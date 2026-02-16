// monteCarlo.worker.js — Web Worker for asynchronous trajectory prediction
// This runs in a separate thread to keep the main FPS high

const LUNAR_GRAVITY = 1.62;
const PREDICTION_HORIZON = 6.0; // Increased for better foresight (brake distance)
const PREDICTION_STEPS = 35; // Better curve resolution
const MONTE_CARLO_SAMPLES = 60; // Balanced quality/speed

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
        terrainData = payload;
    }

    if (type === 'RUN_SIMULATION') {
        if (!terrainData) return;
        const { roverState, isAutopilot } = payload;
        const results = runSimulation(roverState, isAutopilot);
        self.postMessage({ type: 'SIMULATION_RESULTS', payload: results });
    }
};

function runSimulation(state, isAutopilot) {
    const {
        position,    // [x, y, z]
        velocity,    // [vx, vy, vz]
        rotation,    // [pitch, yaw, roll]
        steerAngle,
        throttle,
        targetPos,   // Added for autopilot heuristic
    } = state;

    const trajectories = [];
    const dt = PREDICTION_HORIZON / PREDICTION_STEPS;
    const rng = seededRandom(Date.now());

    // Metrics collection
    const severityScores = []; // For sCVaR
    const margins = [];        // For SMaR

    for (let sample = 0; sample < MONTE_CARLO_SAMPLES; sample++) {
        let simSteer, simThrottle;

        if (isAutopilot) {
            // EXPLORATION: Wide forward-only fan for autopilot visualization
            simSteer = (rng() - 0.5) * 2.5; // Wide steering exploration
            simThrottle = 0.3 + rng() * 0.7; // Forward only [0.3, 1.0]
        } else {
            // PREDICTION: Noise around current user input
            const steerVariation = (rng() - 0.5) * 2.5; // Wider fan (±1.25 rad spread ~ ±70 deg)
            const throttleVariation = (rng() - 0.5) * 0.2;
            simSteer = steerAngle + steerVariation;
            simThrottle = throttle + throttleVariation;
        }

        const path = [];
        let px = position[0];
        let py = position[1];
        let pz = position[2];
        let vx = velocity[0] || 0; // Guard against NaN
        let vy = velocity[1] || 0;
        let vz = velocity[2] || 0;
        let yaw = rotation[1];
        let pitch = rotation[0];
        let rollAngle = rotation[2];

        let risk = 'safe';
        let maxTilt = 0;
        let minSafetyMargin = 999; // Degrees until rollover (approx)

        for (let step = 0; step < PREDICTION_STEPS; step++) {
            const speed = Math.sqrt(vx * vx + vz * vz);

            // Simplified bicycle model
            yaw += simSteer * speed * dt * 0.2;
            const fwdX = -Math.sin(yaw);
            const fwdZ = -Math.cos(yaw);

            // Driving force (Linked to Rover.jsx: Mass 150, Force 120 => Accel ~0.8)
            const forceAccel = simThrottle * 0.8;
            vx += fwdX * forceAccel * dt;
            vz += fwdZ * forceAccel * dt;

            // Resistance (Linked to Rover.jsx: linearDamping 0.15)
            // Cannon damping approximation: v *= (1 - damping * dt)
            const dampingFactor = Math.max(0, 1 - 0.15 * dt);
            vx *= dampingFactor;
            vz *= dampingFactor;

            // Integration
            px += vx * dt;
            pz += vz * dt;
            vy -= LUNAR_GRAVITY * dt;
            py += vy * dt;

            // Terrain interaction
            const terrainHeight = getHeightAtPosition(terrainData.heightData, terrainData.size, terrainData.segments, px, pz);
            if (py < terrainHeight + 0.5) {
                py = terrainHeight + 0.5;
                vy = 0;
                const normal = getNormalAtPosition(terrainData.heightData, terrainData.size, terrainData.segments, px, pz);
                pitch = pitch * 0.5 + Math.asin(-normal[2]) * 0.5;
                rollAngle = rollAngle * 0.5 + Math.asin(normal[0]) * 0.5;
            }

            // Tilt/Slope limits
            const pDeg = Math.abs(pitch * 180 / Math.PI);
            const rDeg = Math.abs(rollAngle * 180 / Math.PI);
            const currentTilt = Math.max(pDeg, rDeg);
            maxTilt = Math.max(maxTilt, currentTilt);

            const slope = getSlopeAtPosition(terrainData.heightData, terrainData.size, terrainData.segments, px, pz);

            // Risk Assessment
            let distToTarget = 999;
            if (targetPos) {
                distToTarget = Math.sqrt((px - targetPos[0]) ** 2 + (pz - targetPos[2]) ** 2);
            }
            const isNearTarget = distToTarget < 5.0;
            const tiltThreshold = isNearTarget ? 75 : 55; // Relax risk near target
            const slopeThreshold = isNearTarget ? 70 : 50;

            if (currentTilt > tiltThreshold || slope > slopeThreshold) risk = 'critical';
            else if (currentTilt > 20 || slope > 20) {
                if (risk !== 'critical') risk = 'warning';
            }

            // Update safety margin (how close are we to 60 deg rollover?)
            minSafetyMargin = Math.min(minSafetyMargin, 60 - currentTilt);

            // Boundary
            if (Math.abs(px) > terrainData.size / 2 - 2 || Math.abs(pz) > terrainData.size / 2 - 2) {
                risk = 'critical';
            }

            path.push([px, py + 0.2, pz]);
            if (risk === 'critical') {
                // If it's a TILT risk, set maxTilt to 90. If it's a BOUNDARY risk, just stop.
                if (currentTilt > tiltThreshold || slope > slopeThreshold) {
                    maxTilt = 90;
                    minSafetyMargin = -10;
                }
                break;
            }
        }

        // Calculate progress toward target
        let finalDist = 9999;
        if (targetPos) {
            const dx = px - targetPos[0];
            const dz = pz - targetPos[2];
            finalDist = Math.sqrt(dx * dx + dz * dz);
        }

        trajectories.push({
            path,
            risk,
            maxTilt,
            input: { throttle: simThrottle, steer: simSteer },
            // Pure fan-based fitness: prefer green paths that get closer to target
            fitness: (risk === 'safe' ? 2000 : risk === 'warning' ? 500 : -10000) - finalDist
        });

        severityScores.push(maxTilt); // Simplified severity for now
        margins.push(minSafetyMargin);
    }

    // --- Calculate sCVaR and SMaR ---
    // sCVaR_alpha (alpha = 0.95): Average of worst 5% severities
    severityScores.sort((a, b) => b - a); // Descending
    const cutoffIndex = Math.ceil(severityScores.length * 0.05);
    let sCVaRSum = 0;
    for (let i = 0; i < cutoffIndex; i++) sCVaRSum += severityScores[i];
    const sCVaR = (cutoffIndex > 0) ? (sCVaRSum / cutoffIndex) : 0;

    // SMaR_alpha (alpha = 0.95): 5th percentile safety margin
    margins.sort((a, b) => a - b); // Ascending
    const smarIndex = Math.floor(margins.length * 0.05);
    const SMaR = margins[smarIndex] || 0;

    // Return extended results
    return {
        trajectories,
        metrics: {
            sCVaR: sCVaR.toFixed(1),
            SMaR: SMaR.toFixed(1)
        }
    };
}
