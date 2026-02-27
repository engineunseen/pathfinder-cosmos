// components/HUD.jsx — Sci-Fi HUD overlay (NVIDIA Drive / SpaceX Dragon style)
// v4.0.0: Context-based state, fixed metrics, logo pairs, terrain resolution
import React, { useState, useCallback, useRef, memo, useEffect } from 'react';
import { STRINGS } from '../i18n';
import { COLORS as C, WARNING_ANGLE, VERSION, TERRAIN_RESOLUTIONS, DUST_DENSITIES, DRIVE_MODES, useSimulationState, useSimulationDispatch } from '../store';
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

// Telemetry panel (Top Left) — v4.0.0: Fixed sCVaR scale (0–100, not 0–1)
function TelemetryPanel({ telemetry, lang, navigationOverlay, style, onToggleHelp, sCVaR }) {
    const t = STRINGS[lang];
    const pitchVal = parseFloat(telemetry.pitch) || 0;
    const rollVal = parseFloat(telemetry.roll) || 0;
    const pitchColor = Math.abs(pitchVal) > WARNING_ANGLE ? C.CRITICAL_PATH : C.PRIMARY_INFO;
    const rollColor = Math.abs(rollVal) > WARNING_ANGLE ? C.CRITICAL_PATH : C.PRIMARY_INFO;

    // v4.0.0: sCVaR is 0–100 scale. >60 = critical, >30 = warning
    const sCVaRVal = parseFloat(sCVaR) || 0;
    const sCVaRColor = sCVaRVal > 60 ? C.CRITICAL_PATH : sCVaRVal > 30 ? C.WARNING_PATH : C.SAFE_PATH;

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
            {navigationOverlay && sCVaR !== undefined && (
                <div className="telemetry-row" style={{ marginTop: '5px', borderTop: '1px solid rgba(0, 255, 255, 0.2)', paddingTop: '5px' }}>
                    <span className="label">sCVaR_α:</span>
                    <span className="value" style={{ color: sCVaRColor }}>
                        {sCVaRVal.toFixed(1)}
                    </span>
                </div>
            )}
        </CornerBrackets>
    );
}

