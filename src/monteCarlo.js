// monteCarlo.js — Monte Carlo trajectory prediction engine
import { getHeightAtPosition, getSlopeAtPosition, getNormalAtPosition } from './terrain';
import { LUNAR_GRAVITY, MONTE_CARLO_SAMPLES, PREDICTION_HORIZON, PREDICTION_STEPS } from './store';

// Simple seeded random for Monte Carlo variations
function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

/**
 * Run Monte Carlo simulation from the rover's current state
 * @param {Object} state - Current rover state
 * @param {Float32Array} heightData - Terrain heightmap
 * @param {Object} terrainInfo - Terrain metadata (size, segments)
 * @returns {Array} Array of trajectory paths with risk classification
 */
export function runMonteCarloSimulation(state, heightData, terrainInfo) {
    const {
        position,    // [x, y, z]
        velocity,    // [vx, vy, vz]
        rotation,    // [pitch, yaw, roll] in radians
        steerAngle,  // current steering
        throttle,    // current throttle
    } = state;

    const trajectories = [];
    const dt = PREDICTION_HORIZON / PREDICTION_STEPS;
    const rng = seededRandom(Date.now());

    for (let sample = 0; sample < MONTE_CARLO_SAMPLES; sample++) {
        // Random variations on control inputs
        const steerVariation = (rng() - 0.5) * 0.8;    // ±0.4 rad steering noise
        const throttleVariation = (rng() - 0.5) * 0.4;  // ±0.2 throttle noise

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

        let risk = 'safe'; // 'safe' | 'warning' | 'critical'
        let maxTilt = 0;

        for (let step = 0; step < PREDICTION_STEPS; step++) {
            // Apply steering to yaw
            const speed = Math.sqrt(vx * vx + vz * vz);
            yaw += simSteer * speed * dt * 0.3;

            // Forward direction
            const fwdX = -Math.sin(yaw);
            const fwdZ = -Math.cos(yaw);

            // Apply throttle force
            const force = simThrottle * 8;
            vx += fwdX * force * dt;
            vz += fwdZ * force * dt;

            // Friction / drag
            vx *= 0.98;
            vz *= 0.98;

            // Update position
            px += vx * dt;
            pz += vz * dt;

            // Get terrain height at new position
            const terrainHeight = getHeightAtPosition(heightData, px, pz);
            const slope = getSlopeAtPosition(heightData, px, pz);
            const normal = getNormalAtPosition(heightData, px, pz);

            // Gravity simulation
            vy -= LUNAR_GRAVITY * dt;
            py += vy * dt;

            // Ground collision
            if (py < terrainHeight + 0.5) {
                py = terrainHeight + 0.5;
                vy = 0;

                // Calculate pitch and roll from terrain normal
                pitch = Math.asin(-normal[2]) * 0.7 + pitch * 0.3;
                rollAngle = Math.asin(normal[0]) * 0.7 + rollAngle * 0.3;
            }

            // Track maximum tilt
            const tiltDeg = Math.max(
                Math.abs(pitch * 180 / Math.PI),
                Math.abs(rollAngle * 180 / Math.PI)
            );
            maxTilt = Math.max(maxTilt, tiltDeg);

            // Classify risk
            if (tiltDeg > 55 || slope > 50) {
                risk = 'critical';
            } else if (tiltDeg > 35 || slope > 35) {
                if (risk !== 'critical') risk = 'warning';
            }

            // Check if out of bounds
            const halfSize = terrainInfo.size / 2;
            if (Math.abs(px) > halfSize || Math.abs(pz) > halfSize) {
                risk = 'critical';
                break;
            }

            path.push([px, py + 0.3, pz]);
        }

        trajectories.push({
            path,
            risk,
            maxTilt,
        });
    }

    return trajectories;
}

/**
 * Generate a danger heatmap for the terrain
 * Projects risk levels onto a grid
 */
export function generateDangerMap(heightData, terrainInfo, gridResolution = 32) {
    const dangerMap = [];
    const cellSize = terrainInfo.size / gridResolution;
    const halfSize = terrainInfo.size / 2;

    for (let iz = 0; iz < gridResolution; iz++) {
        for (let ix = 0; ix < gridResolution; ix++) {
            const worldX = (ix / gridResolution - 0.5) * terrainInfo.size;
            const worldZ = (iz / gridResolution - 0.5) * terrainInfo.size;

            const slope = getSlopeAtPosition(heightData, worldX, worldZ);
            const height = getHeightAtPosition(heightData, worldX, worldZ);

            let danger = 0;
            if (slope > 45) danger = 1.0;       // critical
            else if (slope > 30) danger = 0.6;  // warning
            else if (slope > 15) danger = 0.3;  // mild
            else danger = 0.0;                  // safe

            dangerMap.push({
                x: worldX,
                z: worldZ,
                y: height + 0.1,
                danger,
                size: cellSize,
            });
        }
    }

    return dangerMap;
}
