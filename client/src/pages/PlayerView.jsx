import { useState, useEffect } from 'react';
import { socket } from '../utils/socket';

export default function PlayerView({ gameState }) {
  const [localReveal, setLocalReveal] = useState(null);

  useEffect(() => {
    // Listen for the server telling THIS specific client what card it picked
    const handleReveal = (data) => {
      setLocalReveal(data.role);
    };

    socket.on('CARD_REVEALED', handleReveal);
    return () => socket.off('CARD_REVEALED', handleReveal);
  }, []);

  if (!gameState) return <div style={{ padding: '20px', textAlign: 'center' }}>Connecting to server...</div>;

  if (gameState.status === 'PENDING') {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', color: '#374151' }}>
        <h2>Waiting for the draft to begin...</h2>
        <p>The Judge will unlock the tray shortly.</p>
      </div>
    );
  }

  if (gameState.status === 'COMPLETED' && !localReveal) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', color: '#16a34a' }}>
        <h2>Draft Complete!</h2>
        <p>Please return the tablet to the Judge.</p>
      </div>
    );
  }

  const handlePickCard = (index) => {
    if (gameState.isTrayUnlocked) {
      socket.emit('PICK_CARD', index);
    }
  };

  const handleHideAndPass = () => {
    setLocalReveal(null); // Clears the privacy screen
  };

  // --- VIEW 1: THE REVEAL SCREEN (Privacy enforced) ---
  if (localReveal) {
    // Apply the classic color mapping
    let revealColor = '#000';
    if (localReveal === 'Citizen') revealColor = '#dc2626'; // Red
    if (localReveal === 'Sheriff') revealColor = '#d97706'; // Gold
    if (localReveal === 'Mafia') revealColor = '#111827';   // Black
    if (localReveal === 'Don') revealColor = '#6b21a8';     // Deep Purple

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', backgroundColor: '#f9fafb', borderRadius: '12px', border: '2px solid #e5e7eb', padding: '20px', textAlign: 'center' }}>
        <h2 style={{ color: '#6b7280', textTransform: 'uppercase', letterSpacing: '2px' }}>Your Role Is</h2>
        <h1 style={{ fontSize: '5rem', color: revealColor, margin: '20px 0', textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
          {localReveal}
        </h1>
        <p style={{ marginBottom: '50px', color: '#374151', fontSize: '18px' }}>Memorize your role, then press the button below to hide it.</p>
        
        <button 
          onClick={handleHideAndPass}
          style={{ padding: '20px 40px', fontSize: '24px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
        >
          Hide Role & Pass to Seat {gameState.currentTurn <= 10 ? gameState.currentTurn : 10}
        </button>
      </div>
    );
  }

  // --- VIEW 2: THE TRAY SCREEN ---
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      
      {/* Turn Indicator Bar */}
      <div style={{ 
        backgroundColor: gameState.isTrayUnlocked ? '#10b981' : '#ef4444', 
        color: 'white', 
        padding: '20px', 
        borderRadius: '12px', 
        marginBottom: '40px', 
        transition: 'background-color 0.3s',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '32px' }}>
          {gameState.isTrayUnlocked 
            ? `Seat ${gameState.currentTurn}: Pick Your Card!` 
            : `Seat ${gameState.currentTurn}: Waiting for Judge...`}
        </h1>
      </div>

      {/* The 10-Card Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', padding: '10px' }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => {
          const isAvailable = gameState.availableCards.includes(index);
          const isClickable = isAvailable && gameState.isTrayUnlocked;
          
          return (
            <div 
              key={index}
              onClick={() => isClickable ? handlePickCard(index) : null}
              style={{
                aspectRatio: '2/3',
                backgroundColor: isAvailable ? (gameState.isTrayUnlocked ? '#2563eb' : '#9ca3af') : 'transparent',
                border: isAvailable ? '3px solid rgba(255,255,255,0.2)' : '2px dashed #d1d5db',
                borderRadius: '12px',
                cursor: isClickable ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                opacity: isAvailable ? 1 : 0.15,
                transform: isClickable ? 'scale(1)' : 'scale(0.98)',
                boxShadow: isClickable ? '0 10px 15px -3px rgba(0, 0, 0, 0.2)' : 'none'
              }}
            >
              {isAvailable && (
                <div style={{ 
                  width: '60%', 
                  height: '60%', 
                  border: '2px solid rgba(255,255,255,0.4)', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <span style={{ color: 'white', fontWeight: 'bold', fontSize: '36px', opacity: 0.8 }}>?</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}