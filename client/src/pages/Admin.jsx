/**
 * @file src/pages/Admin.jsx
 * @description Super Admin Dashboard (v0.3.6).
 * Refactored to utilize external CSS classes and robust array fallbacks for dynamic pack fetching.
 */

import React, { useState, useEffect } from 'react';
import { socket } from '../utils/socket';
import { useLanguage } from '../utils/LanguageContext';
import { Menu, X, Monitor, Shield, Users, Plus, Wifi, ShieldAlert, Activity, Lock, Video, Trash2, Ghost } from 'lucide-react';
import packageJson from '../../package.json';
import { useAuth } from '../utils/AuthContext';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';
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
  const { uploadToken } = useAuth();
  const { text: dictionary, settings } = useLanguage();
  const text = dictionary.admin;
  
  const activePack = settings?.customAssets?.activePack || 'fiimdefault.mafpack';
  const [selectedPack, setSelectedPack] = useState(activePack);

  const getAssetPath = (assetName) => `/api/assets/active/${assetName}.webp?v=${activePack}`;
  
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
  
  	const [globalLang, setGlobalLang] = useState(settings?.language || 'en');
  	const [customPacks, setCustomPacks] = useState([]);
  	const [defaultPacks, setDefaultPacks] = useState([]);
  	const [newPackName, setNewPackName] = useState('');
  	const [newPackAuthor, setNewPackAuthor] = useState('');
  	const [newPackVersion, setNewPackVersion] = useState('1.0.0');
  	const [streamSeatPlateBackgroundColor, setStreamSeatPlateBackgroundColor] = useState(settings?.streamSeatPlateBackgroundColor || '#1e1e1e');
    const [streamSeatPlateTextColor, setStreamSeatPlateTextColor] = useState(settings?.streamSeatPlateTextColor || '#ffd700');
  
  const [cropFile, setCropFile] = useState(null); 
  const [cropTarget, setCropTarget] = useState(null); 
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [tempVaultFiles, setTempVaultFiles] = useState([]);
  
  const [updateData, setUpdateData] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

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
  
  useEffect(() => {
    if (settings) {
        setGlobalLang(settings.language || 'en');
        setStreamSeatPlateBackgroundColor(settings.streamSeatPlateBackgroundColor || '#1e1e1e');
        setStreamSeatPlateTextColor(settings.streamSeatPlateTextColor || '#ffd700');
    }
  }, [settings]);
  
  useEffect(() => {
    if (activeTab === 'settings') fetchPacks();
  }, [activeTab, uploadToken]);
  
  useEffect(() => {
    setSelectedPack(activePack);
  }, [activePack]);
  
  useEffect(() => {
    fetch('/api/system/update-check')
      .then(res => res.json())
      .then(data => {
        if (data.hasUpdate) setUpdateData(data);
      })
      .catch(err => console.error('Failed to check for updates', err));
  }, []);

  const handleUpdate = async () => {
    if (updateData.platform === 'darwin') {
      window.open(updateData.url, '_blank');
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch('/api/system/apply-update', { method: 'POST' });
      if (res.ok) {
        alert(text.updateDownloading);
      } else {
        alert(text.updateFailed);
        setIsUpdating(false);
      }
    } catch (e) {
      console.error(e);
      setIsUpdating(false);
    }
  };

  const fetchPacks = () => {
    fetch('/api/assets/packs', { headers: { 'Authorization': `Bearer ${uploadToken}` } })
      .then(res => res.json())
      .then(data => { 
        if (data.success) {
          setCustomPacks(data.customPacks || []); 
          setDefaultPacks(data.defaultPacks || []);
        }
      })
      .catch(err => console.error("Failed to load packs", err));
  };

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

  const handleCompilePack = async () => {
    if (!newPackName || !newPackAuthor) return alert('Name and Author are required!');
    try {
      const res = await fetch('/api/assets/compile', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${uploadToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPackName, author: newPackAuthor, version: newPackVersion })
      });
      
      const data = await res.json();
      if (data.success) {
        alert(`Pack "${newPackName}" Compiled Successfully!`);
        setNewPackName(''); 
		setTempVaultFiles([]); 
        fetchPacks();     
      } else {
        alert(`Compilation Failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const uploadDirect = async (file, targetName) => {
    const formData = new FormData();
    formData.append('image', file, `${targetName}.webp`);
    formData.append('assetType', targetName);

    try {
      const res = await fetch('/api/assets/upload-temp', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${uploadToken}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setTempVaultFiles(prev => [...prev, targetName]);
      } else {
        alert(text.errUploadFailed + data.error);
      }
    } catch (e) {
      console.error(e);
      alert(text.errNetwork);
    }
  };

  const onSelectCropFile = (e, targetName) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (targetName === 'trayBg') {
      const img = new Image();
      img.onload = () => {
        if (img.width < 1280 || img.height < 720) {
          alert(text.errTraySize);
        } else {
          uploadDirect(file, targetName);
        }
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    } 
    else {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setCropFile(reader.result);
        setCropTarget(targetName);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      });
      reader.readAsDataURL(file);
    }
    e.target.value = ''; 
  };

  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleSaveCrop = async () => {
    try {
      const croppedBlob = await getCroppedImg(cropFile, croppedAreaPixels);
      await uploadDirect(croppedBlob, cropTarget);
      setCropFile(null); 
      setCropTarget(null);
    } catch (e) {
      console.error(e);
      alert(text.errNetwork);
    }
  };
  
  const handleImportPack = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('pack', file);

    try {
      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${uploadToken}` },
        body: formData
      });
      
      const data = await res.json();
      if (data.success) {
        alert('Pack imported successfully! Refreshing list...');
        fetchPacks(); 
      } else {
        alert(`Import Failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error during import.');
    }
  };

  const handleDownloadPack = async (filename) => {
    try {
      const res = await fetch(`/api/assets/download/${filename}`, {
        headers: { 'Authorization': `Bearer ${uploadToken}` }
      });
      
      if (!res.ok) throw new Error('Download request failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download pack.');
    }
  };

  // --- ROOM DETAILED RENDERER ---
  const renderRoomDetails = (roomId) => {
    const room = rooms[roomId];
    if (!room) return null;
    const gs = room.gameState;

    const roomDevices = registry.filter(c => c.roomId === roomId && c.role !== 'STREAM' && c.role !== 'PENDING_STREAM' && c.role !== 'ADMIN');
    const slots = Array.from({ length: 10 }, (_, i) => i);

    return (
      <div className="room-details-container">
        <div className="room-header-card">
          <div>
            <h1 className="admin-page-title" style={{ marginBottom: '0.5rem' }}>{roomId}</h1>
            <div className="room-header-meta">
              <span>{ text.statusText } {gs.status === 'PENDING' ? (gs.areRolesLocked ? text.statusWaiting : text.statusUnlocked) : gs.status === 'IN_PROGRESS' ? text.statusInProgress : text.statusCompleted}</span>
              <span>{ text.timeText } <LiveTimer startTime={gs.draftStartTime} /></span>
            </div>
          </div>
          
          <div className="header-controls">
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
                onClick={() => { if(window.confirm('Delete this room permanently?')) { socket.emit('DELETE_ROOM', roomId); navigateTo('overview'); } }}
                style={{ backgroundColor: 'var(--accent-red)' }}
              >
                <Trash2 size={18} /> {text.deleteRoom}
              </button>
            )}
          </div>
        </div>

        <div className="room-details-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="admin-panel-section">
              <h3>{text.roomSettings}</h3>
              
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

            <div className="admin-panel-section">
              <h3>{text.connectedDevices}</h3>
              {roomDevices.length === 0 ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>No devices connected.</div>
              ) : (
                <div className="device-list-container">
                  {roomDevices.map(d => (
                    <div key={d.id} className="device-list-item">
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', color: d.name.includes('Phantom') ? '#888' : 'white' }}>{d.name}</span>
                        {d.ip && <span style={{ fontSize: '0.8rem', color: '#666', fontFamily: 'monospace' }}>IP: {d.ip}</span>}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="admin-panel-section">
              <h3>{text.miniTray}</h3>
              <div className="mini-tray-grid">
                {slots.map(i => {
                  const isRevealed = gs.revealedSlots.includes(i);
                  const trueRole = (globalDebug && typeof gs.slots === 'object') ? gs.slots[i] : null;
                  
                  return (
                    <div 
                      key={i} 
                      className={`mini-card ${isRevealed ? 'revealed' : ''}`}
                      style={{ backgroundImage: trueRole && !isRevealed ? `url('${getAssetPath(trueRole.toLowerCase())}')` : `url('${getAssetPath('cardBack')}')` }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="admin-panel-section">
              <h3>{text.draftResults}</h3>
              <div className="admin-results-list">
                {[1,2,3,4,5,6,7,8,9,10].map(seatNum => {
                  const data = gs.results[seatNum];
                  return (
                    <div key={seatNum} className="admin-result-row">
                      <span style={{ color: '#888' }}>{text.seatLabel.replace('{number}', seatNum)}</span>
                      <span style={{ color: data ? (data.role === 'Sheriff' || data.role === 'Don' ? 'var(--accent-gold)' : 'var(--text-white)') : '#444' }}>
                        {data ? (text['role' + data.role] || data.role) : '...'}
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
              <h2>{text.title}</h2>
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
              <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => navigateTo('settings')}>
                <Monitor size={18} /> {text.tabSettings}
              </button>
            </nav>
    
            <div className="sidebar-footer-form">
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
          {/* --- IN-APP UPDATER BANNER --- */}
            {updateData && (
              <div style={{ backgroundColor: 'var(--accent-gold)', color: '#000', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
                <div>
              {text.versionAvailable
              .replace('{oldVersion}', updateData.currentVersion)
              .replace('{newVersion}', updateData.latestVersion)
            }
                </div>
                <button 
                  onClick={handleUpdate} 
                  className="primary-btn" 
                  style={{ backgroundColor: '#1a1a1a', color: 'var(--accent-gold)', border: '1px solid #000', padding: '0.4rem 1rem' }}
                  disabled={isUpdating}
                >
                  {isUpdating ? text.updatingText : (updateData.platform === 'darwin' ? text.macUpdate : text.winUpdate)}
                </button>
              </div>
            )}
            <header className="admin-header">          <div className="header-controls">
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}><Menu size={24}/></button>
            <div className="status-indicator">
              <Wifi color={isConnected ? "var(--text-white)" : "var(--accent-red)"} size={18} />
              <span style={{ color: isConnected ? "var(--text-white)" : "var(--accent-red)" }}>
                {isConnected ? text.connected : text.disconnected}
              </span>
            </div>
          </div>
          <div className="header-controls">
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
              <h1 className="admin-page-title">{text.tabOverview}</h1>
              {Object.keys(rooms).length === 0 ? <div style={{ color: '#666', fontStyle: 'italic' }}>{text.noRooms}</div> : (
                <div className="overview-grid">
                  {Object.entries(rooms).map(([roomId, roomData]) => {
                    const gs = roomData.gameState;
                    const counts = gs.clientCounts || {};
                    return (
                      <div key={roomId} className="room-plate" onClick={() => navigateTo(roomId)}>
                        <div className="plate-header">
                          <h2>{roomId}</h2>
                          <div className="plate-timer" style={{ color: gs.status === 'IN_PROGRESS' ? 'var(--text-white)' : '#666' }}>
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

          {activeTab === 'streams' && (
            <div>
              <h1 className="admin-page-title">{text.tabStreams}</h1>
              {streams.length === 0 ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>{text.streamMissing}.</div>
              ) : (
                <div className="overview-grid">
                  {streams.map((stream) => (
                    <div key={stream.id} className="room-plate" style={{ borderColor: stream.role === 'PENDING_STREAM' ? 'var(--accent-red)' : '#333' }}>
                      <div className="plate-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <h3>{stream.name}</h3>
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
              <h1 className="admin-page-title">{text.securityTitle}</h1>
              <div className="login-card" style={{ maxWidth: '500px', margin: '0' }}>
                <form onSubmit={handleChangePassword} className="settings-form">
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
          
          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (selectedPack !== 'default') {
                  await fetch(`/api/assets/activate/${selectedPack}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${uploadToken}` }
                  });
                }
                socket.emit('UPDATE_GLOBAL_SETTINGS', {
                  language: globalLang,
                  customAssets: { activePack: selectedPack },
                  streamSeatPlateBackgroundColor,
                  streamSeatPlateTextColor,
                });
                alert(text.saveSuccess);
              }}
            >
              <h1 className="admin-page-title">{text.settingsTitle}</h1>
              <div className="settings-grid">

                {/* --- GENERAL SETTINGS --- */}
                <div className="admin-panel-section">
                  <h3>{text.interfaceAndLanguage}</h3>

                  <div className="settings-form">
                    {/* LANGUAGE SELECTOR */}
                    <div className="input-group">
                      <label>{text.tournamentLang}</label>
                      <select
                        className="login-select"
                        value={globalLang}
                        onChange={e => setGlobalLang(e.target.value)}
                      >
                        <option value="en">English</option>
                        <option value="ru">Русский (Russian)</option>
                        <option value="ua">Українська (Ukrainian)</option>
                        <option value="he">עברית (Hebrew - RTL)</option>
                      </select>
                    </div>

                    {/* PLATE BACKGROUND COLOR */}
                    <div className="input-group">
                      <label>{text.streamPlateBackgroundColor}</label>
                      <div className="color-input-wrapper">
                        <input
                          type="text"
                          className="login-input"
                          value={streamSeatPlateBackgroundColor}
                          onChange={e => setStreamSeatPlateBackgroundColor(e.target.value)}
                          placeholder="#1e1e1e"
                          style={{ paddingInlineStart: '1rem' }}
                        />
                        <input type="color" value={streamSeatPlateBackgroundColor} onChange={e => setStreamSeatPlateBackgroundColor(e.target.value)} />
                      </div>
                    </div>

                    {/* PLATE TEXT COLOR */}
                    <div className="input-group">
                      <label>{text.streamPlateTextColor}</label>
                      <div className="color-input-wrapper">
                        <input
                          type="text"
                          className="login-input"
                          value={streamSeatPlateTextColor}
                          onChange={e => setStreamSeatPlateTextColor(e.target.value)}
                          placeholder="#ffd700"
                          style={{ paddingInlineStart: '1rem' }}
                        />
                        <input type="color" value={streamSeatPlateTextColor} onChange={e => setStreamSeatPlateTextColor(e.target.value)} />
                      </div>
                    </div>

                    {/* PREVIEW */}
                    <div className="input-group">
                      <label>{text.streamPreview}</label>
                      <div
                        style={{
                          backgroundColor: streamSeatPlateBackgroundColor,
                          color: streamSeatPlateTextColor,
                          width: '100%',
                          margin: 0,
                          textAlign: 'center',
                          padding: '15px 0',
                          borderRadius: '8px',
                          border: '1px solid #333',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          letterSpacing: '3px',
                          boxSizing: 'border-box',
                          boxShadow: '0 10px 20px rgba(0,0,0,0.4)',
                        }}
                      >
                        {text.seatLabel?.replace('{number}', 1)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* --- ASSET MANAGER --- */}
                <div className="admin-panel-section">
                  {/* LIVE PREVIEW BOX */}
                  <div className="settings-section" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0' }}>{text.texturePreview}</h3>
                    <div className="pack-preview-container" style={{ backgroundImage: `url('${getAssetPath('trayBg')}')` }}>

                      <div className="mini-tray-grid" style={{ marginTop: 0 }}>
                        {['cardBack', 'citizen', 'sheriff', 'mafia', 'don'].map((card, i) => (
                          <div
                            key={i}
                            className="mini-card"
                            style={{
                              backgroundImage: `url('${getAssetPath(card)}')`,
                              boxShadow: '0 4px 8px rgba(0,0,0,0.6)',
                              border: card === 'cardBack' ? '1px solid #444' : '1px solid var(--accent-gold)'
                            }}
                          />
                        ))}
                      </div>

                    </div>
                  </div>

                  {/* PACK MANAGER & COMPILER */}
                  <div className="pack-manager-header">
                    <h3 style={{ margin: 0 }}>{text.packsWindow}</h3>
                    <label className="pack-import-btn">
                      {text.importButton}
                      <input type="file" accept=".mafpack" onChange={handleImportPack} style={{ display: 'none' }} />
                    </label>
                  </div>

                  <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                    <label>{text.selectPack}</label>
                    <select className="login-select" value={selectedPack} onChange={e => setSelectedPack(e.target.value)}>
                      <optgroup label={text.defaultPacksTitle}>
                        {defaultPacks.map(pack => (
                          <option key={pack.id} value={pack.filename}>{pack.name} (v{pack.version})</option>
                        ))}
                      </optgroup>
                      {customPacks.length > 0 && (
                        <optgroup label={text.customPacksTitle}>
                          {customPacks.map(pack => (
                            <option key={pack.id} value={pack.filename}>{pack.name} - {text.authorReference} {pack.author}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* INSTALLED CUSTOM PACKS LIST */}
                  {customPacks.length > 0 && (
                    <div className="pack-list-container">
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>{text.exportPacksTitle}</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {customPacks.map(pack => (
                          <div key={pack.id} className="pack-list-item">
                            <span>{pack.name} <small style={{ color: '#888' }}>- {pack.author}</small></span>
                            <button type="button" onClick={() => handleDownloadPack(pack.filename)} className="pack-export-btn">
                              {text.exportButton}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* THE CROPPING STUDIO */}
                  <div className="compile-studio-container" style={{ position: 'relative' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#888' }}>{text.compileStudioTitle}</h4>

                    {/* Asset Upload Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      {[
                        { id: 'trayBg', label: text.assetTrayBg },
                        { id: 'cardBack', label: text.assetCardBack },
                        { id: 'citizen', label: text.assetCitizen },
                        { id: 'sheriff', label: text.assetSheriff },
                        { id: 'mafia', label: text.assetMafia },
                        { id: 'don', label: text.assetDon }
                      ].map(asset => (
                        <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a1a', padding: '0.8rem', borderRadius: '4px', border: tempVaultFiles.includes(asset.id) ? '1px solid #2e7d32' : '1px solid #333' }}>
                          <span style={{ color: tempVaultFiles.includes(asset.id) ? '#2e7d32' : 'var(--text-white)' }}>
                            {asset.label} {tempVaultFiles.includes(asset.id) && '✓'}
                          </span>
                          <label className="primary-btn" style={{ cursor: 'pointer', width: '110px', textAlign: 'center', padding: '0.3rem 0', fontSize: '0.8rem', backgroundColor: '#333', flexShrink: 0 }}>
                            {text.uploadBtn}
                            <input type="file" accept="image/*" onChange={(e) => onSelectCropFile(e, asset.id)} style={{ display: 'none' }} />
                          </label>
                        </div>
                      ))}
                    </div>

                    {/* Final Compile Form */}
                    <div className="compile-form-row">
                      <input type="text" className="login-input" placeholder={text.packNamePlaceholder} value={newPackName} onChange={e => setNewPackName(e.target.value)} style={{ flex: 2, padding: '0.6rem', fontSize: '0.9rem' }} />
                      <input type="text" className="login-input" placeholder={text.authorPlaceholder} value={newPackAuthor} onChange={e => setNewPackAuthor(e.target.value)} style={{ flex: 1, padding: '0.6rem', fontSize: '0.9rem' }} />
                      <input type="text" className="login-input" placeholder="v1.0.0" value={newPackVersion} onChange={e => setNewPackVersion(e.target.value)} style={{ width: '80px', padding: '0.6rem', fontSize: '0.9rem' }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => { handleCompilePack(); setTempVaultFiles([]); }}
                      className="primary-btn"
                      style={{ width: '100%', backgroundColor: tempVaultFiles.length >= 6 ? '#1976d2' : '#333', padding: '0.8rem', fontSize: '1rem', transition: 'background-color 0.3s' }}
                      disabled={tempVaultFiles.length === 0}
                    >
                      {tempVaultFiles.length >= 6 ? text.compileReadyBtn : text.compilePendingBtn}
                    </button>

                    {/* THE CROPPER MODAL */}
                    {cropFile && (
                      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Cropper
                            image={cropFile}
                            crop={crop}
                            zoom={zoom}
                            aspect={2.5 / 3.5}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                          />
                        </div>
                        <div style={{ padding: '2rem', backgroundColor: 'var(--surface-black)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', borderTop: '1px solid var(--accent-gold)' }}>
                          <button type="button" onClick={() => setCropFile(null)} className="primary-btn" style={{ backgroundColor: 'var(--accent-red)' }}>{text.cancelBtn}</button>
                          <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(e.target.value)} style={{ width: '300px' }} />
                          <button type="button" onClick={handleSaveCrop} className="primary-btn" style={{ backgroundColor: '#2e7d32' }}>{text.saveCropBtn}</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button type="submit" className="primary-btn" style={{ backgroundColor: '#2e7d32', marginTop: '2rem' }}>
                {text.saveSettings}
              </button>
            </form>
          )}

          {activeTab !== 'overview' && activeTab !== 'streams' && activeTab !== 'security' && activeTab !== 'settings' && renderRoomDetails(activeTab)}

        </div>
        <footer className="lobby-footer" style={{ justifyContent: 'center', padding: '1rem', borderTop: '1px solid #333' }}>
          <span className="version-text">v{packageJson.version}</span>
        </footer>
      </main>
    </div>
  );
};

export default Admin;