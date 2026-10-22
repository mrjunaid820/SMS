import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AcademicSession, SchoolSettings } from '@/types/database';
import { settingsApi } from '@/services/api';
import { INITIAL_SCHOOL_SETTINGS, INITIAL_SESSIONS } from '@/services/mockData';

interface SchoolContextType {
  settings: SchoolSettings;
  sessions: AcademicSession[];
  currentSession: AcademicSession | null;
  selectedSessionId: string;
  setSelectedSessionId: (id: string) => void;
  refreshSettings: () => Promise<void>;
  isLoading: boolean;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SchoolSettings>(INITIAL_SCHOOL_SETTINGS);
  const [sessions, setSessions] = useState<AcademicSession[]>(INITIAL_SESSIONS);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('b0000000-0000-0000-0000-000000000002');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sData, sesList] = await Promise.all([
        settingsApi.getSettings(),
        settingsApi.getSessions(),
      ]);
      setSettings(sData);
      setSessions(sesList);
      const curr = sesList.find((s) => s.is_current) || sesList[0];
      if (curr && !selectedSessionId) {
        setSelectedSessionId(curr.id);
      }
    } catch (e) {
      console.error('Failed to load school context data', e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentSession = sessions.find((s) => s.id === selectedSessionId) || sessions.find((s) => s.is_current) || null;

  return (
    <SchoolContext.Provider
      value={{
        settings,
        sessions,
        currentSession,
        selectedSessionId,
        setSelectedSessionId,
        refreshSettings: loadData,
        isLoading,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used within SchoolProvider');
  return ctx;
};
