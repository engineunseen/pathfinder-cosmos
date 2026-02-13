// store.js — Lightweight global state manager using React context-free approach
import { createContext, useContext } from 'react';

// ======== CONSTANTS ========
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
// Returns a fresh state object with a new random terrain seed
export const getInitialState = () => ({
    language: 'EN',
    driveMode: DRIVE_MODES.MANUAL,
    navigationOverlay: false, // Independent toggle
    speed: 0,
    pitch: 0,
    roll: 0,
    battery: 100,
    targetDistance: 0,
    simulationState: 'running', // 'running' | 'gameover' | 'success'
    failReason: '',
    safetyScore: 100,
    elapsedTime: 0,
    terrainSeed: Math.random() * 10000,
    monteCarloResults: null,
    roverPosition: [0, 2, 0],
    roverRotation: [0, 0, 0],
    inputState: { forward: 0, backward: 0, left: 0, right: 0, brake: false },
    brightness: 1.2, // Exposure regulator
    shadowContrast: 0.5, // Shadow darkness regulator
    chromaticAberration: false, // OFF by default
    apiKey: localStorage.getItem('pathfinder_api_key') || '', // Gemini API key
    aiModel: 'gemini-3-flash', // Default model
});

// ======== REDUCER ========
function simulationReducer(state, action) {
    switch (action.type) {
        case 'SET_LANGUAGE':
            return { ...state, language: action.payload };
        case 'TOGGLE_AUTOPILOT':
            return {
                ...state,
                driveMode: state.driveMode === DRIVE_MODES.MANUAL ? DRIVE_MODES.AUTOPILOT : DRIVE_MODES.MANUAL,
            };
        case 'SET_DRIVE_MODE':
            return { ...state, driveMode: action.payload };
        case 'TOGGLE_NAV_OVERLAY':
            return { ...state, navigationOverlay: !state.navigationOverlay };
        case 'SET_BRIGHTNESS':
            return { ...state, brightness: action.payload };
        case 'SET_SHADOW_CONTRAST':
            return { ...state, shadowContrast: action.payload };
        case 'TOGGLE_CHROMATIC':
            return { ...state, chromaticAberration: !state.chromaticAberration };
        case 'UPDATE_TELEMETRY':
            return { ...state, ...action.payload };
        case 'SET_SIMULATION_STATE':
            return { ...state, simulationState: action.payload.state, failReason: action.payload.reason || '' };
        case 'RESET_SIMULATION':
            return {
                ...getInitialState(),
                language: state.language,
                apiKey: state.apiKey,
                // Override with new random seed just in case getInitialState logic changes
                terrainSeed: Math.random() * 10000,
            };
        case 'NEW_TERRAIN':
            return {
                ...getInitialState(),
                language: state.language,
                apiKey: state.apiKey,
                terrainSeed: Math.random() * 10000,
            };
        case 'SET_MONTE_CARLO':
            return { ...state, monteCarloResults: action.payload };
        case 'SET_INPUT':
            return { ...state, inputState: { ...state.inputState, ...action.payload } };
        case 'SET_API_KEY':
            localStorage.setItem('pathfinder_api_key', action.payload);
            return { ...state, apiKey: action.payload };
        case 'SET_AI_MODEL':
            return { ...state, aiModel: action.payload }; // 'gemini-3-flash' | 'cosmos-reasoning'
        default:
            return state;
    }
}

// ======== CONTEXT ========
export const SimulationContext = createContext(null);
export const SimulationDispatchContext = createContext(null);

export function useSimulationState() {
    return useContext(SimulationContext);
}

export function useSimulationDispatch() {
    return useContext(SimulationDispatchContext);
}

export { simulationReducer };
