// aiNavigator.js — AI Navigation System for Unseen Pathfinder (v3.3.5)
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as THREE from 'three';

const GEMINI_MODEL = "gemini-3-flash-preview";

export const f1 = (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(1) : '0.0');
export const f2 = (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(2) : '0.00');

// ============================================================
// v3.2.0: VISION BRIDGE & FRAME CAPTURE
// ============================================================

/**
 * Captures the current Three.js canvas as a base64 PNG.
 * NOTE: App's Canvas must have gl={{ preserveDrawingBuffer: true }}
 */
export function captureSimulationFrame(gl) {
    try {
        if (!gl || !gl.domElement) return null;
        return gl.domElement.toDataURL('image/png').split(',')[1];
    } catch (e) {
        console.error("Frame capture failed:", e);
        return null;
    }
}

/**
 * Universal Vision Provider to hot-swap between Gemini and NVIDIA Cosmos
 */
export class VisionProvider {
    constructor(config) {
        this.type = config.type || 'gemini'; // 'gemini' | 'cosmos'
        this.apiKey = config.apiKey;
        this.url = config.url; // Required for Cosmos
        this.model = config.model;
    }

    async generateContent(prompt, base64Image) {
        if (this.type === 'gemini') {
            return this._callGemini(prompt, base64Image);
        } else {
            return this._callCosmos(prompt, base64Image);
        }
    }

    async _callGemini(prompt, base64Image) {
        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({
            model: this.model || "gemini-3-flash-preview",
            generationConfig: {
                temperature: this.type === 'autopilot' ? 0.1 : 0.8,
                maxOutputTokens: 2048,
                responseMimeType: this.targetMimeType || "text/plain"
            }
        });

        const content = base64Image
            ? [prompt, { inlineData: { data: base64Image, mimeType: "image/png" } }]
            : [prompt];

        const result = await model.generateContent(content);
        return result.response.text();
    }

    async _callCosmos(prompt, base64Image) {
        if (!this.url) throw new Error("NVIDIA NIM Endpoint URL not configured.");
        // NVIDIA NIM is OpenAI-compatible (v1/chat/completions)
        const endpoint = `${this.url.replace(/\/$/, '')}/v1/chat/completions`;

        const messages = [
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    {
                        type: "image_url",
                        image_url: { url: `data:image/png;base64,${base64Image}` }
                    }
                ]
            }
        ];

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey || 'nv-nim-dummy'}`
            },
            body: JSON.stringify({
                model: "nvidia/cosmos-1-0-reasoning", // Internal NIM model name
                messages: messages,
                max_tokens: 1024,
                temperature: 0.2,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`NVIDIA NIM HTTP ${response.status}: ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

// ============================================================
// LEVEL 1: STRATEGIC PLANNER (Astro-Core Architecture)
// ============================================================

export async function planStrategicRoute(apiKey, heightData, startPos, targetPos, terrainSize, waypointCount, model = 'gemini-3-pro-preview', language = 'EN') {
    if (!apiKey) return { waypoints: [], quote: "FATAL: Navigation SDK Offline.", reasoning: "CRITICAL: Mission Architect cannot initialize.", isAi: false };

    const fullDataUrl = heightmapToImage(heightData);
    const base64Image = fullDataUrl.split(',')[1];
    const halfSize = terrainSize / 2;

    const textPrompt = `You are the STRATEGIC ARCHITECT (Route Planning) & SCIENTIFIC SPECIALIST (Astro-Core).

### 1. STRATEGIC ARCHITECT
Goal: Analyze 257x257 grayscale heightmap and generate a physics-safe trajectory.

MAP SEMANTICS:
- Grayscale Heightmap of 200m x 200m area.
- BRIGHTER pixels = Higher Elevation (Craters rims, basaltic ridges).
- DARKER pixels = Lower Elevation (Cater floors, valleys).

WORLD COORDINATES:
- Center: [0, 0]. Size: ${terrainSize}m. Bounds: [-${halfSize}, ${halfSize}].
- START: [${f1(startPos[0])}, ${f1(startPos[2])}]
- TARGET BEACON: [${f1(targetPos[0])}, ${f1(targetPos[2])}]

MISSION LOGIC:
1. STRATEGIC ANALYSIS: Conduct a deep technical analysis of regolith density and slope variance. 
2. TRAJECTORY LOGIC: Explain path deviations based on traction vs. gradient physics. 
3. OUTPUT FORMAT: Strictly valid JSON. Plan exactly ${waypointCount} waypoints.

### 2. SCIENTIFIC SPECIALIST (Astronomy)
Goal: Provide a single, unique, mind-blowing astronomical quote or status alert to inspire the crew.

JSON SCHEMA:
{
  "waypoints": [[x, z], ...], 
  "reasoning": "[Detailed technical topography analysis]",
  "quote": "[A mission-appropriate scientific quote on astronomy/astrophysics]"
}
`;

    try {
        const provider = new VisionProvider({
            type: 'gemini', // Strategy always uses Gemini/Image map for now
            apiKey: apiKey,
            model: model
        });

        const text = await provider.generateContent(textPrompt, base64Image);
        return parseResponse(text, startPos, targetPos, terrainSize);
    } catch (err) {
        return { waypoints: [], quote: `FATAL: AI NAVIGATOR FAILURE [${err.message}]`, reasoning: "Mission Aborted: Critical failure in strategic calculation stack.", isAi: false };
    }
}

