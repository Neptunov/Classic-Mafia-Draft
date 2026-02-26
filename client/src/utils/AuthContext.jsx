import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket } from './socket';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const handleRoleAssigned = (role) => {
      if (role === 'ADMIN') setIsAuthenticated(true);
    };

    socket.on('ROLE_ASSIGNED', handleRoleAssigned);
    return () => socket.off('ROLE_ASSIGNED', handleRoleAssigned);
  }, []);

  const login = () => setIsAuthenticated(true);
  
  const logout = () => setIsAuthenticated(false);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);