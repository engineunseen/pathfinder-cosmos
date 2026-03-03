// components/HUD.jsx — Sci-Fi HUD overlay (Cosmos Cookoff Edition)
// Stripped: Vision by UNSEEN ENGINE, sCVaR/SMaR, overlay button, Gemini options
import React, { useState, useCallback, useRef, memo, useEffect } from 'react';
import { STRINGS } from '../i18n';
import { COLORS as C, WARNING_ANGLE, VERSION, DUST_DENSITIES, DRIVE_MODES, useSimulationState, useSimulationDispatch } from '../store';
import TerminalPanel from './TerminalPanel';

// Corner bracket decorator component
function CornerBrackets({ children, className = '', onClick, style }) {
    return (
        <div className={`hud-panel ${className}`} onClick={onClick} style={style}>
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            {children}
        </div>
    );
}

function BatteryBar({ value }) {
    const color = value > 60 ? C.SAFE_PATH : value > 30 ? C.WARNING_PATH : C.CRITICAL_PATH;
    return (
        <div className="battery-bar">
            <div className="battery-fill" style={{ width: `${value}%`, background: color }} />
        </div>
    );
}

// Telemetry panel (Top Left) — Cosmos Cookoff: No sCVaR
function TelemetryPanel({ telemetry, lang, style, onToggleHelp }) {
    const t = STRINGS[lang];
    const pitchVal = parseFloat(telemetry.pitch) || 0;
    const rollVal = parseFloat(telemetry.roll) || 0;
    const pitchColor = Math.abs(pitchVal) > WARNING_ANGLE ? C.CRITICAL_PATH : C.PRIMARY_INFO;
    const rollColor = Math.abs(rollVal) > WARNING_ANGLE ? C.CRITICAL_PATH : C.PRIMARY_INFO;

    return (
        <CornerBrackets className="panel-telemetry" style={style}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(0, 255, 255, 0.3)', paddingBottom: '5px', minHeight: '28px' }}>
                <button
                    onClick={onToggleHelp}
                    className="help-icon-btn"
                    title={t.help}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="i-svg-icon">
                        <circle cx="12" cy="12" r="10" opacity="0.4" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                </button>
                <h2 className="panel-title" style={{ margin: 0, border: 'none', padding: 0 }}>{t.telemetry}</h2>
            </div>
            <div className="telemetry-row">
                <span className="label">{t.speed}:</span>
                <span className="value" style={{ color: C.PRIMARY_INFO }}>
                    {telemetry.speed || '0.0'} {t.kmh}
                </span>
            </div>
            <div className="telemetry-row">
                <span className="label">{t.pitch}:</span>
                <span className="value" style={{ color: pitchColor }}>
                    {pitchVal.toFixed(1)}°
                </span>
            </div>
            <div className="telemetry-row">
                <span className="label">{t.roll}:</span>
                <span className="value" style={{ color: rollColor }}>
                    {rollVal.toFixed(1)}°
                </span>
            </div>
            <div className="telemetry-row">
                <span className="label">{t.battery}:</span>
                <BatteryBar value={telemetry.battery || 100} />
            </div>
        </CornerBrackets>
    );
}

