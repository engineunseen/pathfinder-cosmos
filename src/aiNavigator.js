// aiNavigator.js — AI Navigation System for Unseen Pathfinder (v3.3.42)
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as THREE from 'three';

const GEMINI_MODEL = "gemini-3-flash-preview";

export const f1 = (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(1) : '0.0');
export const f2 = (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(2) : '0.00');

// ============================================================
// v3.2.0: VISION BRIDGE & FRAME CAPTURE
// ============================================================

/**
 * Captures and resizes the current Three.js canvas.
 * Downscaling to 512px significantly improves inference speed and prevents 400 errors.
 */
export function captureSimulationFrame(gl, maxDim = 512) {
    try {
        if (!gl || !gl.domElement) return null;
        const canvas = gl.domElement;

        // Create offscreen canvas for resizing
        const offscreen = document.createElement('canvas');
        let width = canvas.width;
        let height = canvas.height;

        if (width > height) {
            if (width > maxDim) { height *= maxDim / width; width = maxDim; }
        } else {
            if (height > maxDim) { width *= maxDim / height; height = maxDim; }
        }

        offscreen.width = width;
        offscreen.height = height;
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(canvas, 0, 0, width, height);

        // JPEG is smaller and more compatible with NIM PIL loaders
        return offscreen.toDataURL('image/jpeg', 0.8).split(',')[1];
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
        if (!this.apiKey || this.apiKey.length < 5) throw new Error("GEMINI_KEY_MISSING");
        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({
            model: this.model || GEMINI_MODEL,
            generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.2,
                responseMimeType: this.targetMimeType || "text/plain"
            }
        });

        const content = base64Image
            ? [prompt, { inlineData: { data: base64Image, mimeType: "image/jpeg" } }]
            : [prompt];

        const result = await model.generateContent(content);
        return result.response.text();
    }

    async _callCosmos(prompt, base64Image) {
        if (!this.url) throw new Error("NVIDIA NIM Endpoint URL not configured.");

        const baseUrl = this.url.replace(/\/$/, '').replace(/\/v1$/, '');
        const endpoint = `${baseUrl}/v1/chat/completions`;

        // Determine real target for proxy (if using one)
        // If the URL is localhost, it's a proxy, and it needs x-target-url to know where to go.
        // We assume the user put the real NIM URL in the apiKey field if they are using the proxy.
        const isProxy = this.url.includes('localhost') || this.url.includes('127.0.0.1');
        const targetUrl = isProxy ? this.apiKey : this.url;

        const content = [{ type: "text", text: prompt }];
        if (base64Image && base64Image !== 'null') {
            content.push({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            });
        }

        const messages = [{ role: "user", content: content }];

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey || 'nv-nim-dummy'}`,
                'x-target-url': targetUrl
            },
            body: JSON.stringify({
                model: this.model || "nvidia/Cosmos-Reason2-2B",
                messages: messages,
                max_tokens: 1024,
                temperature: 0.2,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "Unknown Error");
            if (response.status === 404) {
                try {
                    const modelsBase = endpoint.replace('/chat/completions', '');
                    const modelsRes = await fetch(`${modelsBase}/models`, {
                        headers: { 'Authorization': `Bearer ${this.apiKey || 'nv-nim-dummy'}`, 'x-target-url': targetUrl }
                    });
                    const modelsData = await modelsRes.json();
                    const modelNames = modelsData.data?.map(m => m.id).join(", ") || "none";
                    console.warn(`🛰️ [COSMOS DISCOVERY]: Available models: [ ${modelNames} ]`);
                } catch (e) { }
            }
            throw new Error(`NIM_HTTP_${response.status}: ${errText.substring(0, 100)}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

// ============================================================
// LEVEL 1: STRATEGIC PLANNER (Astro-Core Architecture)
// ============================================================

