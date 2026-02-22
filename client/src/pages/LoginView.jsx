import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { socket } from '../utils/socket';

export default function LoginView() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // Admin no longer passes a room code
    socket.emit('ADMIN_LOGIN', password, (response) => {
      if (response.success) {
        login();
        navigate('/admin');
      } else {
        setError(response.message);
      }
    });
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>Super Admin Login</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <input 
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} 
          placeholder="Enter Admin Password"
          style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }} required
        />
        <button type="submit" style={{ padding: '10px', fontSize: '16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          Login to Dashboard
        </button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '15px' }}>{error}</p>}
    </div>
  );
}