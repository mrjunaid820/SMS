import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile, UserRole } from '@/types/database';
import { supabase, isLiveSupabaseConfigured } from '@/config/supabase';
import { INITIAL_PROFILES } from '@/services/mockData';

interface AuthContextType {
  user: Profile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  switchUserRole: (newRole: UserRole, profileIndex?: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(() => {
    const saved = localStorage.getItem('sms_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return INITIAL_PROFILES[0]; // Default to Administrator
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isLiveSupabaseConfigured()) {
      setIsLoading(true);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setUser(data);
                localStorage.setItem('sms_current_user', JSON.stringify(data));
              }
              setIsLoading(false);
            });
        } else {
          setIsLoading(false);
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (data) {
            setUser(data);
            localStorage.setItem('sms_current_user', JSON.stringify(data));
          }
        } else {
          // If in live mode and logged out, clear
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const login = async (email: string, role: UserRole = 'admin') => {
    setIsLoading(true);
    try {
      if (isLiveSupabaseConfigured()) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: 'password123',
        });
        if (error) throw error;
      } else {
        const matched = INITIAL_PROFILES.find((p) => p.email === email) || {
          id: 'u0000000-0000-0000-0000-000000000001',
          role,
          full_name: role === 'admin' ? 'Administrator (Principal)' : 'Muhammad Tariq (Teacher)',
          email,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setUser(matched);
        localStorage.setItem('sms_current_user', JSON.stringify(matched));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (isLiveSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('sms_current_user');
  };

  const switchUserRole = (newRole: UserRole, profileIndex = 0) => {
    const candidates = INITIAL_PROFILES.filter((p) => p.role === newRole);
    const chosen = candidates[profileIndex % candidates.length] || INITIAL_PROFILES[0];
    setUser(chosen);
    localStorage.setItem('sms_current_user', JSON.stringify(chosen));
  };

  const role: UserRole = user?.role || 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
