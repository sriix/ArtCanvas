const videoElement = document.getElementById('input_video');
const outputCanvas = document.getElementById('output_canvas');
const outputCtx = outputCanvas.getContext('2d');
const drawingCanvas = document.getElementById('drawing_canvas');
const drawCtx = drawingCanvas.getContext('2d');

const virtualCursor = document.getElementById('virtual_cursor');
const gestureHud = document.getElementById('gesture_status');
const gestureEmoji = document.getElementById('gesture_emoji');
const gestureText = document.getElementById('gesture_text');

const introScreen = document.getElementById('intro_screen');
const sidebar = document.getElementById('ui_layer_right');

// UI Elements
const colorBtns = document.querySelectorAll('.color-swatch');
const thicknessSlider = document.getElementById('thickness_slider');
const glowSlider = document.getElementById('glow_slider');
const drawBtn = document.getElementById('draw_btn');
const eraseBtn = document.getElementById('erase_btn');
const panBtn = document.getElementById('pan_btn');
const clearBtn = document.getElementById('clear_btn');
const allTools = [drawBtn, eraseBtn, panBtn];

let initialized = false;

// VECTOR STATE
let state = {
    color: '#00f0ff',
    thickness: parseInt(thicknessSlider.value),
    glowVal: parseInt(glowSlider.value),
    tool: 'draw', 
    
    isGrabbing: false,
    dragAction: null,
    
    allStrokes: [],
    currentStroke: null,
    draggedStroke: null,
    
    cursorPt: null,
    canvasPt: null,
    lastScreenPt: null,
    
    dropFrames: 0,
    lastGesture: 'hover'
};

// Canvas Init
function resizeCanvases() {
    outputCanvas.width = window.innerWidth;
    outputCanvas.height = window.innerHeight;
    
    drawingCanvas.width = window.innerWidth;
    drawingCanvas.height = window.innerHeight;
    drawingCanvas.style.left = `0px`;
    drawingCanvas.style.top = `0px`;
    drawingCanvas.style.transform = `scaleX(-1)`;
    
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
}
window.addEventListener('resize', resizeCanvases);
resizeCanvases();

// UI Logic
function setTool(toolName, btn) {
    state.tool = toolName;
    allTools.forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
}

function setColor(c, btn) {
    state.color = c;
    setTool('draw', drawBtn); 
    virtualCursor.style.setProperty('--btn-color', c);
    colorBtns.forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
}

// Fallback click listeners
colorBtns.forEach(btn => btn.addEventListener('click', () => setColor(btn.dataset.color, btn)));
drawBtn.addEventListener('click', () => setTool('draw', drawBtn));
eraseBtn.addEventListener('click', () => setTool('erase', eraseBtn));
panBtn.addEventListener('click', () => setTool('pan', panBtn));
clearBtn.addEventListener('click', () => { state.allStrokes = []; });

// Hands Setup
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.65
});

function calculateDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function isPointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

