import { useState, useEffect } from 'react';
import { socket } from '../utils/socket';
import { Link } from 'react-router-dom';

export default function LobbyView() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    // Listen for the live list of rooms
    socket.on('AVAILABLE_ROOMS', (roomsList) => {
      setAvailableRooms(roomsList);
      // Auto-select the first room if one isn't selected
      if (roomsList.length > 0 && !roomCode) setRoomCode(roomsList[0]);
    });

    const handleReconnect = () => {
      if (isSubmitted && name.trim() && roomCode.trim()) {
        socket.emit('JOIN_ROOM', { name: name.trim(), roomCode: roomCode.trim() });
      }
    };
    
    socket.on('connect', handleReconnect);
    
    return () => {
      socket.off('AVAILABLE_ROOMS');
      socket.off('connect', handleReconnect);
    };
  }, [isSubmitted, name, roomCode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim() && roomCode.trim()) {
      socket.emit('JOIN_ROOM', { name: name.trim(), roomCode: roomCode.trim() });
      setIsSubmitted(true);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '100px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '10px' }}>Mafia Draft Lobby</h1>
      
      {!isSubmitted ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <p style={{ color: '#4b5563' }}>Select a table and enter your device name:</p>
          
          {availableRooms.length === 0 ? (
            <div style={{ padding: '15px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #f87171' }}>
              Waiting for Tournament Admin to open a room...
            </div>
          ) : (
            <>
              <select 
                value={roomCode} onChange={(e) => setRoomCode(e.target.value)}
                style={{ 
                  padding: '15px', 
                  fontSize: '18px', 
                  borderRadius: '8px', 
                  border: '1px solid #ccc', 
                  backgroundColor: 'white', 
                  color: '#111827' // <-- FIXED: Forces text to be dark
                }} required
              >
                {availableRooms.map(room => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
              <input 
                type="text" value={name} onChange={(e) => setName(e.target.value)} 
                placeholder="Device Name (e.g., Player 1 iPad)"
                style={{ 
                  padding: '15px', 
                  fontSize: '18px', 
                  borderRadius: '8px', 
                  border: '1px solid #ccc',
                  backgroundColor: 'white', // <-- FIXED: Forces background to be white
                  color: '#111827'          // <-- FIXED: Forces text to be dark
                }} required
              />
              <button type="submit" style={{ padding: '15px', fontSize: '18px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                Connect to Table
              </button>
            </>
          )}
        </form>
      ) : (
        <div style={{ backgroundColor: '#f3f4f6', padding: '40px 20px', borderRadius: '12px' }}>
          <h2 style={{ color: '#3b82f6', marginBottom: '5px' }}>Connected as: {name}</h2>
          <p style={{ color: '#4b5563', fontWeight: 'bold', marginBottom: '15px' }}>Room: {roomCode}</p>
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