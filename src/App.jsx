// App.jsx — Lunar Risk: Monte Carlo Pathfinder
// v4.0.0: Architecture refactoring — domain-grouped state
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
import { Earth, Beacon } from './components/EarthAndBeacon';
import MonteCarloViz from './components/MonteCarloViz';
import HUD from './components/HUD';

import { LunarLighting, CameraController } from './components/Scene';
import Dust from './components/Dust';
import AiTrail from './components/AiTrail';

import { planStrategicRoute, getAutopilotCommand, summarizeFan, heightmapToImage, getLidarData, f1, captureSimulationFrame } from './aiNavigator';

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
  telemetry,
  dustDensity
}) {
  return (
    <>
      <LunarLighting shadowContrast={shadowContrast} roverRef={roverRef} />
      <LunarTerrain terrainData={terrainData} />

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
        roverRef={roverRef}
        autopilotActive={driveMode === DRIVE_MODES.AUTOPILOT}
        overlayActive={navigationOverlay}
      />
    </>
  );
}

// ======== COMPONENTS ========
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("FATAL_CRASH:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', background: '#111', color: '#ff0044', fontFamily: 'monospace', height: '100vh' }}>
          <h1>[SYSTEM_FAILURE]</h1>
          <p>CRITICAL_ERROR in Render Pipeline: {this.state.error?.message}</p>
          <p>RECOVERY: Press 'R' or click below to force reset.</p>
          <button onClick={() => window.location.reload()} style={{ background: '#ff0044', color: '#fff', border: 'none', padding: '10px 20px', cursor: 'pointer' }}>
            FORCE_RELOAD
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SimulationApp() {
  const [state, dispatch] = useReducer(simulationReducer, getInitialState());

  // ── Destructure domains for readability ──
  const { graphics, ai, mission, ui } = state;

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
  const renderTicksRef = useRef(0);

  // v4.0.0: Consolidated AI configuration check (uses domain paths)
  const isAiConfigured = useMemo(() => {
    return ai.visionProvider === 'cosmos'
      ? (!!ai.nvidiaNimUrl && !!ai.nvidiaApiKey)
      : !!ai.apiKey;
  }, [ai.visionProvider, ai.nvidiaNimUrl, ai.nvidiaApiKey, ai.apiKey]);
  const [isMcCalculating, setIsMcCalculating] = useState(false);

  const roverRef = useRef();
  const batteryRef = useRef(100);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  // v4.0.0: Terrain now uses resolution from graphics domain
  const terrainData = useMemo(() => {
    return generateTerrainData(mission.terrainSeed, graphics.terrainMode, graphics.terrainResolution);
  }, [mission.terrainSeed, graphics.terrainMode, graphics.terrainResolution]);

  const [isMobile, setIsMobile] = useState(false);
  const [waypoints, setWaypoints] = useState([]);
  const [aiQuote, setAiQuote] = useState("");
  const [currentWaypointIdx, setCurrentWaypointIdx] = useState(0);
  const [lidarScan, setLidarScan] = useState(null);
  const lastPlannedSeed = useRef(null);
  const planningInProgressRef = useRef(false);
  const lastAiReasoningRef = useRef("");
  const lastAiLogTimeRef = useRef(0);
  const lastAiSourceRef = useRef(null);
  const aiCommandRef = useRef(null);
  const lastAiCommandsRef = useRef([]);
  const isAiAutopilotRunningRef = useRef(false);
  const lastAutopilotCallTimeRef = useRef(0);
  const [currentLatency, setCurrentLatency] = useState(1000);

  const targetDistance = useMemo(() => {
    if (!telemetry.position || !terrainData || !terrainData.beacon) return 0;
    return Math.sqrt(
      Math.pow(telemetry.position[0] - terrainData.beacon.x, 2) +
      Math.pow(telemetry.position[2] - terrainData.beacon.z, 2)
    );
  }, [telemetry.position, terrainData.beacon, terrainData.size]);

  const lastPlanAttemptTime = useRef(0);
  const triggerAiPlanning = useCallback(async () => {
    const now = Date.now();
    if (now - lastPlanAttemptTime.current < 2000) return;
    lastPlanAttemptTime.current = now;

    if (planningInProgressRef.current || isAiPlanning || !terrainData || !isAiConfigured || !ai.aiUsePath) {
      if (!isAiConfigured && !isAiPlanning && ai.aiUsePath) {
        dispatch({ type: 'ADD_LOG', payload: { text: "SYSTEM: AI PLANNER OFFLINE.", type: 'warning' } });
      }
      return;
    }

    const planningKey = `${mission.terrainSeed}_${ai.aiModel}_${isAiConfigured}`;
    if (lastPlannedSeed.current === planningKey && waypoints.length > 0) return;

    console.log(`[AI] Start Strategic Planning for seed: ${mission.terrainSeed}`);
    planningInProgressRef.current = true;
    lastPlannedSeed.current = planningKey;

    setIsAiPlanning(true);
    setWaypoints([]);
    setAiQuote("");
    const terrainImage = heightmapToImage(terrainData.heightData);
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
      const aiLang = (ui.language === 'RU' || ui.language === 'UA') ? ui.language : 'EN';

      const result = await planStrategicRoute(
        ai.apiKey,
        terrainData.heightData,
        startPos,
        targetPos,
        terrainData.size,
        ai.waypointCount,
        ai.aiModel,
        aiLang,
        state
      );

      if (result && lastPlannedSeed.current === planningKey) {
        setWaypoints(result.waypoints);
        setAiQuote(result.quote);
        setCurrentWaypointIdx(0);

        if (result.isAi && result.reasoning) {
          dispatch({ type: 'ADD_LOG', payload: { text: `AI ARCHITECT STRATEGIC ANALYSIS:\n${result.reasoning}`, type: 'system' } });
        } else {
          dispatch({ type: 'ADD_LOG', payload: { text: `CRITICAL ERROR: AI ARCHITECT DISCONNECTED.\n${result.reasoning || "NO TELEMETRY RECEIVED."}`, type: 'critical' } });
          setIsAiPlanning(false);
          planningInProgressRef.current = false;
          return;
        }

        if (result.quote) {
          dispatch({ type: 'ADD_LOG', payload: { text: `AI QUOTE: "${result.quote}"`, type: 'info' } });
        }

        dispatch({ type: 'ADD_LOG', payload: { text: "AI ARCHITECT: STRATEGIC ROUTE COMMITTED.", type: 'info' } });
      }
    } catch (e) {
      console.error("[AI] Strategic Planning Error:", e);
      dispatch({ type: 'ADD_LOG', payload: { text: `AI ARCHITECT: CALCULATION FAILED - ${e.message}`, type: 'critical' } });
      lastPlannedSeed.current = null;
    } finally {
      setIsAiPlanning(false);
      planningInProgressRef.current = false;
    }
  }, [ai.apiKey, mission.terrainSeed, ai.aiModel, terrainData, isAiPlanning, ui.language, waypoints.length]);

  const handlePlanRoute = useCallback(() => {
    triggerAiPlanning();
  }, [triggerAiPlanning]);

  // Auto-plan on autopilot engage
  useEffect(() => {
    if (mission.driveMode === DRIVE_MODES.AUTOPILOT &&
      waypoints.length === 0 &&
      !isAiPlanning &&
      mission.simulationState === 'running' &&
      terrainData &&
      isAiConfigured &&
      ai.aiUsePath) {
      triggerAiPlanning();
    }
  }, [mission.driveMode, mission.simulationState, waypoints.length, isAiPlanning, terrainData, isAiConfigured, triggerAiPlanning, ai.aiUsePath]);


  // Monte Carlo state
  const [monteCarloTrajectories, setMonteCarloTrajectories] = useState(null);
  const [riskMetrics, setRiskMetrics] = useState({ sCVaR: 0, SMaR: 0 });

  // Risk monitoring — log on threshold crossing
  const lastRiskLevels = useRef({ sCVaR: 0, SMaR: 3 });
  useEffect(() => {
    if (riskMetrics.sCVaR === undefined || riskMetrics.SMaR === undefined) return;

    let sLevel = 0;
    if (riskMetrics.sCVaR > 60) sLevel = 2;
    else if (riskMetrics.sCVaR > 30) sLevel = 1;

    if (sLevel > lastRiskLevels.current.sCVaR) {
      const msg = sLevel === 2 ? "ALERT: CRITICAL sCVaR DETECTED (>60)" : "WARNING: ELEVATED sCVaR DETECTED (>30)";
      dispatch({ type: 'ADD_LOG', payload: { text: msg, type: sLevel === 2 ? 'critical' : 'warning' } });
    }
    lastRiskLevels.current.sCVaR = sLevel;

    let smLevel = 3;
    if (riskMetrics.SMaR < 15) smLevel = 1;
    else if (riskMetrics.SMaR < 35) smLevel = 2;

    if (smLevel < lastRiskLevels.current.SMaR) {
      const msg = smLevel === 1 ? "ALERT: EXTREME ROLLOVER RISK — SMaR < 15m" : "WARNING: STABILITY MARGIN REDUCED — SMaR < 35m";
      dispatch({ type: 'ADD_LOG', payload: { text: msg, type: smLevel === 1 ? 'critical' : 'warning' } });
    }
    lastRiskLevels.current.SMaR = smLevel;
  }, [riskMetrics.sCVaR, riskMetrics.SMaR]);

  const [dangerMap, setDangerMap] = useState(null);
  const mcWorkerRef = useRef(null);

  // Sync telemetry ref
  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  // Check for mobile
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

  // Seed-based reset & sync
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
  }, [mission.terrainSeed, startPos]);

  const inputRef = useRef({ forward: 0, backward: 0, left: 0, right: 0, brake: false });
  const getInput = useCallback(() => inputRef.current, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isAutopilot = mission.driveMode === DRIVE_MODES.AUTOPILOT;
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
          if (mission.driveMode === DRIVE_MODES.MANUAL) triggerAiPlanning();
          break;
        case 'KeyN':
          if (!mission.navigationOverlay && waypoints.length === 0) triggerAiPlanning();
          dispatch({ type: 'TOGGLE_NAV_OVERLAY' });
          break;
        case 'KeyP': handlePlanRoute(); break;
        case 'KeyR': handleRestart(); break;
      }
    };
    const handleKeyUp = (e) => {
      const isAutopilot = mission.driveMode === DRIVE_MODES.AUTOPILOT;
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
    telemetryRef.current = { ...telemetryRef.current, ...data };
    if (renderTicksRef.current % 2 === 0) {
      setTelemetry(prev => ({ ...prev, ...data }));
    }
  }, []);

  // Main physics loop
  useEffect(() => {
    let frame;
    const loop = (t) => {
      const dt = (t - lastTimeRef.current) / 1000;
      lastTimeRef.current = t;

      const isRollover = Math.abs(telemetry.roll) >= ROLLOVER_ANGLE || Math.abs(telemetry.pitch) >= ROLLOVER_ANGLE;

      if (mission.simulationState === 'running' && !isAiPlanning) {
        elapsedRef.current += dt;
        batteryRef.current = Math.max(0, batteryRef.current - dt * 0.05);

        if (isRollover && mission.simulationState === 'running') {
          dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'failed', reason: 'stability' } });
        } else if (targetDistance < mission.arrivalAccuracy && mission.simulationState === 'running') {
          dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'success' } });
        } else if (batteryRef.current <= 0 && mission.simulationState === 'running') {
          dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'failed', reason: 'damage' } });
        }

        // Lidar scan
        if (mission.navigationOverlay || mission.driveMode === DRIVE_MODES.AUTOPILOT) {
          if (renderTicksRef.current % 5 === 0) {
            const rawLidar = getLidarData(telemetryRef.current.position, telemetryRef.current.rotation, terrainData);
            setLidarScan(rawLidar);
          }
        } else if (lidarScan) {
          setLidarScan(null);
        }
      }
      renderTicksRef.current++;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [mission.simulationState, terrainData.beacon, telemetry.position, isAiPlanning]);

  // ── AUTOPILOT CONTROL LOOP ──
  const [sceneCapturedFrame, setSceneCapturedFrame] = useState(null);

  useEffect(() => {
    if (mission.driveMode === DRIVE_MODES.AUTOPILOT && mission.simulationState === 'running') {
      if (!telemetryRef.current || !telemetryRef.current.position) return;

      // Wait for plan
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

        // Smart waypoint skipping
        if (waypoints && currentWaypointIdx < waypoints.length - 1) {
          const nextWP = waypoints[currentWaypointIdx + 1];
          const dNext = Math.sqrt((nextWP[0] - px) ** 2 + (nextWP[1] - pz) ** 2);
          if (distToWP < 8 || dNext < 10) {
            setCurrentWaypointIdx(prev => prev + 1);
          }
        }

        // Calculate bearings for dual-stream
        const roverQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(telemetryRef.current.rotation[0], telemetryRef.current.rotation[1], telemetryRef.current.rotation[2], 'YXZ')
        );
        const beaconPos = new THREE.Vector3(terrainData.beacon.x, telemetryRef.current.position[1], terrainData.beacon.z);
        const roverPos = new THREE.Vector3(...telemetryRef.current.position);

        const relTargetNow = beaconPos.clone().sub(roverPos).applyQuaternion(roverQuat.invert());
        const realTimeBearing = Math.atan2(relTargetNow.x, -relTargetNow.z) * 180 / Math.PI;

        // Predicted bearing for latent AI
        const speedMs = new THREE.Vector3(...telemetryRef.current.velocity).length();
        const timeToReach = targetDistance / Math.max(speedMs, 0.5);
        const maxPred = Math.min(currentLatency / 1000, 3.0);
        const predSec = Math.min(maxPred, timeToReach * 0.7);

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
          sCVaR: riskMetrics.sCVaR,
          SMaR: riskMetrics.SMaR,
          fanSummary: summarizeFan(monteCarloTrajectories),
          nextWaypoints: waypoints ? waypoints.slice(currentWaypointIdx, currentWaypointIdx + 5) : [],
          currentWaypoint: (waypoints && waypoints.length > 0) ? waypoints[currentWaypointIdx] : [terrainData.beacon.x, terrainData.beacon.z],
          terrainData: terrainData,
          commandHistory: lastAiCommandsRef.current,
          latency: currentLatency,
          currentPathWaypoints: waypoints && waypoints.length > 0 ? `Next WP: [${f1(waypoints[0][0])}, ${f1(waypoints[0][1])}]` : "No Path",
          capturedFrame: ai.visionProvider === 'cosmos' ? sceneCapturedFrame : null,
          visionProvider: ai.visionProvider,
          nvidiaNimUrl: ai.nvidiaNimUrl,
          nvidiaApiKey: ai.nvidiaApiKey
        };

        // AI Autopilot call (throttled to 1s)
        const timeSinceLastAi = performance.now() - lastAutopilotCallTimeRef.current;
        if (isAiConfigured && !isAiAutopilotRunningRef.current && timeSinceLastAi > 1000) {
          isAiAutopilotRunningRef.current = true;
          lastAutopilotCallTimeRef.current = performance.now();
          const aiStartTime = performance.now();

          getAutopilotCommand(ai.visionProvider === 'gemini' ? ai.apiKey : ai.nvidiaApiKey, aiState, ai.aiModel)
            .then(cmd => {
              const rtt = Math.round(performance.now() - aiStartTime);
              setCurrentLatency(rtt);
              aiCommandRef.current = cmd;

              lastAiCommandsRef.current = [
                { steer: cmd.steer, throttle: cmd.throttle, reasoning: cmd.reasoning.substring(0, 30) },
                ...lastAiCommandsRef.current
              ].slice(0, 3);

              const now = Date.now();
              const isNewReasoning = cmd.reasoning && cmd.reasoning !== lastAiReasoningRef.current;
              const isTimeElapsed = now - lastAiLogTimeRef.current > 10000;

              if (isNewReasoning || isTimeElapsed) {
                lastAiReasoningRef.current = cmd.reasoning;
                lastAiLogTimeRef.current = now;
                dispatch({ type: 'ADD_LOG', payload: { text: `AI AUTOPILOT: ${cmd.reasoning}`, type: 'info' } });
              }

              if (cmd.raw && (cmd.reasoning.startsWith('PARSE_FAIL') || cmd.reasoning.includes('JSON Parse Error'))) {
                dispatch({ type: 'ADD_LOG', payload: { text: `RAW_AI_OUTPUT: ${cmd.raw}`, type: 'warning' } });
              }
            })
            .catch(err => {
              dispatch({ type: 'ADD_LOG', payload: { text: "SYSTEM: AI Deadlock prevented — core script failure.", type: 'critical' } });
              console.error("AI Autopilot Error:", err);
            })
            .finally(() => { isAiAutopilotRunningRef.current = false; });
        }

        // Command selection + stale protection
        const isStale = currentLatency > 4000;

        let cmd;
        const isAiCommandValid = aiCommandRef.current &&
          aiCommandRef.current.reasoning &&
          !aiCommandRef.current.reasoning.includes("AUTOPILOT_FATAL") &&
          !aiCommandRef.current.reasoning.includes("AI_PIPELINE_STALLED");

        if (isAiConfigured && isAiCommandValid && !isStale) {
          cmd = aiCommandRef.current;
          inputRef.current.brake = false;
          if (lastAiSourceRef.current !== 'ai') {
            dispatch({ type: 'ADD_LOG', payload: { text: "SYSTEM: AI_LINK_ESTABLISHED. TACTICAL AUTOPILOT ENGAGED.", type: 'info' } });
            lastAiSourceRef.current = 'ai';
          }
        } else {
          const localAiState = { ...aiState, relBearing: realTimeBearing };
          cmd = getHeuristicFromFan(mcSorted, localAiState);

          if (isStale) {
            cmd.throttle *= 0.3;
            cmd.reasoning = `LATENCY_LOCK: ${currentLatency}ms. Local safety driver engaged.`;
          }

          if (lastAiSourceRef.current !== 'core') {
            const reason = !isAiConfigured ? "NOT_CONFIGURED" : (isStale ? "LATENCY_CRITICAL" : "AI_STALLED");
            dispatch({ type: 'ADD_LOG', payload: { text: `SYSTEM: AI_LINK_LOST (${reason}). Vision by UNSEEN ENGINE ACTIVATED.`, type: 'warning' } });
            lastAiSourceRef.current = 'core';
          }

          inputRef.current.brake = false;
        }

        // Boundary reverse
        const distToEdge = terrainData ? (terrainData.size / 2) - Math.max(Math.abs(telemetry.position[0]), Math.abs(telemetry.position[2])) : 100;
        if (distToEdge < 10 && !mission.isCalibrationMode) {
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
  }, [monteCarloTrajectories, mission.driveMode, mission.simulationState, riskMetrics, waypoints, currentWaypointIdx, currentLatency, targetDistance]);

  // Reset AI source tracking on mode change
  useEffect(() => {
    inputRef.current = { forward: 0, backward: 0, left: 0, right: 0, brake: false };
    if (mission.driveMode === DRIVE_MODES.MANUAL && lastAiSourceRef.current === 'core') {
      dispatch({ type: 'ADD_LOG', payload: { text: "SYSTEM: Vision by UNSEEN ENGINE DEACTIVATED.", type: 'info' } });
    }
    lastAiSourceRef.current = null;
  }, [mission.driveMode]);

  // Monte Carlo worker
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
    const shouldRunWorker = mission.driveMode === DRIVE_MODES.AUTOPILOT || mission.navigationOverlay;
    if (mcWorkerRef.current && shouldRunWorker && mission.simulationState === 'running') {
      const runCycle = () => {
        if (!telemetryRef.current || !telemetryRef.current.position) return;
        setIsMcCalculating(true);
        mcWorkerRef.current.postMessage({
          type: 'RUN_SIMULATION',
          payload: {
            isAutopilot: mission.driveMode === DRIVE_MODES.AUTOPILOT,
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
  }, [mission.driveMode, mission.navigationOverlay, mission.simulationState, terrainData.beacon]);

  // ── UNIFIED RESET ──
  const handleNewTerrain = useCallback(() => {
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

    setTelemetry(prev => ({
      ...prev,
      velocity: [0, 0, 0],
      rotation: [0, 0, 0]
    }));
    telemetryRef.current = { ...telemetryRef.current, velocity: [0, 0, 0], rotation: [0, 0, 0] };

    dispatch({ type: 'NEW_TERRAIN' });
  }, []);

  const handleRestart = useCallback(() => {
    handleNewTerrain();
  }, [handleNewTerrain]);

  // v4.0.0: Calibration toggle — does NOT close settings menu
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

  // Scene capture for Cosmos
  const onCanvasCreated = useCallback(({ gl }) => {
    window.simGL = gl;
  }, []);

  const handleCaptureFrame = useCallback(() => {
    if (window.simGL) {
      const frame = captureSimulationFrame(window.simGL);
      setSceneCapturedFrame(frame);
    }
  }, []);

  useEffect(() => {
    if (mission.driveMode === DRIVE_MODES.AUTOPILOT && ai.visionProvider === 'cosmos' && isAiConfigured && !isAiAutopilotRunningRef.current) {
      const interval = setInterval(() => {
        handleCaptureFrame();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [mission.driveMode, ai.visionProvider, handleCaptureFrame, isAiConfigured]);

  return (
    <SimulationContext.Provider value={state}>
      <SimulationDispatchContext.Provider value={dispatch}>
        <div style={{ width: '100vw', height: '100vh', background: '#000000', position: 'relative', overflow: 'hidden' }}>
          <ErrorBoundary>
            <Canvas
              shadows
              gl={{
                antialias: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: graphics.brightness,
                preserveDrawingBuffer: true
              }}
              onCreated={onCanvasCreated}
              camera={{ fov: 60, near: 0.1, far: 2000, position: [0, 10, 15] }}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            >
              <color attach="background" args={['#000000']} />
              <fog attach="fog" args={['#000000', 100, 450]} />
              <Stars count={6000} />
              <Dust roverTelemetry={mission.simulationState === 'running' ? telemetry : null} roverRef={roverRef} maxParticles={graphics.dustDensity} />
              <CameraController enabled={mission.simulationState === 'running'} seed={mission.terrainSeed} snapPosition={startPos} roverRef={roverRef} />
              <Physics key={mission.terrainSeed} gravity={[0, -LUNAR_GRAVITY, 0]} defaultContactMaterial={{ friction: 0.6, restitution: 0.1 }} iterations={10} broadphase="SAP">
                <PhysicsScene
                  terrainData={terrainData}
                  getInput={getInput}
                  driveMode={mission.driveMode}
                  navigationOverlay={mission.navigationOverlay}
                  simulationState={mission.simulationState}
                  dispatch={dispatch}
                  roverRef={roverRef}
                  onTelemetryUpdate={handleTelemetry}
                  startPos={startPos}
                  monteCarloTrajectories={monteCarloTrajectories}
                  dangerMap={dangerMap}
                  shadowContrast={graphics.shadowContrast}
                  waypoints={waypoints}
                  telemetry={telemetry}
                  dustDensity={graphics.dustDensity}
                />
              </Physics>
              {graphics.chromaticAberration && <EffectComposer><ChromaticAberration offset={[0.00035, 0.00035]} /></EffectComposer>}
            </Canvas>
          </ErrorBoundary>
          <HUD
            telemetry={telemetry}
            targetDistance={targetDistance}
            elapsedTime={elapsedRef.current}
            riskMetrics={riskMetrics}
            isAiOnline={isAiConfigured}
            isAiPlanning={isAiPlanning}
            isMcCalculating={state.monteCarloResults?.recalculating}
            aiQuote={aiQuote}
            waypoints={waypoints}
            onPlanRoute={handlePlanRoute}
            onNewTerrain={handleNewTerrain}
            onRestart={handleRestart}
            onToggleCalibration={handleToggleCalibration}
            onToggleNav={() => {
              const prevOverlay = mission.navigationOverlay;
              dispatch({ type: 'TOGGLE_NAV_OVERLAY' });
              if (!prevOverlay && waypoints.length === 0 && !isAiPlanning && isAiConfigured) {
                triggerAiPlanning();
              }
            }}
            capturedFrame={sceneCapturedFrame}
            lidarScan={lidarScan}
            onMobileInput={(inp) => {
              if (inp.toggleAutopilot) {
                dispatch({ type: 'TOGGLE_AUTOPILOT' });
                if (mission.driveMode === DRIVE_MODES.MANUAL) triggerAiPlanning();
              } else if (inp.toggleNav) {
                dispatch({ type: 'TOGGLE_NAV_OVERLAY' });
              } else {
                if (mission.driveMode === DRIVE_MODES.AUTOPILOT && (inp.forward > 0 || inp.backward > 0 || inp.left !== 0 || inp.right !== 0)) {
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

  const steerAction = Math.max(-1, Math.min(1, -relBearing / 45));

  return { steer: steerAction, throttle: avgThrottle * speedFactor };
}