// ============================================================
// LEVEL 2: TACTICAL AUTOPILOT (Local Space Transform v0.9.37)
// ============================================================

export async function getAutopilotCommand(apiKey, state, aiModel = 'gemini-3-flash-preview') {
    const position = state.position || [0, 0, 0];
    const velocity = state.velocity || [0, 0, 0];
    const rotation = state.rotation || [0, 0, 0];
    const { terrainData, relBearing, targetDistance } = state;

    const lidarSweep = getLidarData(position, rotation, terrainData);
    const distToBoundary = terrainData ? (terrainData.size / 2) - Math.max(Math.abs(position[0]), Math.abs(position[2])) : 100;
    const boundaryWarning = distToBoundary < 15 ? `!!! CRITICAL: MAP BOUNDARY AT ${f1(distToBoundary)}m !!!` : "Clear";

    const sensorOverlay = `
### SENSOR OVERLAY (INTELLIGENCE):
- MONTE-CARLO RISK: ${state.mcSummary || "No Data"}
- ARCHITECT PATH: ${state.currentPathWaypoints || "No Data"}
`;

    const textPrompt = `You are the CYBER-PILOT of UNSEEN-1 (150kg, 6-wheel Lunar Rover).
    
PHYSICAL CAPABILITIES:
- High inertia, slow steering response. Rapid counter-steering causes instability.
- Independent motors: Reverse is possible but slow.
    
KINETIC CONTEXT:
- ANTICIPATED BEARING: ${f1(relBearing)}° (Target location in future-space)
- BEACON DISTANCE: ${f1(targetDistance)}m
- CURRENT SPEED: ${f1(new THREE.Vector3(...velocity).length() * 3.6)} km/h
- LIDAR: ${lidarSweep}
- BOUNDARY: ${boundaryWarning}
${(state.useMonteCarlo || state.usePath) ? sensorOverlay : ""}

MISSION DIRECTIVES:
1. SURVIVAL FIRST: If LIDAR shows obstacle < 5m, you MUST maneuver/reverse regardless of target.
2. BEARING SENSITIVITY: Near target (<15m), bearing angles become highly sensitive/noisy due to latency. Prioritize consistent forward momentum and small steering adjustments. 
3. MOMENTUM MANAGEMENT: Do not trigger REVERSE (-0.5) just because of bearing jitter. Only use it for deliberate repositioning if target is clearly missed or blocked.
4. STRATEGIC ALIGNMENT: Use the ARCHITECT PATH as a loose guide, but prioritize LIDAR for immediate local safety. 

JSON ONLY: {"steer": -1 to 1, "throttle": -1 to 1, "reasoning": "string"}`;

    try {
        const provider = new VisionProvider({
            type: state.visionProvider || 'gemini',
            apiKey: state.visionProvider === 'gemini' ? apiKey : state.nvidiaApiKey,
            url: state.nvidiaNimUrl,
            model: aiModel
        });

        // Setup schema for Gemini
        if (provider.type === 'gemini') {
            provider.targetMimeType = "application/json";
        }

        // Capture frame if in Cosmos mode
        const base64Frame = state.visionProvider === 'cosmos' ? state.capturedFrame : null;

        const text = await provider.generateContent(textPrompt, base64Frame);
        return parseAutopilotResponse(text);
    } catch (err) {
        return { steer: 0, throttle: 0, reasoning: `AI_PIPELINE_STALLED: ${err.message}` };
    }
}

function parseAutopilotResponse(text) {
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        const firstOpen = cleanText.indexOf('{');
        const lastClose = cleanText.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) {
            const candidate = cleanText.substring(firstOpen, lastClose + 1);
            return validateCmd(JSON.parse(candidate));
        }
    } catch (e) { /* Fallback handled */ }
    return { steer: 0, throttle: 0, reasoning: "PARSE_ERROR" };
}

