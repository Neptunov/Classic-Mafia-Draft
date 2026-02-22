import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../utils/socket';
import { useAuth } from '../utils/AuthContext';

export default function LoginView() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsChecking(true);
    setError('');

    // Emit the password to the backend and wait for the callback response
    socket.emit('ADMIN_LOGIN', password, (response) => {
      setIsChecking(false);
      if (response.success) {
        login(); // Update our local auth context
        navigate('/admin'); // Redirect to the admin dashboard
      } else {
        setError(response.message || 'Invalid password');
        setPassword('');
      }
    });
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>Admin Authentication</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          placeholder="Enter Admin Password"
          style={{ padding: '12px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
        />
        <button 
          type="submit" 
          disabled={isChecking}
          style={{ padding: '12px', fontSize: '16px', backgroundColor: '#111827', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isChecking ? 'Verifying...' : 'Unlock Console'}
        </button>
      </form>
      {error && <p style={{ color: '#dc2626', fontWeight: 'bold', marginTop: '15px' }}>{error}</p>}
    </div>
  );
}