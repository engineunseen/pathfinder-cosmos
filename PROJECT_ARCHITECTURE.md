# UNSEEN PATHFINDER: Project Architecture & Development Status
**Version:** v0.7.0-alpha
**Date:** February 12, 2026
**Framework:** React + Three.js + Cannon.js (Physics)

## 1. Core Concept & Vision
**"NVIDIA Cosmos / Gemini 2.5 Powered Lunar Navigation System"**

This project is a high-fidelity simulation of a lunar rover's navigation stack. It combines **Generative AI** (Strategic Planning) with **Monte Carlo Physics Simulations** (Tactical Validation) to navigate complex terrain safely.

Goal: Demonstrate how reasoning AI (NVIDIA Cosmos / Gemini 2.5) can control a physical agent in a high-risk environment by using a physics engine as its "imagination" to validate decisions.

---

## 2. Key Metrics (The "Insticts")
The system relies on two critical risk metrics derived from Monte Carlo simulations:

### **sCVaR (Spectral Conditional Value at Risk)**
- **Meaning:** "How bad will it hurt if things go wrong?"
- **Function:** Measures the severity of tail risks (worst-case scenarios).
- **Thresholds:**
    - `0 - 30`: Safe.
    - `30 - 60`: Warning (Impact likely).
    - `> 60`: Critical (High chance of mission failure).
- **Use:** Modulates speed. High sCVaR = Slow down immediately.

### **SMaR (Safety Margin at Risk)**
- **Meaning:** "How close are we to the edge?"
- **Function:** Measures the buffer between the current state and failure (e.g., rollover angle).
- **Thresholds:**
    - `> 35`: Comfortable margin.
    - `15 - 35`: Caution (Approaching limits).
    - `< 15`: Danger (Point of no return).
- **Use:** Modulates aggression. Low SMaR = Gentle steering, no sudden moves.

---

## 3. Architecture Layers

### **Level 1: The STRATEGIST (AI Planner)**
- **Engine:** Google Gemini 2.5 Pro (via API). *Planned upgrade to NVIDIA Cosmos Server.*
- **Input:** 16x16 Downsampled Heightmap + Start Pos + Global Target.
- **Output:** JSON Array of Waypoints (Strategic Route).
- **Function:** "Looks" at the map from above and plans a general path avoiding large obstacles (craters, cliffs).
- **Execution:** Runs ONCE when a new terrain is generated.

### **Level 2: The AUTOPILOT (Tactical AI)**
- **Engine:**
    1.  **AI Navigator (Gemini 2.5 Pro):** Receives current telemetry + fan data + metrics. Outputs specific `{steer, throttle}` commands.
    2.  **Heuristic Fallback:** Used if API key is missing or network fails. Follows strategic waypoints while avoiding "Red" paths in the Monte Carlo fan.
- **Input:**
    - Telemetry (Speed, Pitch, Roll).
    - Strategic Waypoint (Immediate goal).
    - **Monte Carlo Fan:** 60 simulated futures projected 3s ahead.
- **Function:** Executes the strategic plan while reacting to immediate physics realities (slip, rocks, slope).
- **Logic:**
    - "If fan says forward is blocked, try reverse."
    - "If sCVaR is high, crawl."
    - "If SMaR is low, steer gently away from tilt."

### **Level 3: The PHYSICS ENGINE (Monte Carlo Validator)**
- **Engine:** `cannon-es` running in a Web Worker (`monteCarlo.worker.js`).
- **Function:** "Imagination Engine".
- **Process:**
    1.  Takes current rover state.
    2.  Spawns **60 parallel universes** (clones of the rover).
    3.  Applies random noise to controls (Steering ±70°, Throttle ±20%).
    4.  Simulates physics for **3.0 seconds**.
    5.  Evaluates outcomes (Rollover? Stuck? High tilt?).
    6.  Colors trajectories: Green (Safe), Yellow (Warning), Red (Critical).
    7.  Calculates sCVaR and SMaR for the ensemble.

---

## 4. Modes of Operation

1.  **MANUAL (Human Driver)**
    - User controls Rover via WASD/Joystick.
    - **No assistance.** Pure physics.

2.  **MC ASSIST (Co-Pilot)**
    - User controls Rover.
    - **Monte Carlo Fan** is visible, showing future consequences of current input.
    - **HUD** displays real-time sCVaR / SMaR.
    - User optimizes path based on visual feedback ("Don't drive into red lines").

3.  **AUTOPILOT (AI Agent)**
    - **Full Control.** AI takes the wheel.
    - Follows **Strategic Route** (Level 1).
    - Reacts to **Monte Carlo Fan** (Level 3).
    - Modulates speed based on **Metrics**.
    - Capable of **Reverse Maneuvers** to escape dead ends.

---

## 5. Current Development Status (v0.7.0-alpha)

- **Completed:**
    - [x] Full 3D Lunar Environment (Three.js).
    - [x] Realistic Rover Physics (Suspension, friction, gravity).
    - [x] Procedural Terrain Generation (Perlin noise + Rocks).
    - [x] Monte Carlo Engine (Web Worker, 60 samples, 3s horizon).
    - [x] Risk Metrics (sCVaR, SMaR) implementation.
    - [x] Fan Visualization (Green/Yellow/Red trajectories).
    - [x] **AI Navigator Module (`aiNavigator.js`):** Gemini 2.5 Integration.
    - [x] **Settings Panel:** Input for Gemini API Key.
    - [x] **Strategic Planning:** Auto-plans route on map load.
    - [x] **Autopilot Logic:** Follows waypoints + Metrics-aware speed.

- **Next Steps:**
    - [ ] **NVIDIA Cosmos Integration:** Replace Gemini with local/server Cosmos instance.
    - [ ] **Data Collection:** Save "training runs" to fine-tune the Strategist.
    - [ ] **Advanced Strategy:** Re-planning when stuck (currently uses local escape).

---

## 6. How to Run & Recover

**Requirements:** Node.js, NPM.

**Installation:**
```bash
npm install
```

**Run Development Server:**
```bash
npm run dev
```

**Git Workflow:**
- We use iterative commits with semantic versioning tags in `HUD.jsx`.
- Current Version: **v0.7.0-alpha**.

**Recovery Instructions (If Power Lost):**
1.  Check `PROJECT_ARCHITECTURE.md` (this file) to understand the system.
2.  Open `src/aiNavigator.js` to see the AI integration logic.
3.  Open `src/monteCarlo.worker.js` to see the physics/risk engine.
4.  Open `src/App.jsx` to see the control loop (Manual/AI switching).
5.  Restore API Key in HUD Settings (it saves to localStorage).
