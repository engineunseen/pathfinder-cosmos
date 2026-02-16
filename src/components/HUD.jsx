// components/HUD.jsx — Sci-Fi HUD overlay (NVIDIA Drive / SpaceX Dragon style)
import React, { useState, useCallback, useRef, memo } from 'react';
import { STRINGS } from '../i18n';
import { COLORS as C, WARNING_ANGLE, VERSION, useSimulationState } from '../store';
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

// Telemetry panel (Top Left)
function TelemetryPanel({ telemetry, lang, style }) {
    const t = STRINGS[lang];
    const pitchVal = parseFloat(telemetry.pitch) || 0;
    const rollVal = parseFloat(telemetry.roll) || 0;
    const pitchColor = Math.abs(pitchVal) > WARNING_ANGLE ? C.CRITICAL_PATH : C.PRIMARY_INFO;
    const rollColor = Math.abs(rollVal) > WARNING_ANGLE ? C.CRITICAL_PATH : C.PRIMARY_INFO;

    return (
        <CornerBrackets className="panel-telemetry" style={style}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(0, 255, 255, 0.3)', paddingBottom: '5px', minHeight: '28px' }}>
                <h2 className="panel-title" style={{ margin: 0, border: 'none', padding: 0 }}>{t.telemetry}</h2>
                <div style={{ width: '30px' }}></div>
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
                    {telemetry.pitch || '0.0'}°
                </span>
            </div>
            <div className="telemetry-row">
                <span className="label">{t.roll}:</span>
                <span className="value" style={{ color: rollColor }}>
                    {telemetry.roll || '0.0'}°
                </span>
            </div>
            <div className="telemetry-row">
                <span className="label">{t.battery}:</span>
                <BatteryBar value={telemetry.battery || 100} />
            </div>
            {telemetry.sCVaR !== undefined && (
                <div className="telemetry-row" style={{ marginTop: '5px', borderTop: '1px solid rgba(0, 255, 255, 0.2)', paddingTop: '5px' }}>
                    <span className="label">sCVaR:</span>
                    <span className="value" style={{
                        color: telemetry.sCVaR > 50 ? C.CRITICAL_PATH : telemetry.sCVaR > 30 ? C.WARNING_PATH : C.SAFE_PATH
                    }}>
                        {parseFloat(telemetry.sCVaR).toFixed(1)} u
                    </span>
                </div>
            )}
        </CornerBrackets>
    );
}

// Mission Control panel (Top Right)
function MissionPanel({ targetDistance, lang, elapsedTime, onNewTerrain, onOpenSettings, telemetry, style }) {
    const t = STRINGS[lang];

    return (
        <CornerBrackets className="panel-mission" style={style}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(0, 255, 255, 0.3)', paddingBottom: '5px', minHeight: '28px' }}>
                <h2 className="panel-title" style={{ margin: 0, border: 'none', padding: 0 }}>{t.missionControl}</h2>
                <button
                    onClick={onOpenSettings}
                    style={{
                        background: 'none', border: 'none', color: 'rgba(0, 255, 255, 0.7)', fontSize: '20px', cursor: 'pointer', padding: '0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    ⚙
                </button>
            </div>

            <div className="telemetry-row">
                <span className="label">{t.time}:</span>
                <span className="value" style={{ color: C.PRIMARY_INFO }}>
                    {elapsedTime.toFixed(1)}s
                </span>
            </div>
            <div className="telemetry-row">
                <span className="label">{t.target}:</span>
                <span className="value" style={{ color: C.SAFE_PATH }}>
                    {targetDistance.toFixed(0)} {t.meters}
                </span>
            </div>
            {telemetry && telemetry.SMaR !== undefined && (
                <div className="telemetry-row">
                    <span className="label">SMaR:</span>
                    <span className="value" style={{
                        color: telemetry.SMaR < 10 ? C.CRITICAL_PATH : telemetry.SMaR < 25 ? C.WARNING_PATH : C.SAFE_PATH
                    }}>
                        {parseFloat(telemetry.SMaR).toFixed(1)} m
                    </span>
                </div>
            )}
            <button className="hud-button" onClick={onNewTerrain}>
                <span className="btn-bracket">[</span>
                {t.generateNewLandscape}
                <span className="btn-bracket">]</span>
            </button>
        </CornerBrackets>
    );
}

// Bottom Control Panel
function ControlPanel({ driveMode, lang, onSetDriveMode, simulationState, navigationOverlay, onToggleNav, onPlanRoute, isAiOnline, isAiPlanning, isMcCalculating, aiQuote }) {
    const { terminalOpen } = useSimulationState();
    const t = STRINGS[lang];

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
            transition: 'transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)'
        }}>

            {simulationState === 'running' && (
                <>
                    <div className="ai-status" style={{ marginBottom: '12px', minHeight: '16px' }}>
                        {isAiPlanning ? (
                            <span className="ai-active-text pulse" style={{ color: '#00FFFF', fontSize: '11px' }}>{t.planning}</span>
                        ) : (navigationOverlay || driveMode === 'autopilot') ? (
                            <span className="ai-active-text pulse" style={{ color: '#00FFFF', fontSize: '11px' }}>{t.recalculating}</span>
                        ) : !navigationOverlay && driveMode === 'manual' ? (
                            <span className="ai-prompt" style={{ fontSize: '11px' }}>{t.navigatePrompt}</span>
                        ) : null}
                    </div>

                    <div className="mode-selector" style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className={`mode-btn ${driveMode === 'autopilot' ? 'active-autopilot pulse' : ''}`}
                            onClick={() => onSetDriveMode(driveMode === 'autopilot' ? 'manual' : 'autopilot')}
                            style={{ flex: 0.618 }}
                        >
                            <div className="inner-frame" />
                            <span style={{ fontSize: '10px', opacity: 0.7, display: 'block' }}>{t.driveMode}</span>
                            {driveMode === 'autopilot' ? t.autopilot : t.manual}
                        </button>

                        <button
                            className={`mode-btn ${navigationOverlay ? 'active-overlay' : ''}`}
                            onClick={onToggleNav}
                            style={{ flex: 0.382 }}
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
                </>
            )}
        </CornerBrackets>
    );
}

