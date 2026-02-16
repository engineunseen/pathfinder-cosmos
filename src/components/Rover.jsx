import React, { useRef, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBox } from '@react-three/cannon';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationDispatch, ROLLOVER_ANGLE } from '../store';
import { getHeightAtPosition } from '../terrain';

// Rover specs
const CHASSIS_SIZE = [1.8, 0.5, 3.2]; // slightly narrower for stability
const WHEEL_RADIUS = 0.45;
const SUSPENSION_REST_DIST = 0.5;
const SUSPENSION_STIFFNESS = 80.0;  // Stiffer = faster ground contact, less terrain clipping
const SUSPENSION_DAMPING = 5.0;     // Higher damping prevents bouncing on lunar surface
const MAX_SUSPENSION_TRAVEL = 0.3;  // Less travel = less "diving" into terrain

const WHEELS = [
    { pos: [-1.15, -0.2, -1.2], label: 'FL' },
    { pos: [1.15, -0.2, -1.2], label: 'FR' },
    { pos: [-1.25, -0.2, 0], label: 'ML' },
    { pos: [1.25, -0.2, 0], label: 'MR' },
    { pos: [-1.15, -0.2, 1.2], label: 'RL' },
    { pos: [1.15, -0.2, 1.2], label: 'RR' },
];


// Custom ChamferBox for "Pragmatic" hard bevels (1 segment, 45 degrees)
function ChamferBox({ args, bevel = 0.05, color, metalness, roughness, ...props }) {
    const [w, h, d] = args;
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        const w2 = w / 2 - bevel;
        const h2 = d / 2 - bevel; // Depth maps to 2D height in shape

        s.moveTo(-w2, -d / 2);
        s.lineTo(w2, -d / 2);
        s.lineTo(w / 2, -h2);
        s.lineTo(w / 2, h2);
        s.lineTo(w2, d / 2);
        s.lineTo(-w2, d / 2);
        s.lineTo(-w / 2, h2);
        s.lineTo(-w / 2, -h2);
        s.closePath();
        return s;
    }, [w, d, bevel]);

    const config = useMemo(() => ({
        depth: h - 2 * bevel, // Height maps to extrusion depth
        bevelEnabled: true,
        bevelSegments: 1,
        bevelSize: bevel,
        bevelThickness: bevel
    }), [h, bevel]);

    return (
        <mesh {...props} rotation={[-Math.PI / 2, 0, 0]} position={[0, -h / 2, 0]}> {/* Rotate to align Y up, Center Y */}
            <extrudeGeometry args={[shape, config]} />
            <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
        </mesh>
    );
}

