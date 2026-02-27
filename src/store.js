// store.js — Structured state manager with domain separation
// v4.0.0: Architecture refactoring — domain-grouped state
import { createContext, useContext } from 'react';

// ======== CONSTANTS ========
export const VERSION = "v4.0.0";
export const LUNAR_GRAVITY = 1.62;
export const EARTH_GRAVITY = 9.81;
export const ROLLOVER_ANGLE = 60; // degrees
export const WARNING_ANGLE = 45; // degrees
export const MONTE_CARLO_SAMPLES = 50;
export const PREDICTION_HORIZON = 3.0; // seconds
export const PREDICTION_STEPS = 30;

export const COLORS = {
    PRIMARY_INFO: '#00FFFF',
    SAFE_PATH: '#00FF41',
    WARNING_PATH: '#FFBF00',
    CRITICAL_PATH: '#FF0055',
    ACCENT: '#FFFFFF',
    BG_PANEL: 'rgba(0, 0, 0, 0.6)',
};

// AI/Drive modes
export const DRIVE_MODES = {
    MANUAL: 'manual',
    AUTOPILOT: 'autopilot',
};

// Terrain resolution presets
export const TERRAIN_RESOLUTIONS = {
    LOW: 128,
    MEDIUM: 256,
    HIGH: 512,
};

// Dust density presets
export const DUST_DENSITIES = {
    LOW: 200,
    MEDIUM: 600,
    HIGH: 1200,
};

// ======== INITIAL STATE GENERATOR ========
export const getInitialState = () => ({
    // ── GRAPHICS DOMAIN ──
    graphics: {
        brightness: parseFloat(localStorage.getItem('pf_brightness')) || 1.2,
        shadowContrast: parseFloat(localStorage.getItem('pf_shadow')) || 0.5,
        chromaticAberration: localStorage.getItem('pf_chromatic') === 'true',
        terrainMode: localStorage.getItem('pf_terrain_mode') || 'legacy',
        terrainResolution: parseInt(localStorage.getItem('pf_terrain_res')) || TERRAIN_RESOLUTIONS.MEDIUM,
        dustDensity: parseInt(localStorage.getItem('pf_dust_density')) || DUST_DENSITIES.MEDIUM,
    },

    // ── AI DOMAIN ──
    ai: {
        apiKey: localStorage.getItem('pathfinder_api_key') || '',
        aiModel: localStorage.getItem('pathfinder_ai_model') || 'gemini-3-flash-preview',
        visionProvider: localStorage.getItem('pathfinder_vision_provider') || 'gemini',
        nvidiaNimUrl: localStorage.getItem('pathfinder_nvidia_url') || '',
        nvidiaApiKey: localStorage.getItem('pathfinder_nvidia_key') || '',
        aiUseMonteCarlo: localStorage.getItem('pathfinder_use_mc') !== 'false',
        aiUsePath: localStorage.getItem('pathfinder_use_path') === 'true',
        waypointCount: 7,
    },

    // ── MISSION DOMAIN ──
    mission: {
        driveMode: DRIVE_MODES.MANUAL,
        simulationState: 'running',
        failReason: '',
        navigationOverlay: false,
        terrainSeed: Math.random() * 10000,
        isCalibrationMode: false,
        arrivalAccuracy: 5.0,
    },

    // ── UI DOMAIN ──
    ui: {
        language: 'EN',
        terminalOpen: false,
        uiVisible: true,
        helpOpen: false,
    },

    // ── TELEMETRY (volatile, not persisted) ──
    telemetry: {
        speed: 0,
        pitch: 0,
        roll: 0,
        battery: 100,
        targetDistance: 0,
        safetyScore: 100,
        elapsedTime: 0,
        roverPosition: [0, 2, 0],
        roverRotation: [0, 0, 0],
    },

    // ── RUNTIME STATE ──
    monteCarloResults: null,
    inputState: { forward: 0, backward: 0, left: 0, right: 0, brake: false },
    logs: [{ id: Date.now(), text: "SYSTEM: INITIALIZING NAVIGATION STACK...", type: 'info' }],
});

// ======== HELPERS ========
function saveGraphics(key, val) { localStorage.setItem(key, val); }

function createLog(text, type = 'info') {
    return { id: Date.now() + Math.random(), text, type, timestamp: new Date().toLocaleTimeString() };
}

function addLog(state, text, type = 'info') {
    return [createLog(text, type), ...state.logs].slice(0, 50);
}