// Outcome Overlay
function OutcomeOverlay({ reason, lang, onRestart, onNewTerrain, safetyScore, elapsedTime }) {
    const t = STRINGS[lang];
    const { totalCrashes } = useSimulationState();
    const isSuccess = reason === 'success';

    return (
        <div className="outcome-overlay">
            <CornerBrackets className="outcome-panel">
                <h1 className={`outcome-title ${isSuccess ? 'success' : 'fail'}`}>
                    {isSuccess ? 'MISSION SUCCESS' : 'MISSION TERMINATED'}
                </h1>
                <div className="outcome-details">
                    <div className="detail-row"><span>{t.time}:</span> <span>{Math.floor(elapsedTime)}s</span></div>
                    <div className="detail-row"><span>{t.safetyScore}:</span> <span>{safetyScore}/100</span></div>
                    {!isSuccess && <div className="detail-row" style={{ color: '#FF0055' }}><span>STATUS:</span> <span>STABILITY BREACH - ROVER LOST</span></div>}
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button className="hud-button" style={{ flex: 1 }} onClick={onNewTerrain}>{t.generateNewLandscape}</button>
                </div>
            </CornerBrackets>
        </div>
    );
}

// V0.8.34: Lidar Visualization Panel
function LidarPanel({ data, lang }) {
    const t = STRINGS[lang];
    // Data is a string like: "\n- 0°: 5m:[+0.1m] 10m:[-0.5m] ..."
    // We'll parse it into a structured array
    const lines = data.split('\n').filter(l => l.includes('°'));
    const sectors = lines.map(line => {
        const angle = line.match(/(\d+)°/)[1];
        const m5 = line.match(/5m:\[([^\]]+)\]/)[1];
        const m10 = line.match(/10m:\[([^\]]+)\]/)[1];
        return { angle, m5, m10 };
    });

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
                        const rad = (deg - 90) * (Math.PI / 180); // Adjust for CSS rotation
                        const x = Math.cos(rad);
                        const y = Math.sin(rad);

                        const getIntensity = (val) => {
                            if (val === 'VOID') return '#333';
                            const v = parseFloat(val);
                            if (Math.abs(v) > 2) return '#FF0055'; // Danger (Steep)
                            if (Math.abs(v) > 0.8) return '#FFBF00'; // Warning (Slope)
                            return '#00FF41'; // Safe
                        };

                        return (
                            <React.Fragment key={s.angle}>
                                {/* 5m point */}
                                <div className="radar-point p5" style={{
                                    left: `calc(50% + ${x * 25}%)`,
                                    top: `calc(50% + ${y * 25}%)`,
                                    background: getIntensity(s.m5)
                                }}>
                                    <span className="tooltip">{s.m5}</span>
                                </div>
                                {/* 10m point */}
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
                <div className="lidar-legend">
                    <div className="legend-item"><div className="dot" style={{ background: '#00FF41' }} /> {t.safe}</div>
                    <div className="legend-item"><div className="dot" style={{ background: '#FFBF00' }} /> {t.warning}</div>
                    <div className="legend-item"><div className="dot" style={{ background: '#FF0055' }} /> {t.critical}</div>
                </div>
            </CornerBrackets>
        </div>
    );
}