// Mission Panel (Top Right) — Cosmos Cookoff: No SMaR
function MissionPanel({ targetDistance, lang, elapsedTime, onNewTerrain, onOpenSettings, style }) {
    const t = STRINGS[lang];

    return (
        <CornerBrackets className="panel-mission" style={style}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(0, 255, 255, 0.3)', paddingBottom: '5px', minHeight: '28px' }}>
                <h2 className="panel-title" style={{ margin: 0, border: 'none', padding: 0 }}>{t.missionControl}</h2>
                <button
                    onClick={onOpenSettings}
                    style={{
                        background: 'none', border: 'none', color: 'rgba(0, 255, 255, 0.7)', fontSize: '20px', cursor: 'pointer', padding: '0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto'
                    }}
                >
                    ⚙
                </button>
            </div>
            <div className="telemetry-row">
                <span className="label">{t.target}:</span>
                <span className="value" style={{ color: '#00FF41' }}>{Math.round(targetDistance || 0)}{t.meters}</span>
            </div>
            <div className="telemetry-row">
                <span className="label">{t.time}:</span>
                <span className="value">{Math.floor(elapsedTime || 0)}s</span>
            </div>
            <button
                className="hud-button"
                style={{ width: '100%', marginTop: '15px' }}
                onClick={onNewTerrain}
            >
                <span className="btn-bracket">[</span>
                {t.generateNewLandscape}
                <span className="btn-bracket">]</span>
            </button>
        </CornerBrackets>
    );
}

// Bottom Control Panel — Cosmos Cookoff: No overlay button, Cosmos engine only
function ControlPanel({ driveMode, lang, onSetDriveMode, simulationState, isAiOnline, isAiPlanning }) {
    const state = useSimulationState();
    const terminalOpen = state.ui.terminalOpen;
    const t = STRINGS[lang];

    // Cosmos only — show engine name
    const getActiveEngineName = () => {
        if (!isAiOnline) return 'OFFLINE';
        return 'NVIDIA COSMOS REASON 2';
    };

    return (
        <CornerBrackets className="panel-controls" style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: `translateX(${terminalOpen ? 'calc(-50% - 160px)' : '-50%'})`,
            width: '600px',
            maxWidth: '90vw',
            textAlign: 'center',
            padding: '10px 24px',
            zIndex: 90,
            transition: 'transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
            pointerEvents: 'auto'
        }}>

            <div className="ai-status" style={{ marginBottom: '12px', minHeight: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '2px', marginBottom: '2px' }}>ACTIVE ENGINE:</div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: isAiOnline ? '#76b900' : '#FFBF00', letterSpacing: '1px' }}>
                    {getActiveEngineName()}
                </div>
                {isAiPlanning ? (
                    <span className="ai-active-text pulse" style={{ color: '#76b900', fontSize: '11px', marginTop: '4px' }}>{t.planning}</span>
                ) : driveMode === 'autopilot' ? (
                    isAiOnline ? (
                        <span className="ai-active-text pulse" style={{ color: '#76b900', fontSize: '11px', marginTop: '4px' }}>{t.recalculating}</span>
                    ) : (
                        <span className="ai-active-text" style={{ color: '#FFBF00', fontSize: '11px', marginTop: '4px' }}>CONFIGURE NIM ENDPOINT IN SETTINGS</span>
                    )
                ) : driveMode === 'manual' ? (
                    <span className="ai-prompt" style={{ fontSize: '11px', marginTop: '4px' }}>{t.navigatePrompt}</span>
                ) : null}
            </div>

            <div className="mode-selector" style={{ display: 'flex', gap: '10px' }}>
                <button
                    className={`mode-btn ${driveMode === 'autopilot' ? 'active-autopilot pulse' : ''}`}
                    onClick={() => onSetDriveMode(driveMode === 'autopilot' ? 'manual' : 'autopilot')}
                    style={{ flex: 1 }}
                    disabled={simulationState !== 'running'}
                >
                    <div className="inner-frame" />
                    <span style={{ fontSize: '10px', opacity: 0.7, display: 'block' }}>{t.driveMode}</span>
                    {driveMode === 'autopilot' ? t.autopilot : t.manual}
                </button>
            </div>

            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(0, 255, 255, 0.15)', paddingTop: '8px' }}>
                <ControlsHint lang={lang} />
            </div>
        </CornerBrackets>
    );
}

