// aiNavigator.js — AI Navigation System for Pathfinder (Cosmos Cookoff Edition)
// Cosmos Reason 2 ONLY — No Gemini, No Heuristics
import * as THREE from 'three';

export const f1 = (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(1) : '0.0');
export const f2 = (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(2) : '0.00');

// ============================================================
// VISION BRIDGE & FRAME CAPTURE
// ============================================================

/**
 * Captures and resizes the current Three.js canvas.
 * Downscaling to 512px significantly improves inference speed and prevents 400 errors.
 */
export function captureSimulationFrame(gl, maxDim = 512) {
    try {
        if (!gl || !gl.domElement) return null;
        const canvas = gl.domElement;

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

// ============================================================
// NVIDIA COSMOS REASON 2 — Vision Provider
// ============================================================

export class CosmosProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.url = config.url;
        this.model = config.model || 'nvidia/Cosmos-Reason2-2B';
    }

    async generateContent(prompt, base64Image) {
        if (!this.url) throw new Error("NVIDIA NIM Endpoint URL not configured.");

        const baseUrl = this.url.replace(/\/$/, '').replace(/\/v1$/, '');
        const endpoint = `${baseUrl}/v1/chat/completions`;

        // Proxy detection: if URL is localhost, use apiKey as target URL header
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
                model: this.model,
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
// TACTICAL AUTOPILOT — Cosmos Reason 2 Decision Loop
// ============================================================

export async function getAutopilotCommand(apiKey, state, aiModel = 'nvidia/Cosmos-Reason2-2B') {
    const {
        position, velocity, rotation, targetPos,
        fanSummary, wheelsOnGround,
        terrainData, relBearing, targetDistance
    } = state;

    const lidarSweep = getLidarData(position, rotation, terrainData);

    // Precise boundary vectoring
    const bSize = (terrainData?.size / 2) || 100;
    const dists = {
        "+X (RIGHT)": bSize - position[0],
        "-X (LEFT)": position[0] + bSize,
        "+Z (BACK)": bSize - position[2],
        "-Z (FRONT)": position[2] + bSize
    };
    const closestSide = Object.entries(dists).sort((a, b) => a[1] - b[1])[0];
    const boundaryWarning = closestSide[1] < 15 ? `!!! MAP BOUNDARY ${closestSide[0]} AT ${f1(closestSide[1])}m !!!` : "Clear";

    const textPrompt = `You are the Tactical Guide (Autopilot) powered by NVIDIA Cosmos Reason 2. MISSION: Navigate a lunar rover to the destination signal across unknown terrain using physics-aware reasoning.

TELEMETRY CONTEXT:
- POSITION: [${f2(position[0])}, ${f2(position[2])}] - Current coordinates in meters.
- VELOCITY: [${f2(velocity[0])}, ${f2(velocity[2])}] - Current speed vector.
- TARGET DESTINATION: [${f1(targetPos[0])}, ${f1(targetPos[1])}] - The destination signal.
- TARGET DISTANCE: ${f1(targetDistance)}m
- RELATIVE BEARING: ${f1(relBearing)}° (negative = target is left, positive = target is right)
- WHEELS ON GROUND: ${wheelsOnGround}/6
- MAP BOUNDARY: ${boundaryWarning}

SENSOR DATA:
- MONTE CARLO FUTURES: ${fanSummary ? fanSummary : "No Data"} - Predictive trajectory simulations.
- LIDAR TERRAIN SWEEP: ${lidarSweep}

OPERATIONAL DIRECTIVE:
1. PHASE ANALYSIS: 
   - IF wheelsOnGround < 3: INERTIAL PHASE (Ballistics). Steering is ineffective. Minimize rotation.
   - IF wheelsOnGround >= 3: KINETIC PHASE. Dynamic traction control active.
2. MISSION PRIORITY: Navigate directly toward the destination signal. Use terrain data to avoid hazards.
3. KINETIC BODY AWARENESS: You are a 150kg physics entity with 6 wheels in lunar gravity (1.62 m/s²).
4. COGNITIVE REASONING: Adapt to lunar inertia. Reason about your mass-velocity vector. Avoid oscillations.
5. BOUNDARY AWARENESS: If near map edge, steer toward center.

GOAL: REACH DESTINATION at [${f1(targetPos[0])}, ${f1(targetPos[1])}].
OUTPUT JSON ONLY: { "steer": -1.0 to 1.0, "throttle": 0.0 to 1.0, "reasoning": "..." }`;

    try {
        const provider = new CosmosProvider({
            apiKey: state.nvidiaApiKey || apiKey,
            url: state.nvidiaNimUrl,
            model: aiModel
        });

        // Capture frame for visual reasoning
        const base64Frame = state.capturedFrame || null;

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
    } catch (e) {
        console.warn("Autopilot JSON parse failed. Attempting regex extraction.", e);
        const steerMatch = cleanText.match(/"steer"\s*:\s*([-+]?\d*\.?\d+)/);
        const throttleMatch = cleanText.match(/"throttle"\s*:\s*([-+]?\d*\.?\d+)/);

        if (steerMatch || throttleMatch) {
            return validateCmd({
                steer: steerMatch ? parseFloat(steerMatch[1]) : 0,
                throttle: throttleMatch ? parseFloat(throttleMatch[1]) : 0,
                reasoning: "Extracted via Fallback Regex"
            });
        }
    }
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
// UTILS & IMAGE ENGINE
// ============================================================

export function getLidarData(position, rotation, terrainData) {
    if (!position || !rotation || !terrainData || !terrainData.heightData) return "OFFLINE";
    const directions = [0, 45, -45, 90, -90];
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
            const relH = h - position[1];
            sweep += `[${deg}deg: ${dist}m away, RelH: ${relH > 0 ? '+' : ''}${relH.toFixed(1)}m] `;
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

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, 0, 0, side, side, 0, 0, targetSide, targetSide);

    return hCanvas.toDataURL('image/png');
}

export function summarizeFan(trajectories) {
    if (!trajectories) return "";
    const s = trajectories.reduce((acc, t) => { acc[t.risk]++; return acc; }, { safe: 0, warning: 0, critical: 0 });
    return `${s.safe}/${trajectories.length} safe trajectories. Risk: ${s.critical > 5 ? 'High' : 'Low'}`;
}
