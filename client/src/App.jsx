import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './utils/AuthContext';
import { socket, deviceId } from './utils/socket';
import ProtectedRoute from './components/ProtectedRoute';

// Import Views
import LobbyView from './pages/LobbyView';
import LoginView from './pages/LoginView';
import AdminView from './pages/AdminView';
import JudgeView from './pages/JudgeView';
import PlayerView from './pages/PlayerView';
import StreamView from './pages/StreamView';

// We put the main logic inside this child component so it can use the 'useNavigate' hook
function AppContent() {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const navigate = useNavigate();

  useEffect(() => {
    function onConnect() { 
      setIsConnected(true); 
      socket.emit('IDENTIFY', deviceId); // Tell the server who we are!
    }
    function onDisconnect() { setIsConnected(false); }
    
    function onStateUpdate(newState) {
      setGameState(newState);
    }

    // THE TELEPORTER
    function onRoleAssigned(newRole) {
      console.log(`Server assigned role: ${newRole}`);
      if (newRole === 'PLAYER') navigate('/player');
      else if (newRole === 'JUDGE') navigate('/judge');
      else if (newRole === 'STREAM') navigate('/stream');
      else if (newRole === 'UNASSIGNED') {
        // FIX: Do not bounce the stream source back to the lobby!
        if (window.location.pathname !== '/stream') {
          navigate('/');
        }
      }
      // If newRole is 'PENDING_STREAM', do nothing! Stay on the stream waiting page.
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('STATE_UPDATE', onStateUpdate);
    socket.on('ROLE_ASSIGNED', onRoleAssigned);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('STATE_UPDATE', onStateUpdate);
      socket.off('ROLE_ASSIGNED', onRoleAssigned);
    };
  }, [navigate]);

  return (
    <>
      {/* Global Debug Banner */}
      {gameState?.isDebugMode && (
        <div style={{ backgroundColor: '#dc2626', color: 'white', textAlign: 'center', padding: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Warning: Debug Mode Active. Deck is Exposed.
        </div>
      )}

      {/* Connection Warning Header */}
      {!isConnected && (
        <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', textAlign: 'center', padding: '8px', borderBottom: '1px solid #fecaca' }}>
          Server Disconnected. Attempting to reconnect...
        </div>
      )}

      {/* Routes */}
      <div style={{ padding: '20px' }}>
        <Routes>
          <Route path="/" element={<LobbyView />} />
          <Route path="/login" element={<LoginView />} />
          
          {/* We use a placeholder for Player until we actually build the file */}
          <Route path="/player" element={<PlayerView gameState={gameState} />} />
          
          <Route path="/judge" element={<JudgeView gameState={gameState} />} />
          <Route path="/stream" element={<StreamView />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminView gameState={gameState} />} />
          </Route>
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}