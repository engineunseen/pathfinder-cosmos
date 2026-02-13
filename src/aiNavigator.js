// aiNavigator.js — AI Navigation System for Unseen Pathfinder
// Architecture:
//   Level 1: STRATEGIST — plans global route (waypoints) from heightmap
//   Level 2: AUTOPILOT  — follows waypoints using MC fan + sCVaR + SMaR
//   Level 3: DATA COLLECTOR — gathers training data (future)
//
// Currently powered by Gemini 2.5 Pro. Designed for future swap to NVIDIA Cosmos.

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// ============================================================
// LEVEL 1: STRATEGIC PLANNER
// Analyzes terrain heightmap and plans a global route (waypoints)
// Called ONCE at mission start
// ============================================================

export async function planStrategicRoute(apiKey, heightmapData, startPos, targetPos, terrainSize) {
    if (!apiKey) {
        console.warn('AI Navigator: No API key. Using direct route.');
        return { waypoints: generateFallbackRoute(startPos, targetPos), quote: "Offline: Using heuristic fallback." };
    }

    // Downsample heightmap for the prompt (full heightmap is too large)
    const sampledMap = downsampleHeightmap(heightmapData, 16); // 16x16 grid

    const prompt = `You are a legendary Lunar Scout AI Strategist (Gemini 3 Pro). Your mission:
1. Plan a tactical route for the rover.
2. Provide an inspirational quote about space or exploration.

TERRAIN DATA (16x16 height grid, values in meters, terrain size: ${terrainSize}m x ${terrainSize}m):
${formatGrid(sampledMap)}

START POSITION: [${startPos[0].toFixed(1)}, ${startPos[2].toFixed(1)}]
TARGET POSITION: [${targetPos[0].toFixed(1)}, ${targetPos[2].toFixed(1)}]

MISSION PARAMETERS:
- DESIGN A CURVY, NON-LINEAR ROUTE. 
- AVOID STRAIGHT LINES.
- Act like an experienced scout: probe the terrain, take wide turns.
- Stay on flat terrain where possible.
- Total waypoints: 7-12.

RESPONSE FORMAT: Respond with ONLY JSON: {"waypoints": [[x1,z1], [x2,z2], ...], "quote": "Inspirational quote here"}`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000,
                }
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('AI Navigator: API error', response.status, errorBody);
            return {
                waypoints: generateFallbackRoute(startPos, targetPos),
                quote: `API ERROR ${response.status}: Navigator Offline`
            };
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Extract JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const result = JSON.parse(jsonMatch[0].replace(/```json|```/g, ''));
                return {
                    waypoints: result.waypoints || generateFallbackRoute(startPos, targetPos),
                    quote: result.quote || "Precision is the key to exploration."
                };
            } catch (pErr) {
                console.error('AI Navigator: JSON parse error', pErr);
            }
        }

        return { waypoints: generateFallbackRoute(startPos, targetPos), quote: "Strategist initialized. Proceed with caution." };
    } catch (err) {
        console.error('AI Navigator: Error planning route', err);
        return { waypoints: generateFallbackRoute(startPos, targetPos), quote: "System error during strategic planning." };
    }
}

// ============================================================
// LEVEL 2: TACTICAL AUTOPILOT
// Issues steer/throttle commands based on current state + fan + metrics
// Called every ~1-2 seconds
// ============================================================

export async function getAutopilotCommand(apiKey, state) {
    const { position, velocity, rotation, currentWaypoint, nextWaypoint,
        fanSummary, sCVaR, SMaR, distToWaypoint } = state;

    // If close enough to current waypoint, advance to next one
    if (distToWaypoint < 5) {
        return { steer: 0, throttle: 0.3, advanceWaypoint: true };
    }

    // If no API key, use simple waypoint-following with MC fan awareness
    if (!apiKey) {
        return getHeuristicCommand(state);
    }

    const prompt = `You are a lunar rover tactical autopilot. Issue driving commands.

CURRENT STATE:
- Position: [${position[0].toFixed(1)}, ${position[2].toFixed(1)}]
- Speed: ${Math.sqrt(velocity[0] ** 2 + velocity[2] ** 2).toFixed(1)} m/s
- Heading: ${(rotation[1] * 180 / Math.PI).toFixed(0)}°

NAVIGATION:
- Current waypoint: [${currentWaypoint[0].toFixed(1)}, ${currentWaypoint[1].toFixed(1)}]
- Distance to waypoint: ${distToWaypoint.toFixed(1)}m

RISK ASSESSMENT (Monte Carlo):
- Fan summary: ${fanSummary}
- sCVaR (severity): ${sCVaR !== undefined ? sCVaR.toFixed(1) : 'N/A'}
- SMaR (safety margin): ${SMaR !== undefined ? SMaR.toFixed(1) : 'N/A'}m

RULES:
- steer: -1.0 (full left) to +1.0 (full right)
- throttle: 0.0 (stop) to 1.0 (full speed)
- If SMaR < 15: reduce throttle significantly
- If sCVaR > 60: reduce throttle to < 0.3
- If fan shows red ahead: steer toward green sector
- Always aim toward current waypoint

RESPOND with ONLY JSON: {"steer": X, "throttle": Y}`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 50,
                }
            })
        });

        if (!response.ok) {
            return getHeuristicCommand(state);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const cmd = JSON.parse(jsonMatch[0]);
            return {
                steer: Math.max(-1, Math.min(1, cmd.steer || 0)),
                throttle: Math.max(0, Math.min(1, cmd.throttle || 0.3)),
            };
        }
        return getHeuristicCommand(state);
    } catch (err) {
        console.error('AI Navigator: Tactical error', err);
        return getHeuristicCommand(state);
    }
}

