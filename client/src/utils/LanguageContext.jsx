/**
 * @file src/utils/LanguageContext.jsx
 * @description Global i18n provider. Manages active dictionary and injects RTL DOM direction.
 */
import React, { createContext, useState, useEffect, useContext } from 'react';
import { socket } from './socket';
import { en } from '../locales/en';
import { ru } from '../locales/ru';
// Note: We will import ru, uk, he here in Phase 2

const dictionaries = { en, ru }; // Expand this as we add files
const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    // Listen for the Admin changing the global tournament settings
    socket.on('GLOBAL_SETTINGS_UPDATE', (settings) => {
      if (settings?.language) setLanguage(settings.language);
    });
    
    // Request initial settings on mount
    if (socket.connected) socket.emit('REQUEST_GLOBAL_SETTINGS');
    
    return () => socket.off('GLOBAL_SETTINGS_UPDATE');
  }, []);

  // --- THE RTL FLIP LOGIC ---
  useEffect(() => {
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const text = dictionaries[language] || en;

  return (
    <LanguageContext.Provider value={{ language, text }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);