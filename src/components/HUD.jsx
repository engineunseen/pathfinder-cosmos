// components/HUD.jsx — Sci-Fi HUD overlay (NVIDIA Drive / SpaceX Dragon style)
import React, { useState, useCallback, useRef } from 'react';
import { STRINGS } from '../i18n';
import { COLORS as C, WARNING_ANGLE, VERSION } from '../store';

// Corner bracket decorator component
function CornerBrackets({ children, className = '', onClick }) {
    return (
        <div className={`hud-panel ${className}`} onClick={onClick}>
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
function TelemetryPanel({ telemetry, lang }) {
    const t = STRINGS[lang];
    const pitchVal = parseFloat(telemetry.pitch) || 0;
    const rollVal = parseFloat(telemetry.roll) || 0;
    const pitchColor = Math.abs(pitchVal) > WARNING_ANGLE ? C.CRITICAL_PATH : C.PRIMARY_INFO;
    const rollColor = Math.abs(rollVal) > WARNING_ANGLE ? C.CRITICAL_PATH : C.PRIMARY_INFO;

    return (
        <CornerBrackets className="panel-telemetry">
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
function MissionPanel({ targetDistance, lang, elapsedTime, onNewTerrain, onOpenSettings, telemetry }) {
    const t = STRINGS[lang];

    return (
        <CornerBrackets className="panel-mission">
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
    const t = STRINGS[lang];
    const isDual = driveMode === 'autopilot' && navigationOverlay;

    return (
        <CornerBrackets className="panel-controls">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(0, 255, 255, 0.3)', paddingBottom: '5px', minHeight: '28px' }}>
                <h2 className="panel-title" style={{ margin: 0, border: 'none', padding: 0 }}>{t.navAssist}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isAiOnline ? '#00FFFF' : '#FFBF00', boxShadow: `0 0 5px ${isAiOnline ? '#00FFFF' : '#FFBF00'}` }}></span>
                    <span style={{ opacity: 0.7 }}>{isAiOnline ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
            </div>

            {simulationState === 'running' && (
                <>
                    <div className="ai-status" style={{ marginBottom: '12px', minHeight: '16px' }}>
                        {isAiPlanning ? (
                            <span className="ai-active-text pulse" style={{ color: '#00FFFF', fontSize: '11px' }}>{t.planning}</span>
                        ) : isMcCalculating ? (
                            <span className="ai-active-text pulse" style={{ color: '#00FFFF', fontSize: '11px' }}>{t.recalculating}</span>
                        ) : !navigationOverlay && driveMode === 'manual' ? (
                            <span className="ai-prompt" style={{ fontSize: '11px' }}>{t.navigatePrompt}</span>
                        ) : null}
                    </div>

                    <div className="mode-selector" style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className={`mode-btn ${driveMode === 'autopilot' ? 'active-autopilot' : ''}`}
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

// Outcome overlay
function OutcomeOverlay({ reason, lang, onRestart, onNewTerrain, safetyScore, elapsedTime }) {
    const t = STRINGS[lang];
    const isSuccess = reason === 'success';
    return (
        <div className="game-over-overlay">
            <CornerBrackets className="game-over-panel">
                <h1 className={`game-over-title ${isSuccess ? 'success' : 'failure'}`}>{isSuccess ? 'MISSION SUCCESS' : 'MISSION TERMINATED'}</h1>
                {!isSuccess && <p className="fail-reason">{reason === 'rollover' && 'CRITICAL ROLLOVER DETECTED'}{reason === 'stuck' && 'ROVER IMMOBILIZED'}{reason === 'damage' && 'POWER SOURCE EXHAUSTED'}</p>}

                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                    <div className="score-row"><span>{t.safetyScore}:</span><span style={{ color: C.SAFE_PATH }}>{safetyScore}</span></div>
                    <div className="score-row"><span>{t.time}:</span><span style={{ color: C.PRIMARY_INFO }}>{elapsedTime.toFixed(1)}s</span></div>
                </div>

                <div style={{ width: '100%' }}>
                    <button className="hud-button" style={{ width: '100%', borderColor: C.ACCENT }} onClick={onNewTerrain}>
                        <span className="btn-bracket">[</span>{t.restartMission}<span className="btn-bracket">]</span>
                    </button>
                </div>
            </CornerBrackets>
        </div>
    );
}

// Settings Modal
function SettingsModal({ isOpen, onClose, lang, onLanguageChange, brightness, onBrightnessChange, shadowContrast, onShadowChange, chromaticAberration, onChromaticToggle, apiKey, onApiKeyChange, aiModel, onAiModelChange }) {
    if (!isOpen) return null;
    const t = STRINGS[lang];
    const [localBrightness, setLocalBrightness] = React.useState(brightness || 1.2);
    React.useEffect(() => { setLocalBrightness(brightness || 1.2); }, [brightness]);
    const handleSliderChange = (e) => { const val = parseFloat(e.target.value); setLocalBrightness(val); onBrightnessChange(val); };
    const handleReset = () => { const defaultBrightness = 1.2, defaultShadow = 0.5; setLocalBrightness(defaultBrightness); onBrightnessChange(defaultBrightness); onShadowChange(defaultShadow); if (chromaticAberration) onChromaticToggle(); };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <CornerBrackets className="settings-panel" onClick={e => e.stopPropagation()}>
                <h2 className="panel-title">{t.settings}</h2>
                <div className="settings-row"><span className="label">BRIGHTNESS:</span><div className="brightness-control" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><input type="range" min="0.1" max="3.0" step="0.1" value={localBrightness} onChange={handleSliderChange} onPointerDownCapture={(e) => { e.stopPropagation(); }} style={{ width: '150px', accentColor: '#00FFFF', cursor: 'pointer', pointerEvents: 'auto' }} /><span style={{ color: '#00FFFF', fontSize: '0.8em', width: '30px' }}>{localBrightness.toFixed(1)}</span></div></div>
                <div className="settings-row"><span className="label">SHADOWS:</span><div className="brightness-control" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><input type="range" min="0.0" max="1.0" step="0.05" value={shadowContrast || 0.5} onChange={(e) => onShadowChange(parseFloat(e.target.value))} onPointerDownCapture={(e) => { e.stopPropagation(); }} style={{ width: '150px', accentColor: '#00FFFF', cursor: 'pointer', pointerEvents: 'auto' }} /><span style={{ color: '#00FFFF', fontSize: '0.8em', width: '30px' }}>{(shadowContrast || 0.5).toFixed(2)}</span></div></div>
                <div className="settings-row"><span className="label">LENS FX:</span><button className="hud-button" style={{ margin: 0, borderColor: chromaticAberration ? '#00FF41' : 'rgba(255, 255, 255, 0.2)', color: chromaticAberration ? '#00FF41' : 'rgba(255, 255, 255, 0.5)', minWidth: '60px' }} onClick={onChromaticToggle}>{chromaticAberration ? 'ON' : 'OFF'}</button></div>
                <div style={{ marginTop: '15px', marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid rgba(0, 255, 255, 0.2)' }}><div className="settings-row" style={{ display: 'block' }}><span className="label" style={{ marginBottom: '5px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>AI MODEL (COST OPTIMIZED):</span><select value={apiKey && apiKey.startsWith('http') ? 'custom' : (aiModel || 'gemini-3-flash')} onChange={(e) => onAiModelChange(e.target.value)} style={{ width: '100%', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #00FFFF', color: '#00FFFF', padding: '8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none', cursor: 'pointer' }}><option value="gemini-3-flash">Gemini 3 Flash (Manual Planning)</option><option value="cosmos-reasoning">NVIDIA Cosmos Reasoning (Manual)</option></select></div><div className="settings-row" style={{ display: 'block' }}><span className="label" style={{ marginBottom: '5px', display: 'block', fontSize: '10px', letterSpacing: '2px' }}>{aiModel === 'cosmos-reasoning' ? 'COSMOS ENDPOINT URL:' : 'GEMINI API KEY:'}</span><input type="password" value={apiKey || ''} onChange={(e) => onApiKeyChange(e.target.value)} placeholder={aiModel === 'cosmos-reasoning' ? "https://..." : "Enter Key..."} style={{ width: '100%', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #00FFFF', color: '#00FFFF', padding: '8px', fontFamily: 'monospace', fontSize: '12px', outline: 'none' }} onPointerDownCapture={(e) => { e.stopPropagation(); }} /></div></div>
                <div style={{ marginTop: '10px', marginBottom: '20px' }}><button className="hud-button" style={{ width: '100%', borderColor: '#FFBF00', color: '#FFBF00', fontSize: '11px' }} onClick={handleReset}>RESET GRAPHICS</button></div>
                <div className="settings-row"><span className="label">{t.language}:</span><div className="language-selector">{['EN', 'RU', 'UA'].map((l) => (<button key={l} className={`lang-btn ${lang === l ? 'active' : ''}`} onClick={() => onLanguageChange(l)}>{l}</button>))}</div></div>
                <button className="hud-button close-btn" onClick={onClose}><span className="btn-bracket">[</span>{t.close}<span className="btn-bracket">]</span></button>
            </CornerBrackets >
        </div >
    );
}

function TopLogos() {
    return (
        <div className="top-logos">
            <div className="logo-section"><img src="/Nvidia_logo_.svg" alt="NVIDIA" style={{ height: '48px' }} /></div>
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
        isAiPlanning, isMcCalculating, onPlanRoute
    } = props;
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const quoteHeaders = {
        EN: "[AI CONNECTION VERIFIED] - STRATEGIC QUOTE:",
        RU: "[ИИ ПОДКЛЮЧЕН] - СТРАТЕГИЧЕСКАЯ ЦИТАТА:",
        UA: "[ШІ ПІДКЛЮЧЕНО] - СТРАТЕГІЧНА ЦИТАТА:"
    };

    return (
        <div className="hud-overlay">
            <TopLogos />
            <TelemetryPanel telemetry={{ ...telemetry, sCVaR: riskMetrics?.sCVaR }} lang={language} />
            <MissionPanel targetDistance={targetDistance} lang={language} elapsedTime={elapsedTime} onNewTerrain={onNewTerrain} onOpenSettings={() => setIsSettingsOpen(true)} telemetry={{ SMaR: riskMetrics?.SMaR }} />

            <ControlPanel
                driveMode={driveMode} lang={language} onSetDriveMode={onSetDriveMode} simulationState={simulationState} navigationOverlay={navigationOverlay} onToggleNav={onToggleNav}
                onPlanRoute={onPlanRoute} isAiOnline={isAiOnline} isAiPlanning={isAiPlanning} isMcCalculating={isMcCalculating} aiQuote={aiQuote}
            />

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
                <div style={{ position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255, 0, 0, 0.3)', padding: '10px 20px', borderRadius: '5px', border: '1px solid #ff0000', color: '#fff', zIndex: 1000, backdropFilter: 'blur(5px)', fontFamily: 'monospace', fontSize: '14px' }}>
                    <span style={{ fontWeight: 'bold' }}>⚠️ STRATEGIC OFFLINE:</span> AI KEY MISSING. USING HEURISTIC FALLBACK.
                </div>
            )}

            {isMobile && simulationState === 'running' && (
                <MobileControls onInputChange={onMobileInput} onPlanRoute={onPlanRoute} />
            )}

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} lang={language} onLanguageChange={onLanguageChange} brightness={brightness} onBrightnessChange={onBrightnessChange} shadowContrast={shadowContrast} onShadowChange={onShadowChange} chromaticAberration={chromaticAberration} onChromaticToggle={onChromaticToggle} apiKey={apiKey} onApiKeyChange={onApiKeyChange} aiModel={aiModel || 'gemini-3-flash'} onAiModelChange={onAiModelChange} />

            <div style={{ position: 'absolute', bottom: '5px', right: '10px', color: '#888888', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', pointerEvents: 'none' }}>{VERSION}</div>
        </div>
    );
}
