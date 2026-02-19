// store.js — Lightweight global state manager using React context-free approach
import { createContext, useContext } from 'react';

// ======== CONSTANTS ========
export const VERSION = "v3.3.42";
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

// ======== INITIAL STATE GENERATOR ========
export const getInitialState = () => ({
    language: 'EN',
    driveMode: DRIVE_MODES.MANUAL,
    navigationOverlay: false,
    speed: 0,
    pitch: 0,
    roll: 0,
    battery: 100,
    targetDistance: 0,
    simulationState: 'running',
    failReason: '',
    safetyScore: 100,
    elapsedTime: 0,
    terrainSeed: Math.random() * 10000,
    monteCarloResults: null,
    roverPosition: [0, 2, 0],
    roverRotation: [0, 0, 0],
    inputState: { forward: 0, backward: 0, left: 0, right: 0, brake: false },
    brightness: 1.2,
    shadowContrast: 0.5,
    chromaticAberration: false,
    apiKey: localStorage.getItem('pathfinder_api_key') || '',
    aiModel: localStorage.getItem('pathfinder_ai_model') || 'cosmos-reasoning',
    logs: [{ id: Date.now(), text: "SYSTEM: INITIALIZING NAVIGATION STACK...", type: 'info' }],
    waypointCount: 7,
    terminalOpen: false,
    isCalibrationMode: false,
    uiVisible: true,
    arrivalAccuracy: 5.0,
    aiUseMonteCarlo: localStorage.getItem('pathfinder_use_mc') !== 'false',
    aiUsePath: localStorage.getItem('pathfinder_use_path') === 'true', // Default to false
    helpOpen: false,
    terrainMode: 'legacy', // 'legacy' | 'naturalist' | 'ethereal'
    // v3.1.0: Vision Provider settings
    visionProvider: localStorage.getItem('pathfinder_vision_provider') || 'gemini', // 'gemini' | 'cosmos'
    nvidiaNimUrl: localStorage.getItem('pathfinder_nvidia_url') || '',
    nvidiaApiKey: localStorage.getItem('pathfinder_nvidia_key') || '',
});

