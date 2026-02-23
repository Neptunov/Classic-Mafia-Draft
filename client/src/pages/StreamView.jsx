/**
 * @file StreamView.jsx
 * @description The transparent cinematic overlay designed for OBS Studio.
 * Synchronizes with the live table state and enforces an "Audience Protection Timer" 
 * to guarantee viewer legibility regardless of player interaction speed.
 */
import { useState, useEffect, useRef } from 'react';
import { socket, deviceId } from '../utils/socket';

export default function StreamView() {
  const [isVerified, setIsVerified] = useState(false);
  const [clientIp, setClientIp] = useState('Detecting network IP...');
  const [gameState, setGameState] = useState(null);
  
  const [queue, setQueue] = useState([]);
  const [currentReveal, setCurrentReveal] = useState(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [clearSignal, setClearSignal] = useState(0); 
  
  const isClosingRef = useRef(false);
  const revealStartTime = useRef(0); 

  useEffect(() => {
    socket.emit('REQUEST_STREAM_ACCESS', { userAgent: navigator.userAgent, deviceId });

    const handleRoleAssigned = (role) => setIsVerified(role === 'STREAM');
    const handleReveal = (data) => setQueue((prevQueue) => [...prevQueue, data]);
    
    const handleStateUpdate = (state) => {
      setGameState(state);
      if (state.status === 'PENDING') {
        setQueue([]);
        setCurrentReveal(null);
        setIsFlipping(false);
        isClosingRef.current = false;
      }
    };

    socket.on('ROLE_ASSIGNED', handleRoleAssigned);
    socket.on('CARD_REVEALED', handleReveal);
    socket.on('STATE_UPDATE', handleStateUpdate);
    socket.on('STREAM_IP', setClientIp);
    socket.on('CLEAR_STREAM', () => setClearSignal(prev => prev + 1));
    
    return () => {
      socket.off('ROLE_ASSIGNED'); socket.off('CARD_REVEALED');
      socket.off('STATE_UPDATE'); socket.off('STREAM_IP'); socket.off('CLEAR_STREAM');
    };
  }, []);

  useEffect(() => {
    if (!currentReveal && queue.length > 0 && !isClosingRef.current) {
      setCurrentReveal(queue[0]);
      setQueue((prevQueue) => prevQueue.slice(1));
    }
  }, [currentReveal, queue]);

  useEffect(() => {
    if (currentReveal) {
      revealStartTime.current = Date.now(); 
      const flipIn = setTimeout(() => setIsFlipping(true), 150);
      const failsafe = setTimeout(() => triggerClose(), 7000); 
      return () => { clearTimeout(flipIn); clearTimeout(failsafe); };
    }
  }, [currentReveal]);

  useEffect(() => {
    if (currentReveal && clearSignal > 0) {
      triggerClose();
    }
  }, [clearSignal]);

  const triggerClose = () => {
    if (isClosingRef.current || !currentReveal) return;
    
    const MIN_DISPLAY_TIME = 2500; 
    const elapsed = Date.now() - revealStartTime.current;

    if (elapsed < MIN_DISPLAY_TIME) {
      setTimeout(() => executeClose(), MIN_DISPLAY_TIME - elapsed);
    } else {
      executeClose();
    }
  };

  const executeClose = () => {
    isClosingRef.current = true;
    setIsFlipping(false); 
    
    setTimeout(() => {
      setCurrentReveal(null);
      isClosingRef.current = false; 
    }, 500); 
  };


  if (!isVerified) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', color: 'white', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h2 style={{ color: '#3b82f6', marginBottom: '10px' }}>Stream Source Connected</h2>
        <p style={{ color: '#9ca3af', marginBottom: '20px' }}>Waiting for Admin to assign a table...</p>
        
        <div style={{ backgroundColor: '#1f2937', padding: '15px 30px', borderRadius: '8px', border: '1px solid #374151' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>Source IP Address</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{clientIp}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100vw', height: '100vh', 
      backgroundColor: 'transparent',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
      fontFamily: 'sans-serif', overflow: 'hidden' 
    }}>
      
      <style>{`
        :root, html, body, #root { 
          background-color: transparent !important; 
          background: transparent !important;
        }
        
        @keyframes dropIn { 
          from { opacity: 0; transform: translateY(-50px) scale(0.9); } 
          to { opacity: 1; transform: translateY(0) scale(1); } 
        }

        .stream-card-container { width: 320px; height: 480px; perspective: 1000px; margin-bottom: 25px; animation: dropIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .stream-card-inner {
          position: relative; width: 100%; height: 100%; text-align: center;
          transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
          transform-style: preserve-3d;
          transform: ${isFlipping ? 'rotateY(180deg)' : 'rotateY(0deg)'};
        }
        .stream-card-front, .stream-card-back {
          position: absolute; width: 100%; height: 100%; backface-visibility: hidden;
          border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: bold;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        }
        .stream-card-front { background: #1f2937; border: 6px solid #3b82f6; color: #3b82f6; }
        .stream-card-back {
          transform: rotateY(180deg); color: white; border: 6px solid white;
          background: ${currentReveal?.role === 'Citizen' ? '#dc2626' : (currentReveal?.role === 'Mafia' || currentReveal?.role === 'Don') ? '#000' : currentReveal?.role === 'Sheriff' ? '#d97706' : '#6b21a8'};
        }
        .seat-badge {
          background-color: #fbbf24; color: black; padding: 12px 40px; border-radius: 50px;
          font-size: 28px; font-weight: bold; box-shadow: 0 10px 20px rgba(0,0,0,0.4);
          text-transform: uppercase; letter-spacing: 3px; animation: dropIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>

      {currentReveal && (
        <>
          <div className="stream-card-container">
            <div className="stream-card-inner">
              <div className="stream-card-front">?</div>
              <div className="stream-card-back">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px', opacity: 0.8, marginBottom: '5px', letterSpacing: '2px' }}>ROLE</span>
                  <span style={{ fontSize: '50px', textTransform: 'uppercase' }}>{currentReveal.role}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="seat-badge">
            SEAT {currentReveal.seat}
          </div>
        </>
      )}
    </div>
  );
}