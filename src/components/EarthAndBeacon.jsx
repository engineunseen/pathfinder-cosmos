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

    const geometry = useMemo(() => {
        const geo = new THREE.SphereGeometry(30, 64, 64);
        const positions = geo.attributes.position.array;
        const colors = new Float32Array(positions.length);
        const normals = geo.attributes.normal.array;

        for (let i = 0; i < positions.length / 3; i++) {
            const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
            const lat = Math.asin(ny), lon = Math.atan2(nx, nz);
            let r = 0.05, g = 0.15, b = 0.55;
            const ln = Math.sin(lon * 3) * Math.cos(lat * 2) + Math.sin(lon * 5 + 1) * Math.cos(lat * 3 + 2) * 0.5;
            if (ln > 0.3) { r = 0.15 + Math.random() * 0.05; g = 0.35 + Math.random() * 0.1; b = 0.12; }
            if (Math.abs(lat) > 0.95) {
                const iceF = Math.min(1.0, (Math.abs(lat) - 0.95) / 0.4);
                const iceB = iceF * iceF * (3 - 2 * iceF);
                r += (0.9 - r) * iceB; g += (0.92 - g) * iceB; b += (0.95 - b) * iceB;
            }
            colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        return geo;
    }, []);

    return (
        <group position={[100, 20, -250]}>
            <mesh ref={earthRef} geometry={geometry}><meshStandardMaterial vertexColors roughness={0.6} metalness={0.1} /></mesh>
            <mesh ref={glowRef} scale={[1.05, 1.05, 1.05]}><sphereGeometry args={[30, 32, 24]} /><meshBasicMaterial color="#4488ff" transparent opacity={0.15} side={THREE.BackSide} /></mesh>
        </group>
    );
}

function Beacon({ position }) {
    const beaconRef = useRef();
    const ringRef = useRef();
    const ring2Ref = useRef();

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (beaconRef.current) beaconRef.current.position.y = position[1] + 15 + Math.sin(t * 2) * 0.5;
        if (ringRef.current) {
            ringRef.current.rotation.x = Math.sin(t) * 0.3; ringRef.current.rotation.z = Math.cos(t * 1.3) * 0.3;
            ringRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.1);
        }
        if (ring2Ref.current) {
            ring2Ref.current.rotation.y = t * 1.5; ring2Ref.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.7) * 0.2;
        }
    });

    return (
        <group position={position}>
            <mesh position={[0, 15, 0]}><cylinderGeometry args={[0.05, 0.4, 30, 8]} /><meshStandardMaterial color="#00FFFF" transparent opacity={0.5} emissive="#00FFFF" emissiveIntensity={5} toneMapped={false} /></mesh>
            <mesh ref={beaconRef} position={[0, 15, 0]}><octahedronGeometry args={[1.5, 0]} /><meshStandardMaterial color="#00FFFF" emissive="#00FFFF" emissiveIntensity={10} toneMapped={false} /></mesh>
            <mesh ref={ringRef} position={[0, 15, 0]}><torusGeometry args={[1.5, 0.05, 8, 32]} /><meshStandardMaterial color="#00FF41" transparent opacity={0.8} emissive="#00FF41" emissiveIntensity={5} toneMapped={false} /></mesh>
            <mesh ref={ring2Ref} position={[0, 15, 0]}><torusGeometry args={[2.0, 0.03, 8, 32]} /><meshStandardMaterial color="#00FFFF" transparent opacity={0.7} emissive="#00FFFF" emissiveIntensity={5} toneMapped={false} /></mesh>

            {/* Inner Ground circle (Green) */}
            <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.5, 3.0, 32]} />
                <meshStandardMaterial color="#00FF41" transparent opacity={0.6} emissive="#00FF41" emissiveIntensity={2} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>

            {/* Middle Ground circle (Yellow-Orange) */}
            <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[3.4, 4.0, 48]} />
                <meshStandardMaterial color="#FFBF00" transparent opacity={0.7} emissive="#FFBF00" emissiveIntensity={3} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>

            {/* Outermost Ground circle (Deep Orange) */}
            <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[4.4, 5.2, 64]} />
                <meshStandardMaterial color="#FF4500" transparent opacity={0.5} emissive="#FF4500" emissiveIntensity={4} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>

            <pointLight position={[0, 5, 0]} color="#00FFFF" intensity={15} distance={50} />
        </group>
    );
}

export { Earth, Beacon };
