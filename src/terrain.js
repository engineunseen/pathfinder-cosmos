// terrain.js — Procedural lunar terrain generation with Perlin noise, craters, and rocks
import { createNoise2D } from 'simplex-noise';

const TERRAIN_SIZE = 200;
const TERRAIN_SEGMENTS = 256;

// Creates a seeded PRNG (simple mulberry32)
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Generate crater data
function generateCraters(rng, count = 15) {
    const craters = [];
    for (let i = 0; i < count; i++) {
        craters.push({
            x: (rng() - 0.5) * TERRAIN_SIZE * 0.85,
            z: (rng() - 0.5) * TERRAIN_SIZE * 0.85,
            radius: 4 + rng() * 14,
            depth: 1.5 + rng() * 4,
            rimHeight: 0.5 + rng() * 2.0,
            rimSharpness: 0.3 + rng() * 0.7,
        });
    }
    return craters;
}

// Generate rock positions
function generateRocks(rng, count = 60) {
    const rocks = [];
    for (let i = 0; i < count; i++) {
        const scale = 0.3 + rng() * 1.8;
        rocks.push({
            x: (rng() - 0.5) * TERRAIN_SIZE * 0.85,
            z: (rng() - 0.5) * TERRAIN_SIZE * 0.85,
            scale,
            rotationY: rng() * Math.PI * 2,
            type: Math.floor(rng() * 4), // 0-3 — different rock shapes
        });
    }
    return rocks;
}

// Get height at world position from the heightmap
export function getHeightAtPosition(heightData, worldX, worldZ) {
    const halfSize = TERRAIN_SIZE / 2;
    const normalizedX = (worldX + halfSize) / TERRAIN_SIZE;
    const normalizedZ = (worldZ + halfSize) / TERRAIN_SIZE;

    if (normalizedX < 0 || normalizedX > 1 || normalizedZ < 0 || normalizedZ > 1) {
        return 0;
    }

    const gridX = normalizedX * (TERRAIN_SEGMENTS);
    const gridZ = normalizedZ * (TERRAIN_SEGMENTS);

    const ix = Math.floor(gridX);
    const iz = Math.floor(gridZ);
    const fx = gridX - ix;
    const fz = gridZ - iz;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const ix0 = clamp(ix, 0, TERRAIN_SEGMENTS);
    const ix1 = clamp(ix + 1, 0, TERRAIN_SEGMENTS);
    const iz0 = clamp(iz, 0, TERRAIN_SEGMENTS);
    const iz1 = clamp(iz + 1, 0, TERRAIN_SEGMENTS);

    const h00 = heightData[iz0 * (TERRAIN_SEGMENTS + 1) + ix0];
    const h10 = heightData[iz0 * (TERRAIN_SEGMENTS + 1) + ix1];
    const h01 = heightData[iz1 * (TERRAIN_SEGMENTS + 1) + ix0];
    const h11 = heightData[iz1 * (TERRAIN_SEGMENTS + 1) + ix1];

    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    return h0 * (1 - fz) + h1 * fz;
}

// Get surface normal at world position
export function getNormalAtPosition(heightData, worldX, worldZ) {
    const delta = TERRAIN_SIZE / TERRAIN_SEGMENTS;
    const hL = getHeightAtPosition(heightData, worldX - delta, worldZ);
    const hR = getHeightAtPosition(heightData, worldX + delta, worldZ);
    const hD = getHeightAtPosition(heightData, worldX, worldZ - delta);
    const hU = getHeightAtPosition(heightData, worldX, worldZ + delta);

    const nx = hL - hR;
    const nz = hD - hU;
    const ny = 2 * delta;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return [nx / len, ny / len, nz / len];
}

// Get slope angle in degrees at world position
export function getSlopeAtPosition(heightData, worldX, worldZ) {
    const normal = getNormalAtPosition(heightData, worldX, worldZ);
    return Math.acos(Math.max(0, Math.min(1, normal[1]))) * (180 / Math.PI);
}

