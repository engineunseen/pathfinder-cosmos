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

// AI mode constants
export const AI_MODES = {
    OFF: 'off',
    ASSIST: 'assist',
    AUTOPILOT: 'autopilot',
};

// ======== INITIAL STATE ========
const initialState = {
    language: 'EN',
    aiMode: AI_MODES.OFF, // 'off' | 'assist' | 'autopilot'
    speed: 0,
    pitch: 0,
    roll: 0,
    battery: 100,
    targetDistance: 0,
    gameState: 'playing', // 'playing' | 'gameover' | 'success'
    failReason: '',
    safetyScore: 100,
    elapsedTime: 0,
    terrainSeed: Math.random() * 10000,
    monteCarloResults: null,
    roverPosition: [0, 5, 0],
    roverRotation: [0, 0, 0],
    inputState: { forward: 0, backward: 0, left: 0, right: 0, brake: false },
};

// ======== REDUCER ========
function gameReducer(state, action) {
    switch (action.type) {
        case 'SET_LANGUAGE':
            return { ...state, language: action.payload };
        case 'TOGGLE_AI': {
            // Cycle: off → assist → autopilot → off
            const modes = [AI_MODES.OFF, AI_MODES.ASSIST, AI_MODES.AUTOPILOT];
            const idx = modes.indexOf(state.aiMode);
            return { ...state, aiMode: modes[(idx + 1) % 3] };
        }
        case 'SET_AI_MODE':
            return { ...state, aiMode: action.payload };
        case 'UPDATE_TELEMETRY':
            return { ...state, ...action.payload };
        case 'SET_GAME_STATE':
            return { ...state, gameState: action.payload.state, failReason: action.payload.reason || '' };
        case 'RESET_GAME':
            return {
                ...initialState,
                language: state.language,
                terrainSeed: Math.random() * 10000,
            };
        case 'NEW_TERRAIN':
            return {
                ...initialState,
                language: state.language,
                terrainSeed: Math.random() * 10000,
            };
        case 'SET_MONTE_CARLO':
            return { ...state, monteCarloResults: action.payload };
        case 'SET_INPUT':
            return { ...state, inputState: { ...state.inputState, ...action.payload } };
        default:
            return state;
    }
}

// ======== CONTEXT ========
export const GameContext = createContext(null);
export const GameDispatchContext = createContext(null);

export function useGameState() {
    return useContext(GameContext);
}

export function useGameDispatch() {
    return useContext(GameDispatchContext);
}

export { initialState, gameReducer };
