import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function AiTrail({ roverPosition, autopilotActive, overlayActive }) {
    const [points, setPoints] = useState([]);
    const lastPos = useRef([0, 0, 0]);

    // Removed auto-clear effect so trail persists after autopilot disengages

    useFrame(() => {
        if (!autopilotActive || !roverPosition) return;

        // Only add a point if we've moved significantly
        const dx = roverPosition[0] - lastPos.current[0];
        const dy = roverPosition[1] - lastPos.current[1];
        const dz = roverPosition[2] - lastPos.current[2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq > 0.05) { // ~22cm distance
            setPoints(prev => {
                const next = [...prev, new THREE.Vector3(...roverPosition)];
                if (next.length > 5000) next.shift(); // V0.9.16: Increased to 5000 to prevent "dissolving" tail
                return next;
            });
            lastPos.current = [...roverPosition];
        }
    });

    const geometry = useMemo(() => {
        if (points.length < 2) return null;
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [points]);

    // V0.9.16: Show trail even if autopilot is OFF, as long as Overlay is ON.
    if (!overlayActive || points.length < 2) return null;

    return (
        <line geometry={geometry}>
            <lineBasicMaterial color="#00FFFF" linewidth={12} transparent={false} opacity={1.0} toneMapped={false} />
        </line>
    );
}