export async function planStrategicRoute(apiKey, heightData, startPos, targetPos, terrainSize, waypointCount, model = 'gemini-3-pro-preview', language = 'EN', state = {}) {
    // PROTECTIVE GUARD: If path-following is disabled, ARCHITECT must NOT run.
    if (state.aiUsePath === false) {
        return { waypoints: [], quote: "ARCHITECT: STANDBY.", reasoning: "Manual override: Strategic path following disabled.", isAi: false };
    }

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
1. STRATEGIC ANALYSIS: Conduct a deep technical analysis of regolith density and slope variance. Identify specific topographic hazards (crater rims, basaltic ridges, boulder fields). 
2. TRAJECTORY LOGIC: Explain path deviations based on traction vs. gradient physics. Use 'No Straight Lines' philosophy.
3. OUTPUT FORMAT: Strictly valid JSON. Plan exactly ${waypointCount} granular waypoints.

### 2. SCIENTIFIC SPECIALIST (Astronomy)
Goal: Provide a single, unique, mind-blowing astronomical quote or status alert to inspire the crew.
- GOAL: Focus on 'cool' and 'mind-blowing' cosmos facts (black holes, pulsar dynamics, galactic chemistry).
- AVOID: Dry regolith geology, historic clichés, or generic poetry.
- PERSONALITY: Technically brilliant but engaging. A 'Cool Astronomer' persona.

JSON SCHEMA:
{
  "waypoints": [[x, z], ...], 
  "reasoning": "[Technical report. Detailed topography analysis, physics constraints (gradient variance, regolith density), and pathfinding logic.]",
  "quote": "[A mission-appropriate scientific quote on astronomy/astrophysics]"
}

CONSTRAINTS:
- PERSONALITY: High-level Mission Architect. Technically dense. Aggressive safety margins. Use terms: 'regolith', 'basaltic', 'thermal bloom', 'gradient variance', 'isostatic balance'.
- FORBIDDEN: Historical clichés, Armstrong, or poetic metaphors.`;

    try {
        const provider = new VisionProvider({
            type: state.visionProvider || 'gemini',
            apiKey: state.visionProvider === 'gemini' ? (apiKey || state.apiKey) : state.nvidiaApiKey,
            url: state.nvidiaNimUrl,
            model: model
        });

        if (provider.type === 'gemini') {
            provider.targetMimeType = "application/json";
        }

        const text = await provider.generateContent(textPrompt, base64Image);
        return parseResponse(text, startPos, targetPos, terrainSize);
    } catch (err) {
        return { waypoints: [], quote: `FATAL: AI NAVIGATOR FAILURE [${err.message}]`, reasoning: "Mission Aborted: Critical failure in strategic calculation stack.", isAi: false };
    }
}

// ============================================================
// LEVEL 2: TACTICAL AUTOPILOT (Local Space Transform v0.9.37)
// ============================================================

export async function getAutopilotCommand(apiKey, state, aiModel = 'nvidia/Cosmos-Reason2-2B') {
    const {
        position, velocity, rotation, targetPos, nextWaypoints,
        sCVaR, SMaR, fanSummary, currentWaypoint, wheelsOnGround,
        terrainData, mcSummary, currentPathWaypoints, relBearing, targetDistance
    } = state;

    const lidarSweep = getLidarData(position, rotation, terrainData);

    // v3.3.35: Precise boundary vectoring
    const bSize = (terrainData?.size / 2) || 100;
    const dists = {
        "+X (RIGHT)": bSize - position[0],
        "-X (LEFT)": position[0] + bSize,
        "+Z (BACK)": bSize - position[2],
        "-Z (FRONT)": position[2] + bSize
    };
    const closestSide = Object.entries(dists).sort((a, b) => a[1] - b[1])[0];
    const boundaryWarning = closestSide[1] < 15 ? `!!! MAP BOUNDARY ${closestSide[0]} AT ${f1(closestSide[1])}m !!!` : "Clear";

    const sensorOverlay = `
### SENSOR OVERLAY (INTELLIGENCE):
- MONTE-CARLO RISK: ${mcSummary || "No Data"}
- ARCHITECT PATH: ${currentPathWaypoints || "No Data"}
`;

    const textPrompt = `You are the Tactical Guide (Autopilot). MISSION: Execute the strategic route while navigating complex lunar physics (inertia, low gravity, ballistics).

TELEMETRY CONTEXT:
- POSITION: [${f2(position[0])}, ${f2(position[2])}] - Current coordinates in meters.
- VELOCITY: [${f2(velocity[0])}, ${f2(velocity[2])}] - Current speed vector.
- BEYOND HORIZON (TARGET): [${f1(targetPos[0])}, ${f1(targetPos[1])}] - The final destination.
- MISSION ROUTE (SPLINE): ${nextWaypoints ? nextWaypoints.map(p => `[${f1(p[0])}, ${f1(p[1])}]`).join(', ') : "None"} - Your mandatory path. You MUST stay within 5m of this line.

KINETIC METRICS (SENSORY LAYER):
- sCVaR: Stochastic Conditional Value at Risk. Scale 0 (Safe) to 100 (Wrecked). Probability of a mission-ending event (roll/collision). Current: ${f1(sCVaR)}
- SMaR: Stability Margin at Risk. Distance in meters to the nearest rollover threshold. HIGH is safe, LOW (<10m) is critical. Current: ${f1(SMaR)}m
- VENNIK FAN: ${fanSummary ? fanSummary : "No Data"} - Monte Carlo predictive futures. Green lines = Success paths. Red lines = Catastrophic failure.
- LIDAR TOPO SWEEP: ${lidarSweep}

OPERATIONAL DIRECTIVE:
1. PHASE ANALYSIS: 
   - IF wheelsOnGround < 3: INERTIAL PHASE (Ballistics). Steering is ineffective. Reasoning must focus on mass distribution and roll-compensation.
   - IF wheelsOnGround >= 3: KINETIC PHASE. Dynamic traction control active.
2. MISSION PRIORITY: Your primary goal is to reach the target by following the MISSION ROUTE. If you deviate to avoid a hazard, you MUST return to the route as soon as it is safe.
3. KINETIC BODY AWARENESS: You are a physics entity with 6 wheels. Analyze contact patches and the 'Vennik' fan as your proprietary nervous system.
4. COGNITIVE REASONING: Adapt to lunar inertia. Reason about your own mass-velocity vector. Avoid oscillations.
5. METRIC-DRIVEN CONTROL: Prioritize Metrics over speed. If sCVaR > 40, reduce throttle. If SMaR < 10, steer away from the risk vector.

JSON SCHEMA: {steer, throttle, reasoning}.
TERMS: 'ballistic arc', 'contact patch', 'inertial drift', 'mass vector', 'torque modulation'.

GOAL: REACH CURRENT WAYPOINT [${f1(currentWaypoint[0])}, ${f1(currentWaypoint[1])}].
OUTPUT JSON ONLY: { "steer": -1.0 to 1.0, "throttle": 0.0 to 1.0, "reasoning": "..." }`;

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
    if (!position || !rotation || !terrainData || !terrainData.heightData) return "OFFLINE";
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
            const h = terrainData.heightData[idx];
            sweep += `[${deg}deg: ${h.toFixed(1)}m] `;
        } else {
            sweep += `[${deg}deg: OUT] `;
        }
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
