// App.jsx — Lunar Risk: Monte Carlo Pathfinder
// Core application logic, physics world setup, and state management

import React, { useEffect, useRef, useState, useCallback, useReducer, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Physics, useBox } from '@react-three/cannon';
import { Stars } from './components/Scene';
import { EffectComposer, ChromaticAberration } from '@react-three/postprocessing';

// Store & Constants
import {
  getInitialState,
  simulationReducer,
  LUNAR_GRAVITY,
  ROLLOVER_ANGLE,
  DRIVE_MODES,
  COLORS,
  SimulationContext,
  SimulationDispatchContext,
  VERSION,
  useSimulationState,
  useSimulationDispatch
} from './store';

// Components
import Rover from './components/Rover';
import LunarTerrain from './components/LunarTerrain';
// import Rocks from './components/Rocks'; // v1.3.0: Disabled — rock generator needs rework
import { Earth, Beacon } from './components/EarthAndBeacon';
import MonteCarloViz from './components/MonteCarloViz';
import HUD from './components/HUD';

import { LunarLighting, CameraController } from './components/Scene';
import Dust from './components/Dust';
import AiTrail from './components/AiTrail';

// AI Navigation System
import { planStrategicRoute, getAutopilotCommand, summarizeFan, heightmapToImage, getLidarData, f1 } from './aiNavigator';

// Terrain Generation Utility
import { generateTerrainData } from './terrain';

function PhysicsScene({
  terrainData,
  getInput,
  driveMode,
  navigationOverlay,
  simulationState,
  dispatch,
  roverRef,
  onTelemetryUpdate,
  startPos,
  monteCarloTrajectories,
  dangerMap,
  shadowContrast,
  waypoints,
  telemetry
}) {
  return (
    <>
      <LunarLighting shadowContrast={shadowContrast} roverPosition={telemetry.position} />
      <LunarTerrain terrainData={terrainData} />
      {/* <Rocks rocks={terrainData.rocks} /> */} {/* v3.0.0: Disabled — rock generator needs rework */}

      {(simulationState === 'running' || simulationState === 'failed') && (
        <Rover
          ref={roverRef}
          getInput={getInput}
          terrainData={terrainData}
          onTelemetryUpdate={onTelemetryUpdate}
          startPosition={startPos}
          driveMode={driveMode}
        />
      )}

      <Earth />
      <Beacon position={[terrainData.beacon.x, terrainData.beacon.y, terrainData.beacon.z]} />

      <MonteCarloViz
        trajectories={monteCarloTrajectories}
        dangerMap={dangerMap}
        active={navigationOverlay && simulationState === 'running'}
        waypoints={waypoints}
        terrainData={terrainData}
      />

      <AiTrail
        roverPosition={telemetry.position}
        autopilotActive={driveMode === DRIVE_MODES.AUTOPILOT}
        overlayActive={navigationOverlay}
      />
    </>
  );
}

