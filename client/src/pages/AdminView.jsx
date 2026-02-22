import { useState, useEffect } from 'react';
import { socket } from '../utils/socket';

export default function AdminView() {
  const [allClients, setAllClients] = useState([]);
  const [allRooms, setAllRooms] = useState({});
  const [activeTab, setActiveTab] = useState('STREAMS'); // Default to Stream tab
  const [newRoomCode, setNewRoomCode] = useState('');
  const [streamSelections, setStreamSelections] = useState({});

  useEffect(() => {
    const handleRegistryUpdate = (registry) => setAllClients(registry);
    const handleRoomsUpdate = (roomsData) => setAllRooms(roomsData);
    
    socket.on('REGISTRY_UPDATE', handleRegistryUpdate);
    socket.on('ROOMS_UPDATE', handleRoomsUpdate);
    socket.emit('REQUEST_REGISTRY');
    
    return () => {
      socket.off('REGISTRY_UPDATE', handleRegistryUpdate);
      socket.off('ROOMS_UPDATE', handleRoomsUpdate);
    };
  }, []);

  const assignRole = (socketId, role) => socket.emit('ASSIGN_ROLE', { targetSocketId: socketId, newRole: role });
  
  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (newRoomCode.trim()) {
      socket.emit('CREATE_ROOM', newRoomCode.trim());
      setNewRoomCode('');
    }
  };

  const handleDeleteRoom = () => {
    if (window.confirm(`Are you sure you want to delete ${activeTab}? All players will be kicked to the lobby.`)) {
      socket.emit('DELETE_ROOM', activeTab);
      setActiveTab('STREAMS');
    }
  };

  const toggleDebug = () => {
    if (activeTab && allRooms[activeTab]) {
      socket.emit('TOGGLE_DEBUG_MODE', { roomId: activeTab, booleanState: !allRooms[activeTab].gameState.isDebugMode });
    }
  };

  const toggleRoleLock = () => {
    if (activeTab && allRooms[activeTab]) {
      socket.emit('TOGGLE_ROLE_LOCK', { roomId: activeTab, booleanState: !allRooms[activeTab].gameState.areRolesLocked });
    }
  };

  const activeGameState = allRooms[activeTab]?.gameState;
  const isDraftActive = activeGameState?.status === 'IN_PROGRESS';

  // MASTER LOCK: If the room is not in 'PENDING', the tournament has started or finished.
  const isGameLocked = activeGameState && activeGameState.status !== 'PENDING';

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif', color: '#111827' }}>
      
      {/* GLOBAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Super Admin Dashboard</h2>
        
        <form onSubmit={handleCreateRoom} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" value={newRoomCode} onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
            placeholder="New Table Name"
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', textTransform: 'uppercase' }} required
          />
          <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            + Create Table
          </button>
        </form>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{ display: 'flex', gap: '5px', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('STREAMS')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'STREAMS' ? '#8b5cf6' : '#f3f4f6', color: activeTab === 'STREAMS' ? 'white' : '#4b5563', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontWeight: 'bold', marginRight: '10px' }}
        >
          📡 Stream Overlays
        </button>

        {Object.keys(allRooms).map(roomCode => (
          <button
            key={roomCode}
            onClick={() => setActiveTab(roomCode)}
            style={{ padding: '10px 20px', backgroundColor: activeTab === roomCode ? '#3b82f6' : '#f3f4f6', color: activeTab === roomCode ? 'white' : '#4b5563', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {roomCode}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'STREAMS' ? (
        <div>
          <h3>Global Stream Management</h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead style={{ backgroundColor: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '15px' }}>Source / IP</th>
                <th>Status</th>
                <th>Assign to Table</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {allClients.filter(c => c.role === 'PENDING_STREAM' || c.role === 'STREAM').map(client => (
                <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '15px' }}>
                    <strong>{client.name}</strong><br/>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>IP: {client.ip}</span>
                  </td>
                  <td>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: client.role === 'PENDING_STREAM' ? '#fef3c7' : '#dcfce3', color: client.role === 'PENDING_STREAM' ? '#92400e' : '#166534' }}>
                      {client.role === 'PENDING_STREAM' ? 'WAITING' : 'VERIFIED'}
                    </span>
                  </td>
                  <td>
                    {client.role === 'PENDING_STREAM' ? (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <select 
                          value={streamSelections[client.id] || ''} 
                          onChange={(e) => setStreamSelections({...streamSelections, [client.id]: e.target.value})}
                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        >
                          <option value="" disabled>Select Table...</option>
                          {Object.keys(allRooms).map(room => <option key={room} value={room}>{room}</option>)}
                        </select>
                        <button 
                          onClick={() => socket.emit('VERIFY_STREAM', { targetSocketId: client.id, targetRoomId: streamSelections[client.id] })}
                          disabled={!streamSelections[client.id]}
                          style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: streamSelections[client.id] ? 'pointer' : 'not-allowed', fontWeight: 'bold', opacity: streamSelections[client.id] ? 1 : 0.5 }}
                        >
                          Assign
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: '6px', color: '#4b5563', fontSize: '14px' }}>Locked to: <strong>{client.roomId}</strong></div>
                    )}
                  </td>
                  <td>
                    <button onClick={() => socket.emit('RESET_CLIENT', client.id)} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Reset</button>
                  </td>
                </tr>
              ))}
              {allClients.filter(c => c.role === 'PENDING_STREAM' || c.role === 'STREAM').length === 0 && (
                <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>No active OBS Sources or Stream Overlays found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab && activeGameState ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Table: {activeTab} ({activeGameState.status})</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={toggleRoleLock} disabled={isGameLocked}
                style={{ padding: '8px 16px', backgroundColor: activeGameState.areRolesLocked ? '#059669' : '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: isGameLocked ? 'not-allowed' : 'pointer', opacity: isGameLocked ? 0.5 : 1 }}
              >
                {activeGameState.areRolesLocked ? '🔒 Roles Locked' : '🔓 Lock Roles'}
              </button>
              <button 
                onClick={toggleDebug} disabled={isGameLocked}
                style={{ padding: '8px 16px', backgroundColor: activeGameState.isDebugMode ? '#dc2626' : '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: isGameLocked ? 'not-allowed' : 'pointer', opacity: isGameLocked ? 0.5 : 1 }}
              >
                {activeGameState.isDebugMode ? 'Debug ON' : 'Debug OFF'}
              </button>
              <button onClick={handleDeleteRoom} disabled={isGameLocked} style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', opacity: isGameLocked ? 0.5 : 1, cursor: isGameLocked ? 'not-allowed' : 'pointer' }}>Delete</button>
            </div>
          </div>

          {activeGameState.isDebugMode && (
             <div style={{ backgroundColor: '#dc2626', color: 'white', padding: '10px', textAlign: 'center', borderRadius: '6px', marginBottom: '15px', fontWeight: 'bold' }}>
               ⚠️ DEBUG MODE ACTIVE: ROLE SLOTS ARE VISIBLE BELOW
             </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <tr>
                    <th style={{ padding: '10px' }}>Device</th>
                    <th>Role</th>
                    <th>Assign</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allClients.filter(c => c.roomId === activeTab && c.role !== 'ADMIN' && c.role !== 'STREAM').map(client => {
                    const isDropdownDisabled = activeGameState.areRolesLocked || client.name === 'Anonymous';
                    return (
                      <tr key={client.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px' }}>
                          <strong>{client.name}</strong><br/><span style={{ fontSize: '11px', color: '#6b7280' }}>{client.ip}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#e5e7eb' }}>{client.role}</span>
                        </td>
                        <td>
                          <select 
                            value={client.role} onChange={(e) => assignRole(client.id, e.target.value)} disabled={isDropdownDisabled}
                            style={{ padding: '4px', borderRadius: '4px' }}
                          >
                            <option value="UNASSIGNED">Lobby</option>
                            <option value="PLAYER">Player</option>
                            <option value="JUDGE">Judge</option>
                          </select>
                        </td>
                        <td>
                          <button onClick={() => socket.emit('RESET_CLIENT', client.id)} disabled={activeGameState.areRolesLocked} style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px' }}>Reset</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: '#1f2937', color: '#10b981', padding: '20px', borderRadius: '8px', fontSize: '12px', maxHeight: '500px', overflowY: 'auto' }}>
              <h4 style={{ color: 'white', marginTop: 0 }}>Live Table State</h4>
              <pre>{JSON.stringify(activeGameState, null, 2)}</pre>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '50px', color: '#6b7280' }}>Select a table or create a new one to begin management.</div>
      )}
    </div>
  );
}