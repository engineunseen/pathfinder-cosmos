// terrain.js — v3.0.1: Multi-mode terrain (legacy / naturalist / ethereal)
// legacy     = original Pathfinder noise + craters + rocks
// naturalist = smooth rolling hills with blurred craters (no rocks)
// ethereal   = monumental sine waves + sinusoidal craters (no rocks)
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

const smoothstep = (x, edge0, edge1) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
};

// Generate crater data
function generateCraters(rng, count = 15, mode = 'legacy') {
    const craters = [];
    const n = mode === 'ethereal' ? 30 : mode === 'naturalist' ? 18 : count;
    for (let i = 0; i < n; i++) {
        craters.push({
            x: (rng() - 0.5) * TERRAIN_SIZE * (mode === 'legacy' ? 0.85 : 0.9),
            z: (rng() - 0.5) * TERRAIN_SIZE * (mode === 'legacy' ? 0.85 : 0.9),
            radius: 4 + rng() * (mode === 'legacy' ? 14 : 18),
            depth: (mode === 'legacy' ? 1.5 : 2.0) + rng() * (mode === 'legacy' ? 4 : 6),
            rimHeight: (mode === 'legacy' ? 0.5 : 0.8) + rng() * 2.5,
            rimSharpness: 0.3 + rng() * 0.7, // legacy only
            profile: mode === 'ethereal' ? 'sinusoidal' : (rng() > 0.5 ? 'parabolic' : 'sinusoidal'),
        });
    }
    return craters;
}