function validateCmd(cmd) {
    const steer = typeof cmd.steer === 'number' && !isNaN(cmd.steer) ? cmd.steer : 0;
    const throttle = typeof cmd.throttle === 'number' && !isNaN(cmd.throttle) ? cmd.throttle : 0;
    return {
        steer: Math.max(-1, Math.min(1, steer)),
        throttle: Math.max(-1, Math.min(1, throttle)),
        reasoning: cmd.reasoning || "Moving."
    };
}

// ============================================================
// UTILS & IMAGE ENGINE (RESTORED QUALITY)
// ============================================================

export function getLidarData(position, rotation, terrainData) {
    if (!position || !rotation || !terrainData || !terrainData.heightmap) return "OFFLINE";
    const directions = [0, 90, 180, 270];
    let sweep = "";
    directions.forEach(deg => {
        const rad = (deg * Math.PI) / 180 + rotation[1];
        const dist = 10;
        const x = position[0] + Math.sin(rad) * dist;
        const z = position[2] - Math.cos(rad) * dist;
        const halfSize = terrainData.size / 2;
        const u = (x + halfSize) / terrainData.size;
        const v = (z + halfSize) / terrainData.size;
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
            const idx = Math.floor(v * 256) * 257 + Math.floor(u * 256);
            const h = terrainData.heightmap[idx] * (terrainData.maxHeight || 40);
            sweep += `${deg}°:${f1(h - position[1])}m `;
        } else sweep += `${deg}°:WALL `;
    });
    return sweep;
}

export let hCanvas = null;
export function heightmapToImage(hData) {
    const data = hData.heightmap || hData.heightData || hData;
    if (!data || !data.length) return "";

    const side = Math.sqrt(data.length);
    const targetSide = 257;

    if (!hCanvas) hCanvas = document.createElement('canvas');
    hCanvas.width = hCanvas.height = targetSide;
    const ctx = hCanvas.getContext('2d');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = tempCanvas.height = side;
    const tempCtx = tempCanvas.getContext('2d');
    const iData = tempCtx.createImageData(side, side);

    // RESTORED NORMALIZATION: Find min/max for full grayscale range
    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < data.length; i++) {
        if (data[i] < minH) minH = data[i];
        if (data[i] > maxH) maxH = data[i];
    }
    const range = Math.max(maxH - minH, 0.001);

    for (let i = 0; i < data.length; i++) {
        const val = Math.floor(((data[i] - minH) / range) * 255);
        iData.data[i * 4] = iData.data[i * 4 + 1] = iData.data[i * 4 + 2] = val;
        iData.data[i * 4 + 3] = 255;
    }
    tempCtx.putImageData(iData, 0, 0);

    // Smooth scaling to target resolution
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, 0, 0, side, side, 0, 0, targetSide, targetSide);

    return hCanvas.toDataURL('image/png');
}

function parseResponse(text, startPos, targetPos, terrainSize) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match[0]);
        // V0.9.47: HARD COORD VALIDATION (Prevent NaN Black Screen)
        const validWaypoints = (parsed.waypoints || [])
            .filter(wp => Array.isArray(wp) && wp.length >= 2 && typeof wp[0] === 'number' && typeof wp[1] === 'number' && !isNaN(wp[0]) && !isNaN(wp[1]))
            .map(wp => [
                Math.max(-terrainSize / 2, Math.min(terrainSize / 2, wp[0])),
                Math.max(-terrainSize / 2, Math.min(terrainSize / 2, wp[1]))
            ]);

        if (validWaypoints.length === 0) throw new Error("NO_VALID_COORDINATES");

        return {
            waypoints: validWaypoints,
            quote: parsed.quote || "Astro-Core Active.",
            reasoning: parsed.reasoning || "Route established.",
            isAi: true
        };
    } catch (e) {
        return {
            waypoints: [],
            quote: `Protocol Breach: ${e.message}`,
            reasoning: "Analysis failed due to coordinate instability.",
            isAi: false
        };
    }
}

export function summarizeFan(trajectories) {
    if (!trajectories) return "";
    const s = trajectories.reduce((acc, t) => { acc[t.risk]++; return acc; }, { safe: 0, warning: 0, critical: 0 });
    return `${s.safe}/${trajectories.length} safe trajectories. SCVaR: ${s.critical > 5 ? 'High' : 'Low'}`;
}
