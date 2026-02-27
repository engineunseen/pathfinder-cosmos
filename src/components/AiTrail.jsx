import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function AiTrail({ roverRef, autopilotActive, overlayActive }) {
    const [points, setPoints] = useState([]);
    const lastPos = useRef([0, 0, 0]);

    // Removed auto-clear effect so trail persists after autopilot disengages

    useFrame(() => {
        if (!autopilotActive || !roverRef?.current?.getState) return;

        const { position: roverPosition } = roverRef.current.getState();
        if (!roverPosition) return;

        // Only add a point if we've moved significantly
        const dx = roverPosition[0] - lastPos.current[0];
        const dy = roverPosition[1] - lastPos.current[1];
        const dz = roverPosition[2] - lastPos.current[2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq > 0.1) { // ~31cm distance - slightly higher threshold for stability
            setPoints(prev => {
                const next = [...prev, new THREE.Vector3(...roverPosition)];
                if (next.length > 800) next.shift(); // V3.3.71: Further reduced for performance
                return next;
            });
            lastPos.current = [...roverPosition];
        }
    });

    const geometry = useMemo(() => {
        if (points.length < 2) return null;
        // V3.3.69: Strict NaN protection before sending to GPU
        const validPoints = points.filter(p => !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z));
        if (validPoints.length < 2) return null;
        return new THREE.BufferGeometry().setFromPoints(validPoints);
    }, [points]);

    useEffect(() => {
        return () => {
            if (geometry) geometry.dispose();
        };
    }, [geometry]);

    // V0.9.16: Show trail even if autopilot is OFF, as long as Overlay is ON.
    if (!overlayActive || points.length < 2) return null;

    return (
        <line geometry={geometry}>
            <lineBasicMaterial color="#00FFFF" linewidth={12} transparent={false} opacity={1.0} toneMapped={false} />
        </line>
    );
}