// Outcome Overlay
function OutcomeOverlay({ reason, lang, onRestart, onNewTerrain, safetyScore, elapsedTime }) {
    const t = STRINGS[lang];
    const isSuccess = reason === 'success';

    return (
        <div className="outcome-overlay" style={{ pointerEvents: 'auto', zIndex: 999999 }}>
            <CornerBrackets className="outcome-panel">
                <h1 className={`outcome-title ${isSuccess ? 'success' : 'fail'}`}>
                    {isSuccess ? 'MISSION SUCCESS' : 'MISSION TERMINATED'}
                </h1>
                <div className="outcome-details">
                    <div className="detail-row"><span>{t.time}:</span> <span>{Math.floor(elapsedTime || 0)}s</span></div>
                    <div className="detail-row"><span>{t.safetyScore}:</span> <span>{safetyScore}/100</span></div>
                    {!isSuccess && <div className="detail-row" style={{ color: '#FF0055' }}><span>STATUS:</span> <span>STABILITY BREACH — ROVER LOST</span></div>}
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button className="hud-button" style={{ flex: 1 }} onClick={onRestart}>{t.restartMission || 'RESTART MISSION'}</button>
                </div>
            </CornerBrackets>
        </div>
    );
}

// V0.8.34: Lidar Visualization Panel
function LidarPanel({ data, lang }) {
    const t = STRINGS[lang];
    const lines = data.split('\n').filter(l => l.includes('°'));
    const sectors = lines.map(line => {
        const angleMatch = line.match(/(\d+)°/);
        const m5Match = line.match(/5m:\[([^\]]+)\]/);
        const m10Match = line.match(/10m:\[([^\]]+)\]/);
        if (!angleMatch || !m5Match || !m10Match) return null;
        return { angle: angleMatch[1], m5: m5Match[1], m10: m10Match[1] };
    }).filter(s => s !== null);

    return (
        <div className="lidar-panel">
            <CornerBrackets className="lidar-inner">
                <div className="panel-title" style={{ fontSize: '8px', marginBottom: '15px' }}>{t.lidarScan}</div>
                <div className="radar-container">
                    <div className="radar-grid">
                        <div className="radar-circle c10" />
                        <div className="radar-circle c5" />
                        <div className="radar-axis axis-h" />
                        <div className="radar-axis axis-v" />
                        <div className="radar-sweep" />
                    </div>
                    {sectors.map((s, i) => {
                        const deg = parseInt(s.angle);
                        const rad = (deg - 90) * (Math.PI / 180);
                        const x = Math.cos(rad);
                        const y = Math.sin(rad);

                        const getIntensity = (val) => {
                            if (val === 'VOID') return '#333';
                            const v = parseFloat(val);
                            if (Math.abs(v) > 2) return '#FF0055';
                            if (Math.abs(v) > 0.8) return '#FFBF00';
                            return '#00FF41';
                        };

                        return (
                            <React.Fragment key={s.angle}>
                                <div className="radar-point p5" style={{
                                    left: `calc(50% + ${x * 25}%)`,
                                    top: `calc(50% + ${y * 25}%)`,
                                    background: getIntensity(s.m5)
                                }}>
                                    <span className="tooltip">{s.m5}</span>
                                </div>
                                <div className="radar-point p10" style={{
                                    left: `calc(50% + ${x * 45}%)`,
                                    top: `calc(50% + ${y * 45}%)`,
                                    background: getIntensity(s.m10)
                                }}>
                                    <span className="tooltip">{s.m10}</span>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </CornerBrackets>
        </div>
    );
}

// Settings Modal — Cosmos Cookoff Edition: Cosmos-only, no Gemini, no Architect options
function SettingsModal({ isOpen, onClose, onToggleCalibration }) {
    const state = useSimulationState();
    const dispatch = useSimulationDispatch();
    const [confirmReset, setConfirmReset] = React.useState(false);
    const [localBrightness, setLocalBrightness] = React.useState(1.2);

    const { graphics, ai, mission, ui } = state || {};

    React.useEffect(() => { setLocalBrightness(graphics?.brightness || 1.2); }, [graphics?.brightness]);

    if (!isOpen) return null;

    const lang = ui.language;
    const t = STRINGS[lang];

    const handleSliderChange = (e) => {
        const val = parseFloat(e.target.value);
        setLocalBrightness(val);
        dispatch({ type: 'SET_BRIGHTNESS', payload: val });
    };

    const handleReset = () => {
        setLocalBrightness(1.2);
        dispatch({ type: 'SET_BRIGHTNESS', payload: 1.2 });
        dispatch({ type: 'SET_SHADOW_CONTRAST', payload: 0.5 });
        if (graphics.chromaticAberration) dispatch({ type: 'TOGGLE_CHROMATIC' });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <CornerBrackets className="settings-panel" onClick={e => e.stopPropagation()}>
                <h2 className="panel-title">{t.settings}</h2>
                <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '12px' }}>
                    {/* NVIDIA COSMOS NIM CONFIGURATION — TOP PRIORITY */}
                    <div className="settings-row" style={{ display: 'block' }}>
                        <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px', color: '#76b900' }}>⚡ NVIDIA COSMOS REASON 2:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'rgba(118, 185, 0, 0.05)', border: '1px solid rgba(118, 185, 0, 0.3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '9px', color: 'rgba(118, 185, 0, 0.8)' }}>AI MODEL (LOCKED):</span>
                                <div style={{ background: 'rgba(118, 185, 0, 0.1)', width: '100%', border: '1px solid rgba(118, 185, 0, 0.6)', color: '#76b900', padding: '6px', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.5px' }}>🔒 {ai.aiModel}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '9px', color: 'rgba(118, 185, 0, 0.8)' }}>NIM ENDPOINT URL:</span>
                                <input className="api-input" value={ai.nvidiaNimUrl} onChange={(e) => dispatch({ type: 'SET_NVIDIA_NIM_URL', payload: e.target.value })} placeholder="http://localhost:8001/v1" style={{ background: 'rgba(0,0,0,0.5)', width: '100%', border: '1px solid rgba(118, 185, 0, 0.4)', color: '#76b900', padding: '6px', fontSize: '11px', fontFamily: 'monospace' }} onPointerDownCapture={(e) => { e.stopPropagation(); }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '9px', color: 'rgba(118, 185, 0, 0.8)' }}>API KEY / SECRET TOKEN:</span>
                                <input className="api-input" type="password" value={ai.nvidiaApiKey} onChange={(e) => dispatch({ type: 'SET_NVIDIA_API_KEY', payload: e.target.value })} placeholder="https://8000-xxxx.brevlab.com or nv-nim-..." style={{ background: 'rgba(0,0,0,0.5)', width: '100%', border: '1px solid rgba(118, 185, 0, 0.4)', color: '#76b900', padding: '6px', fontSize: '11px', fontFamily: 'monospace' }} onPointerDownCapture={(e) => { e.stopPropagation(); }} />
                            </div>
                            <div style={{ fontSize: '9px', color: 'rgba(118, 185, 0, 0.5)', lineHeight: '1.4' }}>
                                Default: proxy at localhost:8001/v1 → Brev.dev L40S server.<br />
                                Run <code style={{ color: '#76b900' }}>node proxy.js</code> locally + <code style={{ color: '#76b900' }}>bash Docs/setup_cosmos.sh</code> on GPU server.
                            </div>
                        </div>
                    </div>

                    {/* ARRIVAL ACCURACY */}
                    <div className="settings-row" style={{ display: 'block' }}>
                        <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>{t.accuracy}:</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[15.0, 5.0, 1.5].map(acc => (
                                <button key={acc} className={`hud-button ${mission.arrivalAccuracy === acc ? 'active' : ''}`} style={{ flex: 1, margin: 0, fontSize: '10px' }} onClick={() => dispatch({ type: 'SET_ARRIVAL_ACCURACY', payload: acc })}>
                                    {acc === 15.0 ? t.easy : acc === 5.0 ? t.normal : t.hard} ({acc}m)
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* CALIBRATION */}
                    <div className="settings-row" style={{ display: 'block' }}>
                        <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>CALIBRATION:</span>
                        <button
                            className={`hud-button ${mission.isCalibrationMode ? 'active' : ''}`}
                            style={{
                                width: '100%', margin: 0,
                                borderColor: mission.isCalibrationMode ? '#FFBF00' : 'rgba(255, 255, 255, 0.2)',
                                color: mission.isCalibrationMode ? '#FFBF00' : 'rgba(255, 255, 255, 0.5)'
                            }}
                            onClick={() => onToggleCalibration()}
                        >
                            {mission.isCalibrationMode ? "EXIT CALIBRATION (RETURN TO MOON)" : "ENTER CALIBRATION (FLAT PLANE)"}
                        </button>
                    </div>

                    {/* TERRAIN MODE */}
                    <div className="settings-row" style={{ display: 'block' }}>
                        <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>TERRAIN MODE:</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[['legacy', 'LEGACY'], ['naturalist', 'NATURALIST'], ['ethereal', 'ETHEREAL']].map(([val, label]) => (
                                <button key={val} className={`hud-button ${graphics.terrainMode === val ? 'active' : ''}`} style={{ flex: 1, margin: 0, fontSize: '9px' }} onClick={() => dispatch({ type: 'SET_TERRAIN_MODE', payload: val })}>{label}</button>
                            ))}
                        </div>
                        <div style={{ fontSize: '9px', color: 'rgba(0,255,255,0.4)', marginTop: '4px' }}>
                            {graphics.terrainMode === 'legacy' ? 'Noise + craters + rocks' :
                                graphics.terrainMode === 'naturalist' ? 'Smooth rolling hills' :
                                    'Monumental sine waves'}
                        </div>
                    </div>

                    {/* DUST DENSITY */}
                    <div className="settings-row" style={{ display: 'block' }}>
                        <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>DUST PARTICLES:</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[[DUST_DENSITIES.LOW, 'LOW (200)'], [DUST_DENSITIES.MEDIUM, 'MEDIUM (600)'], [DUST_DENSITIES.HIGH, 'HIGH (1200)']].map(([val, label]) => (
                                <button key={val} className={`hud-button ${graphics.dustDensity === val ? 'active' : ''}`} style={{ flex: 1, margin: 0, fontSize: '9px' }} onClick={() => dispatch({ type: 'SET_DUST_DENSITY', payload: val })}>{label}</button>
                            ))}
                        </div>
                    </div>

                    {/* BRIGHTNESS */}
                    <div className="settings-row">
                        <span className="label">{t.brightness}:</span>
                        <div className="brightness-control" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="range" min="0.1" max="3.0" step="0.1" value={localBrightness} onChange={handleSliderChange} onPointerDownCapture={(e) => { e.stopPropagation(); }} style={{ width: '150px', accentColor: '#00FFFF', cursor: 'pointer', pointerEvents: 'auto' }} />
                            <span style={{ color: '#00FFFF', fontSize: '0.8em', width: '30px' }}>{localBrightness.toFixed(1)}</span>
                        </div>
                    </div>

                    {/* SHADOWS */}
                    <div className="settings-row">
                        <span className="label">{t.shadows}:</span>
                        <div className="brightness-control" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="range" min="0.0" max="1.0" step="0.05" value={graphics.shadowContrast || 0.5} onChange={(e) => dispatch({ type: 'SET_SHADOW_CONTRAST', payload: parseFloat(e.target.value) })} onPointerDownCapture={(e) => { e.stopPropagation(); }} style={{ width: '150px', accentColor: '#00FFFF', cursor: 'pointer', pointerEvents: 'auto' }} />
                            <span style={{ color: '#00FFFF', fontSize: '0.8em', width: '30px' }}>{(graphics.shadowContrast || 0.5).toFixed(2)}</span>
                        </div>
                    </div>

                    {/* LENS FX */}
                    <div className="settings-row">
                        <span className="label">{t.lensFx}:</span>
                        <button className="hud-button" style={{ margin: 0, borderColor: graphics.chromaticAberration ? '#00FF41' : 'rgba(255, 255, 255, 0.2)', color: graphics.chromaticAberration ? '#00FF41' : 'rgba(255, 255, 255, 0.5)', minWidth: '60px' }} onClick={() => dispatch({ type: 'TOGGLE_CHROMATIC' })}>{graphics.chromaticAberration ? 'ON' : 'OFF'}</button>
                    </div>

                    <div style={{ marginTop: '20px', padding: '15px 0', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        {!confirmReset ? (
                            <button
                                className="hud-button"
                                style={{
                                    width: '100%',
                                    border: '1px solid #FF0055',
                                    color: '#FF0055',
                                    background: 'rgba(255, 0, 85, 0.05)',
                                    fontSize: '10px',
                                    letterSpacing: '2px'
                                }}
                                onClick={() => setConfirmReset(true)}
                            >
                                RESET TO DEFAULTS
                            </button>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', border: '1px solid #FF0055', background: 'rgba(255, 0, 85, 0.08)' }}>
                                <div style={{ fontSize: '10px', color: '#FF0055', textAlign: 'center', letterSpacing: '1px' }}>CONFIRM FACTORY RESET?</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="hud-button" style={{ flex: 1, border: '1px solid #FF0055', color: '#FF0055', fontSize: '10px' }} onClick={() => { dispatch({ type: 'RESET_DEFAULTS' }); setConfirmReset(false); }}>
                                        <span className="btn-bracket">[</span> YES <span className="btn-bracket">]</span>
                                    </button>
                                    <button className="hud-button" style={{ flex: 1, fontSize: '10px' }} onClick={() => setConfirmReset(false)}>
                                        <span className="btn-bracket">[</span> CANCEL <span className="btn-bracket">]</span>
                                    </button>
                                </div>
                            </div>
                        )}
                        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '9px', color: 'rgba(255, 255, 255, 0.3)', letterSpacing: '1px' }}>
                            ✓ SETTINGS AUTO-SAVED TO PERSISTENT STORAGE
                        </div>
                    </div>
                </div>


                <button className="hud-button close-btn" onClick={onClose}><span className="btn-bracket">[</span>{t.close}<span className="btn-bracket">]</span></button>
            </CornerBrackets>
        </div>
    );
}

// Help Modal — Cosmos Cookoff: Updated descriptions
function HelpModal({ isOpen, onClose, lang }) {
    if (!isOpen) return null;
    const t = STRINGS[lang].helpContent;
    const st = STRINGS[lang];
    return (
        <div className="modal-overlay" onClick={onClose}>
            <CornerBrackets className="settings-panel help-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <h2 className="panel-title">{t.title}</h2>
                <div className="help-content-scroll">
                    <p style={{ color: '#76b900', fontWeight: 'bold', marginBottom: '15px', fontSize: '12px' }}>{t.concept}</p>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        <li style={{ marginBottom: '15px', borderLeft: '2px solid rgba(0, 255, 255, 0.3)', paddingLeft: '10px' }}><span style={{ color: '#00FF41', fontWeight: 'bold', display: 'block', fontSize: '10px', marginBottom: '4px' }}>MANUAL NAVIGATION</span> {t.manual}</li>
                        <li style={{ marginBottom: '15px', borderLeft: '2px solid rgba(118, 185, 0, 0.3)', paddingLeft: '10px' }}><span style={{ color: '#76b900', fontWeight: 'bold', display: 'block', fontSize: '10px', marginBottom: '4px' }}>COSMOS REASON 2 AUTOPILOT</span> NVIDIA Cosmos Reason 2 analyzes terrain via LIDAR and visual scene capture, then autonomously navigates the rover to the destination signal.</li>
                        <li style={{ marginBottom: '15px', borderLeft: '2px solid rgba(0, 255, 255, 0.3)', paddingLeft: '10px' }}><span style={{ color: '#888', fontWeight: 'bold', display: 'block', fontSize: '10px', marginBottom: '4px' }}>MISSION PARAMETERS</span> {t.settings}</li>
                    </ul>
                </div>
                <button className="hud-button close-btn" onClick={onClose} style={{ marginTop: '15px' }}><span className="btn-bracket">[</span>{st.close}<span className="btn-bracket">]</span></button>
            </CornerBrackets>
        </div>
    );
}

function ControlsHint({ lang }) { const t = STRINGS[lang]; return <div className="controls-hint">{t.controls}</div>; }
function MobileControls({ onInputChange }) {
    const joystickRef = useRef(null);
    const knobRef = useRef(null);
    const touchStartPos = useRef({ x: 0, y: 0 });
    const isActive = useRef(false);

    const handleTouchStart = useCallback((e) => {
        const touch = e.touches[0];
        const rect = joystickRef.current.getBoundingClientRect();
        touchStartPos.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
        isActive.current = true;
    }, []);

    const handleTouchMove = useCallback((e) => {
        if (!isActive.current) return;
        const touch = e.touches[0];
        const dx = (touch.clientX - touchStartPos.current.x) / 50;
        const dy = (touch.clientY - touchStartPos.current.y) / 50;
        const clamp = (v) => Math.max(-1, Math.min(1, v));
        onInputChange({ forward: clamp(-dy) > 0 ? clamp(-dy) : 0, backward: clamp(dy) > 0 ? clamp(dy) : 0, left: clamp(-dx) > 0 ? clamp(-dx) : 0, right: clamp(dx) > 0 ? clamp(dx) : 0 });
        if (knobRef.current) {
            const maxDist = 40;
            knobRef.current.style.transform = `translate(${Math.max(-maxDist, Math.min(maxDist, dx * 30))}px, ${Math.max(-maxDist, Math.min(maxDist, dy * 30))}px)`;
        }
    }, [onInputChange]);

    const handleTouchEnd = useCallback(() => {
        if (knobRef.current) knobRef.current.style.transform = 'translate(0, 0)';
        isActive.current = false;
        onInputChange({ forward: 0, backward: 0, left: 0, right: 0 });
    }, [onInputChange]);

    return (
        <div className="mobile-controls">
            <div ref={joystickRef} className="joystick-zone" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}><div className="joystick-base"><div ref={knobRef} className="joystick-knob" /></div></div>
            <button className="mobile-brake-btn" onTouchStart={(e) => { e.preventDefault(); onInputChange({ brake: true }); }} onTouchEnd={(e) => { e.preventDefault(); onInputChange({ brake: false }); }}>BRAKE</button>
        </div>
    );
}

