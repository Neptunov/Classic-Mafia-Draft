/**
 * @file App.jsx
 * @description Root frontend application component. 
 * Manages global application state, socket connections, and view routing based on assigned roles.
 */
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './utils/AuthContext';
import { socket, deviceId } from './utils/socket';
import ProtectedRoute from './components/ProtectedRoute';

import LobbyView from './pages/Lobby';
import LoginView from './pages/LoginView';
import AdminView from './pages/AdminView';
import JudgeView from './pages/JudgeView';
import PlayerView from './pages/PlayerView';
import StreamView from './pages/StreamView';
import SetupView from './pages/SetupView';

function AppContent() {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function onConnect() { 
      setIsConnected(true); 
      socket.emit('IDENTIFY', deviceId); 
    }
    function onDisconnect() { setIsConnected(false); }
    
    function onStateUpdate(newState) {
      setGameState(newState);
    }

    function onRoleAssigned(newRole) {
      console.log(`Server assigned role: ${newRole}`);
      if (newRole === 'PLAYER') navigate('/player');
      else if (newRole === 'JUDGE') navigate('/judge');
      else if (newRole === 'STREAM') navigate('/stream');
      else if (newRole === 'UNASSIGNED') {
        if (window.location.pathname !== '/stream') {
          navigate('/');
        }
      }
    }

    socket.on('SETUP_REQUIRED', () => setIsSetupRequired(true));
    socket.on('SETUP_COMPLETE', () => setIsSetupRequired(false));

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('STATE_UPDATE', onStateUpdate);
    socket.on('ROLE_ASSIGNED', onRoleAssigned);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('STATE_UPDATE', onStateUpdate);
      socket.off('ROLE_ASSIGNED', onRoleAssigned);
      socket.off('SETUP_REQUIRED');
      socket.off('SETUP_COMPLETE');
    };
  }, [navigate]);
  
  const isLobbyView = location.pathname === '/';
  
  return (
    <>
      {!isLobbyView && gameState?.isDebugMode && (
        <div style={{ backgroundColor: '#dc2626', color: 'white', textAlign: 'center', padding: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Warning: Debug Mode Active. Deck is Exposed.
        </div>
      )}

      {!isLobbyView && !isConnected && (
        <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', textAlign: 'center', padding: '8px', borderBottom: '1px solid #fecaca' }}>
          Server Disconnected. Attempting to reconnect...
        </div>
      )}

      {/* Conditionally apply the legacy wrapper and padding */}
      <div 
        className={!isLobbyView ? "legacy-view" : ""} 
        style={{ padding: isLobbyView ? '0px' : '20px' }}
      >
        {isSetupRequired ? (
          <SetupView />
        ) : (
          <Routes>
            <Route path="/" element={<LobbyView />} />
            <Route path="/login" element={<LoginView />} />
            <Route path="/player" element={<PlayerView gameState={gameState} />} />
            <Route path="/judge" element={<JudgeView gameState={gameState} />} />
            <Route path="/stream" element={<StreamView />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<AdminView gameState={gameState} />} />
            </Route>
          </Routes>
        )}
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