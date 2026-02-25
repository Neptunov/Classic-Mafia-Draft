/**
 * @file src/pages/Admin.jsx
 * @description Super Admin Dashboard (v0.2.0).
 * Final implementation including Detailed Room Views, Mini-Trays, and Single Mode config.
 */

import React, { useState, useEffect } from 'react';
import { socket } from '../utils/socket';
import { en } from '../locales/en';
import { Menu, X, Monitor, Shield, Users, Plus, Wifi, ShieldAlert, Activity, Lock, Video, Trash2, Ghost } from 'lucide-react';
import packageJson from '../../package.json';
import '../App.css';
import './Admin.css';

const LiveTimer = ({ startTime }) => {
  const [elapsed, setElapsed] = useState('00:00');
  useEffect(() => {
    if (!startTime) return setElapsed('00:00');
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const m = String(Math.floor(diff / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setElapsed(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  return <span>{elapsed}</span>;
};

const Admin = () => {
  const text = en.admin;
  
  const [rooms, setRooms] = useState({});
  const [registry, setRegistry] = useState([]); 
  const [globalDebug, setGlobalDebug] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  const [activeTab, setActiveTab] = useState('overview'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [securityMsg, setSecurityMsg] = useState('');

  useEffect(() => {
    const handleRoomsUpdate = (roomsData) => setRooms(roomsData);
    const handleRegistryUpdate = (clientData) => setRegistry(clientData);
    const handleDebugUpdate = (debugState) => setGlobalDebug(debugState);
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('ROOMS_UPDATE', handleRoomsUpdate);
    socket.on('REGISTRY_UPDATE', handleRegistryUpdate);
    socket.on('GLOBAL_DEBUG_UPDATE', handleDebugUpdate);
    socket.on('PASSWORD_CHANGED_SUCCESS', (msg) => setSecurityMsg({ type: 'success', text: msg }));
    socket.on('PASSWORD_CHANGED_FAILED', (msg) => setSecurityMsg({ type: 'error', text: msg }));
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
	socket.on('ADMIN_ERROR', (msg) => alert(msg));

    if (socket.connected) socket.emit('REQUEST_REGISTRY');

    return () => {
      socket.off('ROOMS_UPDATE', handleRoomsUpdate);
      socket.off('REGISTRY_UPDATE', handleRegistryUpdate);
      socket.off('GLOBAL_DEBUG_UPDATE', handleDebugUpdate);
      socket.off('PASSWORD_CHANGED_SUCCESS');
      socket.off('PASSWORD_CHANGED_FAILED');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
	  socket.off('ADMIN_ERROR');
    };
  }, []);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    socket.emit('CREATE_ROOM', newRoomName, (res) => {
      if (res && !res.success) alert(res.message);
      else setNewRoomName('');
    });
  };

  const handleToggleGlobalDebug = () => {
    socket.emit('TOGGLE_GLOBAL_DEBUG', !globalDebug, (res) => {
      if (res && !res.success) alert(res.message);
    });
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setSecurityMsg('');
    if (newPass !== confirmPass) return setSecurityMsg({ type: 'error', text: text.passMismatch });
    socket.emit('CHANGE_PASSWORD', { oldPassword: oldPass, newPassword: newPass });
    setOldPass(''); setNewPass(''); setConfirmPass('');
  };

  const navigateTo = (tab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const renderStatus = (gs) => {
    if (gs.status === 'COMPLETED') return <div className="plate-status" style={{ color: 'var(--accent-gold)' }}>{text.statusCompleted}</div>;
    if (gs.status === 'IN_PROGRESS') return <div className="plate-status" style={{ color: '#1976d2' }}>{text.statusInProgress}</div>;
    if (gs.areRolesLocked) return <div className="plate-status" style={{ color: '#2e7d32' }}>{text.statusWaiting}</div>;
    return <div className="plate-status" style={{ color: 'var(--accent-red)' }}>{text.statusUnlocked}</div>;
  };

  // --- ROOM DETAILED RENDERER ---
  const renderRoomDetails = (roomId) => {
    const room = rooms[roomId];
    if (!room) return null;
    const gs = room.gameState;

    const roomDevices = registry.filter(c => c.roomId === roomId && c.role !== 'STREAM' && c.role !== 'PENDING_STREAM' && c.role !== 'ADMIN');
    const slots = Array.from({ length: 10 }, (_, i) => i);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Room Header Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-black)', padding: '1.5rem', borderRadius: '8px', border: '1px solid #333' }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>{roomId}</h1>
            <div style={{ display: 'flex', gap: '1rem', color: '#888', fontWeight: 'bold' }}>
              <span>Status: {gs.status === 'PENDING' ? (gs.areRolesLocked ? text.statusWaiting : text.statusUnlocked) : gs.status === 'IN_PROGRESS' ? text.statusInProgress : text.statusCompleted}</span>
              <span>Time: <LiveTimer startTime={gs.draftStartTime} /></span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            {gs.status === 'PENDING' && (
              <button 
                className="primary-btn" 
                onClick={() => socket.emit('TOGGLE_ROLE_LOCK', { roomId, booleanState: !gs.areRolesLocked })}
                style={{ backgroundColor: gs.areRolesLocked ? '#333' : '#2e7d32' }}
              >
                {gs.areRolesLocked ? text.unlockRoles : text.lockRoles}
              </button>
            )}
            {gs.status === 'PENDING' && !gs.areRolesLocked && (
              <button 
                className="primary-btn" 
                onClick={() => { if(window.confirm('Delete this room permanently?')) socket.emit('DELETE_ROOM', roomId); navigateTo('overview'); }}
                style={{ backgroundColor: 'var(--accent-red)' }}
              >
                <Trash2 size={18} /> {text.deleteRoom}
              </button>
            )}
          </div>
        </div>

        <div className="room-details-grid">
          
          {/* LEFT COLUMN: Settings & Devices */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div className="admin-panel-section">
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-gold)' }}>{text.roomSettings}</h3>
              
              <label style={{ 
                display: 'flex', alignItems: 'center', gap: '0.8rem', 
                cursor: (gs.status === 'PENDING' && !gs.areRolesLocked) ? 'pointer' : 'not-allowed', 
                opacity: (gs.status === 'PENDING' && !gs.areRolesLocked) ? 1 : 0.5 
              }}>
                <input 
                  type="checkbox" 
                  checked={gs.settings.singleMode} 
                  onChange={(e) => socket.emit('TOGGLE_SINGLE_MODE', { roomId, booleanState: e.target.checked })}
                  disabled={gs.status !== 'PENDING' || gs.areRolesLocked}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 'bold' }}>{text.singleMode}</span>
              </label>

              {globalDebug && gs.status === 'PENDING' && !gs.areRolesLocked && gs.settings.singleMode && (
                <button 
                  className="primary-btn" 
                  onClick={() => socket.emit('SPAWN_PHANTOMS', roomId)}
                  style={{ backgroundColor: '#1976d2', marginTop: '1rem', width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Ghost size={18} /> {text.spawnPhantoms}
                </button>
              )}
            </div>

            {/* UNIFIED DEVICE LIST & SEAT CONFIGURATION */}
            <div className="admin-panel-section">
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-gold)' }}>{text.connectedDevices}</h3>
              {roomDevices.length === 0 ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>No devices connected.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {roomDevices.map(d => (
                    <div key={d.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.8rem', backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid #333' }}>
                      
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', color: d.name.includes('Phantom') ? '#888' : 'white' }}>{d.name}</span>
                        {d.ip && <span style={{ fontSize: '0.8rem', color: '#666', fontFamily: 'monospace' }}>IP: {d.ip}</span>}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {/* ROLE ASSIGNMENT */}
                        <select 
                          className="login-input" 
                          value={d.role}
                          onChange={(e) => socket.emit('ASSIGN_ROLE', { targetSocketId: d.id, newRole: e.target.value })}
                          disabled={gs.status !== 'PENDING' || d.name.includes('Phantom')}
                          style={{ width: '130px', padding: '0.4rem' }}
                        >
                          <option value="UNASSIGNED">{text.roleUnassigned}</option>
                          <option value="PLAYER">{text.rolePlayer}</option>
                          <option value="JUDGE">{text.roleJudge}</option>
                        </select>

                        {/* SEAT ASSIGNMENT (Only visible if Single Mode AND device is a Player) */}
                        {gs.settings.singleMode && d.role === 'PLAYER' && (
                          <select 
                            className="login-input" 
                            value={d.assignedSeat || ''}
                            onChange={(e) => socket.emit('ASSIGN_SEAT', { targetDeviceId: d.deviceId, seatNumber: e.target.value })}
                            disabled={gs.status !== 'PENDING' || gs.areRolesLocked}
                            style={{ width: '130px', padding: '0.4rem' }}
                          >
                            <option value="">{text.assignSeat}</option>
                            {[1,2,3,4,5,6,7,8,9,10].map(num => <option key={num} value={num}>{text.seatLabel.replace('{number}', num)}</option>)}
                          </select>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Mini Tray & Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="admin-panel-section">
              <h3 style={{ margin: 0, color: 'var(--accent-gold)' }}>{text.miniTray}</h3>
              <div className="mini-tray-grid">
                {slots.map(i => {
                  const isRevealed = gs.revealedSlots.includes(i);
                  const trueRole = (globalDebug && typeof gs.slots === 'object') ? gs.slots[i] : null;
                  
                  return (
                    <div 
                      key={i} 
                      className={`mini-card ${isRevealed ? 'revealed' : ''} ${!trueRole ? 'face-down' : ''}`}
                      style={{ backgroundImage: trueRole && !isRevealed ? `url('/roles/${trueRole.toLowerCase()}.jpg')` : undefined }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="admin-panel-section">
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-gold)' }}>{text.draftResults}</h3>
              <div className="admin-results-list">
                {[1,2,3,4,5,6,7,8,9,10].map(seatNum => {
                  const data = gs.results[seatNum];
                  return (
                    <div key={seatNum} className="admin-result-row">
                      <span style={{ color: '#888' }}>{text.seatLabel.replace('{number}', seatNum)}</span>
                      <span style={{ color: data ? (data.role === 'Sheriff' || data.role === 'Don' ? 'var(--accent-gold)' : 'var(--text-white)') : '#444' }}>
                        {data ? data.role : '...'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const streams = registry.filter(c => c.role === 'STREAM' || c.role === 'PENDING_STREAM');

  return (
    <div className="admin-layout">
      
      {/* SIDEBAR */}
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)' }}>{text.title}</h2>
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(false)}><X size={24}/></button>
        </div>
        
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => navigateTo('overview')}>
            <Activity size={18} /> {text.tabOverview}
          </button>
          <div style={{ height: '1px', backgroundColor: '#333', margin: '0.5rem 0' }}></div>
          {Object.keys(rooms).map(roomId => (
            <button key={roomId} className={`nav-item ${activeTab === roomId ? 'active' : ''}`} onClick={() => navigateTo(roomId)}>
              <Monitor size={18} /> {roomId}
            </button>
          ))}
          <div style={{ height: '1px', backgroundColor: '#333', margin: '0.5rem 0' }}></div>
          <button className={`nav-item ${activeTab === 'streams' ? 'active' : ''}`} onClick={() => navigateTo('streams')}>
            <Video size={18} /> {text.tabStreams}
          </button>
          <button className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => navigateTo('security')}>
            <Shield size={18} /> {text.tabSecurity}
          </button>
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid #333' }}>
          <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="login-input" 
              placeholder={text.createPlaceholder} 
              value={newRoomName} 
              onChange={e => setNewRoomName(e.target.value)}
              style={{ padding: '0.6rem', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' }}
            />
            <button type="submit" className="primary-btn" style={{ padding: '0.6rem', width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <Plus size={18}/> {text.createRoom}
            </button>
          </form>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-main">
        <header className="admin-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}><Menu size={24}/></button>
            <div className="status-indicator">
              <Wifi color={isConnected ? "var(--text-white)" : "var(--accent-red)"} size={18} />
              <span style={{ color: isConnected ? "var(--text-white)" : "var(--accent-red)", fontSize: '0.9rem' }}>
                {isConnected ? text.connected : text.disconnected}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: globalDebug ? 'var(--accent-gold)' : '#888', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>
              <ShieldAlert size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.3rem' }}/>
              {text.globalDebug}
            </span>
            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
              <input type="checkbox" checked={globalDebug} onChange={handleToggleGlobalDebug} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: globalDebug ? 'var(--accent-gold)' : '#333', borderRadius: '34px', transition: '0.4s' }}>
                <span style={{ position: 'absolute', content: '""', height: '18px', width: '18px', left: '4px', bottom: '4px', backgroundColor: 'white', transition: '0.4s', borderRadius: '50%', transform: globalDebug ? 'translateX(24px)' : 'none' }}></span>
              </span>
            </label>
          </div>
        </header>

        <div className="admin-content">
          {activeTab === 'overview' && (
            <div>
              <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>{text.tabOverview}</h1>
              {Object.keys(rooms).length === 0 ? <div style={{ color: '#666', fontStyle: 'italic' }}>{text.noRooms}</div> : (
                <div className="overview-grid">
                  {Object.entries(rooms).map(([roomId, roomData]) => {
                    const gs = roomData.gameState;
                    const counts = gs.clientCounts || {};
                    return (
                      <div key={roomId} className="room-plate" onClick={() => navigateTo(roomId)}>
                        <div className="plate-header">
                          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{roomId}</h2>
                          <div style={{ color: gs.status === 'IN_PROGRESS' ? 'var(--text-white)' : '#666', fontFamily: 'monospace', fontSize: '1.1rem' }}>
                            {gs.status === 'IN_PROGRESS' ? <LiveTimer startTime={gs.draftStartTime} /> : '00:00'}
                          </div>
                        </div>
                        <div className="plate-stats">
                          <span title="Players"><Users size={16}/> {counts.PLAYER || 0}</span>
                          <span title="Judges"><Shield size={16}/> {counts.JUDGE || 0}</span>
                          <span title="Streams"><Video size={16}/> {counts.STREAM || 0}</span>
                        </div>
                        {renderStatus(gs)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STREAMS TAB */}
          {activeTab === 'streams' && (
            <div>
              <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>{text.tabStreams}</h1>
              {streams.length === 0 ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>No stream sources connected.</div>
              ) : (
                <div className="overview-grid">
                  {streams.map((stream) => (
                    <div key={stream.id} className="room-plate" style={{ borderColor: stream.role === 'PENDING_STREAM' ? 'var(--accent-red)' : '#333' }}>
                      <div className="plate-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0 }}>{stream.name}</h3>
                        <span style={{ fontSize: '0.85rem', color: '#888', fontFamily: 'monospace' }}>IP: {stream.ip}</span>
                      </div>
                      
                      {stream.role === 'PENDING_STREAM' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ color: 'var(--accent-red)', fontSize: '0.9rem', fontWeight: 'bold' }}>{text.streamPending}</span>
                          <select 
                            className="login-input" 
                            onChange={(e) => socket.emit('VERIFY_STREAM', { targetSocketId: stream.id, targetRoomId: e.target.value })}
                            defaultValue=""
                          >
                            <option value="" disabled>{text.streamRoom}</option>
                            {Object.keys(rooms).map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <span style={{ color: '#2e7d32', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            {text.streamActive}: {stream.roomId}
                          </span>
                          
                          <div>
                            <label style={{ fontSize: '0.85rem', color: '#888' }}>{text.streamLayout}</label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                              {['LEFT', 'CENTER', 'RIGHT'].map(l => (
                                <button 
                                  key={l}
                                  onClick={() => {
                                    const layoutName = text[`layout${l.charAt(0) + l.slice(1).toLowerCase()}`];
                                    if (window.confirm(text.confirmLayout.replace('{layout}', layoutName))) {
                                      socket.emit('SET_STREAM_LAYOUT', { targetSocketId: stream.id, layout: l });
                                    }
                                  }}
                                  style={{
                                    flex: 1, padding: '0.4rem', borderRadius: '4px', cursor: 'pointer',
                                    backgroundColor: stream.streamLayout === l ? 'var(--accent-gold)' : '#1a1a1a',
                                    color: stream.streamLayout === l ? '#000' : '#888',
                                    border: '1px solid #333', fontWeight: 'bold', fontSize: '0.8rem'
                                  }}
                                >
                                  {text[`layout${l.charAt(0) + l.slice(1).toLowerCase()}`]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && ( 
            <div>
              <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>{text.securityTitle}</h1>
              <div className="login-card" style={{ maxWidth: '500px', margin: '0' }}>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="input-group">
                    <label>{text.oldPassword}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Lock size={18} style={{ position: 'absolute', left: '12px', color: '#666' }} />
                      <input type="password" required className="login-input" style={{ paddingLeft: '2.5rem' }} value={oldPass} onChange={e => setOldPass(e.target.value)} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>{text.newPassword}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Lock size={18} style={{ position: 'absolute', left: '12px', color: '#666' }} />
                      <input type="password" required minLength={4} className="login-input" style={{ paddingLeft: '2.5rem' }} value={newPass} onChange={e => setNewPass(e.target.value)} />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>{text.confirmPassword}</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Lock size={18} style={{ position: 'absolute', left: '12px', color: '#666' }} />
                      <input type="password" required minLength={4} className="login-input" style={{ paddingLeft: '2.5rem' }} value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
                    </div>
                  </div>
                  {securityMsg && <div style={{ color: securityMsg.type === 'error' ? 'var(--accent-red)' : '#2e7d32', fontSize: '0.9rem', fontWeight: 'bold' }}>{securityMsg.text}</div>}
                  <button type="submit" className="primary-btn" style={{ backgroundColor: 'var(--accent-red)' }}><ShieldAlert size={18} /> {text.changeBtn}</button>
                </form>
              </div>
            </div>
          )}

          {/* ROOM DETAILED VIEW */}
          {activeTab !== 'overview' && activeTab !== 'streams' && activeTab !== 'security' && renderRoomDetails(activeTab)}

        </div>
        <footer className="lobby-footer" style={{ justifyContent: 'center', padding: '1rem', borderTop: '1px solid #333' }}>
          <span className="version-text">v{packageJson.version}</span>
        </footer>
      </main>
    </div>
  );
};

export default Admin;