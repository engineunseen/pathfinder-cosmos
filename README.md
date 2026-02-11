# LUNAR RISK: MONTE CARLO PATHFINDER

A high-fidelity 3D simulation game demonstrating the superiority of Monte Carlo risk assessment over human intuition in autonomous lunar driving.

Built with **React Three Fiber**, **Cannon.js**, and **Web Workers** for high-performance physics simulation.

![Lunar Risk Concept](https://repository-images.githubusercontent.com/placeholder/lunar-risk.png)

## 🚀 Features

- **Procedural Lunar Terrain**: Infinite variations of Moon landscape with craters, rim lips, and scattered rocks.
- **Realistic Physics**: 6-wheel independent suspension rover simulation with lunar gravity (1.62 m/s²).
- **Monte Carlo AI**: Real-time trajectory prediction engine that simulates 50+ possible futures per second in a Web Worker to visualize risk.
- **Cyber-Lunar HUD**: NVIDIA Drive / SpaceX inspired interface with real-time telemetry.
- **Dual Mode**:
  - **Manual Mode**: High-risk driving where intuition fails on crater rims.
  - **AI Assist Mode**: Visualizes "Ghost Lines" (Green=Safe, Red=Rollover) to guide the driver.

## 🎮 Controls

### Desktop
- **WASD / Arrows**: Drive and Steer
- **Space**: Handbrake
- **M**: Toggle AI / Manual Mode
- **Mouse Drag**: Orbit Camera
- **Mouse Scroll**: Zoom

### Mobile
- **Virtual Joystick**: Drive and Steer (Left side)
- **Touch Drag**: Orbit Camera (Right side)
- **AI SCAN**: Toggle AI Mode
- **BRAKE**: Stop

## 🛠️ Technology Stack

- **Framework**: React + Vite
- **3D Engine**: Three.js / React Three Fiber
- **Physics**: Cannon.js (@react-three/cannon)
- **Optimization**: Web Workers for multi-threaded Monte Carlo simulation
- **Styling**: Cyberpunk HUD with CSS Modules / Styled Components logic
- **Internationalization**: English, Russian, Chinese support built-in

## 📦 Installation & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser.

## 🧪 Simulation Details

The core of this project is the **Monte Carlo Prediction Engine**. Instead of relying on heuristic rules ("slow down if slope > 30°"), the AI:
1. Captures the rover's current physics state (position, velocity, rotation).
2. Spawns 50+ parallel simulation threads.
3. Applies random control noise (steering/throttle variations) to each thread.
4. Steps the physics forward for 3 seconds.
5. Counts how many futures result in a rollover or crash.
6. Visualizes the aggregate risk as color-coded trajectories.

This proves that **simulation > statistics** in chaotic environments.