// ============================================================
// FALLBACK: Heuristic command when API is unavailable
// Simple waypoint-following with MC fan awareness
// ============================================================

function getHeuristicCommand(state) {
    const { position, rotation, currentWaypoint, fanSummary, sCVaR, SMaR } = state;

    // Calculate angle to waypoint
    const dx = currentWaypoint[0] - position[0];
    const dz = currentWaypoint[1] - position[2];
    const targetAngle = Math.atan2(dx, dz);
    const currentAngle = rotation[1];

    let angleDiff = targetAngle - currentAngle;
    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Steer toward waypoint
    const steer = Math.max(-1, Math.min(1, angleDiff * 2));

    // Throttle based on metrics
    let throttle = 0.6;
    if (SMaR !== undefined && SMaR < 25) throttle *= 0.5;
    if (sCVaR !== undefined && sCVaR > 50) throttle *= 0.3;

    // Slow down on sharp turns
    if (Math.abs(angleDiff) > 0.5) throttle *= 0.5;

    return { steer, throttle: Math.max(0.15, throttle) };
}

// ============================================================
// LEVEL 3: DATA COLLECTION (stub for future)
// ============================================================

export function collectTrainingData(missionData) {
    // Future: Store telemetry + MC data + decisions for training
    const dataPoint = {
        timestamp: Date.now(),
        terrain: missionData.terrainSeed,
        route: missionData.waypoints,
        telemetry: missionData.telemetryLog,
        metrics: missionData.metricsLog,
        outcome: missionData.outcome, // 'success' | 'failure'
    };

    // For now, store in localStorage
    try {
        const existing = JSON.parse(localStorage.getItem('pathfinder_training_data') || '[]');
        existing.push(dataPoint);
        // Keep last 50 missions
        if (existing.length > 50) existing.shift();
        localStorage.setItem('pathfinder_training_data', JSON.stringify(existing));
        console.log('AI Navigator: Training data collected. Total missions:', existing.length);
    } catch (e) {
        console.warn('AI Navigator: Could not save training data', e);
    }

    return dataPoint;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function generateFallbackRoute(startPos, targetPos) {
    // Simple straight-line route with midpoints
    const sx = startPos[0], sz = startPos[2];
    const tx = targetPos[0], tz = targetPos[2];

    return [
        [sx, sz],
        [sx + (tx - sx) * 0.25, sz + (tz - sz) * 0.25],
        [sx + (tx - sx) * 0.5, sz + (tz - sz) * 0.5],
        [sx + (tx - sx) * 0.75, sz + (tz - sz) * 0.75],
        [tx, tz]
    ];
}

function downsampleHeightmap(heightData, targetSize) {
    if (!heightData || !heightData.length) return [];
    const srcSize = heightData.length;
    const step = Math.max(1, Math.floor(srcSize / targetSize));
    const result = [];

    for (let i = 0; i < srcSize; i += step) {
        const row = [];
        for (let j = 0; j < (heightData[i]?.length || srcSize); j += step) {
            const val = Array.isArray(heightData[i]) ? heightData[i][j] : heightData[i * srcSize + j];
            row.push(typeof val === 'number' ? Math.round(val * 10) / 10 : 0);
        }
        result.push(row);
    }
    return result;
}

function formatGrid(grid) {
    return grid.map(row => row.join('\t')).join('\n');
}

// Summarize MC fan for the AI prompt
export function summarizeFan(trajectories) {
    if (!trajectories || trajectories.length === 0) return 'No data';

    let safe = 0, warning = 0, critical = 0;
    for (const t of trajectories) {
        if (t.risk === 'safe') safe++;
        else if (t.risk === 'warning') warning++;
        else critical++;
    }

    const total = trajectories.length;
    return `${safe}/${total} safe (green), ${warning}/${total} warning (yellow), ${critical}/${total} critical (red)`;
}
