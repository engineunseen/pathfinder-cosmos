// components/LunarTerrain.jsx — 3D Lunar terrain with physics heightfield
import React, { useMemo, useRef } from 'react';
import { useHeightfield } from '@react-three/cannon';
import * as THREE from 'three';

export default function LunarTerrain({ terrainData }) {
    const { heightData, matrix, size, segments, elementSize } = terrainData;

    // Physics heightfield
    const [heightfieldRef] = useHeightfield(() => ({
        args: [
            matrix,
            {
                minValue: -15,
                maxValue: 25,
                elementSize: elementSize,
            },
        ],
        position: [-size / 2, 0, size / 2],
        rotation: [-Math.PI / 2, 0, -Math.PI / 2],
        type: 'Static',
        material: { friction: 0.6, restitution: 0.1 },
    }));

    // Visual mesh
    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(size, size, segments, segments);
        geo.rotateX(-Math.PI / 2);
        const positions = geo.attributes.position.array;

        for (let iz = 0; iz <= segments; iz++) {
            for (let ix = 0; ix <= segments; ix++) {
                const vertexIndex = iz * (segments + 1) + ix;
                const heightIndex = iz * (segments + 1) + ix;
                positions[vertexIndex * 3 + 1] = heightData[heightIndex];
            }
        }

        geo.computeVertexNormals();

        // Vertex colors for lunar regolith appearance
        const colors = new Float32Array(positions.length);
        const normals = geo.attributes.normal.array;

        for (let i = 0; i < positions.length / 3; i++) {
            const y = positions[i * 3 + 1];
            const ny = normals[i * 3 + 1]; // upward normal component

            // Enhanced contrast: flat areas bright, slopes dark
            let brightness = 0.2 + ny * 0.5;

            // Height-based variation
            brightness += y * 0.012;

            // Slope-based darkening for visible relief
            const slopeDarkening = (1 - ny) * 0.25;
            brightness -= slopeDarkening;

            // Clamp
            brightness = Math.max(0.08, Math.min(0.75, brightness));

            // Warm/cool variation for texture
            const r = brightness * (0.95 + Math.random() * 0.05);
            const g = brightness * (0.93 + Math.random() * 0.04);
            const b = brightness * (0.90 + Math.random() * 0.03);

            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        }

        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        return geo;
    }, [heightData, size, segments]);

    return (
        <group>
            {/* Physics body — invisible */}
            <mesh ref={heightfieldRef} visible={false} />

            {/* Visual mesh — top surface */}
            <mesh geometry={geometry} receiveShadow castShadow>
                <meshStandardMaterial
                    vertexColors
                    roughness={0.95}
                    metalness={0.0}
                    flatShading={false}
                />
            </mesh>

            {/* Liner mesh — dark basalt underside, visible only from below */}
            <mesh geometry={geometry}>
                <meshBasicMaterial
                    color="#1a1a1a"
                    side={THREE.BackSide}
                />
            </mesh>
        </group>
    );
}
