// aiNavigator.js — AI Navigation System for Unseen Pathfinder
// UPGRADED TO GEMINI 3.0 MODELS & PHYSICS-AWARE REASONING
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-3-flash-preview";

// ============================================================
// LEVEL 1: STRATEGIC PLANNER
// ============================================================

export async function planStrategicRoute(apiKey, heightmapData, startPos, targetPos, terrainSize, aiModel = 'gemini-3-flash', language = 'EN') {
    let actualKey = "";
    if (typeof apiKey === 'string') actualKey = apiKey.trim();
    else if (apiKey && typeof apiKey.apiKey === 'string') actualKey = apiKey.apiKey.trim();

    if (!actualKey || actualKey === "" || actualKey === "undefined") {
        return { waypoints: generateFallbackRoute(startPos, targetPos), quote: "Offline: No API key found." };
    }

    const activeModel = (aiModel === 'gemini-3-pro' || aiModel === 'gemini-1.5-pro')
        ? "gemini-3-pro-preview"
        : "gemini-3-flash-preview";

    try {
        const imageBase64 = heightmapToImage(heightmapData);
        const timestamp = Date.now();

        // V10: Localization Instruction Added
        const textPrompt = `You are the Tactical Scout AI for the Unseen Pathfinder Mission. [ID: ${timestamp}]
Your task is to analyze the attached Lunar Heightmap and plan a SAFE route for the rover.

MAP SEMANTICS:
- The image is a Top-Down Grayscale Heightmap.
- BRIGHTER pixels = Higher Elevation (Craters rims, hills).
- DARKER pixels = Lower Elevation (Cater floors, valleys).
- VERY DARK small spots = Hazardous rocks/boulders.

LUNAR PHYSICS CONSTRAINTS:
- Gravity: 1.62 m/s².
- Max Slope: 25 degrees. High-brightness gradients are FATAL.
- Rover Stability: Avoid planning through the center of small deep craters.

WORLD COORDINATES:
- Center: [0, 0]. Size: ${terrainSize}m. Bounds: [-${terrainSize / 2}, ${terrainSize / 2}].
- START: [${startPos[0].toFixed(1)}, ${startPos[2].toFixed(1)}]
- TARGET BEACON: [${targetPos[0].toFixed(1)}, ${targetPos[2].toFixed(1)}]

PLANNING PROTOCOL:
1. REASONING: Analyze hazards.
2. STRATEGY: Define curved path.
3. OUTPUT: Exactly 6-8 waypoints [x, z].

LANGUAGE REQUIREMENT:
- You MUST provide the 'reasoning' and 'quote' in the following language: ${language}.
- If RU: use Russian. If UA: use Ukrainian. Default: English.

PERSONALITY & QUOTE CONSTRAINTS:
- STRICT FAILURE CONDITION: DO NOT use historical clichés.
- FORBIDDEN TO MENTION: Neil Armstrong, "One small step", "Giant leap", or "Eagle has landed". Using these will count as a system malfunction.
- ACT as a professional tactical scout navigator. Respond as if transmitting technical data to a rover pilot.
- GENERATE a unique, short, technical quote about the local terrain gradients, regolith density, or basaltic hazards.
- Sounds like: "Terrain gradient within tolerances. Navigating basaltic shelf to preserve motor torque." or "Sensor sweep confirms high boulder frequency. Adjusting vectors for 15-degree clearance."

JSON ONLY FORMAT:
{
  "reasoning": "...",
  "waypoints": [[x1, z1], ...],
  "quote": "..."
}`;

        const genAI = new GoogleGenerativeAI(actualKey);
        const model = genAI.getGenerativeModel({
            model: activeModel,
            generationConfig: {
                temperature: 0.85,
                maxOutputTokens: 1000
            }
        });

        const result = await model.generateContent([
            textPrompt,
            { inlineData: { data: imageBase64, mimeType: "image/png" } }
        ]);

        const response = await result.response;
        const text = response.text();
        return parseResponse(text, startPos, targetPos, terrainSize);

    } catch (err) {
        console.error('AI Navigator SDK Error:', err);
        try {
            return await planStrategicRouteFetch(actualKey, heightmapData, startPos, targetPos, terrainSize, activeModel, language);
        } catch (fetchErr) {
            return { waypoints: generateFallbackRoute(startPos, targetPos), quote: `AI Error: ${err.message}` };
        }
    }
}

