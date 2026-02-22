import { useState, useEffect } from 'react';
import { socket, deviceId } from '../utils/socket';

export default function StreamView() {
  const [isVerified, setIsVerified] = useState(false);
  
  // NEW: The Queue System
  const [queue, setQueue] = useState([]);
  const [currentReveal, setCurrentReveal] = useState(null);

  useEffect(() => {
    socket.emit('REQUEST_STREAM_ACCESS', { 
      userAgent: navigator.userAgent, 
      deviceId: deviceId 
    });

    const handleRoleAssigned = (role) => {
      if (role === 'STREAM') setIsVerified(true);
      if (role === 'UNASSIGNED') setIsVerified(false);
    };

    // 1. When a card is revealed, add it to the BACK of the line
    const handleReveal = (data) => {
      setQueue((prevQueue) => [...prevQueue, data]);
    };

    // 2. If the Judge resets the draft, instantly clear the screen and the queue
    const handleStateUpdate = (state) => {
      if (state.status === 'PENDING') {
        setQueue([]);
        setCurrentReveal(null);
      }
    };

    socket.on('ROLE_ASSIGNED', handleRoleAssigned);
    socket.on('CARD_REVEALED', handleReveal);
    socket.on('STATE_UPDATE', handleStateUpdate);
    
    return () => {
      socket.off('ROLE_ASSIGNED', handleRoleAssigned);
      socket.off('CARD_REVEALED', handleReveal);
      socket.off('STATE_UPDATE', handleStateUpdate);
    };
  }, []);

  // 3. THE QUEUE PROCESSOR: Pulls the next card only when the screen is empty
  useEffect(() => {
    if (!currentReveal && queue.length > 0) {
      setCurrentReveal(queue[0]);
      setQueue((prevQueue) => prevQueue.slice(1));
    }
  }, [currentReveal, queue]);

  // 4. THE TIMER: Clears the screen exactly 6 seconds after a card appears
  useEffect(() => {
    if (currentReveal) {
      const hideTimer = setTimeout(() => {
        setCurrentReveal(null);
      }, 6000);
      
      // If the component unmounts, clear the timer. 
      // Because 'queue' is NOT in the dependency array below, 
      // adding new cards won't accidentally cancel this timer anymore!
      return () => clearTimeout(hideTimer);
    }
  }, [currentReveal]);

  // --- VIEW 1: THE WAITING SCREEN ---
  if (!isVerified) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', color: 'white', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h2 style={{ color: '#3b82f6', marginBottom: '10px' }}>Stream Source Connected</h2>
        <p style={{ color: '#9ca3af' }}>Waiting for Admin to verify this overlay...</p>
        <p style={{ fontSize: '12px', color: '#4b5563', marginTop: '20px' }}>{navigator.userAgent}</p>
      </div>
    );
  }

  // --- VIEW 2: THE VERIFIED OVERLAY ---
  const forceTransparentBackground = (
    <style>{`
      html, body, #root { 
        background-color: transparent !important; 
      }
    `}</style>
  );

  // If nothing is happening, render the transparent box
  if (!currentReveal) {
    return (
      <>
        {forceTransparentBackground}
        <div style={{ width: '100vw', height: '100vh', backgroundColor: 'transparent' }} />
      </>
    );
  }

  let accentColor = '#9ca3af'; 
  if (currentReveal.role === 'Citizen') accentColor = '#dc2626'; 
  if (currentReveal.role === 'Sheriff') accentColor = '#d97706'; 
  if (currentReveal.role === 'Mafia') accentColor = '#111827';   
  if (currentReveal.role === 'Don') accentColor = '#6b21a8';     

  return (
    <>
      {forceTransparentBackground}
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        backgroundColor: 'transparent', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: 'sans-serif'
      }}>
        <style>{`
          @keyframes slideUpFadeIn {
            0% { transform: translateY(100px) scale(0.8); opacity: 0; }
            15% { transform: translateY(0) scale(1.1); opacity: 1; }
            25% { transform: translateY(0) scale(1); opacity: 1; }
            80% { transform: translateY(0) scale(1); opacity: 1; }
            100% { transform: translateY(-50px) scale(0.9); opacity: 0; }
          }
        `}</style>

        {/* IMPORTANT: The 'key' forces React to rebuild the element, restarting the animation */}
        <div key={currentReveal.seat} style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: `4px solid ${accentColor}`,
          borderRadius: '16px',
          padding: '40px 80px',
          textAlign: 'center',
          boxShadow: `0 20px 40px rgba(0,0,0,0.3), 0 0 40px ${accentColor}40`,
          animation: 'slideUpFadeIn 6s ease-in-out forwards'
        }}>
          <h2 style={{ color: '#6b7280', textTransform: 'uppercase', letterSpacing: '3px', margin: '0 0 10px 0', fontSize: '24px' }}>
            Seat {currentReveal.seat} Drew
          </h2>
          <h1 style={{ 
            fontSize: '5rem', 
            color: accentColor, 
            margin: 0, 
            textTransform: 'uppercase',
            textShadow: currentReveal.role === 'Mafia' ? '2px 2px 4px rgba(0,0,0,0.3)' : 'none'
          }}>
            {currentReveal.role}
          </h1>
        </div>
      </div>
    </>
  );
}