const Rover = forwardRef(({ getInput, onTelemetryUpdate, startPosition = [0, 2, 0], terrainData, isAiStalled }, ref) => {
    const dispatch = useSimulationDispatch();

    // Internal state refs — V1.4.7: Initialize with startPosition to avoid [0,0,0] loop
    const position = useRef(startPosition || [0, 0, 0]);
    const velocity = useRef([0, 0, 0]);
    const rotation = useRef([0, 0, 0, 1]);
    const angVelocity = useRef([0, 0, 0]);

    // Input processing
    const steerAngle = useRef(0);
    const throttleRef = useRef(0);
    const isSimulationOver = useRef(false);

    // Wheel meshes
    const wheelRefs = useRef([]);

    // Chassis physics body
    const [chassisRef, api] = useBox(() => ({
        mass: 150,
        args: CHASSIS_SIZE,
        position: startPosition,
        linearDamping: 0.15, // Very low — no atmosphere on Moon, just internal resistance
        angularDamping: 0.5, // Moderate — allows realistic rotation in low gravity
        material: { friction: 0.1, restitution: 0.05 }, // Tiny bounce on impacts
        allowSleep: false,
        onCollide: (e) => {
            if (e.contact.impactVelocity > 10 && !isSimulationOver.current) {
                // Only trigger damage on hard impacts, not normal driving
                if (Math.abs(e.contact.contactNormal[1]) < 0.5) { // side impact
                    isSimulationOver.current = true;
                    dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'gameover', reason: 'damage' } });
                }
            }
        }
    }));

    // Sync physics state
    useEffect(() => {
        if (!api || !api.position || !api.quaternion) return;
        const unsubPos = api.position.subscribe((v) => (position.current = v));
        const unsubRot = api.quaternion.subscribe((v) => (rotation.current = v));
        const unsubVel = api.velocity.subscribe((v) => (velocity.current = v));
        const unsubAng = api.angularVelocity.subscribe((v) => (angVelocity.current = v));
        return () => {
            if (unsubPos) unsubPos();
            if (unsubRot) unsubRot();
            if (unsubVel) unsubVel();
            if (unsubAng) unsubAng();
        };
    }, [api]);

    // Expose API
    useImperativeHandle(ref, () => ({
        getState: () => ({
            position: position.current,
            velocity: velocity.current,
            rotation: new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...rotation.current), 'YXZ').toArray().slice(0, 3),
            steerAngle: steerAngle.current,
            throttle: throttleRef.current,
        }),
        reset: (pos) => {
            isSimulationOver.current = false;
            api.position.set(...(pos || startPosition));
            api.velocity.set(0, 0, 0);
            api.angularVelocity.set(0, 0, 0);
            api.rotation.set(0, 0, 0);
        },
    }));

    // Physics Loop
    useFrame((state, delta) => {
        if (isSimulationOver.current || !terrainData) return;

        const input = getInput();
        const { forward, backward, left, right, brake } = input;

        // Steering
        const targetSteer = (left - right) * 0.5;
        steerAngle.current += (targetSteer - steerAngle.current) * 0.1;

        // Throttle Smoothing (prevents instant jerk)
        const targetThrottle = forward - backward;
        throttleRef.current += (targetThrottle - throttleRef.current) * 0.1;

        // Get current orientation
        const quat = new THREE.Quaternion(...rotation.current);
        const upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
        const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
        const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);

        let wheelsOnGround = 0;

        WHEELS.forEach((w, i) => {
            // World position of wheel mount point
            const wheelOffset = new THREE.Vector3(...w.pos);
            const wheelWorldPos = wheelOffset.clone().applyQuaternion(quat).add(new THREE.Vector3(...position.current));

            // Raycast down to find terrain height
            const terrainHeight = getHeightAtPosition(terrainData.heightData, wheelWorldPos.x, wheelWorldPos.z);

            // Calculate compression
            const distToGround = wheelWorldPos.y - terrainHeight;
            const maxLength = SUSPENSION_REST_DIST + MAX_SUSPENSION_TRAVEL;

            if (distToGround < maxLength) {
                wheelsOnGround++;

                // Suspension force (Spring)
                const compression = Math.max(0, maxLength - distToGround);

                const force = SUSPENSION_STIFFNESS * compression;

                // Damping force
                const pointVel = new THREE.Vector3(...velocity.current)
                    .add(new THREE.Vector3(...angVelocity.current).cross(wheelWorldPos.clone().sub(new THREE.Vector3(...position.current))));
                const damping = pointVel.dot(upDir) * SUSPENSION_DAMPING;

                const totalSuspensionForce = Math.max(0, force - damping);

                // Apply suspension force at wheel position
                api.applyForce(
                    upDir.clone().multiplyScalar(totalSuspensionForce).toArray(),
                    wheelWorldPos.clone().sub(new THREE.Vector3(...position.current)).toArray()
                );

                // Friction / Traction
                if (Math.abs(throttleRef.current) > 0.01 && !brake) {
                    const driveForce = throttleRef.current * 120.0; // Tuned for lunar gravity — prevents liftoff
                    const wheelSteer = (i < 2) ? steerAngle.current : (i > 3 ? -steerAngle.current * 0.5 : 0);
                    const wheelForward = forwardDir.clone().applyAxisAngle(upDir, wheelSteer);

                    // Project drive force onto ground plane to prevent vertical thrust on slopes
                    wheelForward.y *= 0.2; // Severely limit vertical component
                    wheelForward.normalize().multiplyScalar(Math.abs(driveForce));
                    if (throttleRef.current < 0) wheelForward.negate();

                    // Reduce torque by applying force closer to CoM vertical plane
                    const relPos = wheelWorldPos.clone().sub(new THREE.Vector3(...position.current));
                    relPos.y *= 0.1;

                    api.applyForce(
                        wheelForward.toArray(),
                        relPos.toArray()
                    );
                }

                // Sideways friction
                const sideVel = pointVel.dot(rightDir);
                const frictionForce = -sideVel * 12.0; // Lower friction = more lunar slide in turns
                api.applyForce(
                    rightDir.clone().multiplyScalar(frictionForce).toArray(),
                    wheelWorldPos.clone().sub(new THREE.Vector3(...position.current)).toArray()
                );
            }

            // Visual update of wheel mesh
            if (wheelRefs.current[i]) {
                let visualY = -distToGround;
                visualY = Math.max(-maxLength, Math.min(0, visualY));

                const wheelGroup = wheelRefs.current[i];
                wheelGroup.position.y = w.pos[1] + visualY + WHEEL_RADIUS;

                // Rotation (Spin)
                const speed = new THREE.Vector3(...velocity.current).length();
                const spin = (speed * delta / WHEEL_RADIUS) * (throttleRef.current > 0 ? -1 : 1);
                wheelGroup.children[0].rotation.x += spin;

                // Steering
                const wheelSteer = (i < 2) ? steerAngle.current : (i > 3 ? -steerAngle.current * 0.5 : 0);
                wheelGroup.rotation.y = wheelSteer;
            }
        });
        // Floor clamping failsafe — prevent rover from sinking through terrain
        if (wheelsOnGround >= 2) {
            const chassisTerrainH = getHeightAtPosition(terrainData.heightData, position.current[0], position.current[2]);
            const minClearance = CHASSIS_SIZE[1] * 0.5 + 0.1; // Half chassis height + small margin
            if (position.current[1] < chassisTerrainH + minClearance) {
                api.position.set(position.current[0], chassisTerrainH + minClearance, position.current[2]);
                if (velocity.current[1] < 0) {
                    api.velocity.set(velocity.current[0], 0, velocity.current[2]);
                }
            }
        }

        // Boundary: keep rover within terrain edges
        const halfTerrain = terrainData.size / 2 - 5;
        const px = position.current[0];
        const pz = position.current[2];
        if (Math.abs(px) > halfTerrain || Math.abs(pz) > halfTerrain) {
            const cx = Math.max(-halfTerrain, Math.min(halfTerrain, px));
            const cz = Math.max(-halfTerrain, Math.min(halfTerrain, pz));
            api.position.set(cx, position.current[1], cz);
            api.velocity.set(
                Math.abs(px) > halfTerrain ? -velocity.current[0] * 0.3 : velocity.current[0],
                velocity.current[1],
                Math.abs(pz) > halfTerrain ? -velocity.current[2] * 0.3 : velocity.current[2]
            );
        }

        // Brakes — FPS-independent using delta
        if (brake) {
            const brakeFactor = Math.pow(0.05, delta); // Exponential decay, consistent across framerates
            api.velocity.set(velocity.current[0] * brakeFactor, velocity.current[1], velocity.current[2] * brakeFactor);
            api.angularVelocity.set(angVelocity.current[0] * brakeFactor, angVelocity.current[1] * brakeFactor, angVelocity.current[2] * brakeFactor);
        }

        // Rollover check
        const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
        const pitch = Math.abs(euler.x * 180 / Math.PI);
        const roll = Math.abs(euler.z * 180 / Math.PI);

        if ((pitch > ROLLOVER_ANGLE || roll > ROLLOVER_ANGLE) && !isSimulationOver.current) {
            isSimulationOver.current = true;
            dispatch({ type: 'SET_SIMULATION_STATE', payload: { state: 'gameover', reason: 'rollover' } });
        }

        // Telemetry
        if (onTelemetryUpdate) {
            const speedKmph = new THREE.Vector3(...velocity.current).length() * 3.6;
            onTelemetryUpdate({
                speed: speedKmph.toFixed(1),
                pitch: (euler.x * 180 / Math.PI).toFixed(1),
                roll: (euler.z * 180 / Math.PI).toFixed(1),
                position: position.current,
                velocity: velocity.current,
                rotation: euler.toArray(),
                angularVelocity: angVelocity.current,
                wheelsOnGround
            });
        }

    });

    return (
        <group ref={chassisRef}>
            {/* Visual Chassis: ChamferBox with hard single bevel */}
            <ChamferBox
                args={CHASSIS_SIZE} // [2, 0.5, 2.6]
                bevel={0.04}
                color="#aaaaaa"
                metalness={0.6}
                roughness={0.4}
                castShadow
                receiveShadow
            />

            {/* Details (Upper Cabin) - Darker & Rounded */}
            <group position={[0, 0.4, -0.6]}>
                <ChamferBox
                    args={[1.4, 0.5, 1.2]}
                    bevel={0.03}
                    color="#777777"
                    metalness={0.4}
                    roughness={0.6}
                    castShadow
                    receiveShadow
                />
            </group>

            {/* Solar Panel with Hinge (Pivoting at Cabin Tail) */}
            <group position={[0, 0.64, 0.02]} rotation={[-0.26, 0, 0]}>
                {/* Hinge / Axle Bushing (At Pivot Point) */}
                <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.08, 0.08, 1.2, 16]} />
                    <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.3} />
                </mesh>

                {/* Dark Backing Plate (Shifted to start at hinge) */}
                <mesh position={[0, -0.01, 0.72]}>
                    <boxGeometry args={[1.64, 0.05, 1.44]} />
                    <meshStandardMaterial color="#111111" roughness={0.9} />
                </mesh>

                {/* Finer Grid: Shifted +0.72 z */}
                {[...Array(2)].map((_, col) =>
                    [...Array(3)].map((_, row) => {
                        const width = 0.80;
                        const length = 0.46;
                        const gap = 0.01;
                        const x = (col - 0.5) * (width + gap);
                        const z = (row - 1) * (length + gap) + 0.72;
                        return (
                            <mesh key={`cell-${col}-${row}`} position={[x, 0.025, z]}>
                                <boxGeometry args={[width, 0.02, length]} />
                                <meshStandardMaterial color="#4b5b90" roughness={0.2} metalness={0.6} />
                            </mesh>
                        );
                    })
                )}
            </group>

            {/* AI Status Indicator (V0.8.25) */}
            {isAiStalled && (
                <group position={[0, 1.8, 0]}>
                    <Text
                        fontSize={0.2}
                        color="#FF0000"
                        anchorX="center"
                        anchorY="middle"
                        font="/fonts/Inter-Bold.woff" // Assuming font exists or falls back
                    >
                        [ AI STALLED ]
                    </Text>
                    <mesh position={[0, -0.25, 0]}>
                        <boxGeometry args={[1.2, 0.02, 0.02]} />
                        <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={2} />
                    </mesh>
                    <pointLight color="#FF0000" intensity={1} distance={3} />
                </group>
            )}

            {/* Antenna */}
            <group position={[-0.65, 0.5, -1.15]}>
                <mesh position={[0, 0.4, 0]}>
                    <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
                    <meshStandardMaterial color="#aaaaaa" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.8, 0]}>
                    <sphereGeometry args={[0.06, 16, 16]} />
                    <meshStandardMaterial color="#ff3300" emissive="#ff0000" emissiveIntensity={0.8} />
                </mesh>
                <pointLight position={[0, 0.8, 0]} color="#ff0000" intensity={0.5} distance={2} />
            </group>

            {/* Headlights */}
            <mesh position={[-0.6, 0, -1.65]}>
                <boxGeometry args={[0.3, 0.15, 0.05]} />
                <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={2} />
            </mesh>
            <mesh position={[0.6, 0, -1.65]}>
                <boxGeometry args={[0.3, 0.15, 0.05]} />
                <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={2} />
            </mesh>


            <pointLight position={[-0.6, 0, -1.8]} distance={15} intensity={2} color="#00FFFF" />
            <pointLight position={[0.6, 0, -1.8]} distance={15} intensity={2} color="#00FFFF" />

            {/* Visual Wheels */}
            {
                WHEELS.map((w, i) => {
                    const hubX = w.pos[0] < 0 ? -0.23 : 0.23;
                    return (
                        <group
                            key={i}
                            ref={el => wheelRefs.current[i] = el}
                            position={w.pos}
                        >
                            <group>
                                {/* Tire Drum (Lighter Metallic Grey) */}
                                <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
                                    <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.4, 32]} />
                                    <meshStandardMaterial color="#555555" metalness={0.6} roughness={0.4} />
                                </mesh>
                                {/* Hub Cap - Silvery Metallic with Sharp Bevel */}
                                <group position={[w.pos[0] < 0 ? -0.21 : 0.21, 0, 0]} rotation={w.pos[0] < 0 ? [0, 0, Math.PI / 2] : [0, 0, -Math.PI / 2]}>
                                    {/* Base Disc (Thicker base: 0.04) */}
                                    <mesh>
                                        <cylinderGeometry args={[0.25, 0.25, 0.04, 24]} />
                                        <meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.2} />
                                    </mesh>
                                    {/* Chamfered Edge (Smaller 0.02, Delta 0.02 -> 45 degrees) */}
                                    <mesh position={[0, 0.03, 0]}>
                                        <cylinderGeometry args={[0.23, 0.25, 0.02, 24]} />
                                        <meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.2} />
                                    </mesh>
                                </group>

                                {/* Silver Treads */}
                                {[...Array(8)].map((_, t) => {
                                    const angle = (t / 8) * Math.PI * 2;
                                    return (
                                        <mesh
                                            key={t}
                                            position={[0, Math.sin(angle) * WHEEL_RADIUS, Math.cos(angle) * WHEEL_RADIUS]}
                                            rotation={[angle, 0, 0]}
                                        >
                                            {/* Taller treads: 0.08 height */}
                                            <boxGeometry args={[0.38, 0.08, 0.08]} />
                                            <meshStandardMaterial color="#dddddd" metalness={0.8} roughness={0.2} />
                                        </mesh>
                                    );
                                })}
                            </group>
                        </group>
                    );
                })
            }
        </group >
    );
});

export default Rover;
