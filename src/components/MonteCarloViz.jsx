// components/MonteCarloViz.jsx — Professional Visualization of Tactical and Strategic paths
import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS } from '../store';

const RISK_COLORS = {
    safe: new THREE.Color(COLORS.SAFE_PATH).multiplyScalar(1.5),
    warning: new THREE.Color(COLORS.WARNING_PATH).multiplyScalar(1.5),
    critical: new THREE.Color(COLORS.CRITICAL_PATH).multiplyScalar(1.5),
};

function getTerrainHeight(heightData, worldX, worldZ, size) {
    if (!heightData) return 0;
    const segments = Math.sqrt(heightData.length) - 1;
    const halfSize = size / 2;
    const nx = (worldX + halfSize) / size;
    const nz = (worldZ + halfSize) / size;
    if (nx < 0 || nx > 1 || nz < 0 || nz > 1) return 0;
    const gx = nx * segments, gz = nz * segments;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = gx - ix, fz = gz - iz;
    const h00 = heightData[iz * (segments + 1) + ix] || 0;
    const h10 = heightData[iz * (segments + 1) + (ix + 1)] || 0;
    const h01 = heightData[(iz + 1) * (segments + 1) + ix] || 0;
    const h11 = heightData[(iz + 1) * (segments + 1) + (ix + 1)] || 0;
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
}

function TrajectoryLine({ path, risk }) {
    const points = useMemo(() => path?.map(p => [p[0], p[1] + 0.05, p[2]]), [path]);
    if (!points || points.length < 2) return null;
    return <Line points={points} color={RISK_COLORS[risk] || RISK_COLORS.safe} lineWidth={0.15} worldUnits={true} transparent opacity={risk === 'critical' ? 0.9 : 0.4} />;
}

