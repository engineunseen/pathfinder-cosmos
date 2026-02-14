import React, { useRef, useEffect } from 'react';
import { useSimulationState, useSimulationDispatch } from '../store';

const LOG_COLORS = {
    info: '#00FFFF',
    warning: '#FFBF00',
    critical: '#FF0055',
    system: '#FFFFFF'
};

export default function TerminalPanel() {
    const { logs, terminalOpen } = useSimulationState();
    const dispatch = useSimulationDispatch();
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [logs]);

    const toggleTerminal = () => dispatch({ type: 'TOGGLE_TERMINAL' });

    return (
        <div className={`terminal-sidebar ${terminalOpen ? 'open' : 'closed'}`}>
            <button className="terminal-toggle-handle" onClick={toggleTerminal}>
                <div className="handle-line" />
                <div className="handle-line" />
                <div className="handle-line" />
                <span className="handle-label">LOGS</span>
            </button>

            <div className="terminal-container">
                <div className="terminal-header">
                    <span className="terminal-title">SYSTEM TERMINAL v0.7.5-alpha</span>
                    <div className="terminal-status-dots">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                    </div>
                </div>
                <div className="terminal-content" ref={scrollRef}>
                    <div className="terminal-interline-overlay" />
                    {logs.map((log) => (
                        <div key={log.id} className={`terminal-line ${log.type}`}>
                            <span className="line-timestamp">[{log.timestamp || '--:--:--'}]</span>
                            <div className="line-body" style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                                <span className="line-text" style={{ color: LOG_COLORS[log.type] || LOG_COLORS.info }}>
                                    {log.text}
                                </span>
                                {log.image && (
                                    <div className="line-image-container" style={{ marginTop: '5px', border: '1px solid rgba(0, 255, 255, 0.2)', padding: '2px', background: 'rgba(0, 0, 0, 0.4)', alignSelf: 'flex-start' }}>
                                        <img
                                            src={`data:image/png;base64,${log.image}`}
                                            alt="LUNAR TOPOLOGY"
                                            style={{ width: '128px', height: '128px', display: 'block', imageRendering: 'pixelated' }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div className="terminal-scanline" />
                </div>
            </div>

            <style jsx>{`
                .terminal-sidebar {
                    position: fixed;
                    top: 0;
                    right: 0;
                    height: 100vh;
                    width: 320px;
                    background: rgba(0, 15, 15, 0.9);
                    border-left: 1px solid rgba(0, 255, 255, 0.3);
                    box-shadow: -5px 0 20px rgba(0, 0, 0, 0.5);
                    z-index: 1200;
                    transition: transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    display: flex;
                    backdrop-filter: blur(12px);
                    pointer-events: auto;
                }
                .terminal-sidebar.closed {
                    transform: translateX(320px);
                }
                .terminal-sidebar.open {
                    transform: translateX(0);
                }
                
                .terminal-toggle-handle {
                    position: absolute;
                    left: -30px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 30px;
                    height: 120px;
                    background: rgba(0, 40, 40, 0.8);
                    border: 1px solid rgba(0, 255, 255, 0.3);
                    border-right: none;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 0;
                    border-radius: 4px 0 0 4px;
                    transition: background 0.2s;
                    box-shadow: -2px 0 10px rgba(0, 255, 255, 0.1);
                }
                .terminal-toggle-handle:hover {
                    background: rgba(0, 255, 255, 0.15);
                }
                .handle-line {
                    width: 12px;
                    height: 1px;
                    background: rgba(0, 255, 255, 0.6);
                }
                .handle-label {
                    writing-mode: vertical-rl;
                    text-orientation: mixed;
                    color: rgba(0, 255, 255, 0.8);
                    font-size: 10px;
                    font-weight: bold;
                    letter-spacing: 2px;
                    margin-top: 4px;
                }

                .terminal-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    position: relative;
                }
                
                .terminal-header {
                    background: rgba(0, 255, 255, 0.05);
                    padding: 12px 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(0, 255, 255, 0.1);
                }
                .terminal-title {
                    color: rgba(0, 255, 255, 0.8);
                    font-size: 10px;
                    letter-spacing: 2px;
                    font-weight: bold;
                }
                .terminal-status-dots {
                    display: flex;
                    gap: 6px;
                }
                .terminal-status-dots .dot {
                    width: 5px;
                    height: 5px;
                    background: rgba(0, 255, 255, 0.3);
                    border-radius: 50%;
                }
                
                .terminal-content {
                    flex: 1;
                    padding: 15px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(0, 255, 255, 0.2) transparent;
                    position: relative;
                }

                /* INTERLINE SCANLINE EFFECT */
                .terminal-interline-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: repeating-linear-gradient(
                        transparent 0,
                        transparent 2px,
                        rgba(0, 255, 255, 0.03) 2px,
                        rgba(0, 255, 255, 0.03) 4px
                    );
                    pointer-events: none;
                    z-index: 5;
                }

                .terminal-content::-webkit-scrollbar {
                    width: 4px;
                }
                .terminal-content::-webkit-scrollbar-thumb {
                    background: rgba(0, 255, 255, 0.2);
                }
                
                .terminal-line {
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 11px;
                    line-height: 1.4;
                    display: flex;
                    gap: 10px;
                    animation: febFadeIn 0.3s ease-out;
                    z-index: 10;
                }
                .line-timestamp {
                    color: rgba(0, 255, 255, 0.4);
                    flex-shrink: 0;
                    font-size: 9px;
                }
                .line-text {
                    word-break: break-all;
                    text-shadow: 0 0 5px currentColor;
                    letter-spacing: 0.5px;
                }
                
                .terminal-scanline {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(
                        rgba(18, 16, 16, 0) 50%,
                        rgba(0, 0, 0, 0.2) 50%
                    ), linear-gradient(
                        90deg,
                        rgba(255, 0, 0, 0.04),
                        rgba(0, 255, 0, 0.01),
                        rgba(0, 255, 0, 0.04)
                    );
                    background-size: 100% 2px, 3px 100%;
                    pointer-events: none;
                    opacity: 0.1;
                }
                
                @keyframes febFadeIn {
                    from { opacity: 0; transform: translateX(10px); }
                    to { opacity: 1; transform: translateX(0); }
                }

                @media (max-width: 768px) {
                    .terminal-sidebar {
                        width: 260px;
                    }
                    .terminal-sidebar.closed {
                        transform: translateX(260px);
                    }
                }
            `}</style>
        </div>
    );
}
