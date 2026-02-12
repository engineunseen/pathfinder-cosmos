// components/Scene.jsx — Lighting, Stars, and Camera Controls
import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { OrbitControls } from '@react-three/drei';

export function CameraController({ targetPosition, enabled }) {
    const { camera, gl } = useThree();
    const controlsRef = useRef();
    const prevTarget = useRef(new THREE.Vector3(targetPosition[0], targetPosition[1], targetPosition[2]));

    useFrame((state, delta) => {
        if (!enabled || !controlsRef.current) return;

        const tx = targetPosition[0];
        const ty = targetPosition[1];
        const tz = targetPosition[2];

        // 1. Calculate how much the rover moved since last frame
        const dx = tx - prevTarget.current.x;
        const dy = ty - prevTarget.current.y;
        const dz = tz - prevTarget.current.z;

        // 2. Move camera by the same amount (Follow Mode)
        // This preserves the relative offset/rotation set by the user via mouse
        camera.position.x += dx;
        camera.position.y += dy;
        camera.position.z += dz;

        // 3. Update OrbitControls target to look at new position
        controlsRef.current.target.set(tx, ty, tz);

        // 4. Update history
        prevTarget.current.set(tx, ty, tz);

        controlsRef.current.update();
    });

    return <OrbitControls ref={controlsRef} args={[camera, gl.domElement]} enableDamping dampingFactor={0.1} />;
}


export function LunarLighting({ shadowContrast = 0.5 }) {
    // Contrast slider reduces fill light (ambient + hemi) to darken shadows
    // 0.0 = Bright Shadows, 1.0 = Dark Shadows
    const fillFactor = Math.max(0.05, 1.0 - (shadowContrast * 0.9));

    return (
        <>
            {/* Primary Harsh Sunlight */}
            <directionalLight
                position={[100, 80, -50]}
                intensity={3.2}
                color="#ffffff"
                castShadow
                shadow-mapSize-width={4096}
                shadow-mapSize-height={4096}
                shadow-camera-far={300}
                shadow-camera-left={-80}
                shadow-camera-right={80}
                shadow-camera-top={80}
                shadow-camera-bottom={-80}
                shadow-bias={-0.0005}
            />

            {/* Earthshine (Blueish bounce from the sky) */}
            <ambientLight intensity={0.25 * fillFactor} color="#404060" />

            {/* Lunar Bounce (Hemispheric lighting for soft shadows) */}
            <hemisphereLight
                skyColor="#0a0a15"
                groundColor="#222233"
                intensity={0.6 * fillFactor}
            />

            {/* Subtle backlight for rim lighting on craters */}
            <directionalLight
                position={[-150, 40, 200]}
                intensity={0.15 * fillFactor}
                color="#4488cc"
            />
        </>
    );
}

export function Stars({ count = 3000 }) {
    const [positions, colors] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const cols = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            // Distance 700 to 1200
            const r = 700 + Math.random() * 500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)); // Mostly above horizon
            pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

            // Varied brightness and slight color tints
            const brightness = 0.5 + Math.random() * 0.5;
            const tint = Math.random();

            if (tint < 0.1) { // Blueish
                cols[i * 3] = brightness * 0.8;
                cols[i * 3 + 1] = brightness * 0.8;
                cols[i * 3 + 2] = brightness;
            } else if (tint < 0.2) { // Reddish/Amber
                cols[i * 3] = brightness;
                cols[i * 3 + 1] = brightness * 0.8;
                cols[i * 3 + 2] = brightness * 0.7;
            } else { // Pure white
                cols[i * 3] = brightness;
                cols[i * 3 + 1] = brightness;
                cols[i * 3 + 2] = brightness;
            }
        }
        return [pos, cols];
    }, [count]);

    return (
        <points frustumCulled={false}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={count}
                    array={positions}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-color"
                    count={count}
                    array={colors}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={1.6}
                vertexColors
                sizeAttenuation={false}
                transparent
                opacity={1}
                fog={false} // CRITICAL: Stars should not be affected by fog
            />
        </points>
    );
}
