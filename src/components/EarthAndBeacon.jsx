// components/EarthAndBeacon.jsx — v3.2.0: Restored Crystal Rings + Optimized Earth
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ============================================================
// EARTH: Procedural shader with FBM noise for continents/oceans
// + Fresnel atmospheric rim + Backlight Halo billboard
// ============================================================
const earthVertexShader = `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vObjectPosition;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        vObjectPosition = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const earthFragmentShader = `
    varying vec3 vNormal;
    varying vec3 vObjectPosition;
    varying vec3 vViewPosition;
    
    float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
    }
    
    float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    
    float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; ++i) {
            v += a * noise(p);
            p = p * 2.1;
            a *= 0.5;
        }
        return v;
    }

    void main() {
        float n = fbm(vObjectPosition * 0.04);
        vec3 oceanColor = vec3(0.01, 0.03, 0.1); 
        vec3 landColor = vec3(0.06, 0.08, 0.05); 
        float landMask = smoothstep(0.48, 0.52, n);
        vec3 color = mix(oceanColor, landColor, landMask);
        
        vec3 lightDir = normalize(vec3(-1.0, 0.5, 0.5)); 
        float diff = max(dot(vNormal, lightDir), 0.0);
        
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0); 
        vec3 haloColor = vec3(0.1, 0.4, 1.0);
        
        vec3 finalColor = color * (diff * 1.5 + 0.05);
        finalColor += haloColor * fresnel * 0.8; 
        
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// v3.0.1: Backlight Halo — softer, pure blue, smaller radius
const haloVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const haloFragmentShader = `
    varying vec2 vUv;
    void main() {
        float d = length(vUv - 0.5);
        float glow = smoothstep(0.5, 0.28, d);
        glow = pow(glow, 6.0);
        vec3 blueGlow = vec3(0.05, 0.25, 1.0);
        gl_FragColor = vec4(blueGlow, glow * 0.28);
    }
`;

export function Earth() {
    const earthRef = useRef();
    const glowRef = useRef();

    useFrame((state) => {
        if (earthRef.current) {
            earthRef.current.rotation.y += 0.0001;
            earthRef.current.rotation.x = 0.4;
        }
        if (glowRef.current) {
            glowRef.current.lookAt(state.camera.position);
        }
    });

    return (
        <group position={[200, 80, -500]}>
            {/* BACKLIGHT HALO — blue, soft, billboard */}
            <mesh ref={glowRef} scale={[2.0, 2.0, 1]} position={[0, 0, -2]}>
                <planeGeometry args={[100, 100]} />
                <shaderMaterial
                    vertexShader={haloVertexShader}
                    fragmentShader={haloFragmentShader}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>

            {/* PLANET BODY */}
            <mesh ref={earthRef}>
                <sphereGeometry args={[80, 64, 64]} />
                <shaderMaterial
                    vertexShader={earthVertexShader}
                    fragmentShader={earthFragmentShader}
                    transparent={false}
                />
            </mesh>
        </group>
    );
}

// ============================================================
// ============================================================
// BEACON — v3.3.1: Cyan mast + Static Base Rings + Floating Rhombus
// ============================================================
export function Beacon({ position }) {
    const coreRef = useRef();
    const ring1Ref = useRef();
    const ring2Ref = useRef();
    const ring3Ref = useRef();
    const crystalRing1Ref = useRef();
    const crystalRing2Ref = useRef();

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        const currentY = 93 + Math.sin(t * 1.5) * 2.5;
        if (coreRef.current) coreRef.current.position.y = currentY;

        // Base rings rotation — v3.3.1: Disabled per user request (Static rings)
        // if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.4;
        // if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.3;
        // if (ring3Ref.current) ring3Ref.current.rotation.z = t * 0.2;

        // v3.2.0: Crystal rings rotation
        if (crystalRing1Ref.current) {
            crystalRing1Ref.current.position.y = currentY;
            crystalRing1Ref.current.rotation.x = t * 1.2;
            crystalRing1Ref.current.rotation.y = t * 0.8;
        }
        if (crystalRing2Ref.current) {
            crystalRing2Ref.current.position.y = currentY;
            crystalRing2Ref.current.rotation.z = t * 1.5;
            crystalRing2Ref.current.rotation.x = -t * 0.6;
        }
    });

    if (!position) return null;

    return (
        <group position={position} scale={[0.18, 0.18, 0.18]}>
            {/* Cyan semi-transparent mast */}
            <mesh position={[0, 50, 0]}>
                <cylinderGeometry args={[0.5, 2, 110, 16]} />
                <meshStandardMaterial
                    color="#00FFFF"
                    emissive="#00FFFF"
                    emissiveIntensity={2}
                    transparent
                    opacity={0.5}
                    toneMapped={false}
                />
            </mesh>

            {/* Vertical beam glow */}
            <mesh position={[0, 90, 0]}>
                <cylinderGeometry args={[0.1, 1, 180, 16]} />
                <meshStandardMaterial
                    color="#00FFFF"
                    emissive="#00FFFF"
                    emissiveIntensity={5}
                    transparent
                    opacity={0.2}
                    toneMapped={false}
                />
            </mesh>

            {/* Core crystal (top) */}
            <mesh ref={coreRef} position={[0, 93, 0]}>
                <octahedronGeometry args={[8, 0]} />
                <meshStandardMaterial
                    color="#00FFFF"
                    emissive="#00FFFF"
                    emissiveIntensity={35}
                    toneMapped={false}
                />
            </mesh>

            {/* v3.2.0: TWO ROTATING RINGS around the core crystal (Rhombus) */}
            <group ref={crystalRing1Ref} position={[0, 93, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[14, 0.2, 16, 64]} />
                    <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={20} transparent opacity={0.6} toneMapped={false} />
                </mesh>
            </group>
            <group ref={crystalRing2Ref} position={[0, 93, 0]}>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                    <torusGeometry args={[16, 0.2, 16, 64]} />
                    <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={20} transparent opacity={0.6} toneMapped={false} />
                </mesh>
            </group>

            {/* v3.3.1: THREE STATIC BASE RINGS at the foot of the beacon flagpole (Y=-5) */}
            {/* Ring 1 — Cyan (Smallest) */}
            <group ref={ring1Ref} position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <mesh>
                    <torusGeometry args={[14, 0.4, 12, 64]} />
                    <meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={15} toneMapped={false} />
                </mesh>
            </group>

            {/* Ring 2 — Pure Green (Medium) — v3.3.1 Upgrade */}
            <group ref={ring2Ref} position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <mesh>
                    <torusGeometry args={[18, 0.5, 12, 64]} />
                    <meshStandardMaterial color="#00FF00" emissive="#00FF00" emissiveIntensity={12} toneMapped={false} />
                </mesh>
            </group>

            {/* Ring 3 — Pure Red (Largest) — v3.3.1: Match antenna ball exactly */}
            <group ref={ring3Ref} position={[0, -5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <mesh>
                    <torusGeometry args={[23, 0.6, 12, 64]} />
                    <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={10} toneMapped={false} />
                </mesh>
            </group>

            {/* Base ground disc */}
            <mesh position={[0, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[12, 32]} />
                <meshStandardMaterial
                    color="#00FFFF"
                    transparent
                    opacity={0.6}
                    emissive="#00FFFF"
                    emissiveIntensity={8}
                    side={THREE.DoubleSide}
                    toneMapped={false}
                />
            </mesh>

            {/* Point light */}
            <pointLight position={[0, 93, 0]} color="#00FFFF" intensity={300} distance={500} />
        </group>
    );
}
