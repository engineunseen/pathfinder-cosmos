// aiNavigator.js — AI Navigation System for Unseen Pathfinder
// UPGRADED TO GEMINI 3.0 MODELS & PHYSICS-AWARE REASONING
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-3-flash-preview";

// ============================================================
// LEVEL 1: STRATEGIC PLANNER
// ============================================================

const ARCHITECT_PROMPT_TEMPLATE = (language, terrainSize, startPos, targetPos, timestamp) => `You are the Strategic Planning AI for the Unseen Pathfinder Mission. [ID: ${timestamp}]
Your task is to analyze the attached Lunar Heightmap and plan a SAFE route for the rover.

MAP SEMANTICS:
- The image is a Top-Down Grayscale Heightmap of a 200m x 200m area.
- BRIGHTER pixels = Higher Elevation (Craters rims, basaltic ridges).
- DARKER pixels = Lower Elevation (Cater floors, valleys).
- VERY DARK small spots = Hazardous rocks and boulders.

WORLD COORDINATES:
- Center: [0, 0]. Size: ${terrainSize}m. Bounds: [-${terrainSize / 2}, ${terrainSize / 2}].
- START: [${startPos[0].toFixed(1)}, ${startPos[2].toFixed(1)}]
- TARGET BEACON: [${targetPos[0].toFixed(1)}, ${targetPos[2].toFixed(1)}]

MISSION LOGIC & JSON REQUIREMENTS:
1. STRATEGIC ANALYSIS: You MUST conduct a deep technical analysis of the grayscale heightmap. Identify specific topographic hazards (crater rims, basaltic ridges, boulder fields).
2. TRAJECTORY LOGIC: You MUST explain exactly why your path deviates from the direct line. Detail the physics of 'traction vs slope' and how you are navigating micro-relief.
3. NO LIMITS: Write as much as needed for a professional mission architect report. The mission control terminal has scrolling enabled.
4. JSON OUTPUT FORMAT: Strictly valid JSON only.

JSON SCHEMA:
{
  "waypoints": [[x, z], ...], 
  "reasoning": "[Comprehensive mission architect report. Multi-paragraph. Detailed topography analysis, physics constraints, and pathfinding logic. Refer to specific sectors or hazards.]",
  "quote": "[A mission-appropriate scientific quote or status alert]"
}

CONSTRAINTS:
- FORBIDDEN TO MENTION: Neil Armstrong, "One small step", "Giant leap", or "Eagle has landed".
- PERSONALITY: High-level Mission Architect. Technically dense. Aggressive safety margins. Use terms like 'regolith', 'basaltic', 'thermal bloom', 'gradient variance', 'isostatic balance'.
- LANGUAGE: Respond in: ${language}.
`;

