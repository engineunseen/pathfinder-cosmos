# UNSEEN PATHFINDER: Autonomous Lunar Risk-Response System (v1.8.8)
**NVIDIA Cosmos Cookoff Official Submission**

## 🚀 Overview
**Unseen Pathfinder** is a state-of-the-art Physical AI simulation demonstrating the synergy between high-level reasoning and low-level physics validation. Designed for autonomous lunar exploration, it uses **NVIDIA Cosmos Reason 2** to navigate high-risk planetary terrains where human teleoperation is impossible.

Built with **React Three Fiber**, **Cannon.js**, and powered by the **NVIDIA Cosmos Physical AI stack**.

## 🧠 Powered by NVIDIA Cosmos Reason 2
This project is built for the **Cosmos Cookoff** challenge. It utilizes Cosmos Reason 2 as the central "Robot Brain" for:
- **Semantic Terrain Reasoning**: Analyzing visual heightmaps to understand physical topography.
- **Autonomous Decision Making**: Real-time tactical control (steering/throttle) based on multimodal sensor data.
- **Physical Plausibility**: Bridging the gap between physics-based Monte Carlo simulations and semantic mission directives.

## ✨ Key Features
- **Cosmos AI Architect**: Automated strategic route planning that "reasons" about the landscape (craters, basalt slopes, ridges).
- **Monte Carlo Risk Engine**: Real-time simulation of 500+ trajectories to calculate **sCVaR** (Risk Severity) and **SMaR** (Safety Margin).
- **Physical AI Physics**: 6-wheel independent suspension rover with realistic lunar gravity (1.62 m/s²) and dynamic regolith (dust) displacement.
- **Cinematic Visuals**: NASA-inspired rendering of Earth, Sun, and stars with Apollo 16 style dust physics.
- **X-Ray Analysis Mode**: Specialized view for path validation and structural terrain analysis.

## 🛠️ Technology Stack
- **Framework**: React + Vite
- **3D Engine**: Three.js / React Three Fiber
- **Reasoning AI**: NVIDIA Cosmos Reason 2
- **Physics**: Cannon.js (@react-three/cannon)
- **Simulations**: Multi-threaded Web Workers

## 🕹️ Controls
- **WASD / Arrows**: Manual Driving (Manual Mode)
- **M**: Toggle **Cosmos Autopilot**
- **P**: Request **Cosmos Strategic Planning** (AI Architect)
- **N**: Toggle Navigation Risk Overlay (Monte Carlo)
- **Space**: Handbrake
- **R**: Regenerate Lunar Terrain (New Seed)

## 🧪 Deployment Instructions
1. **Clone the project**:
   ```bash
   git clone https://github.com/engineunseen/pathfinder
   cd pathfinder
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure API**:
   Open the application in your browser, go to the **SETTINGS HUD**, and enter your **NVIDIA API Key** to enable Cosmos Reason 2 features.
4. **Run Development Server**:
   ```bash
   npm run dev
   ```
5. **Open Browser**:
   Navigate to `http://localhost:5173`.

---
**Lead Developer:** Andrew Turtsevych  
**Project:** [Unseen Engine](https://unseenvision.netlify.app/)  
**Submission Date:** February 2026  
