// components/MonteCarloViz.jsx — Professional Visualization of Tactical and Strategic paths
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS } from '../store';

const RISK_COLORS = {
    safe: new THREE.Color(COLORS.SAFE_PATH).multiplyScalar(1.5),
    warning: new THREE.Color(COLORS.WARNING_PATH).multiplyScalar(1.5),
    critical: new THREE.Color(COLORS.CRITICAL_PATH).multiplyScalar(1.5),
};

// Helper to get height for draping path over terrain
function getTerrainHeight(heightData, worldX, worldZ, size) {
    if (!heightData) return 0;
    const segments = Math.sqrt(heightData.length) - 1;
    const halfSize = size / 2;
    const normalizedX = (worldX + halfSize) / size;
    const normalizedZ = (worldZ + halfSize) / size;

    if (normalizedX < 0 || normalizedX > 1 || normalizedZ < 0 || normalizedZ > 1) return 0;

    const gridX = normalizedX * segments;
    const gridZ = normalizedZ * segments;
    const ix = Math.floor(gridX);
    const iz = Math.floor(gridZ);
    const fx = gridX - ix;
    const fz = gridZ - iz;

    const h00 = heightData[iz * (segments + 1) + ix] || 0;
    const h10 = heightData[iz * (segments + 1) + (ix + 1)] || 0;
    const h01 = heightData[(iz + 1) * (segments + 1) + ix] || 0;
    const h11 = heightData[(iz + 1) * (segments + 1) + (ix + 1)] || 0;

    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    return h0 * (1 - fz) + h1 * fz;
}

function TrajectoryLine({ path, risk }) {
    const points = useMemo(() => {
        if (!path || path.length < 2) return null;
        return path.map(p => [p[0], p[1] + 0.05, p[2]]); // Slight offset to prevent Z-fighting
    }, [path]);

    if (!points) return null;
    const color = RISK_COLORS[risk] || RISK_COLORS.safe;

    return (
        <Line
            points={points}
            color={color}
            lineWidth={0.15} // Width in meters (V3)
            worldUnits={true} // Perspective-correct scaling (V3)
            transparent
            opacity={risk === 'critical' ? 0.9 : 0.4}
        />
    );
}