// Mission Panel (Top Right) — v4.0.0: Fixed SMaR scale (meters, not 0–1)
function MissionPanel({ targetDistance, lang, elapsedTime, onNewTerrain, onOpenSettings, SMaR, navigationOverlay, style }) {
    const t = STRINGS[lang];
    // v4.0.0: SMaR is in meters. <15 = critical, <35 = warning, >35 = safe
    const sMarVal = parseFloat(SMaR) || 0;
    const sMarColor = sMarVal < 15 ? C.CRITICAL_PATH : sMarVal < 35 ? C.WARNING_PATH : C.SAFE_PATH;

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
            {navigationOverlay && SMaR !== undefined && (
                <div className="telemetry-row" style={{ marginTop: '5px', borderTop: '1px solid rgba(0, 255, 255, 0.1)', paddingTop: '5px' }}>
                    <span className="label">SMaR_α:</span>
                    <span className="value" style={{ color: sMarColor }}>{sMarVal.toFixed(1)}m</span>
                </div>
            )}
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

// Bottom Control Panel — v4.0.0: reads from context, shows specific model name
function ControlPanel({ driveMode, lang, onSetDriveMode, simulationState, failReason, navigationOverlay, onToggleNav, onPlanRoute, isAiOnline, isAiPlanning, isMcCalculating, aiQuote }) {
    const state = useSimulationState();
    const terminalOpen = state.ui.terminalOpen;
    const t = STRINGS[lang];

    // v4.0.0: Show specific model name
    const getActiveEngineName = () => {
        if (!isAiOnline) return 'Vision by UNSEEN ENGINE';
        const model = state.ai.aiModel;
        if (model.includes('cosmos') || model.includes('Cosmos')) return 'NVIDIA COSMOS';
        if (model.includes('3.1')) return 'GEMINI 3.1 PRO';
        return 'GEMINI 3 FLASH';
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
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: isAiOnline ? '#00FFFF' : '#FFBF00', letterSpacing: '1px' }}>
                    {getActiveEngineName()}
                </div>
                {isAiPlanning ? (
                    <span className="ai-active-text pulse" style={{ color: '#00FFFF', fontSize: '11px', marginTop: '4px' }}>{t.planning}</span>
                ) : (navigationOverlay || driveMode === 'autopilot') ? (
                    isAiOnline ? (
                        <span className="ai-active-text pulse" style={{ color: '#00FFFF', fontSize: '11px', marginTop: '4px' }}>{t.recalculating}</span>
                    ) : (
                        <span className="ai-active-text pulse" style={{ color: '#FFBF00', fontSize: '11px', marginTop: '4px' }}>VISION ENGINE ACTIVE</span>
                    )
                ) : !navigationOverlay && driveMode === 'manual' ? (
                    <span className="ai-prompt" style={{ fontSize: '11px', marginTop: '4px' }}>{t.navigatePrompt}</span>
                ) : null}
            </div>

            <div className="mode-selector" style={{ display: 'flex', gap: '10px' }}>
                <button
                    className={`mode-btn ${driveMode === 'autopilot' ? 'active-autopilot pulse' : ''}`}
                    onClick={() => onSetDriveMode(driveMode === 'autopilot' ? 'manual' : 'autopilot')}
                    style={{ flex: 0.618 }}
                    disabled={simulationState !== 'running'}
                >
                    <div className="inner-frame" />
                    <span style={{ fontSize: '10px', opacity: 0.7, display: 'block' }}>{t.driveMode}</span>
                    {driveMode === 'autopilot' ? t.autopilot : t.manual}
                </button>

                <button
                    className={`mode-btn ${navigationOverlay ? 'active-overlay' : ''}`}
                    onClick={() => onToggleNav()}
                    style={{ flex: 0.382, pointerEvents: 'auto' }}
                    disabled={simulationState !== 'running'}
                >
                    <div className="inner-frame" />
                    <span style={{ fontSize: '10px', opacity: 0.7, display: 'block' }}>OVERLAY</span>
                    {t.sensorData}
                </button>
            </div>

            {aiQuote && (
                <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(0, 255, 255, 0.05)', borderLeft: '2px solid #00FFFF', fontFamily: 'monospace', fontSize: '11px', color: '#00FFFF', fontStyle: 'italic', lineHeight: '1.4' }}>
                    {`"${aiQuote}"`}
                </div>
            )}

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

// Settings Modal — v4.0.0: Context-based, calibration doesn't close menu, terrain resolution + dust density
function SettingsModal({ isOpen, onClose, onToggleCalibration }) {
    const state = useSimulationState();
    const dispatch = useSimulationDispatch();
    if (!isOpen) return null;

    const { graphics, ai, mission, ui } = state;
    const lang = ui.language;
    const t = STRINGS[lang];
    const [localBrightness, setLocalBrightness] = React.useState(graphics.brightness || 1.2);
    React.useEffect(() => { setLocalBrightness(graphics.brightness || 1.2); }, [graphics.brightness]);

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

    const isCosmos = ai.aiModel?.includes('cosmos') || ai.aiModel?.includes('Cosmos');

    return (
        <div className="modal-overlay" onClick={onClose}>
            <CornerBrackets className="settings-panel" onClick={e => e.stopPropagation()}>
                <h2 className="panel-title">{t.settings}</h2>
                <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '12px' }}>
                    {/* CALIBRATION — v4.0.0: Does NOT close menu */}
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

                    {/* v4.0.0: TERRAIN RESOLUTION */}
                    <div className="settings-row" style={{ display: 'block' }}>
                        <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>TERRAIN RESOLUTION:</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[[TERRAIN_RESOLUTIONS.LOW, 'LOW (128)'], [TERRAIN_RESOLUTIONS.MEDIUM, 'MEDIUM (256)'], [TERRAIN_RESOLUTIONS.HIGH, 'HIGH (512)']].map(([val, label]) => (
                                <button key={val} className={`hud-button ${graphics.terrainResolution === val ? 'active' : ''}`} style={{ flex: 1, margin: 0, fontSize: '9px' }} onClick={() => dispatch({ type: 'SET_TERRAIN_RESOLUTION', payload: val })}>{label}</button>
                            ))}
                        </div>
                        <div style={{ fontSize: '9px', color: 'rgba(0,255,255,0.4)', marginTop: '4px' }}>
                            Higher resolution = sharper terrain detail (may impact performance)
                        </div>
                    </div>

                    {/* v4.0.0: DUST DENSITY */}
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

                    {/* WAYPOINT RESOLUTION */}
                    <div className="settings-row" style={{ display: 'block' }}>
                        <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>{t.waypointResolution}:</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[7, 15, 25].map(cnt => (
                                <button key={cnt} className={`hud-button ${ai.waypointCount === cnt ? 'active' : ''}`} style={{ flex: 1, margin: 0, fontSize: '10px' }} onClick={() => dispatch({ type: 'SET_WAYPOINT_COUNT', payload: cnt })}>
                                    {cnt === 7 ? `${t.low} (7)` : cnt === 15 ? `${t.med} (15)` : `${t.ultra} (25)`}
                                </button>
                            ))}
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

                    {/* AI NAVIGATION OPTIONS */}
                    <div className="settings-row" style={{ display: 'block' }}>
                        <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>AI NAVIGATION OPTIONS:</span>
                        <button className={`hud-button ${ai.aiUseMonteCarlo ? 'active' : ''}`} style={{ width: '100%', marginBottom: '8px' }} onClick={() => dispatch({ type: 'SET_AI_USE_MC', payload: !ai.aiUseMonteCarlo })}>
                            {t.useMonteCarlo} (Smart Sensors)
                        </button>
                        <button className={`hud-button ${ai.aiUsePath ? 'active' : ''}`} style={{ width: '100%' }} onClick={() => dispatch({ type: 'SET_AI_USE_PATH', payload: !ai.aiUsePath })}>
                            {t.usePlannedPath} (Follow Architect Path)
                        </button>
                        <div style={{ fontSize: '9px', color: 'rgba(0,255,255,0.4)', marginTop: '6px', lineHeight: '1.4' }}>
                            Smart Sensors: enables Vision by UNSEEN ENGINE Monte Carlo fan support.<br />
                            Follow Path: AI uses Architect route as navigation guide.
                        </div>
                    </div>

                    {/* ENGINE SELECTION */}
                    <div className="settings-row" style={{ display: 'block' }}>
                        <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>ENGINE SELECTION:</span>
                        <select
                            value={isCosmos ? 'nvidia/Cosmos-Reason2-2B' : ai.aiModel}
                            onChange={(e) => dispatch({ type: 'SET_AI_MODEL', payload: e.target.value })}
                            style={{ width: '100%', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #00FFFF', color: '#00FFFF', padding: '8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none', cursor: 'pointer', marginBottom: '10px' }}
                        >
                            <option value="gemini-3-flash-preview">Google Gemini 3 Flash</option>
                            <option value="gemini-3.1-pro-preview">Google Gemini 3.1 Pro ✦ NEW</option>
                            <option value="nvidia/Cosmos-Reason2-2B">NVIDIA Cosmos (Local NIM)</option>
                        </select>

                        {isCosmos ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'rgba(0,255,255,0.05)', border: '1px solid rgba(0,255,255,0.2)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '9px', color: 'rgba(0,255,255,0.6)' }}>AI MODEL NAME (vLLM):</span>
                                    <input className="api-input" value={ai.aiModel} onChange={(e) => dispatch({ type: 'SET_AI_MODEL', payload: e.target.value })} placeholder="nvidia/Cosmos-Reason2-2B" style={{ background: 'rgba(0,0,0,0.5)', width: '100%', border: '1px solid rgba(0,255,255,0.3)', color: '#00FFFF', padding: '6px', fontSize: '11px' }} onPointerDownCapture={(e) => { e.stopPropagation(); }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '9px', color: 'rgba(0,255,255,0.6)' }}>NIM ENDPOINT URL:</span>
                                    <input className="api-input" value={ai.nvidiaNimUrl} onChange={(e) => dispatch({ type: 'SET_NVIDIA_NIM_URL', payload: e.target.value })} placeholder="http://IP_ADDRESS:8000" style={{ background: 'rgba(0,0,0,0.5)', width: '100%', border: '1px solid rgba(0,255,255,0.3)', color: '#00FFFF', padding: '6px', fontSize: '11px' }} onPointerDownCapture={(e) => { e.stopPropagation(); }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '9px', color: 'rgba(0,255,255,0.6)' }}>NVIDIA API KEY (NIM):</span>
                                    <input className="api-input" type="password" value={ai.nvidiaApiKey} onChange={(e) => dispatch({ type: 'SET_NVIDIA_API_KEY', payload: e.target.value })} placeholder="nv-nim-..." style={{ background: 'rgba(0,0,0,0.5)', width: '100%', border: '1px solid rgba(0,255,255,0.3)', color: '#00FFFF', padding: '6px', fontSize: '11px' }} onPointerDownCapture={(e) => { e.stopPropagation(); }} />
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '9px', color: 'rgba(0,255,255,0.6)' }}>{t.geminiApiKey}:</span>
                                <input type="password" value={ai.apiKey || ''} onChange={(e) => dispatch({ type: 'SET_API_KEY', payload: e.target.value })} placeholder="Enter Gemini Key..." style={{ width: '100%', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #00FFFF', color: '#00FFFF', padding: '8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }} onPointerDownCapture={(e) => { e.stopPropagation(); }} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="settings-row">
                    <span className="label">{t.language}:</span>
                    <div className="language-selector">{['EN', 'RU', 'UA'].map((l) => (<button key={l} className={`lang-btn ${ui.language === l ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_LANGUAGE', payload: l })}>{l}</button>))}</div>
                </div>
                <button className="hud-button close-btn" onClick={onClose}><span className="btn-bracket">[</span>{t.close}<span className="btn-bracket">]</span></button>
            </CornerBrackets>
        </div>
    );
}

// Inline SVG Vision Eye Logo (from Unseen Vision brand)
function VisionEyeLogo({ size = 40 }) {
    return (
        <div style={{
            width: size, height: size,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)',
            flexShrink: 0
        }}>
            <svg xmlns="http://www.w3.org/2000/svg" width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        </div>
    );
}

function VisionLogoFull() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
            <VisionEyeLogo size={44} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '22px', fontWeight: 'bold', color: 'white', lineHeight: 1, fontFamily: 'monospace', letterSpacing: '1px' }}>Vision</span>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.55)', lineHeight: 1, letterSpacing: '2px', textTransform: 'uppercase' }}>by UNSEEN ENGINE</span>
            </div>
        </div>
    );
}

// v4.0.0: TopLogos — ALWAYS shows a pair. Left = active engine, Right = UNSEEN ENGINE brand
function TopLogos({ isAiOnline, driveMode }) {
    const state = useSimulationState();
    const terminalOpen = state.ui.terminalOpen;
    const uiVisible = state.ui.uiVisible;
    if (!uiVisible) return null;

    const isCosmos = state.ai.visionProvider === 'cosmos';
    const isVisionDriving = !isAiOnline && driveMode === DRIVE_MODES.AUTOPILOT;

    // v4.0.0: Left logo is ALWAYS the active engine. Right is ALWAYS UNSEEN ENGINE brand.
    const getLeftLogo = () => {
        if (!isAiOnline || isVisionDriving) {
            return <VisionEyeLogo size={44} />;
        }
        const partnerLogo = isCosmos ? "/Nvidia_logo_.svg" : "/gemini-color.svg";
        const partnerLogoHeight = isCosmos ? '51px' : '56px';
        return <img src={partnerLogo} alt={isCosmos ? 'NVIDIA' : 'Google Gemini'} style={{ height: partnerLogoHeight }} />;
    };

    // Get human-readable active engine name
    const getEngineBadge = () => {
        if (!isAiOnline || isVisionDriving) return 'Vision by UNSEEN ENGINE';
        const model = state.ai.aiModel;
        if (model.includes('cosmos') || model.includes('Cosmos')) return 'NVIDIA COSMOS';
        if (model.includes('3.1')) return 'GEMINI 3.1 PRO';
        return 'GEMINI 3 FLASH';
    };

    const badgeColor = isAiOnline && !isVisionDriving ? '#00FFFF' : '#a5b4fc';
    const badgeBg = isAiOnline && !isVisionDriving ? 'rgba(0, 255, 255, 0.1)' : 'rgba(99, 102, 241, 0.15)';
    const badgeBorder = isAiOnline && !isVisionDriving ? 'rgba(0, 255, 255, 0.4)' : 'rgba(99, 102, 241, 0.6)';

    return (
        <div className="top-logos-container" style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: `translateX(${terminalOpen ? 'calc(-50% - 160px)' : '-50%'})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            zIndex: 100,
            transition: 'transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)'
        }}>
            {/* ALWAYS show logo pair: Left = active engine, Right = UNSEEN ENGINE */}
            <div className="top-logos" style={{ display: 'flex', alignItems: 'center', gap: '30px', pointerEvents: 'none' }}>
                <div className="logo-section">
                    {getLeftLogo()}
                </div>
                <div className="logo-divider" style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.2)' }} />
                <div className="logo-section">
                    <img src="/Unseen_logo.svg" alt="UNSEEN ENGINE" style={{ height: '54px' }} />
                </div>
            </div>

            {/* Engine badge — ALWAYS visible, shows which engine is active */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 16px',
                background: badgeBg,
                border: `1px solid ${badgeBorder}`,
                borderRadius: '4px',
            }}>
                {(driveMode === DRIVE_MODES.AUTOPILOT) && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: badgeColor, boxShadow: `0 0 8px ${badgeColor}`, animation: 'pulse 1.5s infinite' }} />
                )}
                <div style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', color: badgeColor }}>
                    {getEngineBadge()}
                    {driveMode === DRIVE_MODES.AUTOPILOT && <span style={{ opacity: 0.6, marginLeft: '8px' }}>PILOTING</span>}
                </div>
            </div>
        </div>
    );
}

