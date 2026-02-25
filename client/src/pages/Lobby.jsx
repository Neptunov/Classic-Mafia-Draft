/**
 * @file src/pages/Lobby.jsx
 * @description Device registration and room selection interface.
 * Connects to the Socket.io server to register device sessions and 
 * listens for dynamic room availability.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, ShieldAlert, Key, LogIn, MonitorSmartphone } from 'lucide-react';
import { socket, deviceId } from '../utils/socket';
import { en } from '../locales/en';
import packageJson from '../../package.json';
import '../App.css'; 
import './Lobby.css';

const Lobby = () => {
  const navigate = useNavigate();
  const text = en.lobby; 
  
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isDebugMode, setIsDebugMode] = useState(false);
  
  const [deviceName, setDeviceName] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  
  const [availableRooms, setAvailableRooms] = useState([]);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const onRoomsUpdate = (rooms) => {
      setAvailableRooms(rooms);
      
      if (selectedRoom && !rooms.includes(selectedRoom)) {
        setSelectedRoom('');
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('AVAILABLE_ROOMS', onRoomsUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('AVAILABLE_ROOMS', onRoomsUpdate);
    };
  }, [selectedRoom]);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (deviceName.trim() !== '' && selectedRoom !== '') {
      setIsWaiting(true);
      
      socket.emit('JOIN_ROOM', { 
        name: deviceName,
        roomCode: selectedRoom 
      }); 
    }
  };

  const handleCancel = () => {
    setIsWaiting(false);
  };

  return (
    <div className="lobby-container">
      
      {/* HEADER */}
      <header className="lobby-header">
        <div className="status-indicator">
          <Wifi color={isConnected ? "var(--text-white)" : "var(--accent-red)"} size={20} />
          <span style={{ color: isConnected ? "var(--text-white)" : "var(--accent-red)" }}>
            {isConnected ? text.connected : text.disconnected}
          </span>
        </div>
        
        {isDebugMode && (
          <div className="debug-mode">
            <ShieldAlert size={20} />
            <span>{text.debugActive}</span>
          </div>
        )}
      </header>

      {/* BODY */}
      <main className="lobby-body">
        <div className="login-card">
          
          {!isWaiting ? (
            <>
              <div className="login-header">
                <h2>{text.title}</h2>
                <p>{text.subtitle}</p>
              </div>
              
              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                <div className="input-group">
                  <label htmlFor="deviceName">{text.deviceLabel}</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <MonitorSmartphone size={18} style={{ position: 'absolute', left: '12px', color: '#666' }} />
                    <input 
                      type="text" 
                      id="deviceName"
                      className="login-input" 
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder={text.devicePlaceholder}
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="roomSelect">{text.roomLabel}</label>
                  <select 
                    id="roomSelect" 
                    className="login-select"
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    required
                  >
                    <option value="" disabled>{text.roomPlaceholder}</option>
                    
                    {availableRooms.length > 0 ? (
                      availableRooms.map((roomName, index) => (
                        <option key={index} value={roomName}>{roomName}</option>
                      ))
                    ) : (
                      <option disabled>No Active Rooms (Ask Admin to Create One)</option>
                    )}
                  </select>
                </div>
                
                <button type="submit" className="primary-btn">
                  <LogIn size={20} />
                  {text.joinButton}
                </button>
              </form>
            </>
          ) : (
            <div className="waiting-container">
              <div className="waiting-spinner"></div>
              <h3 style={{ color: 'var(--accent-gold)' }}>{text.waitingTitle}</h3>
              <p style={{ color: '#888', fontSize: '0.9rem', maxWidth: '80%' }}>
                {text.waitingSubtitle
                  .replace('{device}', deviceName)
                  .replace('{room}', selectedRoom)
                }
              </p>
              <button 
                onClick={handleCancel} 
                style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {text.cancelButton}
              </button>
            </div>
          )}

        </div>
      </main>

      {/* FOOTER */}
      <footer className="lobby-footer">
        <span className="version-text">v{packageJson.version}</span>
        
        <button className="admin-btn" onClick={() => navigate('/login')}>
          <Key size={16} />
          {text.adminLogin}
        </button>
      </footer>
      
    </div>
  );
};

export default Lobby;