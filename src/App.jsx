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
  DRIVE_MODES,
  COLORS,
  SimulationContext,
  SimulationDispatchContext,
  VERSION
} from './store';

// Components
import Rover from './components/Rover';
import LunarTerrain from './components/LunarTerrain';
import Rocks from './components/Rocks';
import { Earth, Beacon } from './components/EarthAndBeacon';
import MonteCarloViz from './components/MonteCarloViz';
import HUD from './components/HUD';

import { LunarLighting, CameraController } from './components/Scene';
import Dust from './components/Dust';

// AI Navigation System
import { planStrategicRoute, getAutopilotCommand, summarizeFan } from './aiNavigator';

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
  waypoints
}) {
  return (
    <>
      <LunarLighting shadowContrast={shadowContrast} />
      <LunarTerrain terrainData={terrainData} />
      <Rocks rocks={terrainData.rocks} />

      {simulationState === 'running' && (
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
    rotation: [0, 0, 0]
  });

  const telemetryRef = useRef(telemetry);
  const [isAiPlanning, setIsAiPlanning] = useState(false);
  const [isMcCalculating, setIsMcCalculating] = useState(false);

  const roverRef = useRef();
  const batteryRef = useRef(100);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  const terrainData = useMemo(() => {
    return generateTerrainData(state.terrainSeed);
  }, [state.terrainSeed]);

  const [isMobile, setIsMobile] = useState(false);
  const [waypoints, setWaypoints] = useState([]);
  const [aiQuote, setAiQuote] = useState("");
  const [currentWaypointIdx, setCurrentWaypointIdx] = useState(0);
  const lastPlannedSeed = useRef(null); // EMERGENCY LOCK: Prevent billing loop
  const planningInProgressRef = useRef(false); // Atomic lock

  // V16: MANUAL INTENT PLANNING - Only calculate when user asks
  const triggerAiPlanning = useCallback(async () => {
    if (planningInProgressRef.current || isAiPlanning || !terrainData || !state.apiKey) return;

    const planningKey = `${state.terrainSeed}_${state.aiModel}_${state.apiKey}`;
    if (lastPlannedSeed.current === planningKey && waypoints.length > 0) return; // Already planned for this map

    console.log(`[AI] Start Manual Planning for seed: ${state.terrainSeed}`);
    planningInProgressRef.current = true;
    lastPlannedSeed.current = planningKey;

    setIsAiPlanning(true);
    setWaypoints([]); // Clear visual IMMEDIATELY on intent
    setAiQuote("");
    dispatch({ type: 'ADD_LOG', payload: { text: "AI ARCHITECT: SCANNING LUNAR TOPOLOGY...", type: 'info' } });

    try {
      const startPos = telemetryRef.current.position || [0, 0, 0];
      const targetPos = [terrainData.beacon.x, terrainData.beacon.y, terrainData.beacon.z];
      const aiLang = (state.language === 'RU' || state.language === 'UA') ? 'UA' : 'EN';

      const result = await planStrategicRoute(
        state.apiKey,
        terrainData.heightData,
        startPos,
        targetPos,
        terrainData.size,
        state.aiModel,
        aiLang
      );

      if (result && lastPlannedSeed.current === planningKey) {
        setWaypoints(result.waypoints);
        setAiQuote(result.quote);
        setCurrentWaypointIdx(0);

        // Log AI Reasoning to Terminal
        dispatch({ type: 'ADD_LOG', payload: { text: "AI ARCHITECT: STRATEGIC ROUTE COMMITTED.", type: 'info' } });
        if (result.reasoning) {
          dispatch({ type: 'ADD_LOG', payload: { text: `AI LOGIC: ${result.reasoning}`, type: 'system' } });
        }
        if (result.quote) {
          dispatch({ type: 'ADD_LOG', payload: { text: `AI QUOTE: "${result.quote}"`, type: 'info' } });
        }
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
  const aiCommandRef = useRef(null);

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
          dispatch({ type: 'TOGGLE_NAV_OVERLAY' });
          if (!state.navigationOverlay) triggerAiPlanning();
          break;
        case 'KeyP': handlePlanRoute(); break; // Added 'P' for Plan
        case 'KeyR': handleRestart(); break;
      }
    };
    const handleKeyUp = (e) => {
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
      if (state.simulationState === 'running' && !isAiPlanning) {
        elapsedRef.current += dt;
        batteryRef.current = Math.max(0, batteryRef.current - dt * 0.05);
        const [dx, dy, dz] = [telemetry.position[0] - terrainData.beacon.x, telemetry.position[1] - terrainData.beacon.y, telemetry.position[2] - terrainData.beacon.z];
        const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (currentDist < 3 && state.simulationState === 'running') dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'success' } });
        if (batteryRef.current <= 0) dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'gameover', reason: 'damage' } });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.simulationState, terrainData.beacon, telemetry.position, isAiPlanning]);

  useEffect(() => {
    if (state.driveMode === DRIVE_MODES.AUTOPILOT && monteCarloTrajectories && state.simulationState === 'running') {
      if (!telemetryRef.current || !telemetryRef.current.position) return;
      const sorted = [...monteCarloTrajectories].sort((a, b) => b.fitness - a.fitness);
      const currentWP = (waypoints && waypoints.length > 0 && waypoints[currentWaypointIdx])
        ? waypoints[currentWaypointIdx]
        : [terrainData.beacon.x, terrainData.beacon.z];
      const dx = currentWP[0] - telemetryRef.current.position[0], dz = currentWP[1] - telemetryRef.current.position[2];
      const distToWP = Math.sqrt(dx * dx + dz * dz);
      if (distToWP < 8 && waypoints && currentWaypointIdx < waypoints.length - 1) setCurrentWaypointIdx(prev => prev + 1);

      const aiState = {
        position: telemetryRef.current.position, velocity: telemetryRef.current.velocity, rotation: telemetryRef.current.rotation,
        currentWaypoint: currentWP, nextWaypoint: (waypoints && waypoints[currentWaypointIdx + 1]) || currentWP,
        fanSummary: summarizeFan(monteCarloTrajectories), sCVaR: riskMetrics.sCVaR, SMaR: riskMetrics.SMaR, distToWaypoint: distToWP,
      };

      const { steer, throttle } = getHeuristicFromFan(sorted, aiState);
      inputRef.current.left = steer > 0 ? Math.min(steer, 1) : 0;
      inputRef.current.right = steer < 0 ? Math.min(-steer, 1) : 0;
      inputRef.current.forward = throttle > 0 ? throttle : 0;
      inputRef.current.backward = throttle < 0 ? -throttle : 0;
    }
  }, [monteCarloTrajectories, state.driveMode, state.simulationState, riskMetrics, waypoints, currentWaypointIdx]);

  useEffect(() => {
    inputRef.current = { forward: 0, backward: 0, left: 0, right: 0, brake: false };
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
      const interval = setInterval(() => {
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
      }, 700);
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
  const targetDistance = useMemo(() => {
    const [dx, dy, dz] = [telemetry.position[0] - terrainData.beacon.x, telemetry.position[1] - terrainData.beacon.y, telemetry.position[2] - terrainData.beacon.z];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, [telemetry.position, terrainData.beacon]);

  return (
    <SimulationContext.Provider value={state}>
      <SimulationDispatchContext.Provider value={dispatch}>
        <div style={{ width: '100vw', height: '100vh', background: '#000000', position: 'relative', overflow: 'hidden' }}>
          <Canvas shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: state.brightness }} camera={{ fov: 60, near: 0.1, far: 2000, position: [0, 10, 15] }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
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
                shadowContrast={state.shadowContrast}
                waypoints={waypoints}
              />
            </Physics>
            {state.chromaticAberration && <EffectComposer><ChromaticAberration offset={[0.00035, 0.00035]} /></EffectComposer>}
          </Canvas>
          <HUD
            telemetry={{
              speed: telemetry.speed,
              pitch: telemetry.pitch,
              roll: telemetry.roll,
              battery: batteryRef.current
            }}
            targetDistance={targetDistance}
            driveMode={state.driveMode}
            aiQuote={aiQuote}
            simulationState={state.simulationState}
            isAiPlanning={isAiPlanning}
            isMcCalculating={isMcCalculating}
            riskMetrics={riskMetrics}
            apiKey={state.apiKey}
            onApiKeyChange={(key) => dispatch({ type: 'SET_API_KEY', payload: key })}
            aiModel={state.aiModel}
            onAiModelChange={(model) => dispatch({ type: 'SET_AI_MODEL', payload: model })}
            failReason={state.failReason}
            safetyScore={Math.max(0, Math.round(100 - elapsedRef.current * 0.1 - Math.abs(parseFloat(telemetry.pitch)) * 0.5))}
            elapsedTime={elapsedRef.current}
            language={state.language}
            isMobile={isMobile}
            onSetDriveMode={(mode) => {
              dispatch({ type: 'SET_DRIVE_MODE', payload: mode });
              if (mode === DRIVE_MODES.AUTOPILOT) triggerAiPlanning();
            }}
            onNewTerrain={handleNewTerrain}
            onRestart={handleRestart}
            onLanguageChange={(l) => dispatch({ type: 'SET_LANGUAGE', payload: l })}
            brightness={state.brightness}
            onBrightnessChange={(val) => dispatch({ type: 'SET_BRIGHTNESS', payload: val })}
            shadowContrast={state.shadowContrast}
            onShadowChange={(val) => dispatch({ type: 'SET_SHADOW_CONTRAST', payload: val })}
            chromaticAberration={state.chromaticAberration}
            onChromaticToggle={() => dispatch({ type: 'TOGGLE_CHROMATIC' })}
            onMobileInput={(inp) => {
              if (inp.toggleAutopilot) {
                dispatch({ type: 'TOGGLE_AUTOPILOT' });
                if (state.driveMode === DRIVE_MODES.MANUAL) triggerAiPlanning();
              } else if (inp.toggleNav) {
                dispatch({ type: 'TOGGLE_NAV_OVERLAY' });
                if (!state.navigationOverlay) triggerAiPlanning();
              } else {
                inputRef.current = { ...inputRef.current, ...inp };
              }
            }}
            isAiOnline={!!state.apiKey}
            navigationOverlay={state.navigationOverlay}
            onToggleNav={() => {
              dispatch({ type: 'TOGGLE_NAV_OVERLAY' });
              if (!state.navigationOverlay) triggerAiPlanning();
            }}
            onPlanRoute={handlePlanRoute}
          />
        </div>
      </SimulationDispatchContext.Provider>
    </SimulationContext.Provider>
  );
}

function getHeuristicFromFan(sortedTrajectories, aiState) {
  const { currentWaypoint, position, rotation, sCVaR, SMaR } = aiState;
  const dx = currentWaypoint[0] - position[0], dz = currentWaypoint[1] - position[2];
  const desiredAngle = Math.atan2(dx, dz);
  let angleDiff = desiredAngle - rotation[1];
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  const best = sortedTrajectories[0];
  if (!best || best.fitness < -5000) return { steer: (Math.random() - 0.5) * 2, throttle: -0.3 };
  const bestIsForward = best.input.throttle >= 0;
  const sameDirection = sortedTrajectories.filter(t => bestIsForward ? t.input.throttle >= 0 : t.input.throttle < 0);
  const topN = sameDirection.slice(0, Math.min(10, sameDirection.length));
  let avgSteer = 0, avgThrottle = 0;
  for (const t of topN) { avgSteer += t.input.steer; avgThrottle += t.input.throttle; }
  avgSteer /= topN.length; avgThrottle /= topN.length;
  let speedFactor = 1.0;
  if (SMaR !== undefined && SMaR !== null && SMaR < 25) speedFactor *= 0.5;
  if (sCVaR !== undefined && sCVaR !== null && sCVaR > 50) speedFactor *= 0.3;
  return { steer: topN.length > 0 ? -avgSteer : 0, throttle: topN.length > 0 ? avgThrottle * speedFactor : 0 };
}
