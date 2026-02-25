/**
 * @file src/pages/Player.jsx
 * @description Interactive drafting tray for the players.
 * Features a dynamic grid architecture, velvet background, cinematic 3D reveal,
 * and support for both shared-tablet and single-tablet device modes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../utils/socket';
import { en } from '../locales/en';
import '../App.css';
import './Player.css';

const Player = () => {
  const text = en.player;
  const [gameState, setGameState] = useState(null);
  const [revealedRole, setRevealedRole] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  const prevIsRevealed = useRef(false);

  useEffect(() => {
    const handleStateUpdate = (state) => setGameState(state);
    const handlePrivateReveal = (roleData) => setRevealedRole(roleData.role);
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('STATE_UPDATE', handleStateUpdate);
    socket.on('PRIVATE_ROLE_REVEAL', handlePrivateReveal);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) socket.emit('REQUEST_STATE');

    return () => {
      socket.off('STATE_UPDATE', handleStateUpdate);
      socket.off('PRIVATE_ROLE_REVEAL', handlePrivateReveal);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  useEffect(() => {
    if (gameState) {
      if (prevIsRevealed.current === true && gameState.isCardRevealed === false) {
        setRevealedRole(null);
      }
      prevIsRevealed.current = gameState.isCardRevealed;
    }
  }, [gameState?.isCardRevealed]);

  if (!gameState) return <div className="waiting-container"><div className="waiting-spinner"></div></div>;

  // --- FEATURE: SINGLE MODE (Dormant) ---
  const isSingleMode = gameState.settings?.singleMode || false; 
  const clientSeat = gameState.assignedSeat || 'Unassigned'; 
  const isMyTurn = !isSingleMode || (gameState.activeSeat === clientSeat);

  const handlePickCard = (slotIndex) => {
    if (!gameState.isTrayUnlocked || revealedRole) return;
    if (isSingleMode && !isMyTurn) return; 
    
    socket.emit('PICK_CARD', slotIndex);
  };

  const handleMemorized = () => {
    setRevealedRole(null);
    socket.emit('MEMORIZED_ROLE');
  };

  // --- DYNAMIC GRID MATH ---
  const pickedSlots = gameState.pickedSlots || Object.values(gameState.results || {}).map(r => r.slotIndex).filter(idx => idx !== undefined);
  const availableSlots = gameState.availableSlots || Array.from({ length: 10 }, (_, i) => i).filter(i => !pickedSlots.includes(i));
  
  const totalCards = availableSlots.length;
  let topRow = [];
  let bottomRow = [];

  if (totalCards <= 5) {
    topRow = availableSlots;
  } else {
    const topCount = Math.ceil(totalCards / 2);
    topRow = availableSlots.slice(0, topCount);
    bottomRow = availableSlots.slice(topCount);
  }

  // --- BACKGROUND WARNING LOGIC ---
  let warningElement = null;
  if (!isConnected) {
    warningElement = <div className="tray-background-warning warning-disconnect">{text.warningDisconnect}</div>;
  } else if (gameState.isDebugMode) {
    warningElement = <div className="tray-background-warning warning-debug">{text.warningDebug}</div>;
  }

  return (
    <div className="player-tray-container">
      
      {/* BACKGROUND WARNINGS */}
      {warningElement}

      {/* DRAFT TRAY */}
      <div className="tray-layout">
        
        {(!gameState.isTrayUnlocked || (isSingleMode && !isMyTurn)) && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '2px', position: 'absolute', top: '2rem' }}>
            {text.waitingTitle}
          </div>
        )}

        <div className="card-row">
          {topRow.map((slotIndex) => (
            <div 
              key={`slot-${slotIndex}`} 
              className={`card-slot ${(!gameState.isTrayUnlocked || (isSingleMode && !isMyTurn)) ? 'locked' : ''}`}
              onClick={() => handlePickCard(slotIndex)}
            >
              <div className="card-inner">
                <div className="card-front"></div>
              </div>
            </div>
          ))}
        </div>

        {bottomRow.length > 0 && (
          <div className="card-row">
            {bottomRow.map((slotIndex) => (
              <div 
                key={`slot-${slotIndex}`} 
                className={`card-slot ${(!gameState.isTrayUnlocked || (isSingleMode && !isMyTurn)) ? 'locked' : ''}`}
                onClick={() => handlePickCard(slotIndex)}
              >
                <div className="card-inner">
                  <div className="card-front"></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SINGLE MODE: SEAT INDICATOR */}
      {isSingleMode && (
        <div style={{ position: 'absolute', bottom: '2rem', color: 'var(--accent-gold)', fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '3px', textTransform: 'uppercase', textShadow: '0 5px 15px rgba(0,0,0,0.8)' }}>
          {text.seat.replace('{number}', clientSeat)}
        </div>
      )}

      {/* CINEMATIC REVEAL OVERLAY */}
      {revealedRole && (
        <div className="cinematic-overlay">
          <div className="revealed-card-container">
            <div className="revealed-card-inner">
              <div className="card-front"></div>
              <div 
                className="card-back" 
                style={{ backgroundImage: `url('/roles/${revealedRole.toLowerCase()}.jpg')` }}
              ></div>
            </div>
          </div>
          
          <button className="revealed-memorize-btn" onClick={handleMemorized}>
            {text.memorizedBtn}
          </button>
        </div>
      )}

    </div>
  );
};

export default Player;