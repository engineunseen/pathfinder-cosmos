// components/Scene.jsx — v3.0.0: Upgraded Stars (Shader Twinkle) + Sun Halo
// Ported from Pathfinder5 (V1.30.0 / V1.8.7)
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';

export function CameraController({ targetPosition, enabled, seed, snapPosition }) {
    const { camera, gl } = useThree();
    const controlsRef = useRef();
    const lastSeed = useRef(null); // V1.4.9: Init with null to force initial snap
    const prevTarget = useRef(new THREE.Vector3(targetPosition[0], targetPosition[1], targetPosition[2]));

    useFrame((state, delta) => {
        if (!enabled || !controlsRef.current) return;

        const tx = targetPosition[0];
        const ty = targetPosition[1];
        const tz = targetPosition[2];

        // V1.4.9: UNIVERSAL CAMERA SNAP - Force jump on mount and map refresh
        if (seed !== lastSeed.current) {
            const sx = snapPosition ? snapPosition[0] : tx;
            const sy = snapPosition ? snapPosition[1] : ty;
            const sz = snapPosition ? snapPosition[2] : tz;

            camera.position.set(sx + 5, sy + 4, sz + 8);
            controlsRef.current.target.set(sx, sy, sz);
            controlsRef.current.update();
            lastSeed.current = seed;
            prevTarget.current.set(sx, sy, sz);
            return;
        }

        // Standard Relative Follow
        const dx = tx - prevTarget.current.x;
        const dy = ty - prevTarget.current.y;
        const dz = tz - prevTarget.current.z;

        camera.position.x += dx;
        camera.position.y += dy;
        camera.position.z += dz;

        controlsRef.current.target.set(tx, ty, tz);
        prevTarget.current.set(tx, ty, tz);
        controlsRef.current.update();
    });

    return <OrbitControls ref={controlsRef} args={[camera, gl.domElement]} enableDamping dampingFactor={0.1} />;
}

export function LunarLighting({ shadowContrast = 0.5, roverPosition = [0, 0, 0] }) {
    const lightRef = useRef();
    const targetRef = useRef();
    // Contrast slider reduces fill light (ambient + hemi) to darken shadows
    const fillFactor = Math.max(0.1, 1.0 - (shadowContrast * 0.8));

    useFrame(() => {
        if (lightRef.current && targetRef.current) {
            const [x, y, z] = roverPosition;
            // Keep light following the rover for consistent shadows
            lightRef.current.position.set(x + 100, y + 80, z - 50);
            targetRef.current.position.set(x, y, z);
        }
    });

    return (
        <>
            <object3D ref={targetRef} />
            {/* Primary Harsh Sunlight — follows rover */}
            <directionalLight
                ref={lightRef}
                intensity={3.5}
                color="#ffffff"
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-far={300}
                shadow-camera-left={-80}
                shadow-camera-right={80}
                shadow-camera-top={80}
                shadow-camera-bottom={-80}
                shadow-bias={-0.0005}
                target={targetRef.current}
            />

            {/* Earthshine (Blueish bounce from the sky) */}
            <ambientLight intensity={0.4 * fillFactor} color="#454565" />

            {/* Lunar Bounce (Hemispheric lighting for soft shadows) */}
            <hemisphereLight skyColor="#0a0a15" groundColor="#222233" intensity={0.8 * fillFactor} />
        </>
    );
}

// ============================================================
// v3.0.0: CINEMATIC STARS WITH SHADER TWINKLE (from Pathfinder5)
// Custom GLSL shader: per-star size, phase, and animated brightness
// ============================================================
const starVertexShader = `
    attribute float aSize;
    attribute float aPhase;
    varying vec3 vColor;
    varying float vPhase;
    varying float vBrightness;
    uniform float uTime;

    void main() {
        vColor = color;
        vPhase = aPhase;
        float twinkle = 0.75 + 0.25 * sin(uTime * (1.5 + aPhase * 3.0) + aPhase * 6.2831);
        vBrightness = twinkle;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * twinkle;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const starFragmentShader = `
    varying vec3 vColor;
    varying float vPhase;
    varying float vBrightness;
    void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        alpha *= alpha;
        gl_FragColor = vec4(vColor * vBrightness, alpha);
    }
`;

export function Stars({ count = 8000 }) {
    const materialRef = useRef();
    const [positions, colors, sizes, phases] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const cols = new Float32Array(count * 3);
        const sz = new Float32Array(count);
        const ph = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            // Distance 800 to 1200
            const r = 800 + Math.random() * 400;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.cos(phi);
            pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

            // Power-law magnitude distribution (realistic star brightness)
            const magnitude = Math.pow(Math.random(), 2.0);
            const brightness = (0.2 + magnitude * 0.8) * 2.5;
            sz[i] = 0.8 + magnitude * 3.0;
            ph[i] = Math.random(); // Unique twinkle phase per star

            // Spectral type color tints
            const spectralRoll = Math.random();
            let r_col, g_col, b_col;
            if (spectralRoll < 0.05) {
                // Blue-white (O/B type)
                r_col = brightness * 0.8; g_col = brightness * 0.9; b_col = brightness * 1.0;
            } else if (spectralRoll < 0.2) {
                // Amber/Orange (K/M type)
                r_col = brightness * 1.0; g_col = brightness * 0.95; b_col = brightness * 0.9;
            } else {
                // Pure white (G type — like our Sun)
                r_col = brightness; g_col = brightness; b_col = brightness;
            }
            cols[i * 3] = r_col; cols[i * 3 + 1] = g_col; cols[i * 3 + 2] = b_col;
        }
        return [pos, cols, sz, ph];
    }, [count]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

    return (
        <points frustumCulled={false}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
                <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
                <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
                <bufferAttribute attach="attributes-aPhase" count={count} array={phases} itemSize={1} />
            </bufferGeometry>
            <shaderMaterial
                ref={materialRef}
                vertexShader={starVertexShader}
                fragmentShader={starFragmentShader}
                uniforms={uniforms}
                vertexColors
                transparent
                depthWrite={false}
                fog={false}
            />
        </points>
    );
}
