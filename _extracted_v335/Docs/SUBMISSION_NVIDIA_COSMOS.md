# UNSEEN PATHFINDER: Autonomous Lunar Risk-Response System
**Submission for NVIDIA Cosmos Cookoff (January 2026)**

## Overview
**Unseen Pathfinder** is a Physical AI system designed for autonomous lunar exploration. It addresses the critical challenge of navigating high-risk, unknown planetary terrains where high-latency communication renders direct human teleoperation impossible. 

The system utilizes **NVIDIA Cosmos Reason 2** to bridge the gap between low-level physics (sensor data) and high-level strategic reasoning, enabling a rover to "see, understand, and act" semi-independently in a 1.62 m/s² gravity environment.

## Key Features
- **Semantic Terrain Vision**: Processes raw 257x257 grayscale heightmaps using Cosmos Reason 2 to identify and reason about topographical hazards (crater rims, basalt basins, slope gradients).
- **Real-Time Monte Carlo Risk Engine**: A "Digital Twin" simulation running 500-1000 parallel trajectories to calculate **SMaR** (Stability Margin at Risk) and **sCVaR** (Specific Conditional Value at Risk).
- **Dual-Layer Reasoning Architecture**:
    - *Strategic Layer (Architect)*: Long-term trajectory planning using Vision-Reasoning.
    - *Tactical Layer (Pilot)*: High-frequency local control using LIDAR/Cosmos integration to manage rover inertia and slip.
- **High-Fidelity Physics Playground**: Custom-built lunar 3D engine with dynamic regolith displacement (dust fountains inspired by Apollo 16 footage) and realistic surface dynamics.

## Technical Implementation with Cosmos Reason 2
Unseen Pathfinder implements Cosmos Reason 2 in two primary workflows:

1. **Strategic VLM Analysis**: 
   The system renders the lunar height data into an egocentric visual map. Cosmos Reason 2 analyzes this map not as a grid of numbers, but as a physical landscape. It explains *why* a specific path is chosen (e.g., "avoiding the basaltic slope to maintain traction"), demonstrating advanced spatial and social-physical reasoning.

2. **Autonomous Robot Brain (Decision Making)**:
   In Autopilot mode, the rover feeds LIDAR data and Monte Carlo safety metrics into the Cosmos reasoning loop. The model acts as the "Captain," making nuanced decisions on throttle and steering. It doesn't just calculate a PID loop; it calculates *intent*, such as "reducing speed to prevent rollover ahead of a detected gradient spike."

## Impact
This project moves the Physical AI field forward by proving that **Reasoning-based Autonomy** can significantly reduce mission failure rates in extreme environments. By combining probabilistic physics (Monte Carlo) with deterministic reasoning (Cosmos), we create a "Physical Plausibility Prediction" system that ensures autonomous robots are not just efficient, but physically safe.

## Deployment Instructions
1. **Clone the Repository**: `git clone https://github.com/engineunseen/pathfinder`
2. **Setup Environment**:
   - Install dependencies: `npm install`
   - Create a `.env` file or use the Settings HUD to provide your NVIDIA API Key (Cosmos SDK).
3. **Run Localization**: `npm run dev`
4. **Access UI**: Open `localhost:5173`. Use the HUD to generate new lunar seeds and engage the **AI ARCHITECT** and **AUTOPILOT**.

---
**Lead Developer:** Andrew Turtsevych  
**Community:** Unseen Engine / Engine Unseen  
**Vision:** Bringing reasoning to the final frontier.
