/**
 * @file src/pages/Setup.jsx
 * @description First-time initialization screen.
 * Prompts the user to create the master administrative password,
 * which the server will hash and persist in store.json.
 */

import React, { useState, useEffect } from 'react';
import { Wifi, Lock, ShieldCheck } from 'lucide-react';
import { socket } from '../utils/socket';
import { useLanguage } from '../utils/LanguageContext';
import packageJson from '../../package.json';
import '../App.css'; 

const Setup = () => {
  const { text: dictionary } = useLanguage();
  const text = dictionary.setup;
  
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 4) {
      setError(text.errorLength);
      return;
    }
    if (password !== confirm) {
      setError(text.errorMatch);
      return;
    }
    
    // Send the new master password to the backend.
    // The server will update state and App.jsx will automatically unmount this component.
    socket.emit('SETUP_ADMIN', password);
  };

  return (
    <div className="lobby-container">
      
      {/* STANDARD HEADER */}
      <header className="lobby-header">
        <div className="status-indicator">
          <Wifi color={isConnected ? "var(--text-white)" : "var(--accent-red)"} size={20} />
          <span style={{ color: isConnected ? "var(--text-white)" : "var(--accent-red)" }}>
            {isConnected ? text.connected : text.disconnected}
          </span>
        </div>
      </header>

      {/* BODY */}
      <main className="lobby-body">
        <div className="login-card" style={{ maxWidth: '450px' }}>
          
          <div className="login-header">
            <h2 style={{ color: 'var(--accent-gold)' }}>{text.title}</h2>
            <p style={{ marginTop: '0.5rem' }}>{text.subtitle}</p>
          </div>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* PASSWORD INPUT */}
            <div className="input-group">
              <label htmlFor="setupPassword">{text.passLabel}</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                <Lock size={18} style={{ position: 'absolute', insetInlineStart: '12px', color: '#666' }} />
                <input 
                  type="password" 
                  id="setupPassword"
                  className="login-input" 
                  style={{ paddingLeft: '2.5rem', borderColor: error ? 'var(--accent-red)' : '' }}
                  placeholder={text.passPlaceholder}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(''); 
                  }}
                  required
                />
              </div>
            </div>

            {/* CONFIRM PASSWORD INPUT */}
            <div className="input-group">
              <label htmlFor="confirmPassword">{text.confirmLabel}</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                <Lock size={18} style={{ position: 'absolute', insetInlineStart: '12px', color: '#666' }} />
                <input 
                  type="password" 
                  id="confirmPassword"
                  className="login-input" 
                  style={{ paddingLeft: '2.5rem', borderColor: error ? 'var(--accent-red)' : '' }}
                  placeholder={text.confirmPlaceholder}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setError(''); 
                  }}
                  required
                />
              </div>
              
              {/* ERROR DISPLAY */}
              {error && (
                <span style={{ color: 'var(--accent-red)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {error}
                </span>
              )}
            </div>
            
            <button type="submit" className="primary-btn" style={{ backgroundColor: '#2e7d32', marginTop: '0.5rem' }}>
              <ShieldCheck size={20} />
              {text.submitButton}
            </button>

          </form>
        </div>
      </main>

      {/* STANDARD FOOTER */}
      <footer className="lobby-footer" style={{ justifyContent: 'center' }}>
        <span className="version-text">v{packageJson.version}</span>
      </footer>
      
    </div>
  );
};

export default Setup;