/**
 * @file JudgeView.jsx
 * @description The live control panel for the game moderator. 
 * Allows the judge to open the draft tray, force picks for delayed players, and monitor the resulting deck.
 */
import { useState, useEffect } from 'react';
import { socket } from '../utils/socket';

export default function JudgeView() {
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    socket.on('STATE_UPDATE', setGameState);
    return () => socket.off('STATE_UPDATE');
  }, []);

  if (!gameState) return <div style={{ padding: '20px', color: 'white', backgroundColor: '#111827', minHeight: '100vh' }}>Connecting...</div>;

  const canStart = gameState.status === 'PENDING' && gameState.areRolesLocked;
  const isDrafting = gameState.status === 'IN_PROGRESS';

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', color: 'white', backgroundColor: '#111827', minHeight: '100vh' }}>
      
      {gameState.isDebugMode && (
        <div style={{ backgroundColor: '#dc2626', color: 'white', padding: '10px', textAlign: 'center', fontWeight: 'bold', borderRadius: '8px', marginBottom: '15px' }}>
          ⚠️ DEBUG MODE ACTIVE: DECK IS VISIBLE TO ADMIN
        </div>
      )}

      <h2 style={{ borderBottom: '1px solid #374151', paddingBottom: '10px' }}>Judge Control Panel</h2>

      {/* ACTION BUTTONS */}
      <div style={{ display: 'flex', gap: '15px', margin: '20px 0' }}>
        {gameState.status === 'PENDING' ? (
          <button 
            onClick={() => socket.emit('START_DRAFT')} disabled={!canStart}
            style={{ flex: 1, padding: '20px', fontSize: '18px', backgroundColor: canStart ? '#10b981' : '#374151', color: 'white', border: 'none', borderRadius: '8px', cursor: canStart ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
          >
            {canStart ? '▶ START DRAFT' : 'WAITING FOR ADMIN LOCK'}
          </button>
        ) : (
          <>
            <button 
              onClick={() => socket.emit('UNLOCK_TRAY')} 
              disabled={!isDrafting || gameState.isTrayUnlocked || gameState.isCardRevealed}
              style={{ flex: 2, padding: '20px', fontSize: '18px', backgroundColor: (isDrafting && !gameState.isTrayUnlocked && !gameState.isCardRevealed) ? '#3b82f6' : '#374151', color: 'white', border: 'none', borderRadius: '8px', cursor: (isDrafting && !gameState.isTrayUnlocked && !gameState.isCardRevealed) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
            >
              {gameState.isCardRevealed ? 'WAITING FOR PLAYER TO MEMORIZE...' : (gameState.isTrayUnlocked ? 'TRAY IS UNLOCKED' : `ALLOW PICK (Seat ${gameState.currentTurn})`)}
            </button>
            
            {gameState.isCardRevealed ? (
              <button 
                onClick={() => socket.emit('MEMORIZED_ROLE')}
                style={{ flex: 1, padding: '20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                CLOSE CARD
              </button>
            ) : (
              <button 
                onClick={() => { if(window.confirm("Force a random pick?")) socket.emit('FORCE_PICK') }} 
                disabled={!isDrafting}
                style={{ flex: 1, padding: '20px', backgroundColor: isDrafting ? '#d97706' : '#374151', color: 'white', border: 'none', borderRadius: '8px', cursor: isDrafting ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
              >
                FORCE PICK
              </button>
            )}
          </>
        )}
      </div>

      <div style={{ backgroundColor: '#1f2937', padding: '20px', borderRadius: '12px' }}>
        <h3>Draft Progress: {gameState.revealedSlots?.length || 0} / 10</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginTop: '10px' }}>
          {[...Array(10)].map((_, i) => {
            const seatNum = i + 1;
            const result = gameState.results[seatNum];
            
            let bgColor = '#374151'; 
            if (result) {
              if (result.role === 'Citizen') bgColor = '#dc2626'; 
              else if (result.role === 'Mafia' || result.role === 'Don') bgColor = '#000000'; 
              else if (result.role === 'Sheriff') bgColor = '#d97706'; 
            }

            return (
              <div key={i} style={{ 
                padding: '10px', textAlign: 'center', backgroundColor: bgColor, borderRadius: '6px', fontSize: '12px',
                border: result && (result.role === 'Mafia' || result.role === 'Don') ? '1px solid #4b5563' : 'none'
              }}>
                Seat {seatNum}<br/>
                <strong style={{ fontSize: '14px', letterSpacing: '0.5px' }}>
                  {result ? result.role.toUpperCase() : '---'}
                </strong>
                {result && (
                  <div style={{ fontSize: '10px', marginTop: '5px', opacity: 0.7 }}>
                    Card #{result.slotIndex + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button 
        onClick={() => { if(window.confirm("Reset entire draft?")) socket.emit('RESET_DRAFT') }}
        style={{ marginTop: '30px', width: '100%', padding: '10px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', cursor: 'pointer' }}
      >
        Reset Draft
      </button>
    </div>
  );
}