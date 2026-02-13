// aiNavigator.js — AI Navigation System for Unseen Pathfinder
// UPGRADED TO GEMINI 3.0 MODELS (GEN 3 PREVIEW)
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-3-flash-preview";

// ============================================================
// LEVEL 1: STRATEGIC PLANNER
// ============================================================

export async function planStrategicRoute(apiKey, heightmapData, startPos, targetPos, terrainSize, aiModel = 'gemini-3-flash') {
    let actualKey = "";
    if (typeof apiKey === 'string') actualKey = apiKey.trim();
    else if (apiKey && typeof apiKey.apiKey === 'string') actualKey = apiKey.apiKey.trim();

    if (!actualKey || actualKey === "" || actualKey === "undefined") {
        return { waypoints: generateFallbackRoute(startPos, targetPos), quote: "Offline: No API key found." };
    }

    const activeModel = (aiModel === 'gemini-3-pro' || aiModel === 'gemini-1.5-pro')
        ? "gemini-3-pro-preview"
        : "gemini-3-flash-preview";

    console.log(`AI Navigator: Initializing ${activeModel} (SDK Gen 3)`);

    try {
        const imageBase64 = heightmapToImage(heightmapData);
        // Added dynamic seed (timestamp) and variety instruction to force unique quotes
        const timestamp = Date.now();
        const textPrompt = `You are a legendary Lunar Scout AI Strategist. [Request ID: ${timestamp}]
Plan a tactical route for the rover. 
Provide a UNIQUE inspirational quote from a famous person (different every time). 
Surprise the user with deep wisdom from explorers, scientists, or philosophers.

COORD DATA:
START: [${startPos[0].toFixed(1)}, ${startPos[2].toFixed(1)}]
TARGET: [${targetPos[0].toFixed(1)}, ${targetPos[2].toFixed(1)}]
TERRAIN SIZE: ${terrainSize}m

JSON ONLY: {"waypoints": [[x1,z1], ...], "quote": "..."}`;

        const genAI = new GoogleGenAI({ apiKey: actualKey });
        const model = genAI.getGenerativeModel({
            model: activeModel,
            generationConfig: { temperature: 0.9 } // Added higher temperature for more variety
        });

        const result = await model.generateContent([
            textPrompt,
            { inlineData: { data: imageBase64, mimeType: "image/png" } }
        ]);

        const response = await result.response;
        const text = response.text();
        console.log("AI Raw Response:", text); // Added logging for debugging
        return parseResponse(text, startPos, targetPos);

    } catch (err) {
        console.error('AI Navigator SDK Error:', err);
        try {
            return await planStrategicRouteFetch(actualKey, heightmapData, startPos, targetPos, terrainSize, activeModel);
        } catch (fetchErr) {
            return { waypoints: generateFallbackRoute(startPos, targetPos), quote: `AI Error: ${err.message}` };
        }
    }
}

