// components/Rover.jsx — 6-wheel rover with custom raycast suspension physics
import React, { useRef, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { useGameDispatch, ROLLOVER_ANGLE } from '../store';
import { getHeightAtPosition } from '../terrain';

// Rover specs
const CHASSIS_SIZE = [1.8, 0.5, 3.2]; // slightly narrower for stability
const WHEEL_RADIUS = 0.45;
const SUSPENSION_REST_DIST = 0.5;
const SUSPENSION_STIFFNESS = 60.0;
const SUSPENSION_DAMPING = 3.5;
const MAX_SUSPENSION_TRAVEL = 0.4;

const WHEELS = [
    { pos: [-1.1, -0.2, -1.2], label: 'FL' },
    { pos: [1.1, -0.2, -1.2], label: 'FR' },
    { pos: [-1.2, -0.2, 0], label: 'ML' },
    { pos: [1.2, -0.2, 0], label: 'MR' },
    { pos: [-1.1, -0.2, 1.2], label: 'RL' },
    { pos: [1.1, -0.2, 1.2], label: 'RR' },
];

const Rover = forwardRef(function Rover({ getInput, terrainData, onTelemetryUpdate, startPosition = [0, 5, 0] }, ref) {
    const dispatch = useGameDispatch();
    const chassisBody = useRef();

    // Physics state refs
    const position = useRef([0, 0, 0]);
    const rotation = useRef([0, 0, 0, 1]); // quaternion
    const velocity = useRef([0, 0, 0]);
    const angVelocity = useRef([0, 0, 0]);

    // Input processing
    const steerAngle = useRef(0);
    const throttleRef = useRef(0);
    const isGameover = useRef(false);

    // Wheel meshes
    const wheelRefs = useRef([]);

    // Chassis physics body
    const [chassisRef, api] = useBox(() => ({
        mass: 150,
        args: CHASSIS_SIZE,
        position: startPosition,
        linearDamping: 0.5, // air drag
        angularDamping: 0.9, // Higher damping prevents sudden flips
        material: { friction: 0.1, restitution: 0 }, // slippery chassis, grip comes from suspension
        allowSleep: false,
        onCollide: (e) => {
            if (e.contact.impactVelocity > 10 && !isGameover.current) {
                // Only trigger damage on hard impacts, not normal driving
                if (Math.abs(e.contact.contactNormal[1]) < 0.5) { // side impact
                    isGameover.current = true;
                    dispatch({ type: 'SET_GAME_STATE', payload: { state: 'gameover', reason: 'damage' } });
                }
            }
        }
    }));

    // Sync physics state
    useEffect(() => {
        const unsubPos = api.position.subscribe((v) => (position.current = v));
        const unsubRot = api.quaternion.subscribe((v) => (rotation.current = v));
        const unsubVel = api.velocity.subscribe((v) => (velocity.current = v));
        const unsubAng = api.angularVelocity.subscribe((v) => (angVelocity.current = v));
        return () => { unsubPos(); unsubRot(); unsubVel(); unsubAng(); };
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
            isGameover.current = false;
            api.position.set(...(pos || startPosition));
            api.velocity.set(0, 0, 0);
            api.angularVelocity.set(0, 0, 0);
            api.rotation.set(0, 0, 0);
        },
    }));

    // Physics Loop
    useFrame((state, delta) => {
        if (isGameover.current || !terrainData) return;

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
                    const driveForce = throttleRef.current * 120.0;
                    const wheelSteer = (i < 2) ? steerAngle.current : (i > 3 ? -steerAngle.current * 0.5 : 0);
                    const wheelForward = forwardDir.clone().applyAxisAngle(upDir, wheelSteer);

                    // PHYSICS HACK: Reduce torque by applying force closer to CoM vertical plane
                    const relPos = wheelWorldPos.clone().sub(new THREE.Vector3(...position.current));
                    relPos.y *= 0.1;

                    api.applyForce(
                        wheelForward.multiplyScalar(driveForce).toArray(),
                        relPos.toArray()
                    );
                }

                // Sideways friction
                const sideVel = pointVel.dot(rightDir);
                const frictionForce = -sideVel * 20.0;
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

        // Brakes
        if (brake) {
            api.velocity.set(velocity.current[0] * 0.9, velocity.current[1], velocity.current[2] * 0.9);
            api.angularVelocity.set(angVelocity.current[0] * 0.9, angVelocity.current[1] * 0.9, angVelocity.current[2] * 0.9);
        }

        // Rollover check
        const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
        const pitch = Math.abs(euler.x * 180 / Math.PI);
        const roll = Math.abs(euler.z * 180 / Math.PI);

        if ((pitch > ROLLOVER_ANGLE || roll > ROLLOVER_ANGLE) && !isGameover.current) {
            isGameover.current = true;
            dispatch({ type: 'SET_GAME_STATE', payload: { state: 'gameover', reason: 'rollover' } });
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
                rotation: euler.toArray()
            });
        }

    });

    return (
        <group ref={chassisRef}>
            {/* Visual Chassis Mesh matches physics box */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={CHASSIS_SIZE} />
                <meshStandardMaterial color="#aaaaaa" roughness={0.4} metalness={0.6} />

                {/* Details */}
                <mesh position={[0, 0.4, -0.6]}>
                    <boxGeometry args={[1.4, 0.5, 1.2]} />
                    <meshStandardMaterial color="#cccccc" />
                </mesh>

                {/* Solar Panel */}
                <mesh position={[0, 0.65, 0.5]} rotation={[-0.1, 0, 0]}>
                    <boxGeometry args={[1.6, 0.05, 1.4]} />
                    <meshStandardMaterial color="#1a1a45" roughness={0.2} metalness={0.8} />
                </mesh>

                {/* Headlights */}
                <mesh position={[-0.6, 0, -1.61]}>
                    <boxGeometry args={[0.3, 0.15, 0.05]} />
                    <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={2} />
                </mesh>
                <mesh position={[0.6, 0, -1.61]}>
                    <boxGeometry args={[0.3, 0.15, 0.05]} />
                    <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={2} />
                </mesh>

                <pointLight position={[0, 0, -1.8]} distance={15} intensity={2} color="#00FFFF" />
            </mesh>

            {/* Visual Wheels */}
            {WHEELS.map((w, i) => {
                const hubX = w.pos[0] < 0 ? -0.23 : 0.23;
                return (
                    <group
                        key={i}
                        ref={el => wheelRefs.current[i] = el}
                        position={w.pos}
                    >
                        <group>
                            <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
                                <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.4, 16]} />
                                <meshStandardMaterial color="#555555" roughness={0.8} />
                            </mesh>
                            <mesh position={[hubX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                                <cylinderGeometry args={[0.15, 0.15, 0.05, 8]} />
                                <meshStandardMaterial color="#999999" metalness={0.8} />
                            </mesh>
                        </group>
                    </group>
                );
            })}
        </group>
    );
});

export default Rover;
