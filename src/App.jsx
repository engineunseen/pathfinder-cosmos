// App.jsx — Lunar Risk: Monte Carlo Pathfinder
// Core application logic, physics world setup, and state management

import React, { useEffect, useRef, useState, useCallback, useReducer, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { Stars } from '@react-three/drei';

// Store & Constants
import {
  initialState,
  gameReducer,
  GameContext,
  GameDispatchContext,
  AI_MODES,
  LUNAR_GRAVITY
} from './store';

// Components
import Rover from './components/Rover';
import LunarTerrain from './components/LunarTerrain';
import Rocks from './components/Rocks';
import { Earth, Beacon } from './components/EarthAndBeacon';
import MonteCarloViz from './components/MonteCarloViz';
import HUD from './components/HUD';
import { LunarLighting, CameraController } from './components/Scene';

// Terrain Generation Utility
import { generateTerrainData } from './terrain';

function PhysicsScene({
  terrainData,
  getInput,
  aiMode,
  gameState,
  dispatch,
  roverRef,
  onTelemetryUpdate,
  startPos,
  monteCarloTrajectories,
  dangerMap
}) {
  return (
    <>
      <LunarLighting />

      <LunarTerrain terrainData={terrainData} />

      <Rocks rocks={terrainData.rocks} />

      {gameState === 'playing' && (
        <Rover
          ref={roverRef}
          getInput={getInput}
          terrainData={terrainData}
          onTelemetryUpdate={onTelemetryUpdate}
          startPosition={startPos}
          aiMode={aiMode}
        />
      )}

      <Earth />

      <Beacon position={[terrainData.beacon.x, terrainData.beacon.y, terrainData.beacon.z]} />

      <MonteCarloViz
        trajectories={monteCarloTrajectories}
        dangerMap={dangerMap}
        active={aiMode !== AI_MODES.OFF && gameState === 'playing'}
      />
    </>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [telemetry, setTelemetry] = useState({
    speed: '0.0',
    pitch: '0.0',
    roll: '0.0',
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    rotation: [0, 0, 0]
  });

  const roverRef = useRef();
  const batteryRef = useRef(100);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const [isMobile, setIsMobile] = useState(false);

  // Monte Carlo state
  const [monteCarloTrajectories, setMonteCarloTrajectories] = useState(null);
  const [dangerMap, setDangerMap] = useState(null);
  const mcWorkerRef = useRef(null);

  // Check for mobile
  useEffect(() => {
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  }, []);

  // Generate terrain based on seed
  const terrainData = useMemo(() => {
    return generateTerrainData(state.terrainSeed);
  }, [state.terrainSeed]);

  const startPos = useMemo(() => {
    const h = terrainData.matrix[Math.floor(terrainData.segments / 2)][Math.floor(terrainData.segments / 2)];
    return [0, h + 2, 0];
  }, [terrainData]);

  // Input Handling
  const inputRef = useRef({ forward: 0, backward: 0, left: 0, right: 0, brake: false });

  const getInput = useCallback(() => {
    return inputRef.current;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW': inputRef.current.forward = 1; break;
        case 'KeyS': inputRef.current.backward = 1; break;
        case 'KeyA': inputRef.current.left = 1; break;
        case 'KeyD': inputRef.current.right = 1; break;
        case 'Space': inputRef.current.brake = true; break;
        case 'KeyM': dispatch({ type: 'TOGGLE_AI' }); break;
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
  }, []);

  // Telemetry updates from Rover
  const handleTelemetry = useCallback((data) => {
    setTelemetry(prev => ({ ...prev, ...data }));
  }, []);

  // Main Loop
  useEffect(() => {
    let frame;
    const loop = (t) => {
      const dt = (t - lastTimeRef.current) / 1000;
      lastTimeRef.current = t;

      if (state.gameState === 'playing') {
        elapsedRef.current += dt;
        batteryRef.current = Math.max(0, batteryRef.current - dt * 0.05);

        // Check success
        const dx = telemetry.position[0] - terrainData.beacon.x;
        const dz = telemetry.position[2] - terrainData.beacon.z;
        const currentDist = Math.sqrt(dx * dx + dz * dz);

        if (currentDist < 5 && state.gameState === 'playing') {
          dispatch({ type: 'SET_GAME_STATE', payload: { state: 'success' } });
        }

        // Check failures
        if (batteryRef.current <= 0) {
          dispatch({ type: 'SET_GAME_STATE', payload: { state: 'gameover', reason: 'damage' } });
        }
      }

      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.gameState, terrainData.beacon, telemetry.position]);

  // Initialize MC Worker
  useEffect(() => {
    mcWorkerRef.current = new Worker(new URL('./monteCarlo.worker.js', import.meta.url), { type: 'module' });
    mcWorkerRef.current.onmessage = (e) => {
      if (e.data.type === 'SIMULATION_RESULTS') {
        setMonteCarloTrajectories(e.data.payload);
      }
    };
    return () => mcWorkerRef.current.terminate();
  }, []);

  // Inform worker about terrain
  useEffect(() => {
    if (mcWorkerRef.current && terrainData) {
      mcWorkerRef.current.postMessage({
        type: 'SET_TERRAIN',
        payload: {
          heightData: terrainData.heightData,
          size: terrainData.size,
          segments: terrainData.segments
        }
      });
    }
  }, [terrainData]);

  // Feed Worker
  useEffect(() => {
    if (mcWorkerRef.current && state.aiMode !== AI_MODES.OFF && state.gameState === 'playing') {
      const interval = setInterval(() => {
        mcWorkerRef.current.postMessage({
          type: 'RUN_SIMULATION',
          payload: {
            roverState: {
              position: telemetry.position,
              velocity: telemetry.velocity,
              rotation: telemetry.rotation,
              steerAngle: 0, // Placeholder
              throttle: inputRef.current.forward - inputRef.current.backward
            }
          }
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [state.aiMode, state.gameState, telemetry]);

  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESET_GAME' });
    batteryRef.current = 100;
    elapsedRef.current = 0;
  }, []);

  const handleNewTerrain = useCallback(() => {
    dispatch({ type: 'NEW_TERRAIN' });
    batteryRef.current = 100;
    elapsedRef.current = 0;
  }, []);

  const targetDistance = useMemo(() => {
    const dx = telemetry.position[0] - terrainData.beacon.x;
    const dz = telemetry.position[2] - terrainData.beacon.z;
    return Math.sqrt(dx * dx + dz * dz);
  }, [telemetry.position, terrainData.beacon]);

  return (
    <GameContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>
        <div style={{ width: '100vw', height: '100vh', background: '#000000', position: 'relative', overflow: 'hidden' }}>
          <Canvas
            shadows
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.2,
            }}
            camera={{ fov: 60, near: 0.1, far: 2000, position: [0, 10, 15] }}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          >
            <color attach="background" args={['#000000']} />
            <fog attach="fog" args={['#000000', 100, 450]} />

            <Stars />

            <CameraController
              targetPosition={telemetry.position}
              enabled={state.gameState === 'playing'}
            />

            <Physics
              key={state.terrainSeed}
              gravity={[0, -LUNAR_GRAVITY, 0]}
              defaultContactMaterial={{
                friction: 0.6,
                restitution: 0.1,
              }}
              iterations={10}
              broadphase="SAP"
            >
              <PhysicsScene
                terrainData={terrainData}
                getInput={getInput}
                aiMode={state.aiMode}
                gameState={state.gameState}
                dispatch={dispatch}
                roverRef={roverRef}
                onTelemetryUpdate={handleTelemetry}
                startPos={startPos}
                monteCarloTrajectories={monteCarloTrajectories}
                dangerMap={dangerMap}
              />
            </Physics>
          </Canvas>

          <HUD
            telemetry={{
              speed: telemetry.speed,
              pitch: telemetry.pitch,
              roll: telemetry.roll,
              battery: batteryRef.current,
            }}
            targetDistance={targetDistance}
            aiMode={state.aiMode}
            gameState={state.gameState}
            failReason={state.failReason}
            safetyScore={Math.max(0, Math.round(100 - elapsedRef.current * 0.1 - Math.abs(parseFloat(telemetry.pitch)) * 0.5))}
            elapsedTime={elapsedRef.current}
            language={state.language}
            isMobile={isMobile}
            onToggleAI={() => dispatch({ type: 'TOGGLE_AI' })}
            onSetAIMode={(mode) => dispatch({ type: 'SET_AI_MODE', payload: mode })}
            onNewTerrain={handleNewTerrain}
            onRestart={handleRestart}
            onLanguageChange={(l) => dispatch({ type: 'SET_LANGUAGE', payload: l })}
            onMobileInput={(inp) => {
              if (inp.toggleAI) dispatch({ type: 'TOGGLE_AI' });
              else inputRef.current = { ...inputRef.current, ...inp };
            }}
          />
        </div>
      </GameDispatchContext.Provider>
    </GameContext.Provider>
  );
}