async function planStrategicRouteFetch(key, heightmapData, startPos, targetPos, terrainSize, modelId, language) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
    const imageBase64 = heightmapToImage(heightmapData);
    const timestamp = Date.now();
    const payload = {
        contents: [{
            parts: [
                { text: `Plan safe lunar route. Obey physics. Language: ${language}. JSON ONLY: {"waypoints":..., "quote": "...", "reasoning": "..."}. Bounds[±${terrainSize / 2}]` },
                { inline_data: { mime_type: "image/png", data: imageBase64 } }
            ]
        }],
        generationConfig: { temperature: 0.9 }
    };
    const response = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`Fetch Error: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return parseResponse(text, startPos, targetPos, terrainSize);
}

// ============================================================
// LEVEL 1.1: QUOTE SANITIZER & FACT BANK
// ============================================================

const FACT_BANK = [
    "A day on Venus is longer than its year; the planet spins backward relative to most peers.",
    "Lunar gravity is approximately 16.2% of Earth's, significantly reducing rover traction requirements.",
    "Mars iron oxide (rust) creates its red hue, but its sunsets appear blue to the human eye.",
    "Neutron star material is so dense that a teaspoon would weigh billions of tons.",
    "The Milky Way galaxy smells of rum and raspberries due to ethyl formate in star-forming clouds.",
    "Space is not a perfect vacuum; it contains low-density plasma and electromagnetic vibrations.",
    "In a vacuum, two pieces of the same metal will stick together permanently via cold welding.",
    "The Moon is lemon-shaped, not perfectly round, due to tidal forces during its formation.",
    "Saturn's hexagon is a persistent cloud pattern at the north pole, wider than two Earths.",
    "Jupiter's Great Red Spot is a high-pressure storm that has raged for at least 350 years.",
    "Olympus Mons on Mars is the solar system's tallest volcano, three times the height of Everest.",
    "Titan, Saturn's moon, is the only known moon with a dense atmosphere and liquid methane lakes.",
    "Mercury's core accounts for 85% of its radius, suggesting a violent impact in its early history.",
    "Total solar eclipses are a cosmic coincidence; the Sun is 400x larger but 400x farther than the Moon.",
    "Neptune's winds are the fastest in the solar system, reaching speeds of 2,100 km/h.",
    "Diamonds may rain deep within the atmospheres of Uranus and Neptune due to extreme pressure.",
    "Regolith is the layer of loose, heterogeneous superficial deposits covering solid rock on the Moon.",
    "Basaltic plains comprise approximately 17% of the lunar surface, forming the 'maria' regions.",
    "The Lunar South Pole-Aitken basin is one of the largest, deepest, and oldest impact craters.",
    "Vacuum-stable regolith poses significant abrasive risk to rover joint seals and optics.",
    "Thermal variance on the lunar surface ranges from 127°C in sunlight to -173°C in shadow.",
    "Sunsets on Mars are blue due to dust particles scattering shorter wavelengths of light.",
    "Gamma-ray bursts can release more energy in 10 seconds than our Sun will in its entire lifetime.",
    "The Moon's exosphere is extremely thin, composed mainly of helium, neon, and argon.",
    "Mascons are regions of the Moon's crust that contain excessive positive gravity anomalies."
];

function sanitizeAndEnhanceQuote(rawQuote) {
    const forbidden = [
        "small step", "giant leap", "armstrong", "mankind", "eagle has landed",
        "poetic", "starry night", "fine and powdery", "pick it up", "with my toe",
        "surface is fine", "magnificent desolation", "tranquility base",
        "magnificent desolation", "one small step", "for a man", "humanity"
    ];
    const normalized = (rawQuote || "").toLowerCase();

    // Check for cliches
    for (const word of forbidden) {
        if (normalized.includes(word)) {
            console.warn(`[AI] Historic Cliche detected: "${word}". Replacing with Fact Bank.`);
            return FACT_BANK[Math.floor(Math.random() * FACT_BANK.length)];
        }
    }

    // Default or empty fallback
    if (normalized.trim().length < 5) {
        return FACT_BANK[Math.floor(Math.random() * FACT_BANK.length)];
    }

    return rawQuote;
}

function parseResponse(text, startPos, targetPos, terrainSize) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const cleanJson = jsonMatch[0].replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            const halfSize = terrainSize / 2;
            const validWaypoints = (parsed.waypoints || []).map(wp => [
                Math.max(-halfSize, Math.min(halfSize, wp[0])),
                Math.max(-halfSize, Math.min(halfSize, wp[1]))
            ]);

            return {
                waypoints: validWaypoints.length > 0 ? validWaypoints : generateFallbackRoute(startPos, targetPos),
                quote: sanitizeAndEnhanceQuote(parsed.quote),
                reasoning: parsed.reasoning || ""
            };
        } catch (e) {
            console.error("JSON Parse Error:", e, text);
        }
    }
    return { waypoints: generateFallbackRoute(startPos, targetPos), quote: FACT_BANK[Math.floor(Math.random() * FACT_BANK.length)] };
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
