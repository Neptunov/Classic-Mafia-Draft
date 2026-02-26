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
import { en } from '../locales/en';
import packageJson from '../../package.json';
import CryptoJS from 'crypto-js';
import '../App.css'; 
import './Lobby.css'; 

const LoginView = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const text = en.login;
  
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isDebugMode, setIsDebugMode] = useState(false); 

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    
    const onDebugUpdate = (state) => setIsDebugMode(state);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('GLOBAL_DEBUG_UPDATE', onDebugUpdate); 

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('GLOBAL_DEBUG_UPDATE', onDebugUpdate); 
    };
  }, []);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.trim() === '') return;

    socket.emit('REQUEST_LOGIN_CHALLENGE', (challengeData) => {
      if (!challengeData.success) {
        setErrorMsg(challengeData.message);
        return;
      }

      const { salt, nonce } = challengeData;

      const baseHash = CryptoJS.PBKDF2(password, salt, { 
        keySize: 512 / 32,
        iterations: 10000, 
        hasher: CryptoJS.algo.SHA512 
      }).toString(CryptoJS.enc.Hex);

      const hmacResponse = CryptoJS.HmacSHA256(baseHash, nonce).toString(CryptoJS.enc.Hex);

      socket.emit('ADMIN_LOGIN', hmacResponse, (loginResponse) => {
        if (loginResponse.success) {
          setPassword('');
          login(); 
          navigate('/admin');
        } else {
          setErrorMsg(loginResponse.message || text.defaultError);
          setPassword(''); 
        }
      });
    });
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
          
          <div className="login-header">
            <h2>{text.title}</h2>
            <p>{text.subtitle}</p>
          </div>
          
          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div className="input-group">
              <label htmlFor="adminPassword">{text.passwordLabel}</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', color: '#666' }} />
                <input 
                  type="password" 
                  id="adminPassword"
                  className="login-input" 
                  style={{ paddingLeft: '2.5rem', borderColor: errorMsg ? 'var(--accent-red)' : '' }}
                  placeholder={text.passwordPlaceholder}
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
              {text.authButton}
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
              {text.returnButton}
            </button>

          </form>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="lobby-footer" style={{ justifyContent: 'center' }}>
        <span className="version-text">v{packageJson.version}</span>
      </footer>
      
    </div>
  );
};

export default LoginView;