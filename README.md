# Pathfinder: Autonomous Lunar Navigation with NVIDIA Cosmos Reason 2
**NVIDIA Cosmos Cookoff – Official Submission**

🔗 **Live Demo:** [cosmos.unseenengine.tech](https://cosmos.unseenengine.tech/)

## 🚀 Overview
**Pathfinder** is a real-time Physical AI simulation demonstrating autonomous lunar rover navigation. A 6-wheeled rover must traverse procedurally generated, hazardous lunar terrain to reach a destination signal — guided entirely by **NVIDIA Cosmos Reason 2**.

The AI analyzes terrain via LIDAR scanning and visual scene capture, reasons about slope gradients and obstacle hazards, and outputs real-time steering/throttle commands — all while compensating for communication latency through predictive state estimation.

Built with **React Three Fiber**, **Cannon.js**, and powered by the **NVIDIA Cosmos Physical AI** reasoning model.

## 🧠 Cosmos Reason 2 Integration
Cosmos Reason 2 serves as the autonomous **"Robot Brain"** — the central decision-making loop:

- **Visual Scene Analysis**: Captures the 3D viewport as a frame, providing the AI with egocentric situational awareness of craters, ridges, and slopes.
- **LIDAR Terrain Reasoning**: 12-sector LIDAR scan data at 5m/10m ranges gives the AI precise topographical hazard detection (gradient spikes, cliff edges, surface instability).
- **Autonomous Tactical Control**: Real-time steering and throttle commands generated through spatial reasoning, not PID loops. Cosmos *explains its intent* — e.g., "reducing speed to prevent rollover ahead of detected slope."
- **Monte Carlo Future Prediction**: The AI receives a summary of 60+ simulated trajectories (safe/warning/critical distribution) to inform its risk-aware decision making.
- **Latency Compensation**: Predictive bearing estimation offsets the ~1-3s AI reasoning latency, preventing oscillation and overshoot.

## ✨ Key Features
- **Physical AI Autopilot**: Cosmos Reason 2 drives the rover autonomously — understanding terrain physics, not just following waypoints.
- **Monte Carlo Visualization**: Real-time visualization of 60+ simulated trajectories showing safe (green), warning (yellow), and critical (red) paths.
- **High-Fidelity Physics**: 6-wheel independent suspension rover with realistic lunar gravity (1.62 m/s²), dynamic regolith dust, and rollover detection.
- **Procedural Terrain Generation**: Multiple terrain modes (Legacy, Naturalist, Ethereal) with configurable resolution for varied challenge scenarios.
- **Cinematic Presentation**: NASA-inspired rendering with Earth, Sun, starfield, chromatic aberration, and Apollo-era dust physics.
- **Full Manual Control**: WASD driving with seamless Manual ↔ Autopilot switching.

## 🛠️ Technology Stack
| Layer | Technology |
|-------|-----------|
| **AI Reasoning** | NVIDIA Cosmos Reason 2 (via NIM / vLLM) |
| **Framework** | React 19 + Vite 7 |
| **3D Engine** | Three.js / React Three Fiber |
| **Physics** | Cannon.js (@react-three/cannon) |
| **Simulation** | Multi-threaded Web Workers (Monte Carlo) |
| **Terrain** | Simplex Noise procedural generation |

## 🕹️ Controls
| Key | Action |
|-----|--------|
| **W/A/S/D** | Manual Driving |
| **Space** | Handbrake |
| **M** | Toggle Cosmos Autopilot |
| **R** | Regenerate Terrain |

## 🧪 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/engineunseen/pathfinder-cosmos
cd pathfinder-cosmos
npm install
```

### 2. Start Cosmos NIM Server
You need a running NVIDIA Cosmos Reason 2 inference server. See [Cosmos Setup Guide](Docs/COSMOS_SETUP_GUIDE.md) for detailed instructions, or use the quick setup script:

```bash
bash Docs/setup_cosmos.sh
```

### 3. Configure & Run
```bash
npm run dev
```
Open [cosmos.unseenengine.tech](https://cosmos.unseenengine.tech/) (or `http://localhost:5173` for local), then:
1. Click the ⚙ Settings gear icon
2. Enter your **NIM Endpoint URL** (e.g., `http://your-gpu-server:8000`)
3. Enter your **NVIDIA API Key**
4. Close settings, press **M** to engage Autopilot

### 4. (Optional) CORS Proxy
If your NIM server doesn't support CORS headers, use the included proxy:
```bash
node proxy.js
```
Then set your NIM URL to `http://localhost:3001` in Settings.

## 📐 Architecture
```
┌─────────────────────────────────────────────┐
│                  Browser                     │
│                                              │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐ │
│  │  Rover   │  │  Monte    │  │  Cosmos   │ │
│  │  Physics  │  │  Carlo   │  │  AI Loop  │ │
│  │ (Cannon) │  │ (Worker)  │  │           │ │
│  └─────┬────┘  └─────┬─────┘  └─────┬─────┘ │
│        │             │              │        │
│        └─────┬───────┘              │        │
│              │                      │        │
│        ┌─────▼─────┐         ┌──────▼──────┐ │
│        │ Telemetry │         │  NIM API    │ │
│        │ + LIDAR   │────────►│  (Cosmos    │ │
│        │ + Frame   │         │  Reason 2)  │ │
│        └───────────┘         └─────────────┘ │
└─────────────────────────────────────────────┘
```

## 📋 Cosmos Cookoff Checklist
- ✅ **NVIDIA Cosmos Reason 2** is the core reasoning/decision-making model
- ✅ **Demonstrable integration**: AI controls rover steering/throttle in real-time
- ✅ **Public code repository**: Full source available on GitHub
- ✅ **README**: Setup and usage instructions included
- ✅ **Demo video**: Available (< 3 min)

---
**Developer:** Andrew Turtsevych  
**Project:** [Unseen Engine](https://unseenengine.tech/)  
**Submission:** March 2026
