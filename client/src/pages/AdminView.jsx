import { useState, useEffect } from 'react';
import { socket } from '../utils/socket';

export default function AdminView({ gameState }) {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const handleRegistryUpdate = (registry) => setClients(registry);
    socket.on('REGISTRY_UPDATE', handleRegistryUpdate);
    socket.emit('REQUEST_REGISTRY');
    return () => socket.off('REGISTRY_UPDATE', handleRegistryUpdate);
  }, []);

  const assignRole = (socketId, role) => socket.emit('ASSIGN_ROLE', { targetSocketId: socketId, newRole: role });
  
  const toggleDebug = () => {
    if (gameState) socket.emit('TOGGLE_DEBUG_MODE', !gameState.isDebugMode);
  };

  const toggleRoleLock = () => {
    if (gameState) socket.emit('TOGGLE_ROLE_LOCK', !gameState.areRolesLocked);
  };

  const isDraftActive = gameState?.status === 'IN_PROGRESS';

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e5e7eb', paddingBottom: '15px', marginBottom: '20px' }}>
        <h2>Admin Console</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={toggleRoleLock} 
            disabled={isDraftActive}
            style={{ padding: '8px 16px', backgroundColor: gameState?.areRolesLocked ? '#059669' : '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: isDraftActive ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isDraftActive ? 0.5 : 1 }}
          >
            {gameState?.areRolesLocked ? '🔒 Roles Locked' : '🔓 Lock Roles'}
          </button>
          <button 
            onClick={toggleDebug} 
            disabled={isDraftActive}
            style={{ padding: '8px 16px', backgroundColor: gameState?.isDebugMode ? '#dc2626' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: isDraftActive ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isDraftActive ? 0.5 : 1 }}
          >
            {gameState?.isDebugMode ? 'Disable Debug Mode' : 'Enable Debug Mode'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', color: '#111827', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0 }}>Connected Devices ({clients.length})</h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '10px 5px' }}>Name / IP</th>
                <th>Current Role</th>
                <th>Assign New Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => {
                const isAnonymous = client.name === 'Anonymous' && client.role !== 'ADMIN';
                const isDropdownDisabled = gameState?.areRolesLocked || isAnonymous;

                return (
                  <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '15px 5px' }}>
                      <strong style={{ color: '#111827' }}>{client.name}</strong><br/>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{client.ip}</span>
                      {isAnonymous && <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '4px' }}>Name required for assignment</div>}
                    </td>
                    <td>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: client.role === 'UNASSIGNED' ? '#fef3c7' : '#dcfce3', color: client.role === 'UNASSIGNED' ? '#92400e' : '#166534' }}>
                        {client.role}
                      </span>
                    </td>
                    <td>
                      {client.role === 'PENDING_STREAM' ? (
                        <button 
                          onClick={() => assignRole(client.id, 'STREAM')}
                          disabled={gameState?.areRolesLocked}
                          style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: gameState?.areRolesLocked ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: gameState?.areRolesLocked ? 0.5 : 1 }}
                        >
                          Verify Stream
                        </button>
                      ) : client.role === 'STREAM' ? (
                        <div style={{ padding: '6px', backgroundColor: '#e5e7eb', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold', color: '#374151', fontSize: '13px' }}>
                          Verified Source
                        </div>
                      ) : (
                        <select 
                          value={client.role} 
                          onChange={(e) => assignRole(client.id, e.target.value)}
                          disabled={isDropdownDisabled}
                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', opacity: isDropdownDisabled ? 0.5 : 1 }}
                        >
                          <option value="UNASSIGNED">Lobby (Unassigned)</option>
                          <option value="PLAYER">Player Tray</option>
                          <option value="JUDGE">Judge Control</option>
                          {/* Stream option safely removed */}
                          <option value="ADMIN" disabled>Admin</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <button 
                        onClick={() => socket.emit('RESET_CLIENT', client.id)}
                        disabled={gameState?.areRolesLocked}
                        style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: gameState?.areRolesLocked ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: gameState?.areRolesLocked ? 0.5 : 1 }}
                      >
                        Reset to Lobby
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ backgroundColor: '#1f2937', color: '#10b981', padding: '20px', borderRadius: '8px', overflowX: 'auto' }}>
          <h3 style={{ color: '#f3f4f6', marginTop: 0 }}>Live Server State</h3>
          {!gameState ? <p>Waiting...</p> : <pre style={{ fontSize: '13px' }}>{JSON.stringify(gameState, null, 2)}</pre>}
        </div>
      </div>
    </div>
  );
}