**Version:** v0.9.6
**Date:** February 14, 2026
**Engine:** React + Three.js + Cannon.js + Gemini 3.0

## 1. Core Concept: The "Cognitive Bridge"
This project demonstrates a "Cognitive Bridge" where **Generative Intelligence** (Strategic Brain) communicates with a **Kinetic Engine** (Monte Carlo Imagination) to navigate unknown environments.

- **Dream Layer**: AI predicts a safe route based on visuals.
- **Imagination Layer**: Monte Carlo simulates the physics of that dream.
- **Action Layer**: The rover executes verified trajectories.

---

## Technical Stack
- **Core:** React + Vite
- **3D Engine:** Three.js + React Three Fiber
- **Physics:** Cannon-es
- **AI Core:** Google Generative AI SDK
- **Models:**
    - **MAJOR WARNING:** ONLY GEMINI 3 GENERATION MODELS ALLOWED.
    - **MAJOR WARNING:** ONLY GEMINI 3 GENERATION MODELS ALLOWED.
    - **MAJOR WARNING:** ONLY GEMINI 3 GENERATION MODELS ALLOWED.
    - `gemini-3-flash-preview` (Reasoning & Autopilot)
    - `gemini-3-pro-preview` (Strategic Planning)
- **Deployment:** Netlify

## 2. Multi-Agent AI Stack (Level 1 & 2)

### **The STRATEGIC ARCHITECT (The Mapper)**
- **Model:** `gemini-3-flash-preview`.
- **Function:** Analyzes 257x257 Grayscale Topography.
- **Logic:** Identifies hazards (craters, ridges) and provides a dense reasoning report.
- **Strict Protocol:** No heuristics. No cliches. Pure technical analysis.

### **The PHYSICAL SPECIALIST (The Scientist)**
- **Model:** `gemini-3-flash-preview` (Isolated stream).
- **Tactical Autopilot**: Real-time kinetic execution (Gemini 3.5 Flash / Gemini 3.0 Flash). Direct physics control with Kinetic Body Awareness.
- **Monte Carlo Overlay**: Predictive stability visualization (NVIDIA Cosmos Reasoning / NVIDIA Cosmos VL-7B).

## New in v0.8.28
- **AiTrail**: Cyan neon path visualization active only during Autopilot. Confirms AI trajectory in real-time.
- **Sensory Layer (Cognitive Feed)**: Semantic definitions for sCVaR (Stochastic Conditional Value at Risk) and SMaR (Stability Margin at Risk).
  - *sCVaR*:Probability of mission-ending event (0-100). Throttles at >40.
  - *SMaR*: Distance to rollover threshold (meters). Steers away at <10m.
- **Lidar Sensor (v0.8.31)**: 8-directional topographical sweep (5m/10m samples). Provides real-time 3D depth awareness.
- **Spline Adherence**: Autopilot mission logic strictly following Architect's waypoint resolution (7/15/25 pts).

---

## 3. The Physical Layer: MONTE CARLO (Level 3)
- **Engine:** `cannon-es` via Web Workers.
- **Function:** Ground-truth validation.
- **Mechanism:**
    1.  Clones the rover into **60 parallel futures**.
    2.  Projects movement 3.0s ahead with stochastic noise.
    3.  Calculates **sCVaR** (Worst-case severity) and **SMaR** (Safety buffer).
- **Transparency:** The terminal logs any discrepancy between AI "hopes" and Physics "reality."

---

## 4. Operational Transition (v0.8.0+)
- **Manual Mode**: Direct human control with MC visuals (Co-Pilot).
- **Autopilot (Strategic)**: The rover follows the ARCHITECT's path while the MC Engine throttles speed based on real-time sCVaR.
- **AI Autopilot (Planned)**: An end-to-end AI driver that uses the MC fan as direct feedback to stay in "Green" futures.

---

## 5. Development Progress

- **Completed:**
    - [x] Multi-Agent AI Role Separation (Architect/Specialist).
    - [x] Terminal Support for Grayscale Topology Images.
    - [x] Elimination of "Manual/Heuristic" fallbacks in strategic mode.
    - [x] High-density reasoning logs (Raw AI thoughts).
    - [x] Risk Metrics (sCVaR/SMaR) synchronization.

- **Incoming:**
    - [x] **AI-Driven Autopilot**: Dynamic steering based on MC fan and inertial reasoning (Cognitive).
    - [ ] **NVIDIA Cosmos Reasoning**: Integration of the edge-calculus server.

---

## 6. Maintenance & Dev Workflow

**Safety Protocol:**
- DO NOT use older Gemini models (1.5).
- DO NOT implement heuristic shortcuts to "fake" AI progress. 
- ALWAYS log raw AI responses to ensure transparency.

**Version Tagging:**
- Updated in `HUD.jsx` and `store.js`. Current: **v0.8.4-alpha**.

---
**Restoration Guide:**
Follow coordinates in `STRATEGIC_PLANNER_MODE_RU.md` for specific AI prompting protocols.
