import { socket } from '../utils/socket';

export default function JudgeView({ gameState }) {
  if (!gameState) return <div style={{ padding: '20px' }}>Waiting for server synchronization...</div>;

  const handleStartDraft = () => socket.emit('START_DRAFT');
  const handleUnlockTray = () => socket.emit('UNLOCK_TRAY');
  const handleForcePick = () => socket.emit('FORCE_PICK');
  
  const handleResetDraft = () => {
    if (window.confirm('WARNING: Are you sure you want to completely reset the draft? All progress will be lost.')) {
      socket.emit('RESET_DRAFT');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '20px' }}>
        <h2 style={{ color: '#111827', margin: 0 }}>Judge Control Panel</h2>
        {/* Safe Reset Button for Mistakes */}
        {(gameState.status === 'IN_PROGRESS' || gameState.status === 'COMPLETED') && (
          <button 
            onClick={handleResetDraft}
            style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reset Entire Draft
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px', color: '#374151' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <strong>Player Trays:</strong> {gameState.clientCounts?.PLAYER || 0}
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <strong>Stream Overlays:</strong> {gameState.clientCounts?.STREAM || 0}
        </div>
        <div style={{ flex: 1, textAlign: 'center', color: gameState.areRolesLocked ? '#059669' : '#d97706', fontWeight: 'bold' }}>
          {gameState.areRolesLocked ? '🔒 Roles Locked' : '🔓 Roles Not Locked'}
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center', marginBottom: '20px' }}>
        
        {gameState.status === 'PENDING' && (
          <>
            <h3 style={{ color: '#111827' }}>The Draft is Pending</h3>
            {!gameState.areRolesLocked ? (
              <p style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '20px' }}>Wait for Admin to lock roles before starting.</p>
            ) : (
              <>
                <p style={{ color: '#6b7280', marginBottom: '20px' }}>All roles are locked and stream is ready.</p>
                <button 
                  onClick={handleStartDraft}
                  style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Start Draft & Shuffle Deck
                </button>
              </>
            )}
          </>
        )}

        {gameState.status === 'IN_PROGRESS' && (
          <>
            <h3 style={{ fontSize: '24px', margin: '0 0 20px 0', color: '#111827' }}>Current Turn: Seat {gameState.currentTurn}</h3>
            
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              {gameState.isTrayUnlocked ? (
                <div style={{ padding: '15px', backgroundColor: '#dcfce3', color: '#166534', borderRadius: '8px', fontWeight: 'bold', flex: 1 }}>
                  Tray is UNLOCKED. Waiting for Seat {gameState.currentTurn} to pick...
                </div>
              ) : (
                <button 
                  onClick={handleUnlockTray}
                  style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}
                >
                  Unlock Tray for Seat {gameState.currentTurn}
                </button>
              )}
              
              {/* Force Pick Button */}
              <button 
                onClick={handleForcePick}
                style={{ padding: '15px 20px', fontSize: '16px', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                title="Automatically selects a random card for this seat"
              >
                Force Pick
              </button>
            </div>
          </>
        )}

        {gameState.status === 'COMPLETED' && (
          <>
            <h3 style={{ color: '#16a34a', fontSize: '24px', margin: '0 0 10px 0' }}>Draft Completed!</h3>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>All roles have been assigned.</p>
          </>
        )}
      </div>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0, color: '#111827' }}>Draft Log</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(seat => {
            const role = gameState.results[seat];
            
            // NEW: The classic color mapping
            let roleColor = '#9ca3af'; // Default gray
            if (role === 'Citizen') roleColor = '#dc2626'; // Red
            if (role === 'Sheriff') roleColor = '#d97706'; // Gold
            if (role === 'Mafia') roleColor = '#111827';   // Black
            if (role === 'Don') roleColor = '#6b21a8';     // Deep Purple

            return (
              <div key={seat} style={{ padding: '10px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold', color: '#374151' }}>Seat {seat}</span>
                <span style={{ fontWeight: role ? 'bold' : 'normal', color: roleColor }}>
                  {role || 'Pending...'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}