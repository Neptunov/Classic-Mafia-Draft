import { useState } from 'react';
import { socket } from '../utils/socket';

export default function SetupView() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    
    // Send the new master password to the backend
    socket.emit('SETUP_ADMIN', password);
  };

  return (
    <div style={{ maxWidth: '450px', margin: '100px auto', textAlign: 'center', fontFamily: 'sans-serif', backgroundColor: '#1f2937', padding: '40px', borderRadius: '12px', color: 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
      <h2 style={{ color: '#10b981', marginTop: 0 }}>Tournament Initialization</h2>
      <p style={{ color: '#9ca3af', marginBottom: '25px', fontSize: '14px' }}>Welcome! To secure your live tournament, please create a master administrative password.</p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} 
          placeholder="New Master Password"
          style={{ padding: '12px', fontSize: '16px', borderRadius: '6px', border: '1px solid #4b5563', backgroundColor: '#111827', color: 'white' }} required
        />
        <input 
          type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} 
          placeholder="Confirm Password"
          style={{ padding: '12px', fontSize: '16px', borderRadius: '6px', border: '1px solid #4b5563', backgroundColor: '#111827', color: 'white' }} required
        />
        <button type="submit" style={{ padding: '12px', fontSize: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
          Initialize Server
        </button>
      </form>
      {error && <p style={{ color: '#ef4444', marginTop: '15px', fontWeight: 'bold' }}>{error}</p>}
    </div>
  );
}