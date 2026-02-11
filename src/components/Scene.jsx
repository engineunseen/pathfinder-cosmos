// components/Scene.jsx — Main 3D scene with camera controller
import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function CameraController({ targetPosition, enabled = true }) {
    const { camera } = useThree();
    const offset = useRef(new THREE.Vector3(0, 8, 12));
    const lookTarget = useRef(new THREE.Vector3());
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });
    const spherical = useRef(new THREE.Spherical(15, Math.PI / 4, 0));

    useEffect(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        const onMouseDown = (e) => {
            isDragging.current = true;
            lastMouse.current = { x: e.clientX, y: e.clientY };
        };

        const onMouseMove = (e) => {
            if (!isDragging.current) return;
            const dx = e.clientX - lastMouse.current.x;
            const dy = e.clientY - lastMouse.current.y;
            lastMouse.current = { x: e.clientX, y: e.clientY };

            spherical.current.theta -= dx * 0.005;
            spherical.current.phi = Math.max(0.2, Math.min(Math.PI / 2.2,
                spherical.current.phi + dy * 0.005
            ));
        };

        const onMouseUp = () => { isDragging.current = false; };

        const onWheel = (e) => {
            spherical.current.radius = Math.max(5, Math.min(40,
                spherical.current.radius + e.deltaY * 0.02
            ));
        };

        // Touch events for mobile camera
        let touchStart = null;
        const onTouchStart = (e) => {
            if (e.touches.length === 1) {
                // Check if touch is on the right half of the screen
                if (e.touches[0].clientX > window.innerWidth * 0.5) {
                    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
            }
        };
        const onTouchMove = (e) => {
            if (!touchStart || e.touches.length !== 1) return;
            if (e.touches[0].clientX < window.innerWidth * 0.5) return;
            const dx = e.touches[0].clientX - touchStart.x;
            const dy = e.touches[0].clientY - touchStart.y;
            touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            spherical.current.theta -= dx * 0.005;
            spherical.current.phi = Math.max(0.2, Math.min(Math.PI / 2.2,
                spherical.current.phi + dy * 0.005
            ));
        };
        const onTouchEnd = () => { touchStart = null; };

        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('wheel', onWheel, { passive: true });
        canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        canvas.addEventListener('touchmove', onTouchMove, { passive: true });
        canvas.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            canvas.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
        };
    }, []);

    useFrame(() => {
        if (!enabled || !targetPosition) return;

        const target = new THREE.Vector3(
            targetPosition[0],
            targetPosition[1],
            targetPosition[2]
        );

        // Calculate camera position from spherical coordinates
        const camOffset = new THREE.Vector3();
        camOffset.setFromSpherical(spherical.current);

        const desiredPos = target.clone().add(camOffset);

        // Smooth follow
        camera.position.lerp(desiredPos, 0.08);

        // Look at target
        lookTarget.current.lerp(target, 0.1);
        camera.lookAt(lookTarget.current);
    });

    return null;
}

export function LunarLighting() {
    return (
        <>
            {/* Harsh directional sunlight (vacuum lighting — no scatter) */}
            <directionalLight
                position={[100, 80, -50]}
                intensity={3}
                color="#ffffff"
                castShadow
                shadow-mapSize-width={4096}
                shadow-mapSize-height={4096}
                shadow-camera-far={300}
                shadow-camera-left={-80}
                shadow-camera-right={80}
                shadow-camera-top={80}
                shadow-camera-bottom={-80}
                shadow-bias={-0.001}
            />

            {/* Very dim ambient (space has no atmospheric scatter) */}
            <ambientLight intensity={0.15} color="#445566" />

            {/* Subtle fill from Earth direction */}
            <directionalLight
                position={[200, 30, -400]}
                intensity={0.15}
                color="#4488cc"
            />
        </>
    );
}

export function Stars({ count = 2500 }) {
    const positions = useMemo(() => {
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = 700 + Math.random() * 300;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = Math.abs(r * Math.cos(phi));
            pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        }
        return pos;
    }, [count]);

    return (
        <points>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={count}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial size={1.5} color="#ffffff" sizeAttenuation={false} />
        </points>
    );
}
