// components/HUD.jsx — Sci-Fi HUD overlay (NVIDIA Drive / SpaceX Dragon style)
import React, { useState, useCallback, useRef, memo, useEffect } from 'react';
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
function TelemetryPanel({ telemetry, lang, navigationOverlay, style, onToggleHelp }) {
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
            {navigationOverlay && telemetry.sCVaR !== undefined && (
                <div className="telemetry-row" style={{ marginTop: '5px', borderTop: '1px solid rgba(0, 255, 255, 0.2)', paddingTop: '5px' }}>
                    <span className="label">sCVaR_α:</span>
                    <span className="value" style={{
                        color: telemetry.sCVaR > 0.8 ? C.CRITICAL_PATH : telemetry.sCVaR > 0.4 ? C.WARNING_PATH : C.SAFE_PATH
                    }}>
                        {parseFloat(telemetry.sCVaR).toFixed(2)}
                    </span>
                </div>
            )}
        </CornerBrackets>
    );
}

// Mission Panel (Top Right)
function MissionPanel({ targetDistance, lang, elapsedTime, onNewTerrain, onOpenSettings, telemetry, navigationOverlay, style }) {
    const t = STRINGS[lang];
    const sMar = parseFloat(telemetry.SMaR) || 0;
    const sMarColor = sMar > 0.8 ? C.CRITICAL_PATH : sMar > 0.4 ? C.WARNING_PATH : C.SAFE_PATH;

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
            {navigationOverlay && (
                <div className="telemetry-row" style={{ marginTop: '5px', borderTop: '1px solid rgba(0, 255, 255, 0.1)', paddingTop: '5px' }}>
                    <span className="label">SMaR_α:</span>
                    <span className="value" style={{ color: sMarColor }}>{sMar.toFixed(2)}</span>
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

// Bottom Control Panel
function ControlPanel({ driveMode, lang, onSetDriveMode, simulationState, failReason, navigationOverlay, onToggleNav, onPlanRoute, isAiOnline, isAiPlanning, isMcCalculating, aiQuote }) {
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
            transition: 'transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
            pointerEvents: 'auto'
        }}>

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
                    disabled={simulationState !== 'running'}
                >
                    <div className="inner-frame" />
                    <span style={{ fontSize: '10px', opacity: 0.7, display: 'block' }}>{t.driveMode}</span>
                    {driveMode === 'autopilot' ? t.autopilot : t.manual}
                </button>

                <button
                    className={`mode-btn ${navigationOverlay ? 'active-overlay' : ''}`}
                    onClick={(e) => {
                        console.log("[UI] Overlay Toggle Clicked. Current state:", navigationOverlay);
                        onToggleNav();
                    }}
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
                    {!isSuccess && <div className="detail-row" style={{ color: '#FF0055' }}><span>STATUS:</span> <span>STABILITY BREACH - ROVER LOST</span></div>}
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

// Settings Modal
function SettingsModal({
    isOpen, onClose, lang, onLanguageChange, brightness, onBrightnessChange, shadowContrast, onShadowChange,
    chromaticAberration, onChromaticToggle, apiKey, onApiKeyChange, aiModel, onAiModelChange,
    waypointCount, onWaypointCountChange, onToggleCalibration,
    arrivalAccuracy, onAccuracyChange, aiUseMonteCarlo, onAiUseMcToggle, aiUsePath, onAiUsePathToggle,
    terrainMode, onTerrainModeChange,
    nvidiaNimUrl, onUrlChange, nvidiaApiKey, onNvApiKeyChange
}) {
    if (!isOpen) return null;
    const { isCalibrationMode } = useSimulationState();
    const t = STRINGS[lang];
    const [localBrightness, setLocalBrightness] = React.useState(brightness || 1.2);
    React.useEffect(() => { setLocalBrightness(brightness || 1.2); }, [brightness]);

    const handleSliderChange = (e) => {
        const val = parseFloat(e.target.value);
        setLocalBrightness(val);
        onBrightnessChange(val);
    };

    const handleReset = () => {
        const defaultBrightness = 1.2, defaultShadow = 0.5;
        setLocalBrightness(defaultBrightness);
        onBrightnessChange(defaultBrightness);
        onShadowChange(defaultShadow);
        if (chromaticAberration) onChromaticToggle();
    };

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
                </div>
                <div className="settings-row" style={{ display: 'block' }}>
                    <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>TERRAIN MODE:</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[['legacy', 'LEGACY'], ['naturalist', 'NATURALIST'], ['ethereal', 'ETHEREAL']].map(([val, label]) => (
                            <button
                                key={val}
                                className={`hud-button ${terrainMode === val ? 'active' : ''}`}
                                style={{ flex: 1, margin: 0, fontSize: '9px' }}
                                onClick={() => onTerrainModeChange(val)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: '9px', color: 'rgba(0,255,255,0.4)', marginTop: '4px' }}>
                        {terrainMode === 'legacy' ? 'Noise + craters + rocks' :
                            terrainMode === 'naturalist' ? 'Smooth rolling hills' :
                                'Monumental sine waves'}
                    </div>
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
                                style={{ flex: 1, margin: 0, fontSize: '10px' }}
                                onClick={() => onWaypointCountChange(cnt)}
                            >
                                {cnt === 7 ? `${t.low} (7)` : cnt === 15 ? `${t.med} (15)` : `${t.ultra} (25)`}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="settings-row" style={{ display: 'block' }}>
                    <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>{t.accuracy}:</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[15.0, 5.0, 1.5].map(acc => (
                            <button
                                key={acc}
                                className={`hud-button ${arrivalAccuracy === acc ? 'active' : ''}`}
                                style={{ flex: 1, margin: 0, fontSize: '10px' }}
                                onClick={() => onAccuracyChange(acc)}
                            >
                                {acc === 15.0 ? t.easy : acc === 5.0 ? t.normal : t.hard} ({acc}m)
                            </button>
                        ))}
                    </div>
                </div>
                <div className="settings-row" style={{ display: 'block' }}>
                    <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>AI INTELLIGENCE:</span>
                    <button
                        className={`hud-button ${aiUseMonteCarlo ? 'active' : ''}`}
                        style={{ width: '100%', marginBottom: '8px' }}
                        onClick={() => onAiUseMcToggle(!aiUseMonteCarlo)}
                    >
                        {t.useMonteCarlo}
                    </button>
                    <button
                        className={`hud-button ${aiUsePath ? 'active' : ''}`}
                        style={{ width: '100%' }}
                        onClick={() => onAiUsePathToggle(!aiUsePath)}
                    >
                        {t.usePlannedPath}
                    </button>
                </div>

                <div className="settings-row" style={{ display: 'block' }}>
                    <span className="label" style={{ marginBottom: '8px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>AI MODEL IDENTITY:</span>
                    <select
                        value={aiModel || 'gemini-3-flash-preview'}
                        onChange={(e) => onAiModelChange(e.target.value)}
                        style={{ width: '100%', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #00FFFF', color: '#00FFFF', padding: '8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none', cursor: 'pointer', marginBottom: '12px' }}
                    >
                        <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                        <option value="cosmos-reasoning">NVIDIA Cosmos (Cookoff)</option>
                    </select>

                    {aiModel === 'cosmos-reasoning' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'rgba(0,255,255,0.05)', border: '1px solid rgba(0,255,255,0.2)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '9px', color: 'rgba(0,255,255,0.6)' }}>NIM ENDPOINT URL:</span>
                                <input
                                    className="api-input"
                                    value={nvidiaNimUrl}
                                    onChange={(e) => onUrlChange(e.target.value)}
                                    placeholder="http://IP_ADDRESS:8000"
                                    style={{ background: 'rgba(0,0,0,0.5)', width: '100%', border: '1px solid rgba(0,255,255,0.3)', color: '#00FFFF', padding: '6px', fontSize: '11px' }}
                                    onPointerDownCapture={(e) => { e.stopPropagation(); }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '9px', color: 'rgba(0,255,255,0.6)' }}>NVIDIA API KEY (NIM):</span>
                                <input
                                    className="api-input"
                                    type="password"
                                    value={nvidiaApiKey}
                                    onChange={(e) => onNvApiKeyChange(e.target.value)}
                                    placeholder="nv-nim-..."
                                    style={{ background: 'rgba(0,0,0,0.5)', width: '100%', border: '1px solid rgba(0,255,255,0.3)', color: '#00FFFF', padding: '6px', fontSize: '11px' }}
                                    onPointerDownCapture={(e) => { e.stopPropagation(); }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '9px', color: 'rgba(0,255,255,0.6)' }}>{t.geminiApiKey}:</span>
                            <input
                                type="password"
                                value={apiKey || ''}
                                onChange={(e) => onApiKeyChange(e.target.value)}
                                placeholder="Enter Gemini Key..."
                                style={{ width: '100%', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #00FFFF', color: '#00FFFF', padding: '8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }}
                                onPointerDownCapture={(e) => { e.stopPropagation(); }}
                            />
                        </div>
                    )}
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

function TopLogos({ aiModel, uiVisible }) {
    const { terminalOpen } = useSimulationState();
    if (!uiVisible) return null;
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
                        <li style={{ marginBottom: '15px', borderLeft: '2px solid rgba(0, 255, 255, 0.3)', paddingLeft: '10px' }}><span style={{ color: '#FFBF00', fontWeight: 'bold', display: 'block', fontSize: '10px', marginBottom: '4px' }}>UNSEEN CORE (DIGITAL TWIN)</span> {t.core}</li>
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

export default function HUD(props) {
    const {
        telemetry, targetDistance, driveMode, simulationState, failReason, safetyScore, elapsedTime, language, isMobile, onSetDriveMode, onNewTerrain, onRestart,
        onLanguageChange, onMobileInput, brightness, onBrightnessChange, shadowContrast, onShadowChange, chromaticAberration, onChromaticToggle, riskMetrics,
        apiKey, onApiKeyChange, isAiOnline, aiQuote, navigationOverlay, onToggleNav, aiModel, onAiModelChange,
        isAiPlanning, isMcCalculating, onPlanRoute,
        lidarScan, waypointCount, onWaypointCountChange, onToggleCalibration,
        terrainMode, onTerrainModeChange,
        nvidiaNimUrl, onUrlChange, nvidiaApiKey, onNvApiKeyChange,
        capturedFrame
    } = props;
    const { terminalOpen } = useSimulationState();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const isVisible = props.uiVisible !== false;
    const hudShiftClass = (terminalOpen && !isMobile) ? 'terminal-visible' : '';
    const visibilityClass = isVisible ? '' : 'hud-panels-hidden';
    const t = STRINGS[language];

    return (
        <>
            <div className={`hud-overlay ${hudShiftClass} ${visibilityClass}`} style={{ pointerEvents: 'none' }}>
                <button
                    className="cinematic-toggle"
                    onClick={() => props.onToggleUI()}
                    title={t.cinematicMode}
                    style={{ position: 'fixed', left: '0', top: '50%', transform: 'translateY(-50%)', writingMode: 'vertical-rl', textOrientation: 'mixed', padding: '20px 6px', borderRadius: '0 4px 4px 0', height: 'auto', minHeight: '120px' }}
                >
                    {isVisible ? 'HIDE INTERFACE' : 'RESTORE HUD'}
                </button>

                <TopLogos aiModel={aiModel} uiVisible={isVisible} />

                {isVisible && (
                    <>
                        <TelemetryPanel telemetry={{ ...telemetry, sCVaR: riskMetrics?.sCVaR }} lang={language} navigationOverlay={navigationOverlay} onToggleHelp={() => props.onToggleHelp()} />
                        <MissionPanel targetDistance={targetDistance} lang={language} elapsedTime={elapsedTime} onNewTerrain={onNewTerrain} onOpenSettings={() => setIsSettingsOpen(true)} telemetry={{ SMaR: riskMetrics?.SMaR }} navigationOverlay={navigationOverlay} />
                    </>
                )}

                <ControlPanel
                    driveMode={driveMode} lang={language} onSetDriveMode={onSetDriveMode} simulationState={simulationState} failReason={failReason} navigationOverlay={navigationOverlay} onToggleNav={onToggleNav} onPlanRoute={onPlanRoute}
                    isAiOnline={isAiOnline} isAiPlanning={isAiPlanning} isMcCalculating={isMcCalculating} aiQuote={aiQuote}
                />

                <TerminalPanel />

                {(!isAiOnline && driveMode === 'autopilot') && (
                    <div className="offline-warning-box unseen-core-active">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="core-icon-pulse" />
                            <div>
                                <span style={{ fontWeight: 'bold', letterSpacing: '2px' }}>{STRINGS[language].unseenCore}:</span>
                                <span style={{ marginLeft: '5px', opacity: 0.8 }}>{STRINGS[language].digitalTwin}</span>
                            </div>
                        </div>
                    </div>
                )}

                {isMobile && simulationState === 'running' && (
                    <MobileControls onInputChange={onMobileInput} onPlanRoute={onPlanRoute} />
                )}

                {lidarScan && isVisible && <LidarPanel data={lidarScan} lang={language} />}

                <SettingsModal
                    isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} lang={language} onLanguageChange={onLanguageChange} brightness={brightness} onBrightnessChange={onBrightnessChange}
                    shadowContrast={shadowContrast} onShadowChange={onShadowChange} chromaticAberration={chromaticAberration} onChromaticToggle={onChromaticToggle}
                    apiKey={apiKey} onApiKeyChange={onApiKeyChange} aiModel={aiModel || 'gemini-3-flash-preview'} onAiModelChange={onAiModelChange}
                    waypointCount={waypointCount} onWaypointCountChange={onWaypointCountChange} onToggleCalibration={onToggleCalibration}
                    arrivalAccuracy={props.arrivalAccuracy} onAccuracyChange={props.onAccuracyChange} aiUseMonteCarlo={props.aiUseMonteCarlo} onAiUseMcToggle={props.onAiUseMcToggle} aiUsePath={props.aiUsePath} onAiUsePathToggle={props.onAiUsePathToggle}
                    terrainMode={terrainMode} onTerrainModeChange={onTerrainModeChange}
                    nvidiaNimUrl={nvidiaNimUrl} onUrlChange={onUrlChange}
                    nvidiaApiKey={nvidiaApiKey} onNvApiKeyChange={onNvApiKeyChange}
                />

                {/* v3.1.0: Vision Debug Overlay */}
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

                <HelpModal isOpen={props.helpOpen} onClose={() => props.onToggleHelp()} lang={language} />

                <div style={{ position: 'absolute', bottom: '5px', right: '10px', color: '#888888', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', pointerEvents: 'none' }}>{VERSION}</div>
            </div>

            {(simulationState === 'success' || simulationState === 'failed') && (
                <OutcomeOverlay
                    reason={simulationState} lang={language} onRestart={onRestart} onNewTerrain={onNewTerrain} safetyScore={safetyScore} elapsedTime={elapsedTime}
                />
            )}
        </>
    );
}
