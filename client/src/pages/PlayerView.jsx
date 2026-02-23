/**
 * @file PlayerView.jsx
 * @description The interactive tablet view for the players.
 * Displays the hidden draft tray, handles local tap inputs, and triggers targeted 3D CSS role reveals.
 */
import { useState, useEffect } from 'react';
import { socket } from '../utils/socket';

export default function PlayerView() {
  const [gameState, setGameState] = useState(null);
  const [revealedRole, setRevealedRole] = useState(null);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    socket.on('STATE_UPDATE', setGameState);
    
    socket.on('PRIVATE_ROLE_REVEAL', (data) => {
      setRevealedRole(data.role);
      setTimeout(() => setIsFlipping(true), 100); 
    });

    socket.on('CLOSE_PLAYER_REVEAL', () => {
      setIsFlipping(false);
      setTimeout(() => setRevealedRole(null), 800);
    });

    return () => {
      socket.off('STATE_UPDATE');
      socket.off('PRIVATE_ROLE_REVEAL');
      socket.off('CLOSE_PLAYER_REVEAL'); 
    };
  }, []);

  const handlePick = (index) => {
    if (gameState?.isTrayUnlocked && !gameState.revealedSlots.includes(index)) {
      socket.emit('PICK_CARD', index);
    }
  };

  const closeReveal = () => {
    setIsFlipping(false);
    socket.emit('MEMORIZED_ROLE'); 
    setTimeout(() => setRevealedRole(null), 800); 
  };

  if (!gameState || gameState.status === 'PENDING') {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'white', backgroundColor: '#111827', minHeight: '100vh' }}>Waiting for Judge to start the draft...</div>;
  }

  return (
    <div style={{ minWidth: '100vw', minHeight: '100vh', backgroundColor: '#111827', color: 'white', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', boxSizing: 'border-box' }}>
      <style>{`
        #root { width: 100% !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
        body { margin: 0; padding: 0; background-color: #111827; }
        
        .responsive-grid {
          display: grid; 
          grid-template-columns: repeat(5, 1fr); 
          gap: 15px; 
          width: 100%; 
          max-width: 1000px; 
          margin: 0 auto;
        }
        @media (max-width: 768px) {
          .responsive-grid { gap: 6px; }
        }

        .card-container { width: 320px; height: 448px; perspective: 1000px; } 
        .card-inner { position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform-style: preserve-3d; transform: ${isFlipping ? 'rotateY(180deg)' : 'rotateY(0deg)'}; }
        .card-front, .card-back { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: bold; }
        .card-front { background-image: url('/roles/card-back.jpg'); background-size: cover; background-position: center; border: 4px solid #3b82f6; }
        .card-back { transform: rotateY(180deg); color: transparent; border: 4px solid white; background-image: url('/roles/${revealedRole?.toLowerCase()}.jpg'); background-size: cover; background-position: center; }
      `}</style>

      {gameState.isDebugMode && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#dc2626', color: 'white', padding: '5px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>TESTING/DEBUG MODE ACTIVE</div>
      )}
      
      <h2 style={{ marginBottom: '30px', color: '#60a5fa' }}>Table: {gameState.roomId}</h2>

      <div className="responsive-grid">
        {[...Array(10)].map((_, i) => (
          <div 
            key={i} 
            onClick={() => handlePick(i)}
            style={{
              aspectRatio: '2.5 / 3.5',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: '36px', fontWeight: 'bold', color: 'transparent',
              
              backgroundImage: gameState.revealedSlots.includes(i) ? 'none' : "url('/roles/card-back.jpg')",
              backgroundSize: 'cover', backgroundPosition: 'center',
              backgroundColor: gameState.revealedSlots.includes(i) ? 'transparent' : '#1e293b',
              
              cursor: gameState.isTrayUnlocked && !gameState.revealedSlots.includes(i) ? 'pointer' : 'default',
              border: gameState.isTrayUnlocked && !gameState.revealedSlots.includes(i) ? '3px solid #60a5fa' : '3px solid transparent',
              boxShadow: (gameState.isTrayUnlocked && !gameState.revealedSlots.includes(i)) ? '0 0 20px rgba(59, 130, 246, 0.4)' : 'none',
              opacity: gameState.revealedSlots.includes(i) ? 0.2 : 1,
              transition: 'all 0.1s ease-in-out', transform: 'scale(1)'
            }}
            onMouseDown={(e) => { if (gameState.isTrayUnlocked && !gameState.revealedSlots.includes(i)) e.currentTarget.style.transform = 'scale(0.95)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onTouchStart={(e) => { if (gameState.isTrayUnlocked && !gameState.revealedSlots.includes(i)) e.currentTarget.style.transform = 'scale(0.95)'; }}
            onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {gameState.revealedSlots.includes(i) ? <span style={{color: '#64748b'}}>✘</span> : ''}
          </div>
        ))}
      </div>

      {revealedRole && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div className="card-container"><div className="card-inner">
            <div className="card-front">?</div><div className="card-back"></div>
          </div></div>
          <button onClick={closeReveal} disabled={!isFlipping} style={{ marginTop: '50px', padding: '20px 50px', fontSize: '22px', borderRadius: '50px', backgroundColor: isFlipping ? 'white' : '#4b5563', color: 'black', border: 'none', fontWeight: 'bold', cursor: isFlipping ? 'pointer' : 'not-allowed', transition: 'background-color 0.3s' }}>
            I MEMORIZED IT
          </button>
        </div>
      )}

      <div style={{ marginTop: '40px', fontSize: '20px', color: gameState.isTrayUnlocked ? '#60a5fa' : '#9ca3af', fontWeight: 'bold' }}>
        {gameState.isTrayUnlocked ? `YOUR TURN: PICK A CARD (Seat ${gameState.currentTurn})` : "WAITING FOR JUDGE..."}
      </div>
    </div>
  );
}