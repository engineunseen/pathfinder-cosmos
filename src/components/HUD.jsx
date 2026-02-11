// components/HUD.jsx — Sci-Fi HUD overlay (NVIDIA Drive / SpaceX Dragon style)
import React, { useState, useCallback, useRef } from 'react';
import { STRINGS } from '../i18n';
import { COLORS as C, WARNING_ANGLE } from '../store';

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
            <h2 className="panel-title">{t.telemetry}</h2>
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
        </CornerBrackets>
    );
}

// Mission Control panel (Top Right)
function MissionPanel({ targetDistance, lang, elapsedTime, onNewTerrain, version }) {
    const t = STRINGS[lang];

    return (
        <CornerBrackets className="panel-mission">
            <h2 className="panel-title">{t.missionControl}</h2>
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
            <button className="hud-button" onClick={onNewTerrain}>
                <span className="btn-bracket">[</span>
                {t.generateNewLandscape}
                <span className="btn-bracket">]</span>
            </button>
        </CornerBrackets>
    );
}

// Bottom Control Panel
function ControlPanel({ aiMode, lang, onSetAIMode, gameState }) {
    const t = STRINGS[lang];

    return (
        <CornerBrackets className="panel-controls">
            {gameState === 'playing' && (
                <>
                    <div className="ai-status">
                        {aiMode === 'autopilot' ? (
                            <span className="ai-active-text pulse">{t.autopilotActive}</span>
                        ) : aiMode === 'assist' ? (
                            <span className="ai-active-text pulse">{t.computingTrajectories}</span>
                        ) : (
                            <span className="ai-prompt">{t.navigatePrompt}</span>
                        )}
                    </div>
                    <div className="mode-selector">
                        {[
                            { key: 'off', label: t.manualPilot },
                            { key: 'assist', label: t.monteCarloAssist },
                            { key: 'autopilot', label: t.autopilot },
                        ].map(m => (
                            <button
                                key={m.key}
                                className={`mode-btn ${aiMode === m.key ? 'active' : ''}`}
                                onClick={() => onSetAIMode(m.key)}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </CornerBrackets>
    );
}

// Game Over overlay
function GameOverOverlay({ reason, lang, onRestart, safetyScore, elapsedTime }) {
    const t = STRINGS[lang];
    const isSuccess = reason === 'success';

    return (
        <div className="game-over-overlay">
            <CornerBrackets className="game-over-panel">
                <h1 className={`game-over-title ${isSuccess ? 'success' : 'failure'}`}>
                    {isSuccess ? t.success : t.gameOver}
                </h1>
                {!isSuccess && (
                    <p className="fail-reason">
                        {reason === 'rollover' && t.criticalFailure}
                        {reason === 'stuck' && t.stuck}
                        {reason === 'damage' && t.damage}
                    </p>
                )}
                <div className="score-row">
                    <span>{t.safetyScore}:</span>
                    <span style={{ color: C.SAFE_PATH }}>{safetyScore}</span>
                </div>
                <div className="score-row">
                    <span>{t.time}:</span>
                    <span style={{ color: C.PRIMARY_INFO }}>{elapsedTime.toFixed(1)}s</span>
                </div>
                <button className="hud-button restart-btn" onClick={onRestart}>
                    <span className="btn-bracket">[</span>
                    {t.restart}
                    <span className="btn-bracket">]</span>
                </button>
            </CornerBrackets>
        </div>
    );
}

// Settings Modal component
function SettingsModal({ isOpen, onClose, lang, onLanguageChange }) {
    if (!isOpen) return null;
    const t = STRINGS[lang];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <CornerBrackets className="settings-panel" onClick={e => e.stopPropagation()}>
                <h2 className="panel-title">{t.settings}</h2>
                <div className="settings-row">
                    <span className="label">{t.language}:</span>
                    <div className="language-selector">
                        {['EN', 'RU', 'UA'].map((l) => (
                            <button
                                key={l}
                                className={`lang-btn ${lang === l ? 'active' : ''}`}
                                onClick={() => onLanguageChange(l)}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
                <button className="hud-button close-btn" onClick={onClose}>
                    <span className="btn-bracket">[</span>
                    {t.close}
                    <span className="btn-bracket">]</span>
                </button>
            </CornerBrackets>
        </div>
    );
}

// Top Center Logos
function TopLogos() {
    return (
        <div className="top-logos">
            <div className="logo-section nvidia-logo">
                <svg viewBox="0 0 100 20" className="logo-svg">
                    <path fill="#76b900" d="M10,0 C4.5,0 0,4.5 0,10 C0,15.5 4.5,20 10,20 C15.5,20 20,15.5 20,10 C20,4.5 15.5,0 10,0 Z M10,18 C5.6,18 2,14.4 2,10 C2,5.6 5.6,2 10,2 C14.4,2 18,5.6 18,10 C18,14.4 14.4,18 10,18 Z M10,4 C11.1,4 12,4.9 12,6 C12,7.1 11.1,8 10,8 C8.9,8 8,7.1 8,6 C8,4.9 8.9,4 10,4 Z M10,12 C7.8,12 6,10.2 6,8 C6,7.5 6.1,7 6.3,6.6 C6.7,6.2 7.3,6 8,6 L8,8 C8,9.1 8.9,10 10,10 L10,12 Z M14,10 C14,12.2 12.2,14 10,14 L10,16 C13.3,16 16,13.3 16,10 C16,9.5 15.9,9 15.7,8.6 C15.3,8.2 14.7,8 14,8 L14,10 Z" />
                    <text x="25" y="15" fill="white" fontSize="12" fontWeight="bold">NVIDIA</text>
                </svg>
            </div>
            <div className="logo-divider" />
            <div className="logo-section unseen-logo">
                <span className="unseen-u">U</span>
                <span className="unseen-text">UNSEEN</span>
            </div>
        </div>
    );
}

function ControlsHint({ lang }) {
    const t = STRINGS[lang];
    return <div className="controls-hint">{t.controls}</div>;
}

function MobileControls({ onInputChange }) {
    const joystickRef = useRef(null);
    const knobRef = useRef(null);
    const touchStartPos = useRef({ x: 0, y: 0 });
    const isActive = useRef(false);

    const handleTouchStart = useCallback((e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = joystickRef.current.getBoundingClientRect();
        touchStartPos.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
        isActive.current = true;
    }, []);

    const handleTouchMove = useCallback((e) => {
        e.preventDefault();
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
        isActive.current = false;
        onInputChange({ forward: 0, backward: 0, left: 0, right: 0 });
        if (knobRef.current) {
            knobRef.current.style.transform = 'translate(0, 0)';
        }
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
                className="mobile-ai-btn"
                onTouchStart={(e) => { e.preventDefault(); onInputChange({ toggleAI: true }); }}
            >
                AI<br />SCAN
            </button>
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

export default function HUD({
    telemetry,
    targetDistance,
    aiMode,
    gameState,
    failReason,
    safetyScore,
    elapsedTime,
    language,
    isMobile,
    onToggleAI,
    onSetAIMode,
    onNewTerrain,
    onRestart,
    onLanguageChange,
    onMobileInput,
}) {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    return (
        <div className="hud-overlay">
            {/* Top Center: Branding */}
            <TopLogos />

            {/* Top Left: Telemetry */}
            <TelemetryPanel telemetry={telemetry} lang={language} />

            {/* Settings Toggle */}
            <button className="settings-toggle" onClick={() => setIsSettingsOpen(true)}>
                ⚙
            </button>

            {/* Top Right: Mission Control */}
            <MissionPanel
                targetDistance={targetDistance}
                lang={language}
                elapsedTime={elapsedTime}
                onNewTerrain={onNewTerrain}
            />

            {/* Bottom Center: Controls */}
            <ControlPanel
                aiMode={aiMode}
                lang={language}
                onSetAIMode={onSetAIMode}
                gameState={gameState}
            />

            {/* AI Mode indicator */}
            {aiMode !== 'off' && gameState === 'playing' && (
                <div className="ai-indicator">
                    <div className="ai-status-row">
                        <div className="ai-dot pulse-dot" />
                        <span className="ai-title">{aiMode === 'autopilot' ? STRINGS[language].autopilotActive : STRINGS[language].aiActive}</span>
                    </div>
                    <div className="ai-calculating">
                        <span className="blink-text">CALCULATING TRAJECTORIES...</span>
                    </div>
                </div>
            )}

            {/* Controls hint (desktop only) */}
            {!isMobile && gameState === 'playing' && (
                <ControlsHint lang={language} />
            )}

            {/* Mobile controls */}
            {isMobile && gameState === 'playing' && (
                <MobileControls onInputChange={onMobileInput} />
            )}

            {/* Game over overlay */}
            {(gameState === 'gameover' || gameState === 'success') && (
                <GameOverOverlay
                    reason={gameState === 'success' ? 'success' : failReason}
                    lang={language}
                    onRestart={onRestart}
                    safetyScore={safetyScore}
                    elapsedTime={elapsedTime}
                />
            )}

            {/* Settings Modal */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                lang={language}
                onLanguageChange={onLanguageChange}
            />

            {/* Version Display */}
            <div style={{
                position: 'absolute',
                bottom: '5px',
                right: '10px',
                color: 'rgba(255, 255, 255, 0.3)',
                fontSize: '10px',
                fontFamily: 'monospace',
                pointerEvents: 'none'
            }}>
                v0.3.5-alpha
            </div>
        </div>
    );
}
