// monteCarlo.worker.js — Web Worker for asynchronous trajectory prediction
// This runs in a separate thread to keep the main FPS high

// This runs in a separate thread to keep the main FPS high


// We need to duplicate the terrain logic or import it carefully if we want to share code.
// For a worker, it's often safer to have self-contained logic or pass the heightmap data buffer.
// Here we receive the heightmap buffer from the main thread to perform lookups.

const LUNAR_GRAVITY = 1.62;
const PREDICTION_HORIZON = 3.0;
const PREDICTION_STEPS = 20;
const MONTE_CARLO_SAMPLES = 30; // Reduced to prevent frame spikes

let terrainData = null; // { heightData, size, segments }

// Helper: Get height from shared buffer
function getHeightAtPosition(heightData, size, segments, worldX, worldZ) {
    const halfSize = size / 2;
    const normalizedX = (worldX + halfSize) / size;
    const normalizedZ = (worldZ + halfSize) / size;

    if (normalizedX < 0 || normalizedX > 1 || normalizedZ < 0 || normalizedZ > 1) {
        return 0;
    }

    const gridX = normalizedX * segments;
    const gridZ = normalizedZ * segments;

    const ix = Math.floor(gridX);
    const iz = Math.floor(gridZ);
    const fx = gridX - ix;
    const fz = gridZ - iz;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const ix0 = clamp(ix, 0, segments);
    const ix1 = clamp(ix + 1, 0, segments);
    const iz0 = clamp(iz, 0, segments);
    const iz1 = clamp(iz + 1, 0, segments);

    const h00 = heightData[iz0 * (segments + 1) + ix0];
    const h10 = heightData[iz0 * (segments + 1) + ix1];
    const h01 = heightData[iz1 * (segments + 1) + ix0];
    const h11 = heightData[iz1 * (segments + 1) + ix1];

    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    return h0 * (1 - fz) + h1 * fz;
}

// Helper: Get normal
function getNormalAtPosition(heightData, size, segments, worldX, worldZ) {
    const delta = size / segments;
    const hL = getHeightAtPosition(heightData, size, segments, worldX - delta, worldZ);
    const hR = getHeightAtPosition(heightData, size, segments, worldX + delta, worldZ);
    const hD = getHeightAtPosition(heightData, size, segments, worldX, worldZ - delta);
    const hU = getHeightAtPosition(heightData, size, segments, worldX, worldZ + delta);

    const nx = hL - hR;
    const nz = hD - hU;
    const ny = 2 * delta;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return [nx / len, ny / len, nz / len];
}

// Helper: Get slope
function getSlopeAtPosition(heightData, size, segments, worldX, worldZ) {
    const normal = getNormalAtPosition(heightData, size, segments, worldX, worldZ);
    return Math.acos(Math.max(0, Math.min(1, normal[1]))) * (180 / Math.PI);
}

// Simple Mulberry32 seeded random
function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// Message Handler
self.onmessage = function (e) {
    const { type, payload } = e.data;

    if (type === 'SET_TERRAIN') {
        // Receive the large heightmap buffer once
        terrainData = payload; // { heightData: Float32Array, size, segments }
        console.log('[Worker] Terrain data received');
    }

    if (type === 'RUN_SIMULATION') {
        if (!terrainData) return;

        const { roverState } = payload;
        const results = runSimulation(roverState);

        // Send back results
        self.postMessage({ type: 'SIMULATION_RESULTS', payload: results });
    }
};

function runSimulation(state) {
    const {
        position,    // [x, y, z]
        velocity,    // [vx, vy, vz]
        rotation,    // [pitch, yaw, roll]
        steerAngle,
        throttle,
    } = state;

    const trajectories = [];
    const dt = PREDICTION_HORIZON / PREDICTION_STEPS;
    // Use a changing seed for variation
    const rng = seededRandom(Date.now() + Math.random() * 1000);

    for (let sample = 0; sample < MONTE_CARLO_SAMPLES; sample++) {
        // Variations
        // We assume the AI tries to correct the path, or physics uncertainty
        // High variance in steering = uncertainty in traction
        const steerVariation = (rng() - 0.5) * 0.5;
        const throttleVariation = (rng() - 0.5) * 0.2;

        const simSteer = steerAngle + steerVariation;
        const simThrottle = Math.max(-1, Math.min(1, throttle + throttleVariation));

        const path = [];
        let px = position[0];
        let py = position[1];
        let pz = position[2];
        let vx = velocity[0];
        let vy = velocity[1];
        let vz = velocity[2];
        let yaw = rotation[1];
        let pitch = rotation[0];
        let rollAngle = rotation[2];

        let risk = 'safe';
        let maxTilt = 0;

        for (let step = 0; step < PREDICTION_STEPS; step++) {
            // --- Simplified Physics Model (Kinematic) ---

            const speed = Math.sqrt(vx * vx + vz * vz);

            // Steering affects Yaw
            // At higher speeds, steering is more sensitive but traction loss is possible
            // This is a simplified bicycle model
            yaw += simSteer * speed * dt * 0.25;

            const fwdX = -Math.sin(yaw);
            const fwdZ = -Math.cos(yaw);

            // Force
            const force = simThrottle * 12; // Adjusted engine power approximation
            vx += fwdX * force * dt;
            vz += fwdZ * force * dt;

            // Drag/Friction
            vx *= 0.96;
            vz *= 0.96;

            // Position update
            px += vx * dt;
            pz += vz * dt;

            // Gravity
            vy -= LUNAR_GRAVITY * dt;
            py += vy * dt;

            // Terrain Collision
            const terrainHeight = getHeightAtPosition(terrainData.heightData, terrainData.size, terrainData.segments, px, pz);

            if (py < terrainHeight + 0.5) {
                py = terrainHeight + 0.5;
                vy = 0;

                // Orient to normal
                const normal = getNormalAtPosition(terrainData.heightData, terrainData.size, terrainData.segments, px, pz);
                // Simple lerp orientation
                pitch = pitch * 0.5 + Math.asin(-normal[2]) * 0.5;
                rollAngle = rollAngle * 0.5 + Math.asin(normal[0]) * 0.5;
            }

            // Check Tilt Risk
            const pitchDeg = Math.abs(pitch * 180 / Math.PI);
            const rollDeg = Math.abs(rollAngle * 180 / Math.PI);
            maxTilt = Math.max(pitchDeg, rollDeg);

            const slope = getSlopeAtPosition(terrainData.heightData, terrainData.size, terrainData.segments, px, pz);

            if (maxTilt > 55 || slope > 50) risk = 'critical';
            else if (maxTilt > 35 || slope > 35) {
                if (risk !== 'critical') risk = 'warning';
            }

            // Bounds check
            if (Math.abs(px) > terrainData.size / 2 || Math.abs(pz) > terrainData.size / 2) {
                risk = 'critical';
            }

            path.push([px, py + 0.2, pz]);
        }

        trajectories.push({
            path, // Array of [x,y,z]
            risk, // 'safe', 'warning', 'critical'
            maxTilt
        });
    }

    return trajectories;
}
