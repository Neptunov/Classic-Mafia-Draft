/**
 * @file src/pages/LoginView.jsx
 * @description Secure authentication interface for Tournament Administrators.
 * Validates the master password against the server's cryptographic hash.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { socket } from '../utils/socket';
import { useAuth } from '../utils/AuthContext';
import packageJson from '../../package.json';
import '../App.css'; 
import './Lobby.css'; 

const LoginView = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isDebugMode, setIsDebugMode] = useState(false); // Can sync with global state if needed

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.trim() === '') return;

    socket.emit('ADMIN_LOGIN', password, (response) => {
      if (response.success) {
        setPassword('');
		login();
        navigate('/admin');
      } else {
        setErrorMsg(response.message || 'Invalid Password');
        setPassword(''); 
      }
    });
  };

  return (
    <div className="lobby-container">
      
      {/* HEADER (Same as Lobby) */}
      <header className="lobby-header">
        <div className="status-indicator">
          <Wifi color={isConnected ? "var(--text-white)" : "var(--accent-red)"} size={20} />
          <span style={{ color: isConnected ? "var(--text-white)" : "var(--accent-red)" }}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        
        {isDebugMode && (
          <div className="debug-mode">
            <ShieldAlert size={20} />
            <span>Debug Mode Active</span>
          </div>
        )}
      </header>

      {/* BODY */}
      <main className="lobby-body">
        <div className="login-card">
          
          <div className="login-header">
            <h2>Admin Portal</h2>
            <p>Authorized personnel only</p>
          </div>
          
          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div className="input-group">
              <label htmlFor="adminPassword">Master Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', color: '#666' }} />
                <input 
                  type="password" 
                  id="adminPassword"
                  className="login-input" 
                  style={{ paddingLeft: '2.5rem', borderColor: errorMsg ? 'var(--accent-red)' : '' }}
                  placeholder="Enter master password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  autoComplete="current-password"
                  required
                />
              </div>
              {errorMsg && (
                <span style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {errorMsg}
                </span>
              )}
            </div>
            
            <button type="submit" className="primary-btn">
              Authenticate
            </button>

            <button 
              type="button" 
              onClick={() => navigate('/')}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#888', 
                cursor: 'pointer', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '0.5rem',
                marginTop: '0.5rem'
              }}
            >
              <ArrowLeft size={16} />
              Return to Lobby
            </button>

          </form>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="lobby-footer">
        <span className="version-text">v{packageJson.version}</span>
      </footer>
      
    </div>
  );
};

export default LoginView;