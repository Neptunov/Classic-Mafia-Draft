/**
 * @file src/pages/JudgeView.jsx
 * @description Moderator dashboard for tracking the draft phase.
 * Features a dynamic 1-10 list with strict team-based color coding.
 */

import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Users, Play, Unlock, XSquare, RotateCcw, Wifi } from 'lucide-react';
import { socket } from '../utils/socket';
import { useLanguage } from '../utils/LanguageContext';
import packageJson from '../../package.json';
import '../App.css'; 
import './Judge.css'; 

const JudgeView = () => {
  const { text: dictionary } = useLanguage();
  const text = dictionary.judge;
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const handleStateUpdate = (state) => setGameState(state);
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    
    socket.on('STATE_UPDATE', handleStateUpdate);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    
    return () => {
      socket.off('STATE_UPDATE', handleStateUpdate);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  if (!gameState) return <div className="waiting-container"><div className="waiting-spinner"></div></div>;

  // --- COLOR CODING LOGIC ---
  const getSeatStyles = (role) => {
    if (!role) return { bg: 'bg-empty', text: '' };
    
    const isTown = role === 'Citizen' || role === 'Sheriff';
    const isSpecial = role === 'Sheriff' || role === 'Don';

    return {
      bg: isTown ? 'bg-town' : 'bg-mafia',
      text: isSpecial ? 'text-special' : 'text-regular'
    };
  };

  // --- RENDER HELPERS ---
  const seats = Array.from({ length: 10 }, (_, i) => i + 1);
  const pCount = gameState.clientCounts?.PLAYER || 0;
  const jCount = gameState.clientCounts?.JUDGE || 0;

  return (
    <div className="lobby-container">
      
      {/* STANDARD HEADER */}
      <header className="lobby-header">
        <div className="status-indicator">
          <Wifi color={isConnected ? "var(--text-white)" : "var(--accent-red)"} size={20} />
          <span style={{ color: isConnected ? "var(--text-white)" : "var(--accent-red)" }}>
            {isConnected ? text.connected : text.disconnected}
          </span>
        </div>
        
        {gameState.isDebugMode && (
          <div className="debug-mode">
            <ShieldAlert size={20} />
            <span>{text.debugActive}</span>
          </div>
        )}
      </header>

      {/* BODY (Using flex: 1 to push the footer to the bottom) */}
      <div className="judge-container" style={{ flex: 1 }}>
        
        {/* LEFT COLUMN: CONTROLS */}
        <aside className="judge-controls-sidebar">
          <div className="login-card" style={{ padding: '2rem', maxWidth: '100%' }}>
            
            <div className="judge-header">
              <h2>{text.title}</h2>
              <div className="judge-stats">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Users size={16} /> {text.players.replace('{count}', pCount)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={16} /> {text.judges.replace('{count}', jCount)}
                </span>
              </div>
              <p style={{ color: gameState.status === 'COMPLETED' ? 'var(--accent-gold)' : '#aaa' }}>
                {gameState.status === 'PENDING' ? text.statusPending : 
                 gameState.status === 'IN_PROGRESS' ? text.statusInProgress : text.statusCompleted}
              </p>
            </div>

            <div className="controls-grid">

              {/* 1. START DRAFT */}
              {gameState.status === 'PENDING' && (
                <button 
                  className="primary-btn"
                  disabled={!gameState.areRolesLocked}
                  onClick={() => socket.emit('START_DRAFT')}
                  style={{ opacity: gameState.areRolesLocked ? 1 : 0.5, backgroundColor: '#2e7d32' }}
                >
                  <Play size={18} /> {text.startDraft}
                </button>
              )}

              {/* 2. UNLOCK TRAY */}
              {gameState.status === 'IN_PROGRESS' && (
                <button 
                  className="primary-btn" 
                  disabled={gameState.isTrayUnlocked || gameState.isCardRevealed}
                  onClick={() => socket.emit('UNLOCK_TRAY')}
                  style={{ opacity: (gameState.isTrayUnlocked || gameState.isCardRevealed) ? 0.5 : 1 }}
                >
                  <Unlock size={18} /> {text.unlockTray}
                </button>
              )}

              {/* 3. DYNAMIC BUTTON: FORCE PICK or CLOSE CARD */}
              {gameState.status === 'IN_PROGRESS' && (
                <>
                  {gameState.isCardRevealed ? (
                    <button 
                      className="primary-btn" 
                      onClick={() => socket.emit('MEMORIZED_ROLE')}
                    >
                      <XSquare size={18} /> {text.closeCard}
                    </button>
                  ) : (
                    <button 
                      className="primary-btn" 
                      disabled={!gameState.isTrayUnlocked}
                      onClick={() => {
                        if (window.confirm(text.forcePickConfirm)) {
                          socket.emit('FORCE_PICK');
                        }
                      }}
                      style={{ backgroundColor: '#1976d2', opacity: gameState.isTrayUnlocked ? 1 : 0.5 }}
                    >
                      <ShieldAlert size={18} /> {text.forcePick}
                    </button>
                  )}
                </>
              )}

              {/* 4. RESET DRAFT */}
              <button 
                className="primary-btn" 
                onClick={() => {
                  if(window.confirm("Reset entire draft?")) socket.emit('RESET_DRAFT');
                }}
                style={{ backgroundColor: '#333', marginTop: '1rem' }}
              >
                <RotateCcw size={18} /> {text.resetDraft}
              </button>
            </div>
            
          </div>
        </aside>

        {/* RIGHT COLUMN: 1-10 TRACKING LIST */}
        <main className="judge-tracking-list">
          <div className="seat-list">
            {seats.map((seatNum) => {
              const drawData = gameState.results ? gameState.results[seatNum] : null;
              const role = drawData ? drawData.role : null;
              const styles = getSeatStyles(role);

              return (
                <div key={seatNum} className={`seat-row ${styles.bg}`}>
                  <span>{text.seat.replace('{number}', seatNum)}</span>
                  
                  <span className={styles.text}>
                    {role ? role : text.emptySeat}
                  </span>
                </div>
              );
            })}
          </div>
        </main>

      </div>

      {/* STANDARD FOOTER */}
      <footer className="lobby-footer" style={{ justifyContent: 'center' }}>
        <span className="version-text">v{packageJson.version}</span>
      </footer>

    </div>
  );
};

export default JudgeView;