function HelpModal({ isOpen, onClose, lang }) {
    if (!isOpen) return null;
    const t = STRINGS[lang].helpContent;
    const st = STRINGS[lang];
    return (
        <div className="modal-overlay" onClick={onClose}>
            <CornerBrackets className="settings-panel help-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <h2 className="panel-title">{t.title}</h2>
                <div className="help-content-scroll">
                    <p style={{ color: '#00FFFF', fontWeight: 'bold', marginBottom: '15px', fontSize: '12px' }}>{t.concept}</p>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        <li style={{ marginBottom: '15px', borderLeft: '2px solid rgba(0, 255, 255, 0.3)', paddingLeft: '10px' }}><span style={{ color: '#00FF41', fontWeight: 'bold', display: 'block', fontSize: '10px', marginBottom: '4px' }}>MANUAL NAVIGATION</span> {t.manual}</li>
                        <li style={{ marginBottom: '15px', borderLeft: '2px solid rgba(0, 255, 255, 0.3)', paddingLeft: '10px' }}><span style={{ color: '#00FFFF', fontWeight: 'bold', display: 'block', fontSize: '10px', marginBottom: '4px' }}>TACTICAL AUTOPILOT</span> {t.ai}</li>
                        <li style={{ marginBottom: '15px', borderLeft: '2px solid rgba(0, 255, 255, 0.3)', paddingLeft: '10px' }}><span style={{ color: '#FFBF00', fontWeight: 'bold', display: 'block', fontSize: '10px', marginBottom: '4px' }}>Vision by UNSEEN ENGINE</span> {t.core}</li>
                        <li style={{ marginBottom: '15px', borderLeft: '2px solid rgba(0, 255, 255, 0.3)', paddingLeft: '10px' }}><span style={{ color: '#888', fontWeight: 'bold', display: 'block', fontSize: '10px', marginBottom: '4px' }}>MISSION PARAMETERS</span> {t.settings}</li>
                    </ul>
                </div>
                <button className="hud-button close-btn" onClick={onClose} style={{ marginTop: '15px' }}><span className="btn-bracket">[</span>{st.close}<span className="btn-bracket">]</span></button>
            </CornerBrackets>
        </div>
    );
}