// THE STRATEGIC "RED CARPET" ROAD
function StrategicRoad({ waypoints, terrainData }) {
    if (!waypoints || waypoints.length < 2 || !terrainData) return null;

    const roadWidth = 3.2;
    const segmentsPerLeg = 20;

    const { roadLines, arrowHead } = useMemo(() => {
        const leftPoints = [];
        const rightPoints = [];
        const totalWaypoints = waypoints.length;

        // Calculate arrow head geometry first so road can terminate at it
        const target = waypoints[totalWaypoints - 1];
        const prev = waypoints[totalWaypoints - 2];
        const dir = new THREE.Vector3(target[0] - prev[0], 0, target[1] - prev[1]).normalize();

        // Tip stops 5m before the actual target beacon
        const tip = new THREE.Vector3(target[0], 0, target[1]).sub(dir.clone().multiplyScalar(5));
        const yBase = getTerrainHeight(terrainData.heightData, tip.x, tip.z, terrainData.size) + 3.0;
        tip.y = yBase;

        // Create a wide arrow base 7m behind the tip
        const baseCenter = tip.clone().sub(dir.clone().multiplyScalar(7));
        const rightVec = new THREE.Vector3(-dir.z, 0, dir.x);
        const baseL = baseCenter.clone().add(rightVec.clone().multiplyScalar(4.5));
        const baseR = baseCenter.clone().add(rightVec.clone().multiplyScalar(-4.5));
        baseL.y = yBase; baseR.y = yBase;

        for (let i = 0; i < totalWaypoints - 1; i++) {
            const start = waypoints[i];
            const end = waypoints[i + 1];
            const isLastLeg = i === totalWaypoints - 2;

            for (let s = 0; s <= segmentsPerLeg; s++) {
                const t = s / segmentsPerLeg;

                const x = start[0] + (end[0] - start[0]) * t;
                const z = start[1] + (end[1] - start[1]) * t;

                // Termination logic: Stop road segments exactly at the arrow base wings
                if (isLastLeg) {
                    const distToTarget = Math.sqrt((x - target[0]) ** 2 + (z - target[1]) ** 2);
                    // Arrow base is approx 12m (5+7) from target. Stop segments within that range.
                    if (distToTarget < 12.5) break;
                }

                const y = getTerrainHeight(terrainData.heightData, x, z, terrainData.size) + 3.0;

                const nextX = start[0] + (end[0] - start[0]) * (t + 0.01);
                const nextZ = start[1] + (end[1] - start[1]) * (t + 0.01);
                const forward = new THREE.Vector2(nextX - x, nextZ - z).normalize();
                const right = new THREE.Vector2(-forward.y, forward.x);

                leftPoints.push(new THREE.Vector3(x + right.x * (roadWidth / 2), y, z + right.y * (roadWidth / 2)));
                rightPoints.push(new THREE.Vector3(x - right.x * (roadWidth / 2), y, z - right.y * (roadWidth / 2)));
            }
        }

        // Add the junction points to connect road edges to arrow "wings"
        leftPoints.push(baseL);
        rightPoints.push(baseR);

        return {
            roadLines: { leftPoints, rightPoints },
            arrowHead: { baseL, baseR, tip }
        };
    }, [waypoints, terrainData]);

    const magenta = "#FF00FF";
    const cyan = "#00FFFF";

    return (
        <group>
            {/* Road Lines connecting to arrow wings */}
            <Line points={roadLines.leftPoints} color={magenta} lineWidth={0.4} worldUnits={true} transparent opacity={0.6} toneMapped={false} />
            <Line points={roadLines.rightPoints} color={magenta} lineWidth={0.4} worldUnits={true} transparent opacity={0.6} toneMapped={false} />

            {/* Arrow Head Triangle: [baseL, tip, baseR] (no crossover) */}
            <Line
                points={[
                    [arrowHead.baseL.x, arrowHead.baseL.y, arrowHead.baseL.z],
                    [arrowHead.tip.x, arrowHead.tip.y, arrowHead.tip.z],
                    [arrowHead.baseR.x, arrowHead.baseR.y, arrowHead.baseR.z]
                ]}
                color={magenta}
                lineWidth={0.4}
                worldUnits={true}
                transparent opacity={0.9} toneMapped={false}
            />

            {/* Arrow Head Triangle Fill (Lilac) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
                <meshBasicMaterial color="#D8BFD8" transparent opacity={0.15} side={THREE.DoubleSide} />
                <shapeGeometry args={[
                    useMemo(() => {
                        const s = new THREE.Shape();
                        s.moveTo(arrowHead.baseL.x, -arrowHead.baseL.z);
                        s.lineTo(arrowHead.tip.x, -arrowHead.tip.z);
                        s.lineTo(arrowHead.baseR.x, -arrowHead.baseR.z);
                        s.closePath();
                        return s;
                    }, [arrowHead])
                ]} />
            </mesh>

            {/* Waypoint Nodes */}
            {waypoints.slice(0, -1).map((wp, i) => (
                <mesh key={`wp${i}`} position={[wp[0], getTerrainHeight(terrainData.heightData, wp[0], wp[1], terrainData.size) + 4.5, wp[1]]}>
                    <octahedronGeometry args={[1.5, 0]} />
                    <meshStandardMaterial color={cyan} emissive={cyan} emissiveIntensity={10} toneMapped={false} />
                    <pointLight color={cyan} intensity={2} distance={10} />
                </mesh>
            ))}

            <pointLight position={[arrowHead.tip.x, arrowHead.tip.y + 2, arrowHead.tip.z]} color={magenta} intensity={3} distance={12} />
        </group>
    );
}

export default function MonteCarloViz({ trajectories, dangerMap, active, waypoints, terrainData }) {
    const groupRef = useRef();

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.visible = active;
        }
    });

    if (!active) return null;

    return (
        <group ref={groupRef}>
            {/* Monte Carlo Visual Layer */}
            {trajectories && trajectories.map((traj, i) => (
                <TrajectoryLine key={i} path={traj.path} risk={traj.risk} />
            ))}

            {/* AI STRATEGIC PATH (The Red Carpet) */}
            <StrategicRoad waypoints={waypoints} terrainData={terrainData} />
        </group>
    );
}
