# 🎨 ArtCanvas
### Air Drawing with Hand Detection

ArtCanvas is a browser-based prototype that lets you draw, erase, and move strokes in the air using **hand gestures**.  
It uses **MediaPipe Hands** for real-time hand tracking and maps gestures to drawing actions on an HTML5 `<canvas>`.

---

## 📖 Overview
- Detects your hand via webcam.  
- Index finger acts as a **pen** to draw in the air.  
- Pinch gesture (thumb + index) acts as a **grab** to move strokes or interact with UI.  
- Erase mode removes strokes using the index finger.  
- Includes a **toolbar** for color, thickness, glow, and tool selection.  

---

## ✨ Features
- 🖌️ **Draw** with index finger.  
- 🩹 **Erase** strokes with erase tool.  
- 🤏 **Grab & Pan** strokes using pinch gesture.  
- 🎨 **Color & Thickness Controls** via virtual toolbar.  
- 💡 **Glow Effect** slider for brush styling.  
- 🧭 **HUD Feedback** with gesture emoji and status text.  

---

## 🧠 Technologies Used
| Component         | Technology                       |
| ----------------- | -------------------------------- |
| Hand Tracking     | MediaPipe Hands (via CDN)        |
| Interface         | HTML, CSS                        |
| Logic             | JavaScript                       |
| Canvas Rendering  | HTML5 `<canvas>`                 |

---

## 📦 How to Run
1. Clone the repository:
   ```bash
   git clone https://github.com/sriix/ArtCanvas.git
## 📦 How to Run
```bash
2. Open index.html in Chrome (or any modern browser)
3. Allow webcam access when prompted
4. Use gestures to draw, erase, or move strokes in the air

