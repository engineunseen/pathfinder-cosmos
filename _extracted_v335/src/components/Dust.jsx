import React, { useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_PARTICLES = 300;

const Dust = forwardRef((props, ref) => {
    const meshRef = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Particle state: [x, y, z, vx, vy, vz, life, maxLife, scale]
    const particles = useRef([]);

    // Initialize pool
    useMemo(() => {
        particles.current = [];
        for (let i = 0; i < MAX_PARTICLES; i++) {
            particles.current.push({
                active: false,
                pos: new THREE.Vector3(),
                vel: new THREE.Vector3(),
                life: 0,
                maxLife: 1.0,
                scale: 1.0,
                rotation: Math.random() * Math.PI
            });
        }
    }, []);

    useImperativeHandle(ref, () => ({
        spawn: (x, y, z, velocityScale = 1.0) => {
            // Find first inactive particle
            const p = particles.current.find(p => !p.active);
            if (p) {
                p.active = true;
                p.pos.set(x, y, z);
                // Random upward/outward velocity
                p.vel.set(
                    (Math.random() - 0.5) * 2.0 * velocityScale,
                    (Math.random() * 2.0 + 0.5) * velocityScale,
                    (Math.random() - 0.5) * 2.0 * velocityScale
                );
                p.life = 1.0;
                p.maxLife = 0.5 + Math.random() * 0.5;
                p.scale = 0.2 + Math.random() * 0.3;
                p.rotation = Math.random() * Math.PI;
            }
        }
    }));

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        let activeCount = 0;

        particles.current.forEach((p, i) => {
            if (p.active) {
                p.life -= delta * 1.5; // Fade speed

                if (p.life <= 0) {
                    p.active = false;
                    // Move out of view
                    dummy.position.set(0, -1000, 0);
                    dummy.updateMatrix();
                    meshRef.current.setMatrixAt(i, dummy.matrix);
                } else {
                    // Update physics
                    p.vel.y -= 3.0 * delta; // Low gravity
                    p.pos.add(p.vel.clone().multiplyScalar(delta));

                    // Update transform
                    dummy.position.copy(p.pos);
                    const scale = p.scale * p.life; // Shrink as it dies
                    dummy.scale.set(scale, scale, scale);
                    dummy.rotation.set(p.rotation, p.rotation, p.rotation);
                    dummy.updateMatrix();

                    meshRef.current.setMatrixAt(i, dummy.matrix);
                    activeCount++;
                }
            } else {
                // Ensure inactive are hidden
                dummy.position.set(0, -1000, 0);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
            }
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[null, null, MAX_PARTICLES]} frustumCulled={false}>
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshStandardMaterial
                color="#aaaaaa"
                transparent
                opacity={0.4}
                roughness={1}
                depthWrite={false}
            />
        </instancedMesh>
    );
});

export default Dust;
