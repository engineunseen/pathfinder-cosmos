# Pathfinder — NVIDIA Cosmos Cookoff Submission

## Submission (copy/paste to GitHub Discussion)

### Where to submit
👉 **https://github.com/orgs/nvidia-cosmos/discussions/4**

---

### Text Description (paste as comment)

# Pathfinder: Autonomous Lunar Navigation with NVIDIA Cosmos Reason 2

🔗 **Live Demo:** https://cosmos.unseenengine.tech/
📂 **Source:** https://github.com/engineunseen/pathfinder-cosmos
📹 **Video Demo:** [YOUR YOUTUBE LINK]

## What It Does

Pathfinder is a real-time 3D simulation where NVIDIA Cosmos Reason 2 serves as the autonomous "Robot Brain" for a lunar rover. The rover must navigate procedurally generated hazardous lunar terrain — craters, ridges, slopes — to reach a destination signal, with Cosmos making ALL driving decisions in real-time.

Unlike traditional PID-based autopilots that merely react to sensor data, Pathfinder feeds Cosmos Reason 2 rich multimodal context and receives back **reasoned driving commands with explanations**. The AI doesn't just steer — it *explains why* it steers.

## How Cosmos Reason 2 Is Integrated

Cosmos Reason 2 is the **core decision-making engine** — every steering and throttle command in autopilot mode comes from Cosmos. It receives:

- **Visual Scene Capture**: A viewport frame showing the terrain ahead — providing egocentric situational awareness of craters, ridges, and obstacles
- **12-Sector LIDAR Scan**: Terrain height sampling at 5m and 10m ranges in 30° increments, with automatic hazard classification (DROP, CRATER_EDGE, RIDGE)
- **Monte Carlo Risk Analysis**: Summary of 60 simulated trajectories showing safe vs. critical path distribution
- **Rover Telemetry**: Speed, bearing to target, pitch/roll angles, wheel traction (wheels on ground), and velocity vectors
- **Pre-computed Navigation Defaults**: Bearing-derived steering and throttle suggestions that Cosmos can accept or override based on its reasoning

Cosmos responds with a JSON command containing `steer`, `throttle`, and a `reasoning` explanation — visible in real-time in the system terminal.

## Key Technical Highlights

- **Latency Compensation**: The system predicts the rover's future position and bearing to offset the ~1-3s AI inference latency, preventing oscillation
- **Approach Algorithm**: Three-phase navigation (Cruise → Approach → Final) with progressive deceleration, turn-in-place maneuvering, and reverse capability
- **Multi-threaded Monte Carlo**: 60+ trajectory simulations running in Web Workers for real-time risk visualization
- **Physical AI Physics**: 6-wheel independent suspension, lunar gravity (1.62 m/s²), dynamic regolith dust, and rollover detection
- **Procedural Terrain**: Multiple noise-based terrain generation modes for infinite scenario variety

## Technology Stack

| Layer | Technology |
|-------|-----------|
| AI Reasoning | NVIDIA Cosmos Reason 2 (via NIM / vLLM) |
| Framework | React 19 + Vite 7 |
| 3D Engine | Three.js / React Three Fiber |
| Physics | Cannon.js |
| Simulation | Multi-threaded Web Workers |

## Impact

Autonomous planetary exploration is one of the most challenging problems in physical AI — there's no GPS, no teleoperation (minutes of latency to Earth), and terrain is completely unknown. Pathfinder demonstrates that a reasoning VLM like Cosmos can serve as a credible autonomous navigation agent that:

1. **Understands terrain physics** — not just detecting obstacles, but reasoning about slope gradients and crater edges
2. **Explains its decisions** — critical for mission safety review and debugging
3. **Adapts in real-time** — adjusting speed, steering, and even reversing based on dynamic risk assessment

This approach bridges the gap between traditional reactive autopilots and human-level spatial reasoning for autonomous systems.

---
**Developer:** Andrew Turtsevych

---

## Demo Video Script (< 3 min)

### 0:00 – 0:15 — Hook
*"What if a lunar rover could think about why a path is dangerous, not just detect that it is?"*
Show cinematic wide shot of rover on lunar terrain with Earth in the background.

### 0:15 – 0:45 — The Problem
- Lunar terrain is unpredictable: craters, slopes, ridgelines
- Communication latency makes teleoperation impossible
- Traditional autopilot uses PID — it reacts, it doesn't reason

### 0:45 – 1:30 — Cosmos In Action
- Switch to Autopilot mode (press M)
- Show the AI reasoning log in the terminal: Cosmos explaining WHY it turns
- Show LIDAR panel lighting up with terrain scan
- Show Monte Carlo fan visualizing safe (green) vs dangerous (red) trajectories
- Show the AI Vision Feed overlay (captured frame sent to Cosmos)

### 1:30 – 2:15 — Technical Integration
- Brief overlay showing the architecture: Browser → Telemetry/LIDAR/Frame → NIM API → Cosmos Reason 2 → Steering/Throttle
- Show Settings panel with NIM endpoint configuration
- Mention latency compensation: "The AI predicts where the rover WILL BE when it responds"

### 2:15 – 2:45 — Arrival
- Show rover approaching the destination signal
- Mission Success screen
- Quick terrain regeneration + new run to show variety

### 2:45 – 3:00 — Closing
*"Pathfinder: Reasoning-based autonomy for the final frontier."*
Show GitHub URL on screen.

---

## Submission Checklist
- [ ] Text description (above, paste into GitHub Discussion comment)
- [ ] Demo video (< 3 min, upload to YouTube Unlisted)
- [ ] Public GitHub repo URL: `https://github.com/engineunseen/pathfinder-cosmos`
- [ ] README.md in repo root with setup instructions ✅
- [ ] Cosmos Reason 2 demonstrably integrated into core decision-making loop ✅
- [ ] Graceful offline mode for visitors without GPU ✅

---
**Deadline:** March 5, 2026 — 5:00 PM PT  
**Developer:** Andrew Turtsevych