export default function SimulationApp() {
  const [state, dispatch] = useReducer(simulationReducer, getInitialState());
  const [telemetry, setTelemetry] = useState({
    speed: '0.0',
    pitch: '0.0',
    roll: '0.0',
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    rotation: [0, 0, 0],
    wheelsOnGround: 6
  });

  const telemetryRef = useRef(telemetry);
  const [isAiPlanning, setIsAiPlanning] = useState(false);
  const [isMcCalculating, setIsMcCalculating] = useState(false);

  const roverRef = useRef();
  const batteryRef = useRef(100);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  const terrainData = useMemo(() => {
    return generateTerrainData(state.terrainSeed, state.terrainMode);
  }, [state.terrainSeed, state.terrainMode]);

  const [isMobile, setIsMobile] = useState(false);
  const [waypoints, setWaypoints] = useState([]);
  const [aiQuote, setAiQuote] = useState("");
  const [currentWaypointIdx, setCurrentWaypointIdx] = useState(0);
  const [lidarScan, setLidarScan] = useState(null); // V0.8.34: Visual Lidar Feed
  const lastPlannedSeed = useRef(null); // EMERGENCY LOCK: Prevent billing loop
  const planningInProgressRef = useRef(false); // Atomic lock
  const lastAiReasoningRef = useRef(""); // V0.8.23: Deduplication for terminal logs
  const lastAiLogTimeRef = useRef(0);    // V0.8.26: Frequency control
  const [currentLatency, setCurrentLatency] = useState(1000); // V0.9.25: Dynamic RTT tracking in ms
  const lastAiSourceRef = useRef(null); // V0.9.46: Track AI vs Core driver for logging
  const targetDistance = useMemo(() => {
    if (!telemetry.position || !terrainData || !terrainData.beacon) return 0;
    return Math.sqrt(
      Math.pow(telemetry.position[0] - terrainData.beacon.x, 2) +
      Math.pow(telemetry.position[2] - terrainData.beacon.z, 2)
    );
  }, [telemetry.position, terrainData.beacon, terrainData.size]);

  // V16: MANUAL INTENT PLANNING - Only calculate when user asks
  const triggerAiPlanning = useCallback(async () => {
    if (planningInProgressRef.current || isAiPlanning || !terrainData || !state.apiKey) return;

    const planningKey = `${state.terrainSeed}_${state.aiModel}_${state.apiKey}`;
    if (lastPlannedSeed.current === planningKey && waypoints.length > 0) return; // Already planned for this map

    console.log(`[AI] Start Strategic Planning for seed: ${state.terrainSeed}`);
    planningInProgressRef.current = true;
    lastPlannedSeed.current = planningKey;

    setIsAiPlanning(true);
    setWaypoints([]); // Clear visual IMMEDIATELY on intent
    setAiQuote("");
    const terrainImage = heightmapToImage(terrainData.heightData);
    console.log("[App] Dispatching Terrain Image Log:", terrainImage ? terrainImage.substring(0, 30) : "NULL");
    dispatch({
      type: 'ADD_LOG',
      payload: {
        text: "AI ARCHITECT: SCANNING LUNAR TOPOLOGY [257x257 RAW DATA]...",
        type: 'info',
        image: terrainImage
      }
    });

    try {
      const startPos = telemetryRef.current.position || [0, 0, 0];
      const targetPos = [terrainData.beacon.x, terrainData.beacon.y, terrainData.beacon.z];
      const aiLang = (state.language === 'RU' || state.language === 'UA') ? state.language : 'EN';

      const result = await planStrategicRoute(
        state.apiKey,
        terrainData.heightData,
        startPos,
        targetPos,
        terrainData.size,
        state.waypointCount,
        state.aiModel,
        aiLang
      );

      if (result && lastPlannedSeed.current === planningKey) {
        setWaypoints(result.waypoints);
        setAiQuote(result.quote);
        setCurrentWaypointIdx(0);

        if (result.isAi && result.reasoning) {
          dispatch({
            type: 'ADD_LOG',
            payload: {
              text: `AI ARCHITECT STRATEGIC ANALYSIS:\n${result.reasoning}`,
              type: 'system'
            }
          });
        } else {
          // TOTAL DISCLOSURE: No faking
          dispatch({
            type: 'ADD_LOG',
            payload: {
              text: `CRITICAL ERROR: AI ARCHITECT DISCONNECTED.\n${result.reasoning || "NO TELEMETRY RECEIVED."}`,
              type: 'critical'
            }
          });
          setIsAiPlanning(false);
          planningInProgressRef.current = false;
          return; // STOP MISSION
        }

        if (result.quote) {
          dispatch({
            type: 'ADD_LOG',
            payload: {
              text: `AI QUOTE: "${result.quote}"`,
              type: 'info'
            }
          });
        }

        dispatch({
          type: 'ADD_LOG',
          payload: {
            text: "AI ARCHITECT: STRATEGIC ROUTE COMMITTED.",
            type: 'info'
          }
        });
      }
    } catch (e) {
      console.error("[AI] Strategic Planning Error:", e);
      dispatch({ type: 'ADD_LOG', payload: { text: `AI ARCHITECT: CALCULATION FAILED - ${e.message}`, type: 'critical' } });
      lastPlannedSeed.current = null;
    } finally {
      setIsAiPlanning(false);
      planningInProgressRef.current = false;
    }
  }, [state.apiKey, state.terrainSeed, state.aiModel, terrainData, isAiPlanning, state.language, waypoints.length]);

  const handlePlanRoute = useCallback(() => {
    triggerAiPlanning();
  }, [triggerAiPlanning]);

  // V0.9.27: AUTO-PLAN ON RESET
  // Automatically triggers the AI Architect if we are in Autopilot mode but have no route (e.g., after a crash or map refresh).
  useEffect(() => {
    if (state.driveMode === DRIVE_MODES.AUTOPILOT &&
      waypoints.length === 0 &&
      !isAiPlanning &&
      state.simulationState === 'running' &&
      terrainData &&
      state.apiKey) {
      triggerAiPlanning();
    }
  }, [state.driveMode, state.simulationState, waypoints.length, isAiPlanning, terrainData, state.apiKey, triggerAiPlanning]);

  // Monte Carlo state
  const [monteCarloTrajectories, setMonteCarloTrajectories] = useState(null);
  const [riskMetrics, setRiskMetrics] = useState({ sCVaR: 0, SMaR: 0 });

  // V19: RISK MONITORING - Log to terminal on threshold crossing
  const lastRiskLevels = useRef({ sCVaR: 0, SMaR: 3 }); // 0:safe, 1:warn, 2:critical | 3:comfortable, 2:caution, 1:danger
  useEffect(() => {
    if (riskMetrics.sCVaR === undefined || riskMetrics.SMaR === undefined) return;

    // sCVaR Monitoring
    let sLevel = 0;
    if (riskMetrics.sCVaR > 60) sLevel = 2;
    else if (riskMetrics.sCVaR > 30) sLevel = 1;

    if (sLevel > lastRiskLevels.current.sCVaR) {
      const msg = sLevel === 2 ? "ALERT: CRITICAL sCVaR DETECTED (>60)" : "WARNING: ELEVATED sCVaR DETECTED (>30)";
      dispatch({ type: 'ADD_LOG', payload: { text: msg, type: sLevel === 2 ? 'critical' : 'warning' } });
    }
    lastRiskLevels.current.sCVaR = sLevel;

    // SMaR Monitoring
    let smLevel = 3;
    if (riskMetrics.SMaR < 15) smLevel = 1;
    else if (riskMetrics.SMaR < 35) smLevel = 2;

    if (smLevel < lastRiskLevels.current.SMaR) {
      const msg = smLevel === 1 ? "ALERT: EXTREME ROLLOVER RISK - SMaR < 15m" : "WARNING: STABILITY MARGIN REDUCED - SMaR < 35m";
      dispatch({ type: 'ADD_LOG', payload: { text: msg, type: smLevel === 1 ? 'critical' : 'warning' } });
    }
    lastRiskLevels.current.SMaR = smLevel;
  }, [riskMetrics.sCVaR, riskMetrics.SMaR]);
  const [dangerMap, setDangerMap] = useState(null);
  const mcWorkerRef = useRef(null);

  // AI Navigation state
  // AI Navigation state
  const aiCommandRef = useRef(null); // V0.9.26: Init null for cold start fallback
  const lastAiCommandsRef = useRef([]); // V0.9.24: Tactical Memory array
  const isAiAutopilotRunningRef = useRef(false);

  // Sync telemetry ref
  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  // Check for mobile (Dynamic)
  useEffect(() => {
    const checkMobile = () => {
      const isUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isNarrow = window.innerWidth < 768;
      setIsMobile(isUA || isNarrow);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const startPos = useMemo(() => {
    if (!terrainData || !terrainData.spawn) return [0, 1, 0];
    const { x, z } = terrainData.spawn;
    const halfSize = terrainData.size / 2;
    const centerX = Math.floor(((x + halfSize) / terrainData.size) * terrainData.segments);
    const centerZ = Math.floor(((z + halfSize) / terrainData.size) * terrainData.segments);

    let bestX = x, bestZ = z, minTilt = Infinity, bestY = 0;

    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -4; dz <= 4; dz++) {
        const ix = Math.min(terrainData.segments, Math.max(0, centerX + dx));
        const iz = Math.min(terrainData.segments, Math.max(0, centerZ + dz));
        const h = terrainData.matrix[iz][ix];
        // Sample tilt
        const tiltX = Math.abs(terrainData.matrix[iz][Math.min(terrainData.segments, ix + 1)] - terrainData.matrix[iz][Math.max(0, ix - 1)]);
        const tiltZ = Math.abs(terrainData.matrix[Math.min(terrainData.segments, iz + 1)][ix] - terrainData.matrix[Math.max(0, iz - 1)][ix]);
        const totalTilt = tiltX + tiltZ;

        if (totalTilt < minTilt) {
          minTilt = totalTilt;
          bestX = (ix / terrainData.segments - 0.5) * terrainData.size;
          bestZ = (iz / terrainData.segments - 0.5) * terrainData.size;
          bestY = h;
        }
      }
    }
    return [bestX, bestY + 0.8, bestZ];
  }, [terrainData]);

  // V1.4.8: SEED-BASED RESET & SYNC
  // Only snaps coordinates when the map seed changes, avoiding recursive loops.
  useEffect(() => {
    if (startPos) {
      setTelemetry(prev => ({
        ...prev,
        position: startPos,
        velocity: [0, 0, 0],
        rotation: [0, 0, 0]
      }));
      setWaypoints([]);
      setAiQuote("");
      setIsAiPlanning(false);
      setIsMcCalculating(false);
      setCurrentWaypointIdx(0);
      elapsedRef.current = 0;
      batteryRef.current = 100;
      inputRef.current = { forward: 0, backward: 0, left: 0, right: 0, brake: false };
    }
  }, [state.terrainSeed, startPos]);

  const inputRef = useRef({ forward: 0, backward: 0, left: 0, right: 0, brake: false });
  const getInput = useCallback(() => inputRef.current, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isAutopilot = state.driveMode === DRIVE_MODES.AUTOPILOT;
      const moveKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'];
      if (isAutopilot && moveKeys.includes(e.code)) return;

      switch (e.code) {
        case 'KeyW': inputRef.current.forward = 1; break;
        case 'KeyS': inputRef.current.backward = 1; break;
        case 'KeyA': inputRef.current.left = 1; break;
        case 'KeyD': inputRef.current.right = 1; break;
        case 'Space': inputRef.current.brake = true; break;
        case 'KeyM':
          dispatch({ type: 'TOGGLE_AUTOPILOT' });
          if (state.driveMode === DRIVE_MODES.MANUAL) triggerAiPlanning();
          break;
        case 'KeyN':
          if (!state.navigationOverlay && waypoints.length === 0) triggerAiPlanning();
          dispatch({ type: 'TOGGLE_NAV_OVERLAY' });
          break;
        case 'KeyP': handlePlanRoute(); break; // Added 'P' for Plan
        case 'KeyR': handleRestart(); break;
      }
    };
    const handleKeyUp = (e) => {
      const isAutopilot = state.driveMode === DRIVE_MODES.AUTOPILOT;
      const moveKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space'];
      if (isAutopilot && moveKeys.includes(e.code)) return;


      switch (e.code) {
        case 'KeyW': inputRef.current.forward = 0; break;
        case 'KeyS': inputRef.current.backward = 0; break;
        case 'KeyA': inputRef.current.left = 0; break;
        case 'KeyD': inputRef.current.right = 0; break;
        case 'Space': inputRef.current.brake = false; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handlePlanRoute]);

  const handleTelemetry = useCallback((data) => {
    setTelemetry(prev => ({ ...prev, ...data }));
  }, []);

  useEffect(() => {
    let frame;
    const loop = (t) => {
      const dt = (t - lastTimeRef.current) / 1000;
      lastTimeRef.current = t;

      // ROLLOVER CHECK (Must be outside simulationState guard to catch physics updates)
      const isRollover = Math.abs(telemetry.roll) >= ROLLOVER_ANGLE || Math.abs(telemetry.pitch) >= ROLLOVER_ANGLE;

      if (state.simulationState === 'running' && !isAiPlanning) {
        elapsedRef.current += dt;
        batteryRef.current = Math.max(0, batteryRef.current - dt * 0.05);

        if (isRollover && state.simulationState === 'running') {
          dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'failed', reason: 'stability' } });
        } else if (targetDistance < state.arrivalAccuracy && state.simulationState === 'running') {
          dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'success' } });
        } else if (batteryRef.current <= 0 && state.simulationState === 'running') {
          dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'failed', reason: 'damage' } });
        }

        // V0.8.34: REAL-TIME LIDAR SCAN (Visual Feed)
        if (state.navigationOverlay || state.driveMode === DRIVE_MODES.AUTOPILOT) {
          const rawLidar = getLidarData(telemetryRef.current.position, telemetryRef.current.rotation, terrainData);
          setLidarScan(rawLidar);
        } else if (lidarScan) {
          setLidarScan(null);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.simulationState, terrainData.beacon, telemetry.position, isAiPlanning]);

  useEffect(() => {
    if (state.driveMode === DRIVE_MODES.AUTOPILOT && state.simulationState === 'running') {
      if (!telemetryRef.current || !telemetryRef.current.position) return;

      // V1.5.0: WAIT FOR PLAN LOGIC
      if (isAiPlanning) {
        inputRef.current.left = 0;
        inputRef.current.right = 0;
        inputRef.current.forward = 0;
        inputRef.current.backward = 0;
        inputRef.current.brake = true;
        return;
      }

      if (monteCarloTrajectories) {
        const mcSorted = [...monteCarloTrajectories].sort((a, b) => b.fitness - a.fitness);
        const currentWP = (waypoints && waypoints.length > 0 && waypoints[currentWaypointIdx])
          ? waypoints[currentWaypointIdx]
          : [terrainData.beacon.x, terrainData.beacon.z];

        const px = telemetryRef.current.position[0], pz = telemetryRef.current.position[2];
        const dx = currentWP[0] - px, dz = currentWP[1] - pz;
        const distToWP = Math.sqrt(dx * dx + dz * dz);

        // V0.9.21: SMART WAYPOINT SKIPPING
        // If we are close or if the next waypoint is also close, skip ahead
        if (waypoints && currentWaypointIdx < waypoints.length - 1) {
          const nextWP = waypoints[currentWaypointIdx + 1];
          const dNext = Math.sqrt((nextWP[0] - px) ** 2 + (nextWP[1] - pz) ** 2);
          if (distToWP < 8 || dNext < 10) {
            setCurrentWaypointIdx(prev => prev + 1);
          }
        }

        // V0.9.43: CALCULATE COORDINATES FOR ALL STREAMS
        const roverQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(telemetryRef.current.rotation[0], telemetryRef.current.rotation[1], telemetryRef.current.rotation[2], 'YXZ')
        );
        const beaconPos = new THREE.Vector3(terrainData.beacon.x, telemetryRef.current.position[1], terrainData.beacon.z);
        const roverPos = new THREE.Vector3(...telemetryRef.current.position);

        // 1. REAL-TIME (Current) for the 60FPS local safety driver
        const relTargetNow = beaconPos.clone().sub(roverPos).applyQuaternion(roverQuat.invert());
        const realTimeBearing = Math.atan2(relTargetNow.x, -relTargetNow.z) * 180 / Math.PI;

        // 2. PREDICTED (Future) for the latent AI
        // V0.9.44: ADAPTIVE FORESIGHT - Reduce prediction as we approach target
        const speedMs = new THREE.Vector3(...telemetryRef.current.velocity).length();
        const timeToReach = targetDistance / Math.max(speedMs, 0.5);
        const maxPred = Math.min(currentLatency / 1000, 3.0);
        const predSec = Math.min(maxPred, timeToReach * 0.7); // Never predict more than 70% of distance away

        const angVel = telemetryRef.current.angularVelocity || [0, 0, 0];
        const predDeltaQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angVel[1] * predSec);
        const predictedQuat = roverQuat.clone().multiply(predDeltaQuat);
        const predictedPos3 = new THREE.Vector3(
          telemetryRef.current.position[0] + (telemetryRef.current.velocity[0] * predSec),
          telemetryRef.current.position[1],
          telemetryRef.current.position[2] + (telemetryRef.current.velocity[2] * predSec)
        );
        const relTargetPred = beaconPos.clone().sub(predictedPos3).applyQuaternion(predictedQuat.invert());
        const predictedBearing = Math.atan2(relTargetPred.x, -relTargetPred.z) * 180 / Math.PI;

        const aiState = {
          position: telemetryRef.current.position,
          velocity: telemetryRef.current.velocity,
          rotation: telemetryRef.current.rotation,
          relBearing: predictedBearing,
          realTimeBearing: realTimeBearing,
          targetDistance: targetDistance,
          wheelsOnGround: telemetryRef.current.wheelsOnGround,
          targetPos: [terrainData.beacon.x, terrainData.beacon.z],
          terrainData: terrainData,
          commandHistory: lastAiCommandsRef.current,
          latency: currentLatency,
          // V0.9.46: Sensor Toggles & Data
          currentPathWaypoints: waypoints && waypoints.length > 0 ? `Next WP: [${f1(waypoints[0][0])}, ${f1(waypoints[0][1])}]` : "No Path",
          // v3.1.0: Frame Capture for Cosmos
          capturedFrame: state.visionProvider === 'cosmos' ? sceneCapturedFrame : null,
          visionProvider: state.visionProvider,
          nvidiaNimUrl: state.nvidiaNimUrl,
          nvidiaApiKey: state.nvidiaApiKey
        };

        // AI Autopilot Logic (Call GEMINI only if not busy)
        if (state.apiKey && !isAiAutopilotRunningRef.current) {
          isAiAutopilotRunningRef.current = true;
          const aiStartTime = performance.now();
          getAutopilotCommand(state.apiKey, aiState, state.aiModel)
            .then(cmd => {
              const rtt = Math.round(performance.now() - aiStartTime);
              setCurrentLatency(rtt); // Update for next cycle
              if (rtt > 5000) {
                dispatch({ type: 'ADD_LOG', payload: { text: `SYSTEM: High latency detected (${rtt}ms). AI is calculating future path...`, type: 'warning' } });
              }

              aiCommandRef.current = cmd;

              // Updates Tactical Memory (keep last 3 commands)
              lastAiCommandsRef.current = [
                { steer: cmd.steer, throttle: cmd.throttle, reasoning: cmd.reasoning.substring(0, 30) },
                ...lastAiCommandsRef.current
              ].slice(0, 3);

              const now = Date.now();
              const isNewReasoning = cmd.reasoning && cmd.reasoning !== lastAiReasoningRef.current;
              const isTimeElapsed = now - lastAiLogTimeRef.current > 10000; // 10 seconds

              if (isNewReasoning || isTimeElapsed) {
                lastAiReasoningRef.current = cmd.reasoning;
                lastAiLogTimeRef.current = now;
                dispatch({ type: 'ADD_LOG', payload: { text: `AI AUTOPILOT: ${cmd.reasoning}`, type: 'info' } });
              }

              // V0.9.11: Log RAW RESPONSE on failure for debugging
              if (cmd.raw && (cmd.reasoning.startsWith('PARSE_FAIL') || cmd.reasoning.includes('JSON Parse Error'))) {
                dispatch({ type: 'ADD_LOG', payload: { text: `RAW_AI_OUTPUT: ${cmd.raw}`, type: 'warning' } });
              }
            })
            .catch(err => {
              dispatch({ type: 'ADD_LOG', payload: { text: `SYSTEM: AI Deadlock prevented - core script failure. Attempting recovery...`, type: 'critical' } });
              console.error("AI Autopilot Error:", err);
            })
            .finally(() => { isAiAutopilotRunningRef.current = false; });
        }

        // V0.9.30: Improved command selection + STALE COMMAND PROTECTION
        // If RTT is > 4 seconds, data is too old for safe steering.
        const isStale = currentLatency > 4000;

        let cmd;
        if (state.apiKey && aiCommandRef.current && aiCommandRef.current.reasoning && !aiCommandRef.current.reasoning.includes("AUTOPILOT_FATAL") && !isStale) {
          cmd = aiCommandRef.current;
          inputRef.current.brake = false;
          if (lastAiSourceRef.current !== 'ai') {
            dispatch({ type: 'ADD_LOG', payload: { text: "SYSTEM: AI_LINK_ESTABLISHED. TACTICAL AUTOPILOT ENGAGED.", type: 'info' } });
            lastAiSourceRef.current = 'ai';
          }
        } else {
          // V0.9.42: ALWAYS USE REAL-TIME BEARING FOR LOCAL DRIVER
          const localAiState = { ...aiState, relBearing: realTimeBearing };
          cmd = getHeuristicFromFan(mcSorted, localAiState);

          if (isStale) {
            cmd.throttle *= 0.3;
            cmd.reasoning = `LATENCY_LOCK: ${currentLatency}ms. Local safety driver engaged.`;
          }

          if (lastAiSourceRef.current !== 'core') {
            const reason = !state.apiKey ? "NO_API_KEY" : (isStale ? "LATENCY_CRITICAL" : "AI_STALLED");
            dispatch({ type: 'ADD_LOG', payload: { text: `SYSTEM: AI_LINK_LOST (${reason}). UNSEEN CORE (DIGITAL TWIN) ACTIVATED.`, type: 'warning' } });
            lastAiSourceRef.current = 'core';
          }

          inputRef.current.brake = false;
        }

        // V0.9.42: DISABLE BOUNDARY REVERSE IN CALIBRATION MODE
        const distToEdge = terrainData ? (terrainData.size / 2) - Math.max(Math.abs(telemetry.position[0]), Math.abs(telemetry.position[2])) : 100;
        if (distToEdge < 10 && !state.isCalibrationMode) {
          const velocityMagnitude = new THREE.Vector3(...telemetry.velocity).length();
          if (velocityMagnitude > 1) {
            cmd.throttle = Math.min(cmd.throttle, 0.1);
            if (distToEdge < 5) cmd.throttle = -0.3;
          }
        }

        inputRef.current.left = cmd.steer > 0 ? Math.min(cmd.steer, 1) : 0;
        inputRef.current.right = cmd.steer < 0 ? Math.min(-cmd.steer, 1) : 0;
        inputRef.current.forward = cmd.throttle > 0 ? cmd.throttle : 0;
        inputRef.current.backward = cmd.throttle < 0 ? -cmd.throttle : 0;
      }
    }
  }, [monteCarloTrajectories, state.driveMode, state.simulationState, riskMetrics, waypoints, currentWaypointIdx, currentLatency, targetDistance]);

  useEffect(() => {
    inputRef.current = { forward: 0, backward: 0, left: 0, right: 0, brake: false };

    // V0.9.46: Log deactivation and reset tracking
    if (state.driveMode === DRIVE_MODES.MANUAL && lastAiSourceRef.current === 'core') {
      dispatch({ type: 'ADD_LOG', payload: { text: "SYSTEM: UNSEEN CORE (DIGITAL TWIN) DEACTIVATED.", type: 'info' } });
    }
    lastAiSourceRef.current = null;
  }, [state.driveMode]);

  useEffect(() => {
    mcWorkerRef.current = new Worker(new URL('./monteCarlo.worker.js', import.meta.url), { type: 'module' });
    mcWorkerRef.current.onmessage = (e) => {
      if (e.data.type === 'SIMULATION_RESULTS') {
        const { trajectories, metrics } = e.data.payload;
        setMonteCarloTrajectories(trajectories);
        if (metrics) setRiskMetrics(metrics);
        setIsMcCalculating(false);
      }
    };
    return () => mcWorkerRef.current.terminate();
  }, []);

  useEffect(() => {
    if (mcWorkerRef.current && terrainData) {
      mcWorkerRef.current.postMessage({ type: 'SET_TERRAIN', payload: { heightData: terrainData.heightData, size: terrainData.size, segments: terrainData.segments } });
    }
  }, [terrainData]);

  useEffect(() => {
    const shouldRunWorker = state.driveMode === DRIVE_MODES.AUTOPILOT || state.navigationOverlay;
    if (mcWorkerRef.current && shouldRunWorker && state.simulationState === 'running') {
      // V0.8.22: INSTANT START - Run first cycle immediately
      const runCycle = () => {
        if (!telemetryRef.current || !telemetryRef.current.position) return;
        setIsMcCalculating(true);
        mcWorkerRef.current.postMessage({
          type: 'RUN_SIMULATION',
          payload: {
            isAutopilot: state.driveMode === DRIVE_MODES.AUTOPILOT,
            roverState: {
              position: telemetryRef.current.position, velocity: telemetryRef.current.velocity, rotation: telemetryRef.current.rotation,
              targetPos: [terrainData.beacon.x, terrainData.beacon.y, terrainData.beacon.z], steerAngle: 0, throttle: inputRef.current.forward - inputRef.current.backward
            }
          }
        });
      };

      runCycle();

      const interval = setInterval(runCycle, 700);
      return () => clearInterval(interval);
    } else if (!shouldRunWorker) { setRiskMetrics({ sCVaR: undefined, SMaR: undefined }); setMonteCarloTrajectories(null); }
  }, [state.driveMode, state.navigationOverlay, state.simulationState, terrainData.beacon]);

  // V18: HARD ATOMIC RESET - Prevent Black Screen / Coordinates Conflict
  const handleNewTerrain = useCallback(() => {
    // 1. Immediate UI/Logic cleanup
    setWaypoints([]);
    setAiQuote("");
    setIsAiPlanning(false);
    setIsMcCalculating(false);
    setCurrentWaypointIdx(0);
    elapsedRef.current = 0;
    batteryRef.current = 100;
    inputRef.current = { forward: 0, backward: 0, left: 0, right: 0, brake: false };
    aiCommandRef.current = null; // V0.9.28: Clear command cache on reset
    lastAiCommandsRef.current = []; // V0.9.28: Clear tactical memory on reset

    // 2. Force Telemetry Reset handled by V1.4.8 seed effect
    // We only reset velocity/rotation here to ensure physics stops immediately
    setTelemetry(prev => ({
      ...prev,
      velocity: [0, 0, 0],
      rotation: [0, 0, 0]
    }));
    telemetryRef.current = { ...telemetryRef.current, velocity: [0, 0, 0], rotation: [0, 0, 0] };

    // 3. Dispatch Store Update
    dispatch({ type: 'NEW_TERRAIN' });
  }, []);

  // V17: UNIFIED RESET - Always refresh landscape for stability
  const handleRestart = useCallback(() => {
    handleNewTerrain();
  }, [handleNewTerrain]);

  const handleToggleCalibration = useCallback(() => {
    setWaypoints([]);
    setAiQuote("");
    setIsAiPlanning(false);
    setIsMcCalculating(false);
    setCurrentWaypointIdx(0);
    elapsedRef.current = 0;
    batteryRef.current = 100;
    inputRef.current = { forward: 0, backward: 0, left: 0, right: 0, brake: false };
    aiCommandRef.current = null;
    lastAiCommandsRef.current = [];
    dispatch({ type: 'TOGGLE_CALIBRATION' });
  }, []);
  const [sceneCapturedFrame, setSceneCapturedFrame] = useState(null);

  // v3.1.0: Scene Capture Hook
  const onCanvasCreated = useCallback(({ gl }) => {
    window.simGL = gl; // Global reference for easy capture
  }, []);

  const handleCaptureFrame = useCallback(() => {
    if (window.simGL) {
      const frame = captureSimulationFrame(window.simGL);
      setSceneCapturedFrame(frame);
    }
  }, []);

  // Capture frame right before AI autopilot run
  useEffect(() => {
    if (state.driveMode === DRIVE_MODES.AUTOPILOT && state.visionProvider === 'cosmos' && !isAiAutopilotRunningRef.current) {
      handleCaptureFrame();
    }
  }, [state.driveMode, state.visionProvider, handleCaptureFrame]);

  return (
    <SimulationContext.Provider value={state}>
      <SimulationDispatchContext.Provider value={dispatch}>
        <div style={{ width: '100vw', height: '100vh', background: '#000000', position: 'relative', overflow: 'hidden' }}>
          <Canvas
            shadows
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: state.brightness,
              preserveDrawingBuffer: true // Required for frame capture
            }}
            onCreated={onCanvasCreated}
            camera={{ fov: 60, near: 0.1, far: 2000, position: [0, 10, 15] }}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          >
            <color attach="background" args={['#000000']} />
            <fog attach="fog" args={['#000000', 100, 450]} />
            <Stars count={6000} />
            <Dust />
            <CameraController targetPosition={telemetry.position} enabled={state.simulationState === 'running'} seed={state.terrainSeed} snapPosition={startPos} />
            <Physics key={state.terrainSeed} gravity={[0, -LUNAR_GRAVITY, 0]} defaultContactMaterial={{ friction: 0.6, restitution: 0.1 }} iterations={10} broadphase="SAP">
              <PhysicsScene
                terrainData={terrainData}
                getInput={getInput}
                driveMode={state.driveMode}
                navigationOverlay={state.navigationOverlay}
                simulationState={state.simulationState}
                dispatch={dispatch}
                roverRef={roverRef}
                onTelemetryUpdate={handleTelemetry}
                startPos={startPos}
                monteCarloTrajectories={monteCarloTrajectories}
                dangerMap={dangerMap}
                waypoints={waypoints}
                telemetry={telemetry}
              />
            </Physics>
            {state.chromaticAberration && <EffectComposer><ChromaticAberration offset={[0.00035, 0.00035]} /></EffectComposer>}
          </Canvas>
          <HUD
            speed={telemetry.speed}
            pitch={telemetry.pitch}
            roll={telemetry.roll}
            battery={state.battery}
            targetDistance={targetDistance}
            elapsedTime={state.elapsedTime || elapsedRef.current}
            driveMode={state.driveMode}
            language={state.language}
            simulationState={state.simulationState}
            failReason={state.failReason}
            navigationOverlay={state.navigationOverlay}
            safetyScore={state.safetyScore}
            isAiOnline={!!state.apiKey}
            isAiPlanning={isAiPlanning}
            isMcCalculating={state.monteCarloResults?.recalculating}
            aiQuote={aiQuote}
            onSetDriveMode={(mode) => dispatch({ type: 'SET_DRIVE_MODE', payload: mode })}
            onToggleNav={() => {
              const prevOverlay = state.navigationOverlay;
              dispatch({ type: 'TOGGLE_NAV_OVERLAY' });
              // V0.9.47: AUTO-PLAN ON OVERLAY (If no route exists)
              if (!prevOverlay && waypoints.length === 0 && !isAiPlanning && state.apiKey) {
                triggerAiPlanning();
              }
            }}
            onPlanRoute={handlePlanRoute}
            onLanguageChange={(lang) => dispatch({ type: 'SET_LANGUAGE', payload: lang })}
            onNewTerrain={handleNewTerrain}
            onRestart={handleRestart}
            onTelemetryUpdate={setTelemetry}
            telemetry={telemetry}
            riskMetrics={riskMetrics}
            brightness={state.brightness}
            onBrightnessChange={(val) => dispatch({ type: 'SET_BRIGHTNESS', payload: val })}
            shadowContrast={state.shadowContrast}
            onShadowChange={(val) => dispatch({ type: 'SET_SHADOWS', payload: val })}
            chromaticAberration={state.chromaticAberration}
            onChromaticToggle={() => dispatch({ type: 'TOGGLE_CHROMATIC' })}
            apiKey={state.apiKey}
            onApiKeyChange={(val) => { localStorage.setItem('pathfinder_api_key', val); dispatch({ type: 'SET_API_KEY', payload: val }); }}
            aiModel={state.aiModel}
            onAiModelChange={(val) => dispatch({ type: 'SET_AI_MODEL', payload: val })}
            waypointCount={state.waypointCount}
            onWaypointCountChange={(val) => dispatch({ type: 'SET_WAYPOINT_COUNT', payload: val })}
            onToggleCalibration={() => dispatch({ type: 'TOGGLE_CALIBRATION' })}
            uiVisible={state.uiVisible}
            onToggleUI={() => dispatch({ type: 'TOGGLE_UI' })}
            arrivalAccuracy={state.arrivalAccuracy}
            onAccuracyChange={(val) => dispatch({ type: 'SET_ARRIVAL_ACCURACY', payload: val })}
            aiUseMonteCarlo={state.aiUseMonteCarlo}
            onAiUseMcToggle={(val) => dispatch({ type: 'SET_AI_USE_MC', payload: val })}
            aiUsePath={state.aiUsePath}
            onAiUsePathToggle={(val) => dispatch({ type: 'SET_AI_USE_PATH', payload: val })}
            nvidiaNimUrl={state.nvidiaNimUrl}
            onUrlChange={(val) => dispatch({ type: 'SET_NVIDIA_NIM_URL', payload: val })}
            nvidiaApiKey={state.nvidiaApiKey}
            onNvApiKeyChange={(val) => dispatch({ type: 'SET_NVIDIA_API_KEY', payload: val })}
            capturedFrame={sceneCapturedFrame}
            helpOpen={state.helpOpen}
            onToggleHelp={() => dispatch({ type: 'TOGGLE_HELP' })}
            terrainMode={state.terrainMode}
            onTerrainModeChange={(val) => dispatch({ type: 'SET_TERRAIN_MODE', payload: val })}
            onMobileInput={(inp) => {
              if (inp.toggleAutopilot) {
                dispatch({ type: 'TOGGLE_AUTOPILOT' });
                if (state.driveMode === DRIVE_MODES.MANUAL) triggerAiPlanning();
              } else if (inp.toggleNav) {
                dispatch({ type: 'TOGGLE_NAV_OVERLAY' });
              } else {
                if (state.driveMode === DRIVE_MODES.AUTOPILOT && (inp.forward > 0 || inp.backward > 0 || inp.left !== 0 || inp.right !== 0)) {
                  dispatch({ type: 'SET_DRIVE_MODE', payload: DRIVE_MODES.MANUAL });
                  dispatch({ type: 'ADD_LOG', payload: { text: "MODE: MANUAL OVERRIDE (JOYSTICK)", type: 'warning' } });
                }
                inputRef.current = { ...inputRef.current, ...inp };
              }
            }}
            isMobile={isMobile}
          />
        </div>
      </SimulationDispatchContext.Provider>
    </SimulationContext.Provider>
  );
}

function getHeuristicFromFan(sortedTrajectories, aiState) {
  const { relBearing, targetDistance, sCVaR, SMaR } = aiState;

  const best = sortedTrajectories[0];
  if (!best || best.fitness < -5000) return { steer: (Math.random() - 0.5) * 2, throttle: -0.3 };

  const topN = sortedTrajectories.slice(0, Math.min(10, sortedTrajectories.length));
  let avgSteer = 0, avgThrottle = 0;
  for (const t of topN) { avgSteer += t.input.steer; avgThrottle += t.input.throttle; }
  avgSteer /= topN.length; avgThrottle /= topN.length;

  let speedFactor = 1.0;
  if (SMaR < 25) speedFactor *= 0.5;
  if (sCVaR > 50) speedFactor *= 0.3;

  // Heuristic steering: proportional to bearing
  const steerAction = Math.max(-1, Math.min(1, -relBearing / 45));

  return { steer: steerAction, throttle: avgThrottle * speedFactor };
}