// Generate rock positions (legacy only)
function generateRocks(rng, count = 60) {
    const rocks = [];
    for (let i = 0; i < count; i++) {
        const scale = 0.3 + rng() * 1.8;
        rocks.push({
            x: (rng() - 0.5) * TERRAIN_SIZE * 0.85,
            z: (rng() - 0.5) * TERRAIN_SIZE * 0.85,
            scale,
            rotationY: rng() * Math.PI * 2,
            type: Math.floor(rng() * 4),
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
// mode: 'legacy' | 'naturalist' | 'ethereal'
export function generateTerrainData(seed, mode = 'legacy') {
    const isCalibration = seed === 999;

    const rng = mulberry32(Math.floor(isCalibration ? 1234 : seed));
    const noise2D = createNoise2D(() => rng());

    const craters = isCalibration ? [] : generateCraters(rng, 15, mode);
    const rocks = (isCalibration || mode !== 'legacy') ? [] : generateRocks(rng);
    const heightData = new Float32Array((TERRAIN_SEGMENTS + 1) * (TERRAIN_SEGMENTS + 1));

    // Build heightmap
    for (let iz = 0; iz <= TERRAIN_SEGMENTS; iz++) {
        for (let ix = 0; ix <= TERRAIN_SEGMENTS; ix++) {
            const worldX = (ix / TERRAIN_SEGMENTS - 0.5) * TERRAIN_SIZE;
            const worldZ = (iz / TERRAIN_SEGMENTS - 0.5) * TERRAIN_SIZE;

            if (isCalibration) {
                heightData[iz * (TERRAIN_SEGMENTS + 1) + ix] = 0;
                continue;
            }

            let height = 0;

            if (mode === 'legacy') {
                // Original: Perlin noise + craters with rim
                height += noise2D(worldX * 0.008, worldZ * 0.008) * 8;
                height += noise2D(worldX * 0.02, worldZ * 0.02) * 3;
                height += noise2D(worldX * 0.06, worldZ * 0.06) * 1;
                height += noise2D(worldX * 0.15, worldZ * 0.15) * 0.3;
                for (const crater of craters) {
                    const dx = worldX - crater.x;
                    const dz = worldZ - crater.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    const nd = dist / crater.radius;
                    if (nd < 2.0) {
                        if (nd < 1.0) height -= crater.depth * (1 - nd * nd);
                        if (nd > 0.7 && nd < 1.5) {
                            const rimFactor = Math.exp(-(Math.abs(nd - 1.0) ** 2) / (crater.rimSharpness * 0.15));
                            height += crater.rimHeight * rimFactor;
                        }
                    }
                }

            } else if (mode === 'naturalist') {
                // Smooth rolling hills — blurred craters, no rocks
                height += noise2D(worldX * 0.007, worldZ * 0.007) * 9.0;
                height += noise2D(worldX * 0.02, worldZ * 0.02) * 2.5;
                for (const crater of craters) {
                    const d = Math.sqrt((worldX - crater.x) ** 2 + (worldZ - crater.z) ** 2);
                    const nd = d / crater.radius;
                    if (nd < 2.5) {
                        if (nd < 1.0) height -= crater.depth * (crater.profile === 'sinusoidal'
                            ? Math.cos(nd * Math.PI) * 0.5 + 0.5
                            : 1.0 - Math.pow(nd, 2.3));
                        const rf = Math.cos(Math.min(1.0, Math.abs(nd - 1.0) * 2.5) * Math.PI) * 0.5 + 0.5;
                        height += crater.rimHeight * rf * (1.0 - smoothstep(nd, 0.7, 1.3));
                    }
                }

            } else if (mode === 'ethereal') {
                // Monumental sine waves + sinusoidal craters
                height = Math.sin(worldX * 0.03) * Math.cos(worldZ * 0.03) * 9 + Math.sin(worldX * 0.09) * 2.5;
                height += noise2D(worldX * 0.015, worldZ * 0.015) * 1.5;
                height += noise2D(worldX * 0.1, worldZ * 0.1) * 0.35;
                for (const crater of craters) {
                    const d = Math.sqrt((worldX - crater.x) ** 2 + (worldZ - crater.z) ** 2);
                    const nd = d / crater.radius;
                    if (nd < 2.0) {
                        if (nd < 1.0) height -= crater.depth * (Math.cos(nd * Math.PI) * 0.5 + 0.5);
                        const rf = Math.cos(Math.min(1.0, Math.abs(nd - 1.0) * 2.0) * Math.PI) * 0.5 + 0.5;
                        height += crater.rimHeight * rf * (1.0 - smoothstep(nd, 0.8, 1.2));
                    }
                }
            }

            heightData[iz * (TERRAIN_SEGMENTS + 1) + ix] = height;
        }
    }

    // Post-processing: blur for naturalist mode
    if (mode === 'naturalist' && !isCalibration) {
        const blurred = new Float32Array(heightData.length);
        const dim = TERRAIN_SEGMENTS + 1;
        for (let iz = 0; iz < dim; iz++) {
            for (let ix = 0; ix < dim; ix++) {
                let sum = 0, count = 0;
                for (let kz = -1; kz <= 1; kz++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const nz = iz + kz, nx = ix + kx;
                        if (nz >= 0 && nz < dim && nx >= 0 && nx < dim) {
                            sum += heightData[nz * dim + nx]; count++;
                        }
                    }
                }
                blurred[iz * dim + ix] = sum / count;
            }
        }
        heightData.set(blurred);
    }

    // Generate Cannon.js heightfield data
    const matrix = [];
    for (let iz = 0; iz <= TERRAIN_SEGMENTS; iz++) {
        const row = [];
        for (let ix = 0; ix <= TERRAIN_SEGMENTS; ix++) {
            row.push(heightData[iz * (TERRAIN_SEGMENTS + 1) + ix]);
        }
        matrix.push(row);
    }

    // Rocks (legacy only)
    const filteredRocks = (isCalibration || mode !== 'legacy') ? [] : rocks.filter((rock) => {
        if (Math.abs(rock.x) < 10 && Math.abs(rock.z) < 10) return false;
        for (const crater of craters) {
            if (Math.sqrt((rock.x - crater.x) ** 2 + (rock.z - crater.z) ** 2) < crater.radius * 0.6) return false;
        }
        return true;
    });

    for (const rock of filteredRocks) {
        rock.y = getHeightAtPosition(heightData, rock.x, rock.z);
    }

    // Target/Spawn positioning
    let beaconX, beaconZ, spawnX, spawnZ;
    if (isCalibration) {
        beaconX = 80; beaconZ = 80;
        spawnX = -80; spawnZ = -80;
    } else {
        const quadrantX = rng() > 0.5 ? 1 : -1;
        const quadrantZ = rng() > 0.5 ? 1 : -1;
        if (mode === 'legacy') {
            beaconX = quadrantX * (65 + rng() * 25);
            beaconZ = quadrantZ * (65 + rng() * 25);
            spawnX = -quadrantX * (70 + rng() * 10);
            spawnZ = -quadrantZ * (70 + rng() * 10);
        } else {
            beaconX = quadrantX * (75 + rng() * 15);
            beaconZ = quadrantZ * (75 + rng() * 15);
            spawnX = -quadrantX * 65;
            spawnZ = -quadrantZ * 65;
        }
    }

    const beaconY = getHeightAtPosition(heightData, beaconX, beaconZ) + 2;

    return {
        heightData,
        matrix,
        craters,
        rocks: filteredRocks,
        beacon: { x: beaconX, y: beaconY, z: beaconZ },
        spawn: { x: spawnX, z: spawnZ },
        size: TERRAIN_SIZE,
        segments: TERRAIN_SEGMENTS,
        elementSize: TERRAIN_SIZE / TERRAIN_SEGMENTS,
        mode,
    };
}
