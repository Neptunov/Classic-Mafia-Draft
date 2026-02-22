import { useState, useEffect } from 'react';
import { socket } from '../utils/socket';
import { Link } from 'react-router-dom';

export default function LobbyView() {
  const [name, setName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // ---> THE FIX: Handle hidden socket reconnections <---
  useEffect(() => {
    const handleReconnect = () => {
      // If Vite hot-reloads or Wi-Fi drops, automatically re-register the name!
      if (isSubmitted && name.trim()) {
        socket.emit('SET_NAME', name.trim());
      }
    };

    socket.on('connect', handleReconnect);
    return () => socket.off('connect', handleReconnect);
  }, [isSubmitted, name]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      socket.emit('SET_NAME', name.trim());
      setIsSubmitted(true);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '100px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '10px' }}>Mafia Draft Lobby</h1>
      
      {!isSubmitted ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <p style={{ color: '#4b5563' }}>Enter your name or device description to join:</p>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="e.g., Main iPad, Player 1, Judge Laptop"
            style={{ padding: '15px', fontSize: '18px', borderRadius: '8px', border: '1px solid #ccc' }}
            required
          />
          <button type="submit" style={{ padding: '15px', fontSize: '18px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Connect to Lobby
          </button>
        </form>
      ) : (
        <div style={{ backgroundColor: '#f3f4f6', padding: '40px 20px', borderRadius: '12px' }}>
          <h2 style={{ color: '#3b82f6', marginBottom: '15px' }}>Connected as: {name}</h2>
          <div style={{ display: 'inline-block', width: '20px', height: '20px', border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#6b7280', marginTop: '15px', fontWeight: 'bold' }}>Waiting for Admin to assign your role...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <div style={{ marginTop: '50px' }}>
        <Link to="/login" style={{ color: '#d1d5db', textDecoration: 'none', fontSize: '12px' }}>Admin Login</Link>
      </div>
    </div>
  );
}