// ======== REDUCER ========
function simulationReducer(state, action) {
    switch (action.type) {
        // ── LOGS ──
        case 'ADD_LOG':
            return {
                ...state,
                logs: [createLog(action.payload.text, action.payload.type || 'info', action.payload.image), ...state.logs].slice(0, 50)
            };
        case 'CLEAR_LOGS':
            return { ...state, logs: [] };

        // ── UI DOMAIN ──
        case 'SET_LANGUAGE':
            return { ...state, ui: { ...state.ui, language: action.payload } };
        case 'TOGGLE_TERMINAL':
            return { ...state, ui: { ...state.ui, terminalOpen: !state.ui.terminalOpen } };
        case 'TOGGLE_UI':
            return { ...state, ui: { ...state.ui, uiVisible: !state.ui.uiVisible } };
        case 'TOGGLE_HELP':
            return { ...state, ui: { ...state.ui, helpOpen: !state.ui.helpOpen } };

        // ── MISSION DOMAIN ──
        case 'TOGGLE_AUTOPILOT': {
            const isManual = state.mission.driveMode === DRIVE_MODES.MANUAL;
            return {
                ...state,
                mission: { ...state.mission, driveMode: isManual ? DRIVE_MODES.AUTOPILOT : DRIVE_MODES.MANUAL },
                logs: addLog(state, isManual ? "MODE: AUTOPILOT ENGAGED" : "MODE: MANUAL CONTROL RESTORED", isManual ? 'warning' : 'info')
            };
        }
        case 'SET_DRIVE_MODE':
            return {
                ...state,
                mission: { ...state.mission, driveMode: action.payload },
                logs: addLog(state, action.payload === DRIVE_MODES.AUTOPILOT ? "MODE: AUTOPILOT ENGAGED" : "MODE: MANUAL CONTROL RESTORED", action.payload === DRIVE_MODES.AUTOPILOT ? 'warning' : 'info')
            };
        case 'TOGGLE_NAV_OVERLAY':
            return {
                ...state,
                mission: { ...state.mission, navigationOverlay: !state.mission.navigationOverlay },
                logs: addLog(state, !state.mission.navigationOverlay ? "SYSTEM: MONTE CARLO OVERLAY ACTIVATED" : "SYSTEM: MONTE CARLO OVERLAY DEACTIVATED")
            };
        case 'SET_SIMULATION_STATE': {
            const targetState = action.payload.state || action.payload;
            const targetReason = action.payload.reason || '';
            const simLog = targetState === 'success'
                ? "MISSION: SUCCESS — SIGNAL BEACON REACHED"
                : `MISSION: TERMINATED — ${targetReason.toUpperCase() || 'STABILITY BREACH'}`;
            return {
                ...state,
                mission: { ...state.mission, simulationState: targetState, failReason: targetReason },
                logs: addLog(state, simLog, targetState === 'success' ? 'info' : 'critical')
            };
        }
        case 'SET_ARRIVAL_ACCURACY':
            return { ...state, mission: { ...state.mission, arrivalAccuracy: action.payload } };

        // ── RESET & TERRAIN ──
        case 'RESET_SIMULATION':
            return {
                ...getInitialState(),
                graphics: state.graphics, // ← Entire domain preserved
                ai: state.ai,
                ui: state.ui,
                mission: {
                    ...state.mission,
                    driveMode: DRIVE_MODES.MANUAL,
                    navigationOverlay: false,
                    simulationState: 'running',
                    failReason: '',
                },
                logs: addLog(state, "SYSTEM: RESTARTING MISSION...")
            };
        case 'NEW_TERRAIN':
            return {
                ...getInitialState(),
                graphics: state.graphics,
                ai: state.ai,
                ui: state.ui,
                mission: {
                    ...state.mission,
                    driveMode: DRIVE_MODES.MANUAL,
                    navigationOverlay: false,
                    simulationState: 'running',
                    failReason: '',
                    terrainSeed: Math.random() * 10000,
                },
                logs: [createLog("SYSTEM: LANDSCAPE GENERATED.")]
            };
        case 'TOGGLE_CALIBRATION': {
            const isCalOn = !state.mission.isCalibrationMode;
            return {
                ...getInitialState(),
                graphics: state.graphics,
                ai: state.ai,
                ui: state.ui,
                mission: {
                    ...state.mission,
                    isCalibrationMode: isCalOn,
                    driveMode: DRIVE_MODES.MANUAL,
                    navigationOverlay: false,
                    simulationState: 'running',
                    failReason: '',
                    terrainSeed: isCalOn ? 999 : Math.random() * 10000,
                },
                logs: [createLog(isCalOn ? "SYSTEM: CALIBRATION MODE ENGAGED (FLAT PLANE)" : "SYSTEM: CALIBRATION MODE DISENGAGED (LUNAR TERRAIN RESTORED)", isCalOn ? 'warning' : 'info')]
            };
        }

        // ── GRAPHICS DOMAIN ──
        case 'SET_BRIGHTNESS':
            saveGraphics('pf_brightness', action.payload);
            return { ...state, graphics: { ...state.graphics, brightness: action.payload } };
        case 'SET_SHADOW_CONTRAST':
            saveGraphics('pf_shadow', action.payload);
            return { ...state, graphics: { ...state.graphics, shadowContrast: action.payload } };
        case 'TOGGLE_CHROMATIC':
            saveGraphics('pf_chromatic', !state.graphics.chromaticAberration);
            return { ...state, graphics: { ...state.graphics, chromaticAberration: !state.graphics.chromaticAberration } };
        case 'SET_TERRAIN_MODE':
            saveGraphics('pf_terrain_mode', action.payload);
            return { ...state, graphics: { ...state.graphics, terrainMode: action.payload } };
        case 'SET_TERRAIN_RESOLUTION':
            saveGraphics('pf_terrain_res', action.payload);
            return { ...state, graphics: { ...state.graphics, terrainResolution: action.payload } };
        case 'SET_DUST_DENSITY':
            saveGraphics('pf_dust_density', action.payload);
            return { ...state, graphics: { ...state.graphics, dustDensity: action.payload } };

        // ── AI DOMAIN ──
        case 'SET_API_KEY':
            localStorage.setItem('pathfinder_api_key', action.payload);
            return { ...state, ai: { ...state.ai, apiKey: action.payload } };
        case 'SET_AI_MODEL': {
            let finalModel = action.payload;
            if (finalModel === 'cosmos-reasoning') finalModel = 'nvidia/Cosmos-Reason2-2B';
            const isCosmos = finalModel.toLowerCase().includes('cosmos');
            localStorage.setItem('pathfinder_ai_model', finalModel);
            localStorage.setItem('pathfinder_vision_provider', isCosmos ? 'cosmos' : 'gemini');
            let modelLabel = finalModel;
            if (finalModel === 'gemini-3-flash-preview') modelLabel = 'GEMINI 3 FLASH';
            else if (finalModel === 'gemini-3.1-pro-preview') modelLabel = 'GEMINI 3.1 PRO';
            else if (isCosmos) modelLabel = 'NVIDIA COSMOS';
            return {
                ...state,
                ai: { ...state.ai, aiModel: finalModel, visionProvider: isCosmos ? 'cosmos' : 'gemini' },
                logs: addLog(state, `SYSTEM: ENGINE SWITCHED → [${modelLabel.toUpperCase()}]${finalModel.includes('3.1') ? ' ★ NEW MODEL ★' : ''}`)
            };
        }
        case 'SET_WAYPOINT_COUNT':
            return { ...state, ai: { ...state.ai, waypointCount: action.payload } };
        case 'SET_AI_USE_MC':
            localStorage.setItem('pathfinder_use_mc', action.payload);
            return { ...state, ai: { ...state.ai, aiUseMonteCarlo: action.payload } };
        case 'SET_AI_USE_PATH':
            localStorage.setItem('pathfinder_use_path', action.payload);
            return { ...state, ai: { ...state.ai, aiUsePath: action.payload } };
        case 'SET_VISION_PROVIDER':
            localStorage.setItem('pathfinder_vision_provider', action.payload);
            return { ...state, ai: { ...state.ai, visionProvider: action.payload } };
        case 'SET_NVIDIA_NIM_URL':
            localStorage.setItem('pathfinder_nvidia_url', action.payload);
            return { ...state, ai: { ...state.ai, nvidiaNimUrl: action.payload } };
        case 'SET_NVIDIA_API_KEY':
            localStorage.setItem('pathfinder_nvidia_key', action.payload);
            return { ...state, ai: { ...state.ai, nvidiaApiKey: action.payload } };

        // ── TELEMETRY ──
        case 'UPDATE_TELEMETRY':
            return { ...state, telemetry: { ...state.telemetry, ...action.payload } };
        case 'SET_TARGET_DISTANCE':
            return { ...state, telemetry: { ...state.telemetry, targetDistance: action.payload } };

        // ── RUNTIME ──
        case 'SET_MONTE_CARLO':
            return { ...state, monteCarloResults: action.payload };
        case 'SET_INPUT':
            return { ...state, inputState: { ...state.inputState, ...action.payload } };

        default:
            return state;
    }
}

export const SimulationContext = createContext(null);
export const SimulationDispatchContext = createContext(null);

export function useSimulationState() {
    return useContext(SimulationContext);
}

export function useSimulationDispatch() {
    return useContext(SimulationDispatchContext);
}

export { simulationReducer };
