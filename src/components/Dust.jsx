// components/Dust.jsx — Rover Wheel Dust Trail System
// Spawns lunar dust particles behind rover wheels during movement.
// Self-contained: receives roverTelemetry prop and manages its own spawning logic.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_PARTICLES = 600;

// Wheel positions relative to rover chassis (matches Rover.jsx WHEELS)
const WHEEL_OFFSETS = [
    new THREE.Vector3(-1.15, -0.45, -1.2),  // FL
    new THREE.Vector3(1.15, -0.45, -1.2),   // FR
    new THREE.Vector3(-1.25, -0.45, 0),     // ML
    new THREE.Vector3(1.25, -0.45, 0),      // MR
    new THREE.Vector3(-1.15, -0.45, 1.2),   // RL
    new THREE.Vector3(1.15, -0.45, 1.2),    // RR
];

export default function Dust({ roverTelemetry }) {
    const meshRef = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const spawnTimer = useRef(0);

    // Particle pool
    const particles = useRef([]);
    useMemo(() => {
        particles.current = Array.from({ length: MAX_PARTICLES }, () => ({
            active: false,
            pos: new THREE.Vector3(),
            vel: new THREE.Vector3(),
            life: 0,
            scale: 1.0,
            rotation: Math.random() * Math.PI * 2,
        }));
    }, []);

    const findInactive = () => particles.current.find(p => !p.active);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        // === SPAWN LOGIC ===
        if (roverTelemetry && roverTelemetry.position && roverTelemetry.velocity) {
            const { position, velocity, rotation } = roverTelemetry;

            const speedVec = new THREE.Vector3(...velocity);
            const speed = speedVec.length();

            // Only spawn if rover is moving meaningfully
            if (speed > 0.5) {
                spawnTimer.current += delta;

                // Spawn rate proportional to speed (faster = more dust)
                const spawnInterval = Math.max(0.02, 0.08 / speed);

                if (spawnTimer.current >= spawnInterval) {
                    spawnTimer.current = 0;

                    // Get rover quaternion from rotation (Euler YXZ)
                    const quat = new THREE.Quaternion().setFromEuler(
                        new THREE.Euler(rotation[0], rotation[1], rotation[2], 'YXZ')
                    );

                    const roverPos = new THREE.Vector3(...position);

                    // Spawn from rear wheels (indices 4 & 5) primarily, all wheels for high speed
                    const wheelsToSpawn = speed > 2.0
                        ? [4, 5, 2, 3] // Rear + mid wheels
                        : [4, 5];      // Just rear wheels

                    for (const wi of wheelsToSpawn) {
                        const p = findInactive();
                        if (!p) break;

                        // World position of this wheel
                        const worldWheel = WHEEL_OFFSETS[wi].clone()
                            .applyQuaternion(quat)
                            .add(roverPos);

                        // Spawn just at ground level
                        p.active = true;
                        p.pos.set(worldWheel.x, worldWheel.y + 0.1, worldWheel.z);

                        // Velocity: mostly upward + backward + some lateral spread
                        const upward = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
                        const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);

                        const vScale = 0.3 + speed * 0.2;
                        p.vel.set(
                            (Math.random() - 0.5) * vScale * 2.0,
                            upward.y * vScale * (0.5 + Math.random() * 0.8),
                            (Math.random() - 0.5) * vScale * 2.0
                        );
                        // Add backward kick proportional to speed
                        p.vel.addScaledVector(backward, speed * 0.15);

                        p.life = 1.0;
                        p.scale = 0.08 + Math.random() * 0.15 + speed * 0.02;
                        p.rotation = Math.random() * Math.PI * 2;
                    }
                }
            } else {
                spawnTimer.current = 0;
            }
        }

        // === PARTICLE UPDATE ===
        particles.current.forEach((p, i) => {
            if (p.active) {
                // Fade using lunar gravity (1.62 m/s²)
                const fadeFactor = 1.0 + Math.max(0, spawnTimer.current); // Normalize life time
                p.life -= delta * (0.8 + Math.random() * 0.3);

                if (p.life <= 0) {
                    p.active = false;
                    dummy.position.set(0, -5000, 0);
                    dummy.scale.set(0.001, 0.001, 0.001);
                    dummy.updateMatrix();
                    meshRef.current.setMatrixAt(i, dummy.matrix);
                } else {
                    // Low lunar gravity
                    p.vel.y -= 1.62 * delta;
                    // Air resistance (none on Moon, but subtle drifting for visual appeal)
                    p.vel.multiplyScalar(1 - delta * 0.5);
                    p.pos.addScaledVector(p.vel, delta);

                    // Scale: grow slightly then shrink
                    const lifeRatio = p.life; // 0=dead, 1=just born
                    const scaleMult = lifeRatio < 0.7
                        ? lifeRatio / 0.7      // Shrink phase
                        : 1.0 + (1.0 - lifeRatio) * 0.5; // Grow phase (birth expansion)

                    const s = p.scale * scaleMult;
                    dummy.position.copy(p.pos);
                    dummy.scale.set(s, s, s);
                    dummy.rotation.set(
                        p.rotation + p.life * 2,
                        p.rotation,
                        p.rotation + p.life
                    );
                    dummy.updateMatrix();
                    meshRef.current.setMatrixAt(i, dummy.matrix);
                }
            } else {
                // Hidden particle
                dummy.position.set(0, -5000, 0);
                dummy.scale.set(0.001, 0.001, 0.001);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
            }
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[null, null, MAX_PARTICLES]}
            frustumCulled={false}
        >
            {/* Flat disc shape for dust grain, more lunar-looking than box */}
            <sphereGeometry args={[1, 4, 3]} />
            <meshStandardMaterial
                color="#c8b89a"        // Warm lunar regolith grey-tan
                transparent
                opacity={0.35}
                roughness={1}
                metalness={0}
                depthWrite={false}
                fog={true}
            />
        </instancedMesh>
    );
}
