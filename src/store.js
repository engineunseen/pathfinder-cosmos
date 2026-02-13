// store.js — Lightweight global state manager using React context-free approach
import { createContext, useContext } from 'react';

// ======== CONSTANTS ========
export const VERSION = "1.4.9";
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
    aiModel: 'gemini-3-flash',
});

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
                driveMode: DRIVE_MODES.MANUAL, // Force manual
                navigationOverlay: false,      // Force overlay off
                terrainSeed: state.terrainSeed, // Keeps the map
            };
        case 'NEW_TERRAIN':
            return {
                ...getInitialState(),
                language: state.language,
                apiKey: state.apiKey,
                driveMode: DRIVE_MODES.MANUAL,
                navigationOverlay: false,
                terrainSeed: Math.random() * 10000, // Changes the map
            };
        case 'SET_MONTE_CARLO':
            return { ...state, monteCarloResults: action.payload };
        case 'SET_INPUT':
            return { ...state, inputState: { ...state.inputState, ...action.payload } };
        case 'SET_API_KEY':
            localStorage.setItem('pathfinder_api_key', action.payload);
            return { ...state, apiKey: action.payload };
        case 'SET_AI_MODEL':
            return { ...state, aiModel: action.payload };
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
