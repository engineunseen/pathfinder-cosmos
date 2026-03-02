// store.js — Structured state manager with domain separation
// Cosmos Cookoff Edition — NVIDIA Cosmos Reason 2 only
import { createContext, useContext } from 'react';

// ======== CONSTANTS ========
export const VERSION = "v4C.2.0";
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
        terrainResolution: TERRAIN_RESOLUTIONS.MEDIUM, // Fixed — resolution picker disabled in Cosmos edition
        dustDensity: parseInt(localStorage.getItem('pf_dust_density')) || DUST_DENSITIES.MEDIUM,
    },

    // ── AI DOMAIN (Cosmos Only — model HARDCODED for hackathon) ──
    ai: {
        aiModel: 'nvidia/Cosmos-Reason2-2B', // LOCKED — Cosmos Cookoff requirement
        visionProvider: 'cosmos',
        nvidiaNimUrl: localStorage.getItem('pathfinder_nvidia_url') || 'http://localhost:8001/v1',
        nvidiaApiKey: localStorage.getItem('pathfinder_nvidia_key') || '',
    },

    // ── MISSION DOMAIN ──
    mission: {
        driveMode: DRIVE_MODES.MANUAL,
        simulationState: 'running',
        failReason: '',
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
        // TOGGLE_NAV_OVERLAY removed — Cosmos Cookoff edition
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

        // ── AI DOMAIN (Cosmos Only) ──
        case 'SET_AI_MODEL': {
            const finalModel = action.payload;
            localStorage.setItem('pathfinder_ai_model', finalModel);
            return {
                ...state,
                ai: { ...state.ai, aiModel: finalModel },
                logs: addLog(state, `SYSTEM: MODEL → [${finalModel.toUpperCase()}]`)
            };
        }
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

        case 'RESET_DEFAULTS':
            // Wipe all persisted settings
            localStorage.removeItem('pf_brightness');
            localStorage.removeItem('pf_shadow');
            localStorage.removeItem('pf_chromatic');
            localStorage.removeItem('pf_terrain_mode');
            localStorage.removeItem('pf_dust_density');
            localStorage.removeItem('pathfinder_ai_model');
            localStorage.removeItem('pathfinder_nvidia_url');
            localStorage.removeItem('pathfinder_nvidia_key');

            return {
                ...getInitialState(),
                logs: [createLog("SYSTEM: ALL PARAMETERS RESET TO FACTORY DEFAULTS", 'warning')]
            };

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
