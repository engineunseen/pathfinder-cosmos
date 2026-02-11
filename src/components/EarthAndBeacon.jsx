// components/EarthAndBeacon.jsx — Earth on the horizon + beacon target
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Earth() {
    const earthRef = useRef();
    const glowRef = useRef();

    useFrame((state) => {
        if (earthRef.current) {
            earthRef.current.rotation.y += 0.0003;
        }
    });

    // Earth texture via procedural sphere with vertex colors
    const geometry = useMemo(() => {
        const geo = new THREE.SphereGeometry(30, 64, 48);
        const positions = geo.attributes.position.array;
        const colors = new Float32Array(positions.length);
        const normals = geo.attributes.normal.array;

        for (let i = 0; i < positions.length / 3; i++) {
            const nx = normals[i * 3];
            const ny = normals[i * 3 + 1];
            const nz = normals[i * 3 + 2];

            // Simple procedural earth-like coloring
            const lat = Math.asin(ny);
            const lon = Math.atan2(nx, nz);

            // Oceans
            let r = 0.05, g = 0.15, b = 0.55;

            // Land masses (rough continents approximation)
            const landNoise = Math.sin(lon * 3) * Math.cos(lat * 2) +
                Math.sin(lon * 5 + 1) * Math.cos(lat * 3 + 2) * 0.5 +
                Math.sin(lon * 7 + 3) * Math.cos(lat * 5 + 1) * 0.3;

            if (landNoise > 0.3 && Math.abs(lat) < 1.2) {
                r = 0.15 + Math.random() * 0.05;
                g = 0.35 + Math.random() * 0.1;
                b = 0.12;
            }

            // Ice caps
            if (Math.abs(lat) > 1.1) {
                r = 0.85; g = 0.88; b = 0.92;
            }

            // Clouds (random patches)
            const cloudNoise = Math.sin(lon * 10 + 5) * Math.cos(lat * 8 + 3) * 0.5 +
                Math.sin(lon * 15) * Math.cos(lat * 12) * 0.3;
            if (cloudNoise > 0.3) {
                r = Math.min(1, r + 0.3);
                g = Math.min(1, g + 0.3);
                b = Math.min(1, b + 0.3);
            }

            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }

        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        return geo;
    }, []);

    return (
        <group position={[200, 30, -400]}>
            {/* Earth sphere */}
            <mesh ref={earthRef} geometry={geometry}>
                <meshStandardMaterial
                    vertexColors
                    roughness={0.6}
                    metalness={0.1}
                />
            </mesh>

            {/* Atmospheric glow */}
            <mesh ref={glowRef} scale={[1.05, 1.05, 1.05]}>
                <sphereGeometry args={[30, 32, 24]} />
                <meshBasicMaterial
                    color="#4488ff"
                    transparent
                    opacity={0.15}
                    side={THREE.BackSide}
                />
            </mesh>
        </group>
    );
}

function Beacon({ position }) {
    const beaconRef = useRef();
    const ringRef = useRef();
    const ring2Ref = useRef();

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (beaconRef.current) {
            beaconRef.current.position.y = position[1] + Math.sin(t * 2) * 0.5 + 1;
        }
        if (ringRef.current) {
            ringRef.current.rotation.x = Math.sin(t) * 0.3;
            ringRef.current.rotation.z = Math.cos(t * 1.3) * 0.3;
            ringRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.1);
        }
        if (ring2Ref.current) {
            ring2Ref.current.rotation.y = t * 1.5;
            ring2Ref.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.7) * 0.2;
        }
    });

    return (
        <group position={position}>
            {/* Beacon light column */}
            <mesh position={[0, 5, 0]}>
                <cylinderGeometry args={[0.02, 0.3, 10, 8]} />
                <meshBasicMaterial color="#00FFFF" transparent opacity={0.3} />
            </mesh>

            {/* Beacon core */}
            <mesh ref={beaconRef} position={[0, position[1] + 1, 0]}>
                <octahedronGeometry args={[0.6, 0]} />
                <meshBasicMaterial color="#00FFFF" />
            </mesh>

            {/* Orbiting ring */}
            <mesh ref={ringRef} position={[0, position[1] + 1, 0]}>
                <torusGeometry args={[1.2, 0.03, 8, 32]} />
                <meshBasicMaterial color="#00FF41" transparent opacity={0.6} />
            </mesh>

            {/* Second ring */}
            <mesh ref={ring2Ref} position={[0, position[1] + 1, 0]}>
                <torusGeometry args={[1.6, 0.02, 8, 32]} />
                <meshBasicMaterial color="#00FFFF" transparent opacity={0.4} />
            </mesh>

            {/* Ground circle indicator */}
            <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2, 2.5, 32]} />
                <meshBasicMaterial color="#00FF41" transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>

            {/* Point light */}
            <pointLight position={[0, 3, 0]} color="#00FFFF" intensity={5} distance={30} />
        </group>
    );
}

export { Earth, Beacon };