hands.onResults((results) => {
    outputCtx.save();
    outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    outputCtx.drawImage(results.image, 0, 0, outputCanvas.width, outputCanvas.height);

    if (!initialized) {
        introScreen.classList.add('hidden');
        sidebar.style.opacity = '1';
        sidebar.style.pointerEvents = 'auto';
        gestureHud.style.opacity = '1';
        initialized = true;
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        drawConnectors(outputCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(255,255,255,0.2)', lineWidth: 1});
        drawLandmarks(outputCtx, landmarks, {color: state.color, lineWidth: 1, radius: 2});

        const wrist = landmarks[0];
        const indexTip = landmarks[8], thumbTip = landmarks[4];
        
        // Physics logic bounds
        const isIndexUp = calculateDistance(indexTip, wrist) > calculateDistance(landmarks[6], wrist);
        const isMiddleUp = calculateDistance(landmarks[12], wrist) > calculateDistance(landmarks[10], wrist);
        const isRingUp = calculateDistance(landmarks[16], wrist) > calculateDistance(landmarks[14], wrist);
        const isPinkyUp = calculateDistance(landmarks[20], wrist) > calculateDistance(landmarks[18], wrist);
        
        const pinchDist = calculateDistance(thumbTip, indexTip);
        const isPinching = pinchDist < 0.05;
        
        let baseGesture = 'hover';
        if (isPinching) {
            baseGesture = 'grab';
        } else if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
            baseGesture = 'draw';
        }

        // Anti-Stutter Smoothing
        if (baseGesture !== 'draw' && state.lastGesture === 'draw' && state.dropFrames < 5) {
            baseGesture = 'draw'; 
            state.dropFrames++;
        } else if (baseGesture === 'draw') {
            state.dropFrames = 0;
        } else {
            state.dropFrames = 5;
        }
        state.lastGesture = baseGesture;
        let currentGesture = baseGesture;

        // Coordinates
        const cx = currentGesture === 'grab' ? (indexTip.x + thumbTip.x)/2 : indexTip.x;
        const cy = currentGesture === 'grab' ? (indexTip.y + thumbTip.y)/2 : indexTip.y;
        
        const rawScreenX = (1 - cx) * window.innerWidth;
        const rawScreenY = cy * window.innerHeight;
        
        const rawDrawX = cx * window.innerWidth; 
        const rawDrawY = cy * window.innerHeight;

        if (!state.cursorPt) {
            state.cursorPt = { x: rawScreenX, y: rawScreenY };
            state.canvasPt = { x: rawDrawX, y: rawDrawY };
        } else {
            const alpha = 0.45; 
            state.cursorPt.x += alpha * (rawScreenX - state.cursorPt.x);
            state.cursorPt.y += alpha * (rawScreenY - state.cursorPt.y);
            state.canvasPt.x += alpha * (rawDrawX - state.canvasPt.x);
            state.canvasPt.y += alpha * (rawDrawY - state.canvasPt.y);
        }

        const screenX = state.cursorPt.x;
        const screenY = state.cursorPt.y;
        const drawX = state.canvasPt.x;
        const drawY = state.canvasPt.y;

        virtualCursor.style.display = 'flex';
        virtualCursor.style.left = `${screenX}px`;
        virtualCursor.style.top = `${screenY}px`;
        virtualCursor.className = `virtual-cursor ${currentGesture}`;

        const inToolbarZone = screenX > window.innerWidth - 130;

        // --- ACTIONS ---
        if (currentGesture === 'draw') {
            state.isGrabbing = false;
            
            if (!inToolbarZone && state.tool !== 'pan') {
                if (!state.currentStroke) {
                    state.currentStroke = {
                        type: state.tool, 
                        color: state.color,
                        thickness: state.thickness,
                        glow: state.glowVal,
                        points: [],
                        offsetX: 0,
                        offsetY: 0
                    };
                    state.allStrokes.push(state.currentStroke);
                }
                state.currentStroke.points.push({x: drawX, y: drawY});
            } else {
                state.currentStroke = null;
            }

            let emoji = state.tool === 'erase' ? '🩹' : '☝️';
            updateHUD('', emoji, state.tool === 'erase' ? 'Erasing' : 'Drawing');
        }
        
        else if (currentGesture === 'grab') {
            state.currentStroke = null;

            if (!state.isGrabbing) {
                state.isGrabbing = true;
                state.dragAction = null;
                let hitUI = false;

                colorBtns.forEach(btn => {
                    if(isPointInRect(screenX, screenY, btn.getBoundingClientRect())) {
                        setColor(btn.dataset.color, btn); hitUI = true;
                    }
                });

                if(isPointInRect(screenX, screenY, drawBtn.getBoundingClientRect())){ setTool('draw', drawBtn); hitUI=true;}
                if(isPointInRect(screenX, screenY, eraseBtn.getBoundingClientRect())){ setTool('erase', eraseBtn); hitUI=true;}
                if(isPointInRect(screenX, screenY, panBtn.getBoundingClientRect())){ setTool('pan', panBtn); hitUI=true;}
                if(isPointInRect(screenX, screenY, clearBtn.getBoundingClientRect())){ 
                    state.allStrokes = []; hitUI=true;
                }

                if(isPointInRect(screenX, screenY, thicknessSlider.getBoundingClientRect())) { state.dragAction = 'thickness'; hitUI = true; }
                if(isPointInRect(screenX, screenY, glowSlider.getBoundingClientRect())) { state.dragAction = 'glow'; hitUI = true; }

                if (!hitUI && state.tool === 'pan') {
                    // Reverse iterate to grab the top-most stroke
                    let minDist = 50; 
                    let grabbed = null;
                    
                    for (let i = state.allStrokes.length - 1; i >= 0; i--) {
                        let obj = state.allStrokes[i];
                        if (obj.type === 'erase') continue; 
                        
                        for (let p of obj.points) {
                            let physicalX = window.innerWidth - (p.x + obj.offsetX); 
                            let physicalY = p.y + obj.offsetY;
                            
                            let dist = Math.hypot(screenX - physicalX, screenY - physicalY);
                            if (dist < minDist) {
                                minDist = dist;
                                grabbed = obj;
                                break; 
                            }
                        }
                        if (grabbed) break; 
                    }
                    
                    if (grabbed) {
                        state.dragAction = 'drag_stroke';
                        state.draggedStroke = grabbed;
                    }
                }

            } else {
                // Dragging sliders
                if (state.dragAction === 'thickness' || state.dragAction === 'glow') {
                    let slider = state.dragAction === 'thickness' ? thicknessSlider : glowSlider;
                    let rect = slider.getBoundingClientRect();
                    
                    let p = (rect.bottom - screenY) / rect.height;
                    p = Math.max(0, Math.min(1, p));
                    
                    let min = parseInt(slider.min), max = parseInt(slider.max);
                    let val = Math.floor(min + p * (max - min));
                    
                    slider.value = val;
                    if (state.dragAction === 'thickness') { 
                        state.thickness = val; 
                        document.getElementById('size_val').innerText = val + 'px';
                    } else { 
                        state.glowVal = val; 
                        document.getElementById('glow_val').innerText = val + '%';
                    }
                } 
                else if (state.dragAction === 'drag_stroke' && state.draggedStroke) {
                    if (state.lastScreenPt) {
                        // Remember canvas is flipped, so moving hand right (screenX increases) 
                        // means object moves visually right, which means canvas coordinate shifts 
                        state.draggedStroke.offsetX -= (screenX - state.lastScreenPt.x);
                        state.draggedStroke.offsetY += (screenY - state.lastScreenPt.y);
                    }
                }
            }
            updateHUD('', '🤏', 'Grabbing');

        } else {
            state.currentStroke = null;
            state.isGrabbing = false;
            updateHUD('', '⏳', 'Hovering');
        }

        state.lastScreenPt = {x: screenX, y: screenY};

    } else {
        virtualCursor.style.display = 'none';
        state.isGrabbing = false;
        state.currentStroke = null;
        state.cursorPt = null;
        state.canvasPt = null;
        updateHUD('', '✖️', 'No Hand');
    }
    outputCtx.restore();

    // --- VECTOR RENDER ENGINE ---
    drawCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    
    state.allStrokes.forEach(stroke => {
        if (stroke.points.length < 2) {
            // Draw a single dot if stroke is just one point
            if (stroke.points.length === 1 && stroke.type !== 'erase') {
                drawCtx.beginPath();
                drawCtx.arc(stroke.points[0].x + stroke.offsetX, stroke.points[0].y + stroke.offsetY, stroke.thickness/2, 0, Math.PI*2);
                drawCtx.fillStyle = stroke.color;
                drawCtx.fill();
            }
            return;
        }

        drawCtx.beginPath();
        let p0 = stroke.points[0];
        drawCtx.moveTo(p0.x + stroke.offsetX, p0.y + stroke.offsetY);
        
        for (let i = 1; i < stroke.points.length - 2; i++) {
            let p1 = stroke.points[i];
            let p2 = stroke.points[i + 1];
            let xc = (p1.x + p2.x) / 2 + stroke.offsetX;
            let yc = (p1.y + p2.y) / 2 + stroke.offsetY;
            drawCtx.quadraticCurveTo(p1.x + stroke.offsetX, p1.y + stroke.offsetY, xc, yc);
        }
        
        let last = stroke.points[stroke.points.length - 1];
        let prev = stroke.points[stroke.points.length - 2];
        if (prev && last) {
            drawCtx.quadraticCurveTo(
                prev.x + stroke.offsetX, prev.y + stroke.offsetY,
                last.x + stroke.offsetX, last.y + stroke.offsetY
            );
        }

        if (stroke.type === 'erase') {
            drawCtx.globalCompositeOperation = 'destination-out';
            drawCtx.lineWidth = stroke.thickness * 4;
            drawCtx.shadowBlur = 0;
            drawCtx.strokeStyle = "rgba(0,0,0,1)";
        } else {
            drawCtx.globalCompositeOperation = 'source-over';
            drawCtx.strokeStyle = stroke.color;
            drawCtx.lineWidth = stroke.thickness;
            if (stroke.glow > 0) {
                drawCtx.shadowColor = stroke.color;
                drawCtx.shadowBlur = stroke.glow;
            } else {
                drawCtx.shadowBlur = 0;
            }
        }
        drawCtx.stroke();
    });
});

function updateHUD(glowClass, emoji, text) {
    gestureHud.className = `gesture-hud`; 
    gestureEmoji.innerText = emoji;
    gestureText.innerText = text;
}

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280, height: 720
});
camera.start();
