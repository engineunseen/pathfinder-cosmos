# How to Run LUNAR RISK

## Prerequisites
- Node.js (v18 or higher recommended)
- A modern web browser (project uses WebGL 2.0 and Web Workers)

## Quick Start

1.  **Open a terminal** in this folder:
    `G:\atArticles_2026\2026_02_11_Lunar_Risk`

2.  **Install dependencies** (if you haven't already):
    ```bash
    npm install
    ```

3.  **Start the Simulation**:
    ```bash
    npm run dev
    ```

4.  **Open the App**:
    Go to `http://localhost:5173/` in your browser.

## Features to Test

1.  **Manual Driving**: Use **WASD** to drive around. Notice how easy it is to flip over on crater rims. The lunar gravity makes the rover floaty and dangerous.
2.  **Toggle AI**: Press **M** or click the "Monte Carlo Assist" switch at the bottom.
3.  **Observe Predictions**:
    -   **Green Lines**: Safe paths.
    -   **Red Lines**: Paths that will result in a rollover.
    -   **Glowing Effect**: The lines use HDR colors to glow against the black sky.
4.  **Mission**: Drive to the **Earth Beacon** (the cyan/green holographic marker under the Earth).

## Troubleshooting

-   **Performance**: If the simulation lags, close other browser tabs. The AI runs in a separate thread (Web Worker) to keep the framerate high.
-   **Mobile**: The app works on phones with virtual touch joysticks.
-   **Browser Support**: Chrome/Edge/Firefox recommended for best Web Worker support.

## Project Structure

-   `src/components/Rover.jsx`: Physics vehicle logic.
-   `src/monteCarlo.worker.js`: The AI brain (calculates 80 trajectories/frame).
-   `src/terrain.js`: Procedural Moon generation.
-   `src/store.js`: Global state (Redux-like simplified pattern).

Enjoy the void! 🌑
