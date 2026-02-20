# LUNAR RISK: MONTE CARLO PATHFINDER (v0.9.6)

A high-fidelity 3D simulation game demonstrating the superiority of Monte Carlo risk assessment and Generative AI reasoning over human intuition in autonomous lunar driving.

Built with **React Three Fiber**, **Cannon.js**, and **Gemini 3.0 API**.

## 🤖 Powered by Gemini 3.0
**IMPORTANT: THIS PROJECT USES GEMINI 3.0 MODELS ONLY.**
**IMPORTANT: THIS PROJECT USES GEMINI 3.0 MODELS ONLY.**
**IMPORTANT: THIS PROJECT USES GEMINI 3.0 MODELS ONLY.**

We leverage the latest **Gemini 3 Flash** and **Gemini 3 Pro** models for:

## 🚀 Features

- **Procedural Lunar Terrain**: Infinite variations of Moon landscape with craters, rim lips, and scattered rocks.
- **Realistic Physics**: 6-wheel independent suspension rover simulation with lunar gravity (1.62 m/s²).
- **Multi-Agent AI Navigator**:
  - **Strategic Architect**: Analyzes 257x257 topography maps using Gemini 3 Flash to plan safety-first routes.
  - **Scientific Specialist**: Real-time geological and physical analysis of the lunar surface.
- **Monte Carlo Engine**: Real-time trajectory prediction simulating 50+ possible futures per second to visualize sCVaR and SMaR risk metrics.
- **Cyber-Lunar HUD**: Terminal-driven interface showing raw AI reasoning and live telemetry.
- **Strict Transparency**: No heuristic fallbacks. The system is 100% AI-driven; if the AI is offline, mission control receives a fatal status report.

## 🎮 Controls

### Desktop
- **WASD / Arrows**: Drive and Steer
- **Space**: Handbrake
- **M**: Toggle AI / Manual Mode (Autopilot)
- **N**: Request Strategic AI Planning
- **Mouse Drag**: Orbit Camera

## 🛠️ Technology Stack

- **Framework**: React + Vite
- **3D Engine**: Three.js / React Three Fiber
- **AI**: Google Gemini 3.0 (Flash/Pro)
- **Physics**: Cannon.js (@react-three/cannon)
- **Multi-threading**: Web Workers for Monte Carlo simulations

## 🧪 Simulation Architecture

The project demonstrates the synergy between **Generative Reasoning** and **Kinetic Validation**:
1. **STRATEGIST**: Gemini 3 analyzes the landscape and proposed waypoints.
2. **VALIDATOR**: Monte Carlo engine tests 1000s of iterations of those waypoints against the physics engine to calculate **sCVaR** (risk severity) and **SMaR** (safety margin).
3. **ACTUATOR**: The rover executes the vetted plan with high reliability.

This proves that **AI Reasoning + Simulation > Heuristics** in extreme environments.
