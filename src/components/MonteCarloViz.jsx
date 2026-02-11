// components/MonteCarloViz.jsx — 3D visualization of Monte Carlo prediction paths
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS } from '../store';

const RISK_COLORS = {
    safe: new THREE.Color(COLORS.SAFE_PATH).multiplyScalar(15), // HDR Glow
    warning: new THREE.Color(COLORS.WARNING_PATH).multiplyScalar(12),
    critical: new THREE.Color(COLORS.CRITICAL_PATH).multiplyScalar(20),
};

function TrajectoryLine({ path, risk }) {
    const points = useMemo(() => {
        if (!path || path.length < 2) return null;
        return path.map(p => [p[0], p[1], p[2]]);
    }, [path]);

    if (!points) return null;

    const color = RISK_COLORS[risk] || RISK_COLORS.safe;

    return (
        <Line
            points={points}
            color={color}
            lineWidth={3} // In pixels (default)
            transparent
            opacity={risk === 'critical' ? 0.8 : 0.5}
            vertexColors={false} // Solid color for now, for better glow
        />
    );
}

function DangerHeatmapCell({ x, z, y, danger, size }) {
    if (danger < 0.1) return null;

    const color = useMemo(() => {
        if (danger > 0.7) return COLORS.CRITICAL_PATH;
        if (danger > 0.3) return COLORS.WARNING_PATH;
        return COLORS.SAFE_PATH;
    }, [danger]);

    return (
        <mesh position={[x, y + 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[size * 0.9, size * 0.9]} />
            <meshBasicMaterial
                color={color}
                transparent
                opacity={danger * 0.25}
                side={THREE.DoubleSide}
                depthWrite={false}
            />
        </mesh>
    );
}

export default function MonteCarloViz({ trajectories, dangerMap, active }) {
    const groupRef = useRef();

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.visible = active;
        }
    });

    if (!active || !trajectories) return null;

    return (
        <group ref={groupRef}>
            {/* Trajectory lines */}
            {trajectories.map((traj, i) => (
                <TrajectoryLine key={i} path={traj.path} risk={traj.risk} />
            ))}

            {/* Danger heatmap overlay */}
            {dangerMap && dangerMap.map((cell, i) => (
                <DangerHeatmapCell
                    key={`h${i}`}
                    x={cell.x}
                    z={cell.z}
                    y={cell.y}
                    danger={cell.danger}
                    size={cell.size}
                />
            ))}
        </group>
    );
}