export async function planStrategicRoute(apiKey, heightmapData, startPos, targetPos, terrainSize, aiModel = 'gemini-3-flash-preview', language = 'EN') {
    let actualKey = "";
    if (typeof apiKey === 'string') actualKey = apiKey.trim();
    else if (apiKey && typeof apiKey.apiKey === 'string') actualKey = apiKey.apiKey.trim();

    if (!actualKey || actualKey === "" || actualKey === "undefined") {
        return { waypoints: [], quote: "FATAL: Navigation SDK Offline. No API Key.", reasoning: "CRITICAL: Mission Architect cannot initialize without authorization.", isAi: false };
    }

    const activeModel = (aiModel.includes('pro'))
        ? "gemini-3-pro-preview"
        : "gemini-3-flash-preview";

    try {
        const imageBase64 = heightmapToImage(heightmapData);
        const timestamp = Date.now();
        const textPrompt = ARCHITECT_PROMPT_TEMPLATE(language, terrainSize, startPos, targetPos, timestamp);

        const genAI = new GoogleGenerativeAI(actualKey);
        const model = genAI.getGenerativeModel({
            model: activeModel,
            generationConfig: {
                temperature: 0.85,
                maxOutputTokens: 4096
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
            return { waypoints: [], quote: `FATAL: AI NAVIGATOR FAILURE [${err.message}]`, reasoning: "Mission Aborted: Critical failure in strategic calculation stack.", isAi: false };
        }
    }
}

async function planStrategicRouteFetch(key, heightmapData, startPos, targetPos, terrainSize, modelId, language) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
    const imageBase64 = heightmapToImage(heightmapData);
    const timestamp = Date.now();
    const textPrompt = ARCHITECT_PROMPT_TEMPLATE(language, terrainSize, startPos, targetPos, timestamp);

    const payload = {
        contents: [{
            parts: [
                { text: textPrompt },
                { inline_data: { mime_type: "image/png", data: imageBase64 } }
            ]
        }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 4096 }
    };
    const response = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`REST API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return parseResponse(text, startPos, targetPos, terrainSize);
}

// ============================================================
// LEVEL 1.1: SCIENTIFIC SPECIALIST (THE SCIENCE CORE)
// ============================================================

export async function getScientificSpecialistReport(apiKey, language = 'EN') {
    let actualKey = "";
    if (typeof apiKey === 'string') actualKey = apiKey.trim();
    else if (apiKey && typeof apiKey.apiKey === 'string') actualKey = apiKey.apiKey.trim();

    if (!actualKey) return { quote: "PHYSICS CORE OFFLINE.", isAi: false };

    const textPrompt = `You are the Physical Specialist for the Unseen Pathfinder Mission.
Your task is to provide a single, unique, technically dense scientific quote or status alert about the lunar environment.

TECHNICAL CONSTRAINTS:
- Use terms like: 'regolith friction', 'isostatic balance', 'thermal gradient', 'basaltic opacity', 'low-gravity traction'.
- AVOID: Historical clichés, Armstrong, or poetic metaphors.
- FOCUS: Pure physics and geological observations.
- LANGUAGE: ${language}.
`;

    try {
        const genAI = new GoogleGenerativeAI(actualKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        const result = await model.generateContent(textPrompt);
        const text = result.response.text().replace(/"/g, '').trim();
        return { quote: text, isAi: true };
    } catch (e) {
        return { quote: "DATA STREAM CORRUPTED.", isAi: false };
    }
}

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
    console.log("[AI ARCHITECT] Raw Response Received:", text);

    // Robust JSON extraction
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const cleanJson = jsonMatch[0].replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            const halfSize = terrainSize / 2;
            const rawWaypoints = (parsed.waypoints || []);
            const validWaypoints = rawWaypoints.map(wp => [
                Math.max(-halfSize, Math.min(halfSize, wp[0])),
                Math.max(-halfSize, Math.min(halfSize, wp[1]))
            ]);

            return {
                waypoints: validWaypoints.length > 0 ? validWaypoints : generateFallbackRoute(startPos, targetPos),
                quote: sanitizeAndEnhanceQuote(parsed.quote),
                reasoning: parsed.reasoning || "Analysis complete but no descriptive reasoning provided.",
                isAi: true
            };
        } catch (e) {
            console.error("[AI Navigator] JSON Parse Error. Raw text:", text);
        }
    }

    // Total Transparency Fallback: Return raw text as reasoning so the user can see it
    return {
        waypoints: [],
        quote: "CRITICAL: Response Format Violation.",
        reasoning: `The AI Architect failed to return valid JSON. Potential data corruption or safety filter block.\n\nRAW TELEMETRY DATA RECEIVED:\n------------------------\n${text || "[EMPTY RESPONSE]"}\n------------------------`,
        isAi: false
    };
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
        const genAI = new GoogleGenerativeAI(actualKey);
        const model = genAI.getGenerativeModel({
            model: activeModel,
            generationConfig: { temperature: 0.4, maxOutputTokens: 256 }
        });
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
export function heightmapToImage(hData) {
    if (!hData) return "";
    // Target side 257x257 for optimal AI processing
    const targetSide = 257;
    const side = Math.floor(Math.sqrt(hData.length));

    if (!hCanvas) hCanvas = document.createElement('canvas');
    hCanvas.width = hCanvas.height = targetSide;
    const ctx = hCanvas.getContext('2d');

    // Create temporary image data of original size
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = tempCanvas.height = side;
    const tempCtx = tempCanvas.getContext('2d');
    const iData = tempCtx.createImageData(side, side);

    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < hData.length; i++) {
        if (hData[i] < minH) minH = hData[i];
        if (hData[i] > maxH) maxH = hData[i];
    }
    let r = maxH - minH || 1;

    for (let i = 0; i < hData.length; i++) {
        const val = Math.floor(((hData[i] - minH) / r) * 255);
        iData.data[i * 4] = iData.data[i * 4 + 1] = iData.data[i * 4 + 2] = val;
        iData.data[i * 4 + 3] = 255;
    }
    tempCtx.putImageData(iData, 0, 0);

    // Scale and draw to main canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, targetSide, targetSide);
    ctx.drawImage(tempCanvas, 0, 0, side, side, 0, 0, targetSide, targetSide);

    return hCanvas.toDataURL('image/png').split(',')[1];
}

export function summarizeFan(trajectories) {
    const s = trajectories.reduce((acc, t) => { acc[t.risk]++; return acc; }, { safe: 0, warning: 0, critical: 0 });
    return `${s.safe}/${trajectories.length} safe`;
}