// Settings Modal
function SettingsModal({ isOpen, onClose, lang, onLanguageChange, brightness, onBrightnessChange, shadowContrast, onShadowChange, chromaticAberration, onChromaticToggle, apiKey, onApiKeyChange, aiModel, onAiModelChange, waypointCount, onWaypointCountChange, onToggleCalibration }) {
    if (!isOpen) return null;
    const { isCalibrationMode } = useSimulationState();
    const t = STRINGS[lang];
    const [localBrightness, setLocalBrightness] = React.useState(brightness || 1.2);
    React.useEffect(() => { setLocalBrightness(brightness || 1.2); }, [brightness]);
    const handleSliderChange = (e) => { const val = parseFloat(e.target.value); setLocalBrightness(val); onBrightnessChange(val); };
    const handleReset = () => { const defaultBrightness = 1.2, defaultShadow = 0.5; setLocalBrightness(defaultBrightness); onBrightnessChange(defaultBrightness); onShadowChange(defaultShadow); if (chromaticAberration) onChromaticToggle(); };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <CornerBrackets className="settings-panel" onClick={e => e.stopPropagation()}>
                <h2 className="panel-title">{t.settings}</h2>
                <div className="settings-row" style={{ display: 'block' }}>
                    <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>CALIBRATION:</span>
                    <button
                        className={`hud-button ${isCalibrationMode ? 'active' : ''}`}
                        style={{
                            width: '100%',
                            margin: 0,
                            borderColor: isCalibrationMode ? '#FFBF00' : 'rgba(255, 255, 255, 0.2)',
                            color: isCalibrationMode ? '#FFBF00' : 'rgba(255, 255, 255, 0.5)'
                        }}
                        onClick={() => { onToggleCalibration(); onClose(); }}
                    >
                        {isCalibrationMode ? "EXIT CALIBRATION (RETURN TO MOON)" : "ENTER CALIBRATION (FLAT PLANE)"}
                    </button>
                    <span style={{ fontSize: '9px', opacity: 0.6, marginTop: '4px', display: 'block' }}>
                        * Resets mission on an ideal 0-height surface for navigation testing.
                    </span>
                </div>
                <div className="settings-row">
                    <span className="label">{t.brightness}:</span>
                    <div className="brightness-control" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="range" min="0.1" max="3.0" step="0.1" value={localBrightness} onChange={handleSliderChange} onPointerDownCapture={(e) => { e.stopPropagation(); }} style={{ width: '150px', accentColor: '#00FFFF', cursor: 'pointer', pointerEvents: 'auto' }} />
                        <span style={{ color: '#00FFFF', fontSize: '0.8em', width: '30px' }}>{localBrightness.toFixed(1)}</span>
                    </div>
                </div>
                <div className="settings-row">
                    <span className="label">{t.shadows}:</span>
                    <div className="brightness-control" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="range" min="0.0" max="1.0" step="0.05" value={shadowContrast || 0.5} onChange={(e) => onShadowChange(parseFloat(e.target.value))} onPointerDownCapture={(e) => { e.stopPropagation(); }} style={{ width: '150px', accentColor: '#00FFFF', cursor: 'pointer', pointerEvents: 'auto' }} />
                        <span style={{ color: '#00FFFF', fontSize: '0.8em', width: '30px' }}>{(shadowContrast || 0.5).toFixed(2)}</span>
                    </div>
                </div>
                <div className="settings-row">
                    <span className="label">{t.lensFx}:</span>
                    <button className="hud-button" style={{ margin: 0, borderColor: chromaticAberration ? '#00FF41' : 'rgba(255, 255, 255, 0.2)', color: chromaticAberration ? '#00FF41' : 'rgba(255, 255, 255, 0.5)', minWidth: '60px' }} onClick={onChromaticToggle}>{chromaticAberration ? 'ON' : 'OFF'}</button>
                </div>
                <div className="settings-row" style={{ display: 'block' }}>
                    <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>{t.waypointResolution}:</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[7, 15, 25].map(cnt => (
                            <button
                                key={cnt}
                                className={`hud-button ${waypointCount === cnt ? 'active' : ''}`}
                                style={{
                                    flex: 1,
                                    margin: 0,
                                    fontSize: '10px'
                                }}
                                onClick={() => onWaypointCountChange(cnt)}
                            >
                                {cnt === 7 ? `${t.low} (7)` : cnt === 15 ? `${t.med} (15)` : `${t.ultra} (25)`}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="settings-row" style={{ display: 'block' }}>
                    <span className="label" style={{ marginBottom: '5px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>{t.aiModelIdentity}:</span>
                    <select value={apiKey && apiKey.startsWith('http') ? 'custom' : (aiModel || 'gemini-3-flash-preview')} onChange={(e) => onAiModelChange(e.target.value)} style={{ width: '100%', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #00FFFF', color: '#00FFFF', padding: '8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
                        <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                        <option value="cosmos-reasoning">NVIDIA Cosmos</option>
                    </select>
                </div>
                <div className="settings-row" style={{ display: 'block' }}>
                    <span className="label" style={{ marginBottom: '5px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>
                        {aiModel === 'cosmos-reasoning' ? `${t.cosmosEndpoint}:` : `${t.geminiApiKey}:`}
                    </span>
                    <input type="password" value={apiKey || ''} onChange={(e) => onApiKeyChange(e.target.value)} placeholder={aiModel === 'cosmos-reasoning' ? "https://..." : "Enter Key..."} style={{ width: '100%', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #00FFFF', color: '#00FFFF', padding: '8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }} onPointerDownCapture={(e) => { e.stopPropagation(); }} />
                </div>
                <div style={{ marginTop: '10px', marginBottom: '20px' }}>
                    <button className="hud-button" style={{ width: '100%', borderColor: '#FFBF00', color: '#FFBF00', fontSize: '11px' }} onClick={handleReset}>{t.resetGraphics}</button>
                </div>
                <div className="settings-row">
                    <span className="label">{t.language}:</span>
                    <div className="language-selector">{['EN', 'RU', 'UA'].map((l) => (<button key={l} className={`lang-btn ${lang === l ? 'active' : ''}`} onClick={() => onLanguageChange(l)}>{l}</button>))}</div>
                </div>
                <button className="hud-button close-btn" onClick={onClose}><span className="btn-bracket">[</span>{t.close}<span className="btn-bracket">]</span></button>
            </CornerBrackets >
        </div >
    );
}

function TopLogos({ aiModel }) {
    const { terminalOpen } = useSimulationState();
    const isGemini = aiModel && (aiModel.includes('gemini') || aiModel === 'gemini-3-flash-preview');
    const partnerLogo = isGemini ? "/gemini-color.svg" : "/Nvidia_logo_.svg";

    return (
        <div className="top-logos" style={{
            transform: `translateX(${terminalOpen ? 'calc(-50% - 160px)' : '-50%'})`
        }}>
            <div className="logo-section"><img src={partnerLogo} alt="Partner" style={{ height: isGemini ? '56px' : '51px' }} /></div>
            <div className="logo-divider" /><div className="logo-section"><img src="/Unseen_logo.svg" alt="UNSEEN" style={{ height: '54px' }} /></div>
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
        // e.preventDefault();
        const touch = e.touches[0];
        const rect = joystickRef.current.getBoundingClientRect();
        touchStartPos.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
        isActive.current = true;
    }, []);

    const handleTouchMove = useCallback((e) => {
        // e.preventDefault();
        if (!isActive.current) return;
        const touch = e.touches[0];
        const dx = (touch.clientX - touchStartPos.current.x) / 50;
        const dy = (touch.clientY - touchStartPos.current.y) / 50;

        const clamp = (v) => Math.max(-1, Math.min(1, v));
        const left = clamp(-dx) > 0 ? clamp(-dx) : 0;
        const right = clamp(dx) > 0 ? clamp(dx) : 0;
        const forward = clamp(-dy) > 0 ? clamp(-dy) : 0;
        const backward = clamp(dy) > 0 ? clamp(dy) : 0;

        onInputChange({ forward, backward, left, right });

        if (knobRef.current) {
            const maxDist = 40;
            const kx = Math.max(-maxDist, Math.min(maxDist, dx * 30));
            const ky = Math.max(-maxDist, Math.min(maxDist, dy * 30));
            knobRef.current.style.transform = `translate(${kx}px, ${ky}px)`;
        }
    }, [onInputChange]);

    const handleTouchEnd = useCallback(() => {
        if (knobRef.current) {
            knobRef.current.style.transform = 'translate(0, 0)';
        }
        isActive.current = false;
        onInputChange({ forward: 0, backward: 0, left: 0, right: 0 });
    }, [onInputChange]);

    return (
        <div className="mobile-controls">
            <div
                ref={joystickRef}
                className="joystick-zone"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="joystick-base">
                    <div ref={knobRef} className="joystick-knob" />
                </div>
            </div>
            <button
                className="mobile-brake-btn"
                onTouchStart={(e) => { e.preventDefault(); onInputChange({ brake: true }); }}
                onTouchEnd={(e) => { e.preventDefault(); onInputChange({ brake: false }); }}
            >
                BRAKE
            </button>
        </div>
    );
}

export default function HUD(props) {
    const {
        telemetry, targetDistance, driveMode, simulationState, failReason, safetyScore, elapsedTime, language, isMobile, onSetDriveMode, onNewTerrain, onRestart,
        onLanguageChange, onMobileInput, brightness, onBrightnessChange, shadowContrast, onShadowChange, chromaticAberration, onChromaticToggle, riskMetrics,
        apiKey, onApiKeyChange, isAiOnline, aiQuote, navigationOverlay, onToggleNav, aiModel, onAiModelChange,
        isAiPlanning, isMcCalculating, onPlanRoute,
        lidarScan, waypointCount, onWaypointCountChange, onToggleCalibration
    } = props;
    const { terminalOpen } = useSimulationState();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const quoteHeaders = {
        EN: "[AI CONNECTION VERIFIED] - STRATEGIC QUOTE:",
        RU: "[ИИ ПОДКЛЮЧЕН] - СТРАТЕГИЧЕСКАЯ ЦИТАТА:",
        UA: "[ШІ ПІДКЛЮЧЕНО] - СТРАТЕГІЧНА ЦИТАТА:"
    };

    const hudShiftClass = (terminalOpen && !isMobile) ? 'terminal-visible' : '';

    return (
        <div className={`hud-overlay ${hudShiftClass}`} style={{ pointerEvents: 'none' }}>
            <TopLogos aiModel={aiModel} />
            <TelemetryPanel telemetry={{ ...telemetry, sCVaR: riskMetrics?.sCVaR }} lang={language} />

            <MissionPanel
                targetDistance={targetDistance}
                lang={language}
                elapsedTime={elapsedTime}
                onNewTerrain={onNewTerrain}
                onOpenSettings={() => setIsSettingsOpen(true)}
                telemetry={{ SMaR: riskMetrics?.SMaR }}
            />

            <ControlPanel
                driveMode={driveMode}
                lang={language}
                onSetDriveMode={onSetDriveMode}
                simulationState={simulationState}
                navigationOverlay={navigationOverlay}
                onToggleNav={onToggleNav}
                onPlanRoute={onPlanRoute}
                isAiOnline={isAiOnline}
                isAiPlanning={isAiPlanning}
                isMcCalculating={isMcCalculating}
                aiQuote={aiQuote}
            />

            <TerminalPanel />

            {(simulationState === 'success' || simulationState === 'gameover') && (
                <OutcomeOverlay
                    reason={simulationState === 'success' ? 'success' : failReason}
                    lang={language}
                    onRestart={onRestart}
                    onNewTerrain={onNewTerrain}
                    safetyScore={safetyScore}
                    elapsedTime={elapsedTime}
                />
            )}

            {!isAiOnline && driveMode === 'autopilot' && (
                <div className="offline-warning-box">
                    <span style={{ fontWeight: 'bold' }}>⚠️ STRATEGIC OFFLINE:</span> AI KEY MISSING. USING HEURISTIC FALLBACK.
                </div>
            )}

            {isMobile && simulationState === 'running' && (
                <MobileControls onInputChange={onMobileInput} onPlanRoute={onPlanRoute} />
            )}

            {lidarScan && <LidarPanel data={lidarScan} lang={language} />}

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} lang={language} onLanguageChange={onLanguageChange} brightness={brightness} onBrightnessChange={onBrightnessChange} shadowContrast={shadowContrast} onShadowChange={onShadowChange} chromaticAberration={chromaticAberration} onChromaticToggle={onChromaticToggle} apiKey={apiKey} onApiKeyChange={onApiKeyChange} aiModel={aiModel || 'gemini-3-flash'} onAiModelChange={onAiModelChange} waypointCount={waypointCount} onWaypointCountChange={onWaypointCountChange} onToggleCalibration={onToggleCalibration} />

            <div style={{ position: 'absolute', bottom: '5px', right: '10px', color: '#888888', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', pointerEvents: 'none' }}>{VERSION}</div>
        </div>
    );
}