async function planStrategicRouteFetch(key, heightmapData, startPos, targetPos, terrainSize, modelId) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
    const imageBase64 = heightmapToImage(heightmapData);
    const timestamp = Date.now();
    const payload = {
        contents: [{
            parts: [
                { text: `Plan route. Request ID: ${timestamp}. JSON ONLY: {"waypoints":..., "quote": "UNIQUE inspirational quote"}` },
                { inline_data: { mime_type: "image/png", data: imageBase64 } }
            ]
        }],
        generationConfig: { temperature: 0.9 }
    };
    const response = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`Fetch Error: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return parseResponse(text, startPos, targetPos);
}

function parseResponse(text, startPos, targetPos) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const cleanJson = jsonMatch[0].replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            return {
                waypoints: parsed.waypoints || generateFallbackRoute(startPos, targetPos),
                quote: parsed.quote || "Exploration is in our nature. It is the only way to know our place in the universe."
            };
        } catch (e) {
            console.error("JSON Parse Error in AI Response:", e, text);
        }
    }
    return { waypoints: generateFallbackRoute(startPos, targetPos), quote: "Strategy calculated. Proceed with caution." };
}

// ============================================================
// LEVEL 2: TACTICAL AUTOPILOT
// ============================================================

export async function getAutopilotCommand(apiKey, state, aiModel = 'gemini-3-flash') {
    let actualKey = "";
    if (typeof apiKey === 'string') actualKey = apiKey.trim();
    else if (apiKey && typeof apiKey.apiKey === 'string') actualKey = apiKey.apiKey.trim();

    const activeModel = (aiModel === 'gemini-3-pro' || aiModel === 'gemini-1.5-pro') ? "gemini-3-pro-preview" : "gemini-3-flash-preview";
    const { position, currentWaypoint, distToWaypoint } = state;

    if (distToWaypoint < 5) return { steer: 0, throttle: 0.3, advanceWaypoint: true };
    if (!actualKey || actualKey === "undefined") return getHeuristicCommand(state);

    try {
        const genAI = new GoogleGenAI({ apiKey: actualKey });
        const model = genAI.getGenerativeModel({ model: activeModel, generationConfig: { temperature: 0.4 } });
        const textPrompt = `Rover autopilot. JSON {"steer": X, "throttle": Y}. STATE: Pos[${position[0].toFixed(1)}, ${position[2].toFixed(1)}], Target[${currentWaypoint[0].toFixed(1)}, ${currentWaypoint[1].toFixed(1)}]`;
        const result = await model.generateContent(textPrompt);
        return parseAutopilotResponse(result.response.text());
    } catch (err) {
        return getHeuristicCommand(state);
    }
}

function parseAutopilotResponse(text) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const cmd = JSON.parse(jsonMatch[0].replace(/```json|```/g, ''));
            return { steer: Math.max(-1, Math.min(1, cmd.steer || 0)), throttle: Math.max(0, Math.min(1, cmd.throttle || 0.3)) };
        } catch (e) { }
    }
    return { steer: 0, throttle: 0.15 };
}

function getHeuristicCommand(state) {
    const { position, rotation, currentWaypoint, SMaR, sCVaR } = state;
    const dx = currentWaypoint[0] - position[0];
    const dz = currentWaypoint[1] - position[2];
    const targetAngle = Math.atan2(dx, dz);
    let angleDiff = targetAngle - rotation[1];
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    let throttle = 0.6;
    if (SMaR < 25) throttle *= 0.5;
    if (sCVaR > 50) throttle *= 0.3;
    return { steer: Math.max(-1, Math.min(1, angleDiff * 2)), throttle: Math.max(0.15, throttle) };
}

// ============================================================
// UTILS
// ============================================================

function generateFallbackRoute(startPos, targetPos) {
    const [sx, sz, tx, tz] = [startPos[0], startPos[2], targetPos[0], targetPos[2]];
    return [[sx, sz], [sx + (tx - sx) * 0.5, sz + (tz - sz) * 0.5], [tx, tz]];
}

let hCanvas = null;
function heightmapToImage(hData) {
    if (!hData) return "";
    const side = Math.floor(Math.sqrt(hData.length));
    if (!hCanvas) hCanvas = document.createElement('canvas');
    hCanvas.width = hCanvas.height = side;
    const ctx = hCanvas.getContext('2d');
    const iData = ctx.createImageData(side, side);
    let minH = Math.min(...hData), maxH = Math.max(...hData), r = maxH - minH || 1;
    for (let i = 0; i < hData.length; i++) {
        const val = Math.floor(((hData[i] - minH) / r) * 255);
        iData.data[i * 4] = iData.data[i * 4 + 1] = iData.data[i * 4 + 2] = val; iData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(iData, 0, 0);
    return hCanvas.toDataURL('image/png').split(',')[1];
}

export function summarizeFan(trajectories) {
    const s = trajectories.reduce((acc, t) => { acc[t.risk]++; return acc; }, { safe: 0, warning: 0, critical: 0 });
    return `${s.safe}/${trajectories.length} safe`;
}
