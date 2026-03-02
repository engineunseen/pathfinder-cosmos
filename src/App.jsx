// App.jsx — Pathfinder: Cosmos Cookoff Edition
// NVIDIA Cosmos Reason 2 — Autonomous Lunar Navigation
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

import { getAutopilotCommand, summarizeFan, getLidarData, f1, captureSimulationFrame } from './aiNavigator';

// Terrain Generation Utility
import { generateTerrainData } from './terrain';

function PhysicsScene({
  terrainData,
  getInput,
  driveMode,
  simulationState,
  dispatch,
  roverRef,
  onTelemetryUpdate,
  startPos,
  monteCarloTrajectories,
  dangerMap,
  shadowContrast,
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
        active={driveMode === DRIVE_MODES.AUTOPILOT && simulationState === 'running'}
        terrainData={terrainData}
      />

      <AiTrail
        roverRef={roverRef}
        autopilotActive={driveMode === DRIVE_MODES.AUTOPILOT}
        overlayActive={driveMode === DRIVE_MODES.AUTOPILOT}
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

  // Cosmos configuration check
  const isAiConfigured = useMemo(() => {
    return !!ai.nvidiaNimUrl && !!ai.nvidiaApiKey;
  }, [ai.nvidiaNimUrl, ai.nvidiaApiKey]);
  const [isMcCalculating, setIsMcCalculating] = useState(false);

  const roverRef = useRef();
  const batteryRef = useRef(100);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  // Terrain uses resolution from graphics domain
  const terrainData = useMemo(() => {
    return generateTerrainData(mission.terrainSeed, graphics.terrainMode, graphics.terrainResolution);
  }, [mission.terrainSeed, graphics.terrainMode, graphics.terrainResolution]);

  const [isMobile, setIsMobile] = useState(false);
  const [lidarScan, setLidarScan] = useState(null);
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

  // Monte Carlo state (visual only, no proprietary metrics)
  const [monteCarloTrajectories, setMonteCarloTrajectories] = useState(null);
  const [riskMetrics, setRiskMetrics] = useState({});

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
      setIsAiPlanning(false);
      setIsMcCalculating(false);
      elapsedRef.current = 0;
      batteryRef.current = 100;
      inputRef.current = { forward: 0, backward: 0, left: 0, right: 0, brake: false };
    }
  }, [mission.terrainSeed, startPos]);

  const inputRef = useRef({ forward: 0, backward: 0, left: 0, right: 0, brake: false });
  const getInput = useCallback(() => inputRef.current, []);

  // ── UNIFIED RESET ──
  const handleNewTerrain = useCallback(() => {
    setIsAiPlanning(false);
    setIsMcCalculating(false);
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

  // Calibration toggle
  const handleToggleCalibration = useCallback(() => {
    setIsAiPlanning(false);
    setIsMcCalculating(false);
    elapsedRef.current = 0;
    batteryRef.current = 100;
    inputRef.current = { forward: 0, backward: 0, left: 0, right: 0, brake: false };
    aiCommandRef.current = null;
    lastAiCommandsRef.current = [];
    dispatch({ type: 'TOGGLE_CALIBRATION' });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isAutopilot = mission.driveMode === DRIVE_MODES.AUTOPILOT;
      const moveKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
      const brakeKeys = ['Space'];

      // AUTO OVERRIDE: If autopilot is active and a movement key is pressed, switch to manual.
      if (isAutopilot && (moveKeys.includes(e.code) || brakeKeys.includes(e.code))) {
        dispatch({ type: 'SET_DRIVE_MODE', payload: DRIVE_MODES.MANUAL });
        dispatch({ type: 'ADD_LOG', payload: { text: "MODE: MANUAL OVERRIDE (KEYBOARD)", type: 'warning' } });
        if (roverRef.current?.stop) roverRef.current.stop();
      }

      switch (e.code) {
        case 'KeyW': inputRef.current.forward = 1; break;
        case 'KeyS': inputRef.current.backward = 1; break;
        case 'KeyA': inputRef.current.left = 1; break;
        case 'KeyD': inputRef.current.right = 1; break;
        case 'Space': inputRef.current.brake = true; break;
        case 'KeyM': dispatch({ type: 'TOGGLE_AUTOPILOT' }); break;
        case 'KeyR': handleRestart(); break;
      }
    };
    const handleKeyUp = (e) => {
      // Always reset keys on KeyUp, even if we were in Autopilot (which might have switched to Manual)
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
  }, [mission.driveMode, handleRestart]);

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

      if (mission.simulationState === 'running') {
        elapsedRef.current += dt;
        batteryRef.current = Math.max(0, batteryRef.current - dt * 0.05);

        if (isRollover && mission.simulationState === 'running') {
          dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'failed', reason: 'stability' } });
        } else if (targetDistance < mission.arrivalAccuracy && mission.simulationState === 'running') {
          dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'success' } });
        } else if (batteryRef.current <= 0 && mission.simulationState === 'running') {
          dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'failed', reason: 'damage' } });
        }

        // Lidar scan in autopilot mode
        if (mission.driveMode === DRIVE_MODES.AUTOPILOT) {
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
  }, [mission.simulationState, terrainData.beacon, telemetry.position]);

  // ── AUTOPILOT CONTROL LOOP (Cosmos Reason 2 Only) ──
  const [sceneCapturedFrame, setSceneCapturedFrame] = useState(null);

  useEffect(() => {
    if (mission.driveMode === DRIVE_MODES.AUTOPILOT && mission.simulationState === 'running') {
      if (!telemetryRef.current || !telemetryRef.current.position) return;

      if (monteCarloTrajectories) {
        const beaconTarget = [terrainData.beacon.x, terrainData.beacon.z];

        const px = telemetryRef.current.position[0], pz = telemetryRef.current.position[2];

        // Calculate bearings
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
          targetPos: beaconTarget,
          fanSummary: summarizeFan(monteCarloTrajectories),
          terrainData: terrainData,
          commandHistory: lastAiCommandsRef.current,
          latency: currentLatency,
          capturedFrame: sceneCapturedFrame,
          visionProvider: 'cosmos',
          nvidiaNimUrl: ai.nvidiaNimUrl,
          nvidiaApiKey: ai.nvidiaApiKey
        };

        // AI Autopilot call (throttled to 1s)
        const timeSinceLastAi = performance.now() - lastAutopilotCallTimeRef.current;
        if (isAiConfigured && !isAiAutopilotRunningRef.current && timeSinceLastAi > 1000) {
          isAiAutopilotRunningRef.current = true;
          lastAutopilotCallTimeRef.current = performance.now();
          const aiStartTime = performance.now();

          getAutopilotCommand(ai.nvidiaApiKey, aiState, ai.aiModel)
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
                dispatch({ type: 'ADD_LOG', payload: { text: `COSMOS AUTOPILOT: ${cmd.reasoning}`, type: 'info' } });
              }

              if (cmd.raw && (cmd.reasoning.startsWith('PARSE_FAIL') || cmd.reasoning.includes('JSON Parse Error'))) {
                dispatch({ type: 'ADD_LOG', payload: { text: `RAW_AI_OUTPUT: ${cmd.raw}`, type: 'warning' } });
              }
            })
            .catch(err => {
              dispatch({ type: 'ADD_LOG', payload: { text: "SYSTEM: Cosmos AI pipeline error.", type: 'critical' } });
              console.error("AI Autopilot Error:", err);
            })
            .finally(() => { isAiAutopilotRunningRef.current = false; });
        }

        // Command selection — Cosmos only, no heuristic fallback
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
            dispatch({ type: 'ADD_LOG', payload: { text: "SYSTEM: COSMOS REASON 2 CONNECTED. AUTOPILOT ENGAGED.", type: 'info' } });
            lastAiSourceRef.current = 'ai';
          }
        } else {
          // No heuristic fallback — rover stops and waits
          cmd = { steer: 0, throttle: 0, reasoning: "WAITING_FOR_AI" };
          inputRef.current.brake = true;

          if (lastAiSourceRef.current !== 'waiting') {
            const reason = !isAiConfigured ? "NOT_CONFIGURED" : (isStale ? "LATENCY_CRITICAL" : "CONNECTING");
            dispatch({ type: 'ADD_LOG', payload: { text: `SYSTEM: AI OFFLINE (${reason}). Rover stopped. Configure Cosmos NIM or switch to Manual.`, type: 'warning' } });
            lastAiSourceRef.current = 'waiting';
          }
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
  }, [monteCarloTrajectories, mission.driveMode, mission.simulationState, riskMetrics, currentLatency, targetDistance]);

  // Reset AI source tracking on mode change
  useEffect(() => {
    inputRef.current = { forward: 0, backward: 0, left: 0, right: 0, brake: false };
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
    const shouldRunWorker = mission.driveMode === DRIVE_MODES.AUTOPILOT;
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
    } else if (!shouldRunWorker) { setRiskMetrics({}); setMonteCarloTrajectories(null); }
  }, [mission.driveMode, mission.simulationState, terrainData.beacon]);

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
    if (mission.driveMode === DRIVE_MODES.AUTOPILOT && isAiConfigured && !isAiAutopilotRunningRef.current) {
      const interval = setInterval(() => {
        handleCaptureFrame();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [mission.driveMode, handleCaptureFrame, isAiConfigured]);

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
                  simulationState={mission.simulationState}
                  dispatch={dispatch}
                  roverRef={roverRef}
                  onTelemetryUpdate={handleTelemetry}
                  startPos={startPos}
                  monteCarloTrajectories={monteCarloTrajectories}
                  dangerMap={dangerMap}
                  shadowContrast={graphics.shadowContrast}
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
            onNewTerrain={handleNewTerrain}
            onRestart={handleRestart}
            onToggleCalibration={handleToggleCalibration}
            capturedFrame={sceneCapturedFrame}
            lidarScan={lidarScan}
            onMobileInput={(inp) => {
              if (inp.toggleAutopilot) {
                dispatch({ type: 'TOGGLE_AUTOPILOT' });
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