// Generate the complete terrain data
export function generateTerrainData(seed) {
    const rng = mulberry32(Math.floor(seed));
    const noise2D = createNoise2D(() => rng());

    const craters = generateCraters(rng);
    const rocks = generateRocks(rng);
    const heightData = new Float32Array((TERRAIN_SEGMENTS + 1) * (TERRAIN_SEGMENTS + 1));

    // Build heightmap
    for (let iz = 0; iz <= TERRAIN_SEGMENTS; iz++) {
        for (let ix = 0; ix <= TERRAIN_SEGMENTS; ix++) {
            const worldX = (ix / TERRAIN_SEGMENTS - 0.5) * TERRAIN_SIZE;
            const worldZ = (iz / TERRAIN_SEGMENTS - 0.5) * TERRAIN_SIZE;

            // Layer 1: Base rolling hills (Perlin noise, multiple octaves)
            let height = 0;
            height += noise2D(worldX * 0.008, worldZ * 0.008) * 8;  // Large hills
            height += noise2D(worldX * 0.02, worldZ * 0.02) * 3;    // Medium bumps
            height += noise2D(worldX * 0.06, worldZ * 0.06) * 1;    // Fine detail
            height += noise2D(worldX * 0.15, worldZ * 0.15) * 0.3;  // Micro detail

            // Layer 2: Craters (subtraction with rim)
            for (const crater of craters) {
                const dx = worldX - crater.x;
                const dz = worldZ - crater.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const normalizedDist = dist / crater.radius;

                if (normalizedDist < 2.0) {
                    if (normalizedDist < 1.0) {
                        // Inside crater — bowl shape
                        const bowlFactor = 1 - normalizedDist * normalizedDist;
                        height -= crater.depth * bowlFactor;
                    }
                    // Rim
                    if (normalizedDist > 0.7 && normalizedDist < 1.5) {
                        const rimDist = Math.abs(normalizedDist - 1.0);
                        const rimFactor = Math.exp(-rimDist * rimDist / (crater.rimSharpness * 0.15));
                        height += crater.rimHeight * rimFactor;
                    }
                }
            }

            heightData[iz * (TERRAIN_SEGMENTS + 1) + ix] = height;
        }
    }

    // Generate Cannon.js heightfield data (rows of columns)
    const matrix = [];
    for (let iz = 0; iz <= TERRAIN_SEGMENTS; iz++) {
        const row = [];
        for (let ix = 0; ix <= TERRAIN_SEGMENTS; ix++) {
            row.push(heightData[iz * (TERRAIN_SEGMENTS + 1) + ix]);
        }
        matrix.push(row);
    }

    // Filter rocks to avoid placing them inside craters or too close to spawn
    const filteredRocks = rocks.filter((rock) => {
        // Don't place rocks near spawn
        if (Math.abs(rock.x) < 10 && Math.abs(rock.z) < 10) return false;
        // Don't place rocks deep inside craters
        for (const crater of craters) {
            const dx = rock.x - crater.x;
            const dz = rock.z - crater.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < crater.radius * 0.6) return false;
        }
        return true;
    });

    // Update rock Y positions based on terrain height
    for (const rock of filteredRocks) {
        rock.y = getHeightAtPosition(heightData, rock.x, rock.z);
    }

    // Generate Earth beacon position — far away and on relatively flat ground
    let beaconX = 70 + rng() * 20;
    let beaconZ = -30 + rng() * 60;
    if (rng() > 0.5) beaconX = -beaconX;
    const beaconY = getHeightAtPosition(heightData, beaconX, beaconZ) + 2;

    return {
        heightData,
        matrix,
        craters,
        rocks: filteredRocks,
        beacon: { x: beaconX, y: beaconY, z: beaconZ },
        size: TERRAIN_SIZE,
        segments: TERRAIN_SEGMENTS,
        elementSize: TERRAIN_SIZE / TERRAIN_SEGMENTS,
    };
}