function StrategicRoad({ waypoints, terrainData }) {
    if (!waypoints || waypoints.length < 2 || !terrainData) return null;

    const roadWidth = 6.4;
    const segs = 15;
    const magenta = "#FF00FF";
    const cyan = "#00FFFF";

    const { ribbonGeom, perimeter, tipPos } = useMemo(() => {
        const vertices = [];
        const indices = [];
        const leftArr = [];
        const rightArr = [];

        const targetPoint = waypoints[waypoints.length - 1];
        const prevPoint = waypoints[waypoints.length - 2];
        const rawDir = new THREE.Vector3(targetPoint[0] - prevPoint[0], 0, targetPoint[1] - prevPoint[1]);
        const dir = (rawDir.lengthSq() < 0.001) ? new THREE.Vector3(0, 0, 1) : rawDir.normalize();

        // V8: SURGICAL ACUTE ARROW GEOMETRY
        const arrowLength = 22;     // Longer for drama
        const arrowWidth = 14.0;    // Wider base
        const indentLength = 7.0;   // Deeper sharper indent

        const tip = new THREE.Vector3(targetPoint[0], 0, targetPoint[1]);
        const yBase = getTerrainHeight(terrainData.heightData, tip.x, tip.z, terrainData.size) + 3.0;
        tip.y = yBase;

        const baseC = tip.clone().sub(dir.clone().multiplyScalar(arrowLength));
        const rightV = new THREE.Vector3(-dir.z, 0, dir.x);

        const baseL = baseC.clone().add(rightV.clone().multiplyScalar(arrowWidth / 2));
        const baseR = baseC.clone().add(rightV.clone().multiplyScalar(-arrowWidth / 2));
        const indentC = baseC.clone().add(dir.clone().multiplyScalar(indentLength));

        baseL.y = yBase; baseR.y = yBase; indentC.y = yBase;

        let vIdx = 0;

        // 1. Build Road Ribbon
        for (let i = 0; i < waypoints.length - 1; i++) {
            const start = waypoints[i];
            const end = waypoints[i + 1];
            const isLast = (i === waypoints.length - 2);

            for (let s = 0; s <= segs; s++) {
                const t = s / segs;
                const x = start[0] + (end[0] - start[0]) * t;
                const z = start[1] + (end[1] - start[1]) * t;

                const dToTip = Math.sqrt((x - tip.x) ** 2 + (z - tip.z) ** 2);
                if (isLast && dToTip < arrowLength - indentLength + 0.5) break;

                const y = getTerrainHeight(terrainData.heightData, x, z, terrainData.size) + 3.05;

                const nextT = Math.min(1, t + 0.05);
                const nX = start[0] + (end[0] - start[0]) * nextT;
                const nZ = start[1] + (end[1] - start[1]) * nextT;
                const fwd = new THREE.Vector2(nX - x, nZ - z).normalize();
                const rgt = (fwd.lengthSq() < 0.1) ? new THREE.Vector2(-dir.z, dir.x) : new THREE.Vector2(-fwd.y, fwd.x);

                const pL = new THREE.Vector3(x + rgt.x * (roadWidth / 2), y, z + rgt.y * (roadWidth / 2));
                const pR = new THREE.Vector3(x - rgt.x * (roadWidth / 2), y, z - rgt.y * (roadWidth / 2));

                leftArr.push(pL);
                rightArr.push(pR);
                vertices.push(pL.x, pL.y, pL.z, pR.x, pR.y, pR.z);

                if (vIdx > 0) {
                    const a = (vIdx - 1) * 2, b = a + 1, c = vIdx * 2, d = c + 1;
                    indices.push(a, b, c, b, d, c);
                }
                vIdx++;
            }
        }

        // 2. Head Geometry (ACUTE ANGLES)
        const roadEndIdxL = (vIdx - 1) * 2;
        const roadEndIdxR = (vIdx - 1) * 2 + 1;
        const headIdx = vertices.length / 3;

        vertices.push(baseL.x, baseL.y, baseL.z, baseR.x, baseR.y, baseR.z, tip.x, tip.y, tip.z, indentC.x, indentC.y, indentC.z);

        const bL = headIdx, bR = headIdx + 1, tP = headIdx + 2, iC = headIdx + 3;

        if (vIdx > 0) {
            indices.push(roadEndIdxL, roadEndIdxR, iC);
            indices.push(roadEndIdxL, iC, bL);
            indices.push(roadEndIdxR, bR, iC);
        }

        indices.push(bL, tP, iC);
        indices.push(bR, iC, tP);

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();

        return {
            ribbonGeom: geom,
            perimeter: [...leftArr, baseL, tip, baseR, ...rightArr.reverse()].filter(p => p && !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z)),
            tipPos: tip
        };
    }, [waypoints, terrainData]);

    return (
        <group>
            <mesh geometry={ribbonGeom}>
                <meshBasicMaterial color={magenta} transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>
            <Line points={perimeter} color={magenta} lineWidth={0.33} worldUnits={true} transparent opacity={0.9} toneMapped={false} />
            {waypoints.slice(0, -1).map((wp, i) => (
                <mesh key={i} position={[wp[0], getTerrainHeight(terrainData.heightData, wp[0], wp[1], terrainData.size) + 4.5, wp[1]]}>
                    <octahedronGeometry args={[1.5, 0]} />
                    <meshStandardMaterial color={cyan} emissive={cyan} emissiveIntensity={10} toneMapped={false} />
                </mesh>
            ))}
            <pointLight position={[tipPos.x, tipPos.y + 2, tipPos.z]} color={magenta} intensity={3} distance={12} />
        </group>
    );
}

export default function MonteCarloViz({ trajectories, active, waypoints, terrainData }) {
    if (!active) return null;
    return (
        <group>
            {trajectories?.map((t, i) => <TrajectoryLine key={i} path={t.path} risk={t.risk} />)}
            <StrategicRoad waypoints={waypoints} terrainData={terrainData} />
        </group>
    );
}