function simulationReducer(state, action) {
    switch (action.type) {
        case 'ADD_LOG':
            const newLog = {
                id: Date.now() + Math.random(),
                text: action.payload.text,
                type: action.payload.type || 'info',
                image: action.payload.image,
                timestamp: new Date().toLocaleTimeString()
            };
            return {
                ...state,
                logs: [newLog, ...state.logs].slice(0, 50)
            };
        case 'CLEAR_LOGS':
            return { ...state, logs: [] };
        case 'SET_LANGUAGE':
            return { ...state, language: action.payload };
        case 'TOGGLE_AUTOPILOT':
            const isManual = state.driveMode === DRIVE_MODES.MANUAL;
            const logText = isManual ? "MODE: AUTOPILOT ENGAGED" : "MODE: MANUAL CONTROL RESTORED";
            const updatedLogs = [{
                id: Date.now(),
                text: logText,
                type: isManual ? 'warning' : 'info',
                timestamp: new Date().toLocaleTimeString()
            }, ...state.logs].slice(0, 50);
            return {
                ...state,
                driveMode: isManual ? DRIVE_MODES.AUTOPILOT : DRIVE_MODES.MANUAL,
                logs: updatedLogs
            };
        case 'SET_DRIVE_MODE':
            const modeText = action.payload === DRIVE_MODES.AUTOPILOT ? "MODE: AUTOPILOT ENGAGED" : "MODE: MANUAL CONTROL RESTORED";
            return {
                ...state,
                driveMode: action.payload,
                logs: [{
                    id: Date.now(),
                    text: modeText,
                    type: action.payload === DRIVE_MODES.AUTOPILOT ? 'warning' : 'info',
                    timestamp: new Date().toLocaleTimeString()
                }, ...state.logs].slice(0, 50)
            };
        case 'TOGGLE_NAV_OVERLAY':
            const isOverlayOn = !state.navigationOverlay;
            return {
                ...state,
                navigationOverlay: isOverlayOn,
                logs: [{
                    id: Date.now(),
                    text: isOverlayOn ? "SYSTEM: MONTE CARLO OVERLAY ACTIVATED" : "SYSTEM: MONTE CARLO OVERLAY DEACTIVATED",
                    type: 'info',
                    timestamp: new Date().toLocaleTimeString()
                }, ...state.logs].slice(0, 50)
            };
        case 'SET_BRIGHTNESS':
            return { ...state, brightness: action.payload };
        case 'SET_SHADOW_CONTRAST':
            return { ...state, shadowContrast: action.payload };
        case 'TOGGLE_CHROMATIC':
            return { ...state, chromaticAberration: !state.chromaticAberration };
        case 'UPDATE_TELEMETRY':
            return { ...state, ...action.payload };
        case 'SET_SIMULATION_STATE':
            const targetState = action.payload.state || action.payload; // Handle both 'success' and {state: 'failed', reason: '...'}
            const targetReason = action.payload.reason || '';
            const simLog = targetState === 'success'
                ? "MISSION: SUCCESS - BEACON REACHED"
                : `MISSION: TERMINATED - ${targetReason.toUpperCase() || 'STABILITY BREACH'}`;
            return {
                ...state,
                simulationState: targetState,
                failReason: targetReason,
                logs: [{
                    id: Date.now(),
                    text: simLog,
                    type: action.payload.state === 'success' ? 'info' : 'critical',
                    timestamp: new Date().toLocaleTimeString()
                }, ...state.logs].slice(0, 50)
            };
        case 'RESET_SIMULATION':
            return {
                ...getInitialState(),
                language: state.language,
                apiKey: state.apiKey,
                visionProvider: state.visionProvider,
                nvidiaNimUrl: state.nvidiaNimUrl,
                nvidiaApiKey: state.nvidiaApiKey,
                waypointCount: state.waypointCount,
                aiModel: state.aiModel,
                aiUsePath: state.aiUsePath,
                aiUseMonteCarlo: state.aiUseMonteCarlo,
                brightness: state.brightness,
                shadowContrast: state.shadowContrast,
                chromaticAberration: state.chromaticAberration,
                driveMode: DRIVE_MODES.MANUAL, // Force manual
                navigationOverlay: false,      // Force overlay off
                terrainSeed: state.terrainSeed, // Keeps the map
                terrainMode: state.terrainMode, // v3.0.2: Preserve mode
                logs: [{
                    id: Date.now(),
                    text: "SYSTEM: RESTARTING MISSION...",
                    type: 'info',
                    timestamp: new Date().toLocaleTimeString()
                }, ...state.logs].slice(0, 50)
            };
        case 'NEW_TERRAIN':
            return {
                ...getInitialState(),
                language: state.language,
                apiKey: state.apiKey,
                visionProvider: state.visionProvider,
                nvidiaNimUrl: state.nvidiaNimUrl,
                nvidiaApiKey: state.nvidiaApiKey,
                waypointCount: state.waypointCount,
                aiModel: state.aiModel,
                aiUsePath: state.aiUsePath,
                aiUseMonteCarlo: state.aiUseMonteCarlo,
                brightness: state.brightness,
                shadowContrast: state.shadowContrast,
                chromaticAberration: state.chromaticAberration,
                driveMode: DRIVE_MODES.MANUAL,
                navigationOverlay: false,
                terrainSeed: Math.random() * 10000,
                terrainMode: state.terrainMode, // v3.0.2: Preserve mode
                logs: [{
                    id: Date.now(),
                    text: "SYSTEM: LANDSCAPE GENERATED.",
                    type: 'info',
                    timestamp: new Date().toLocaleTimeString()
                }]
            };
        case 'SET_MONTE_CARLO':
            return { ...state, monteCarloResults: action.payload };
        case 'SET_INPUT':
            return { ...state, inputState: { ...state.inputState, ...action.payload } };
        case 'SET_API_KEY':
            localStorage.setItem('pathfinder_api_key', action.payload);
            return { ...state, apiKey: action.payload };
        case 'SET_AI_MODEL':
            let finalModel = action.payload;
            if (finalModel === 'cosmos-reasoning') finalModel = 'nvidia/Cosmos-Reason2-2B';
            const isCosmos = finalModel.toLowerCase().includes('cosmos');
            localStorage.setItem('pathfinder_ai_model', finalModel);
            localStorage.setItem('pathfinder_vision_provider', isCosmos ? 'cosmos' : 'gemini');
            return {
                ...state,
                aiModel: finalModel,
                visionProvider: isCosmos ? 'cosmos' : 'gemini',
                logs: [{
                    id: Date.now(),
                    text: `SYSTEM: AI ARCHITECT SWITCHED TO [${action.payload.toUpperCase()}]`,
                    type: 'info',
                    timestamp: new Date().toLocaleTimeString()
                }, ...state.logs].slice(0, 50)
            };
        case 'SET_WAYPOINT_COUNT':
            return { ...state, waypointCount: action.payload };
        case 'TOGGLE_CALIBRATION':
            const isCalOn = !state.isCalibrationMode;
            return {
                ...getInitialState(),
                language: state.language,
                apiKey: state.apiKey,
                isCalibrationMode: isCalOn,
                terrainSeed: isCalOn ? 999 : Math.random() * 10000,
                logs: [{
                    id: Date.now(),
                    text: isCalOn ? "SYSTEM: CALIBRATION MODE ENGAGED (FLAT PLANE)" : "SYSTEM: CALIBRATION MODE DISENGAGED (LUNAR TERRAIN RESTORED)",
                    type: isCalOn ? 'warning' : 'info',
                    timestamp: new Date().toLocaleTimeString()
                }]
            };
        case 'TOGGLE_TERMINAL':
            return { ...state, terminalOpen: !state.terminalOpen };
        case 'TOGGLE_UI':
            return { ...state, uiVisible: !state.uiVisible };
        case 'SET_ARRIVAL_ACCURACY':
            return { ...state, arrivalAccuracy: action.payload };
        case 'SET_AI_USE_MC':
            localStorage.setItem('pathfinder_use_mc', action.payload);
            return { ...state, aiUseMonteCarlo: action.payload };
        case 'SET_AI_USE_PATH':
            localStorage.setItem('pathfinder_use_path', action.payload);
            return { ...state, aiUsePath: action.payload };
        case 'TOGGLE_HELP':
            return { ...state, helpOpen: !state.helpOpen };
        case 'SET_TERRAIN_MODE':
            return { ...state, terrainMode: action.payload };
        case 'SET_VISION_PROVIDER':
            localStorage.setItem('pathfinder_vision_provider', action.payload);
            return { ...state, visionProvider: action.payload };
        case 'SET_NVIDIA_NIM_URL':
            localStorage.setItem('pathfinder_nvidia_url', action.payload);
            return { ...state, nvidiaNimUrl: action.payload };
        case 'SET_NVIDIA_API_KEY':
            localStorage.setItem('pathfinder_nvidia_key', action.payload);
            return { ...state, nvidiaApiKey: action.payload };
        case 'SET_TARGET_DISTANCE':
            return { ...state, targetDistance: action.payload };
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
