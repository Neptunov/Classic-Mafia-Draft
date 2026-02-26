/**
 * @file App.jsx
 * @description Root frontend application component. 
 * Manages global application state, socket connections, and view routing based on assigned roles.
 */
 
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './utils/AuthContext';
import { socket, getDeviceId, setDeviceId } from './utils/socket';
import ProtectedRoute from './components/ProtectedRoute';

import LobbyView from './pages/Lobby';
import LoginView from './pages/Login';
import AdminView from './pages/Admin';
import JudgeView from './pages/Judge';
import PlayerView from './pages/Player';
import StreamView from './pages/Stream';
import SetupView from './pages/Setup';

function AppContent() {
  const [gameState, setGameState] = useState(null);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function onConnect() { 
      setIsConnected(true); 
    }
    
    function onDisconnect() { setIsConnected(false); }
    
    function onAssignNewDeviceId(newSecureId) {
      setDeviceId(newSecureId);
      socket.emit('IDENTIFY', newSecureId); 
    }

    function onStateUpdate(newState) { setGameState(newState); }

    function onRoleAssigned(newRole) {
      console.log(`Server assigned role: ${newRole}`);
      if (newRole === 'PLAYER') navigate('/player');
      else if (newRole === 'JUDGE') navigate('/judge');
      else if (newRole === 'STREAM') navigate('/stream');
      else if (newRole === 'UNASSIGNED') {
        if (window.location.pathname !== '/stream') navigate('/');
      }
    }

    socket.on('SETUP_REQUIRED', () => setIsSetupRequired(true));
    socket.on('SETUP_COMPLETE', () => setIsSetupRequired(false));

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('ASSIGN_NEW_DEVICE_ID', onAssignNewDeviceId);
    socket.on('STATE_UPDATE', onStateUpdate);
    socket.on('ROLE_ASSIGNED', onRoleAssigned);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('ASSIGN_NEW_DEVICE_ID', onAssignNewDeviceId);
      socket.off('STATE_UPDATE', onStateUpdate);
      socket.off('ROLE_ASSIGNED', onRoleAssigned);
      socket.off('SETUP_REQUIRED');
      socket.off('SETUP_COMPLETE');
    };
  }, [navigate]);
  
  return (
    <>
      <div style={{ padding: '0px'}}>
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