function ControlsHint({ lang }) { const t = STRINGS[lang]; return <div className="controls-hint">{t.controls}</div>; }
function MobileControls({ onInputChange, onPlanRoute }) {
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

// v4.0.0: Main HUD — reads from Context, minimal props
export default function HUD(props) {
    const state = useSimulationState();
    const dispatch = useSimulationDispatch();
    const { mission, ui, graphics } = state;

    const {
        telemetry, targetDistance, elapsedTime, riskMetrics,
        isAiOnline, isAiPlanning, isMcCalculating, aiQuote,
        onPlanRoute, onNewTerrain, onRestart, onToggleCalibration, onToggleNav,
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

                <TopLogos isAiOnline={isAiOnline} driveMode={mission.driveMode} />

                {isVisible && (
                    <>
                        <TelemetryPanel telemetry={telemetry} lang={lang} navigationOverlay={mission.navigationOverlay} onToggleHelp={() => dispatch({ type: 'TOGGLE_HELP' })} sCVaR={riskMetrics?.sCVaR} />
                        <MissionPanel targetDistance={targetDistance} lang={lang} elapsedTime={elapsedTime} onNewTerrain={onNewTerrain} onOpenSettings={() => setIsSettingsOpen(true)} SMaR={riskMetrics?.SMaR} navigationOverlay={mission.navigationOverlay} />
                    </>
                )}

                <ControlPanel
                    driveMode={mission.driveMode} lang={lang}
                    onSetDriveMode={(mode) => dispatch({ type: 'SET_DRIVE_MODE', payload: mode })}
                    simulationState={mission.simulationState} failReason={mission.failReason}
                    navigationOverlay={mission.navigationOverlay} onToggleNav={onToggleNav} onPlanRoute={onPlanRoute}
                    isAiOnline={isAiOnline} isAiPlanning={isAiPlanning} isMcCalculating={isMcCalculating} aiQuote={aiQuote}
                />

                <TerminalPanel />

                {isMobile && mission.simulationState === 'running' && (
                    <MobileControls onInputChange={onMobileInput} onPlanRoute={onPlanRoute} />
                )}

                {lidarScan && isVisible && <LidarPanel data={lidarScan} lang={lang} />}

                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onToggleCalibration={onToggleCalibration}
                />

                {/* Vision Debug Overlay */}
                {capturedFrame && (
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '320px',
                        width: '160px',
                        height: '110px',
                        background: 'rgba(0,0,0,0.8)',
                        border: '1px solid #00FFFF',
                        padding: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        pointerEvents: 'none',
                        zIndex: 10
                    }}>
                        <div style={{ fontSize: '9px', color: '#00FFFF', letterSpacing: '1px' }}>AI VISION FEED (LIVE)</div>
                        <img src={`data:image/png;base64,${capturedFrame}`} style={{ width: '100%', height: '80px', objectFit: 'cover', opacity: 0.8 }} alt="AI Vision" />
                    </div>
                )}

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
