/**
 * @file src/utils/LanguageContext.jsx
 * @description Global i18n provider. Manages active dictionary and injects RTL DOM direction.
 */
import React, { createContext, useState, useEffect, useContext } from 'react';
import { socket } from './socket';
import { en } from '../locales/en';
import { ru } from '../locales/ru';
import { ua } from '../locales/ua';
import { he } from '../locales/he';

const dictionaries = { en, ru, he, ua };
const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem('tournament_lang') || 'en');
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const handleSettingsUpdate = (newSettings) => {
      if (newSettings) {
        setSettings(newSettings);
        if (newSettings.language) {
          setLanguage(newSettings.language);
          localStorage.setItem('tournament_lang', newSettings.language);
        }
      }
    };

    socket.on('GLOBAL_SETTINGS_UPDATE', handleSettingsUpdate);

    if (socket.connected) socket.emit('REQUEST_GLOBAL_SETTINGS');

    const onConnect = () => socket.emit('REQUEST_GLOBAL_SETTINGS');
    socket.on('connect', onConnect);

    return () => {
      socket.off('GLOBAL_SETTINGS_UPDATE', handleSettingsUpdate);
      socket.off('connect', onConnect);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const text = dictionaries[language] || en;

  return (
    <LanguageContext.Provider value={{ language, text, settings }}> {/* Add settings here */}
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);