// Main HUD — Cosmos Cookoff Edition: No TopLogos, clean minimal UI
export default function HUD(props) {
    const state = useSimulationState();
    const dispatch = useSimulationDispatch();
    const { mission, ui, graphics } = state;

    const {
        telemetry, targetDistance, elapsedTime, riskMetrics,
        isAiOnline, isAiPlanning, isMcCalculating,
        onNewTerrain, onRestart, onToggleCalibration,
        onMobileInput, capturedFrame, lidarScan, isMobile
    } = props;

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const isVisible = ui.uiVisible;
    const hudShiftClass = (ui.terminalOpen && !isMobile) ? 'terminal-visible' : '';
    const visibilityClass = isVisible ? '' : 'hud-panels-hidden';
    const lang = ui.language;
    const t = STRINGS[lang];

    return (
        <>
            <div className={`hud-overlay ${hudShiftClass} ${visibilityClass}`} style={{ pointerEvents: 'none' }}>
                <button
                    className="cinematic-toggle"
                    onClick={() => dispatch({ type: 'TOGGLE_UI' })}
                    title={t.cinematicMode}
                    style={{ position: 'fixed', left: '0', top: '50%', transform: 'translateY(-50%)', writingMode: 'vertical-rl', textOrientation: 'mixed', padding: '20px 6px', borderRadius: '0 4px 4px 0', height: 'auto', minHeight: '120px' }}
                >
                    {isVisible ? 'HIDE INTERFACE' : 'RESTORE HUD'}
                </button>

                {/* Cosmos Cookoff Edition — subtle top accent bar */}
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
                    background: 'linear-gradient(90deg, transparent 0%, #76b900 20%, #76b900 80%, transparent 100%)',
                    opacity: 0.7, zIndex: 1000, pointerEvents: 'none'
                }} />
                <div style={{
                    position: 'fixed', top: '6px', left: '50%', transform: 'translateX(-50%)',
                    fontSize: '9px', letterSpacing: '3px', color: 'rgba(118, 185, 0, 0.5)',
                    fontFamily: 'monospace', pointerEvents: 'none', zIndex: 1000,
                    textShadow: '0 0 10px rgba(118, 185, 0, 0.3)'
                }}>PHYSICAL AI · AUTONOMOUS REASONING</div>

                {isVisible && (
                    <>
                        <TelemetryPanel telemetry={telemetry} lang={lang} onToggleHelp={() => dispatch({ type: 'TOGGLE_HELP' })} />
                        <MissionPanel targetDistance={targetDistance} lang={lang} elapsedTime={elapsedTime} onNewTerrain={onNewTerrain} onOpenSettings={() => setIsSettingsOpen(true)} />
                    </>
                )}

                <ControlPanel
                    driveMode={mission.driveMode} lang={lang}
                    onSetDriveMode={(mode) => dispatch({ type: 'SET_DRIVE_MODE', payload: mode })}
                    simulationState={mission.simulationState}
                    isAiOnline={isAiOnline} isAiPlanning={isAiPlanning}
                />

                <TerminalPanel />

                {isMobile && mission.simulationState === 'running' && (
                    <MobileControls onInputChange={onMobileInput} />
                )}

                {lidarScan && isVisible && <LidarPanel data={lidarScan} lang={lang} />}

                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onToggleCalibration={onToggleCalibration}
                />

                {/* Cosmos Vision Feed + LIDAR — stacked on right side, shift with terminal */}
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: ui.terminalOpen && !isMobile ? '340px' : '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'right 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                    pointerEvents: 'none',
                    zIndex: 10
                }}>
                    {capturedFrame && (
                        <div style={{
                            width: '160px',
                            height: '110px',
                            background: 'rgba(0,0,0,0.8)',
                            border: '1px solid #76b900',
                            padding: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                        }}>
                            <div style={{ fontSize: '9px', color: '#76b900', letterSpacing: '1px' }}>COSMOS VISION FEED</div>
                            <img src={`data:image/png;base64,${capturedFrame}`} style={{ width: '100%', height: '80px', objectFit: 'cover', opacity: 0.8 }} alt="Cosmos Vision" />
                        </div>
                    )}
                </div>

                <HelpModal isOpen={ui.helpOpen} onClose={() => dispatch({ type: 'TOGGLE_HELP' })} lang={lang} />

                <div style={{ position: 'absolute', bottom: '5px', right: '10px', color: '#888888', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', pointerEvents: 'none' }}>{VERSION}</div>
            </div>

            {(mission.simulationState === 'success' || mission.simulationState === 'failed') && (
                <OutcomeOverlay
                    reason={mission.simulationState} lang={lang} onRestart={onRestart} onNewTerrain={onNewTerrain} safetyScore={100} elapsedTime={elapsedTime}
                />
            )}
        </>
    );
}
