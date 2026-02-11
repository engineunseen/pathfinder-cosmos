// components/Rocks.jsx — Scattered lunar rocks (visual only, no physics collision)
import React, { useMemo } from 'react';
import * as THREE from 'three';

// Seeded random for deterministic rock appearance
function seededRng(seed) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// Generate a more natural-looking rock by merging two offset shapes
function createRockGeometry(scale, type, seed) {
    const rng = seededRng(seed);

    let geo;
    if (type === 0) {
        // Chunky boulder — dodecahedron slightly squashed
        geo = new THREE.DodecahedronGeometry(scale, 1);
    } else if (type === 1) {
        // Jagged shard — icosahedron
        geo = new THREE.IcosahedronGeometry(scale * 0.9, 1);
    } else if (type === 2) {
        // Angular rock — octahedron stretched
        geo = new THREE.OctahedronGeometry(scale, 1);
    } else {
        // Flat slab — box with randomized proportions
        const w = scale * (0.6 + rng() * 0.8);
        const h = scale * (0.3 + rng() * 0.4);
        const d = scale * (0.6 + rng() * 0.8);
        geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
    }

    // Convert to non-indexed for clean flat shading
    geo = geo.toNonIndexed();

    // Subtle per-vertex displacement for natural irregularity
    const positions = geo.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        const dist = Math.sqrt(positions[i] ** 2 + positions[i + 1] ** 2 + positions[i + 2] ** 2);
        if (dist > 0.01) {
            const factor = 1 + (rng() - 0.5) * 0.15; // ±7.5% per vertex
            positions[i] *= factor;
            positions[i + 1] *= factor * (0.7 + rng() * 0.3); // squash vertically
            positions[i + 2] *= factor;
        }
    }

    geo.computeVertexNormals();
    return geo;
}

function Rock({ position, scale, rotationY, type, index }) {
    const geometry = useMemo(
        () => createRockGeometry(scale, type, index * 7919 + type * 131),
        [scale, type, index]
    );

    // Deterministic color from seed (no Math.random in render = no flickering)
    const color = useMemo(() => {
        const rng = seededRng(index * 3571 + 42);
        const brightness = 35 + rng() * 22;
        return `hsl(35, 4%, ${brightness}%)`;
    }, [index]);

    // Deterministic rotation
    const rotation = useMemo(() => {
        const rng = seededRng(index * 2741);
        return [rng() * 0.3, rotationY, rng() * 0.3];
    }, [index, rotationY]);

    return (
        <mesh
            geometry={geometry}
            position={[position[0], position[1] + scale * 0.2, position[2]]}
            rotation={rotation}
            castShadow
            receiveShadow
        >
            <meshStandardMaterial
                color={color}
                roughness={0.88}
                metalness={0.03}
                flatShading
            />
        </mesh>
    );
}

export default function Rocks({ rocks }) {
    return (
        <group>
            {rocks.map((rock, i) => (
                <Rock
                    key={i}
                    index={i}
                    position={[rock.x, rock.y, rock.z]}
                    scale={rock.scale}
                    rotationY={rock.rotationY}
                    type={rock.type}
                />
            ))}
        </group>
    );
}
