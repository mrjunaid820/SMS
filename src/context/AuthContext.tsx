import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile, UserRole } from '@/types/database';
import { supabase, isLiveSupabaseConfigured } from '@/config/supabase';
import { INITIAL_PROFILES } from '@/services/mockData';

interface AuthContextType {
  user: Profile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<Profile>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(() => {
    if (isLiveSupabaseConfigured()) {
      const saved = localStorage.getItem('sms_current_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id && parsed.role) {
            return parsed;
          }
        } catch {
          return null;
        }
      }
      return null;
    }

    const saved = localStorage.getItem('sms_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Verify against system profiles to enforce role integrity and prevent client-side elevation
        const profiles: Profile[] = (() => {
          try {
            const sp = localStorage.getItem('sms_profiles');
            if (sp) return JSON.parse(sp);
          } catch {}
          return INITIAL_PROFILES;
        })();
        const verified = profiles.find(
          (p) => p.id === parsed.id || p.email.toLowerCase() === (parsed.email || '').toLowerCase()
        );
        if (verified && verified.is_active !== false) {
          return verified;
        }
      } catch (e) {
        // ignore
      }
    }
    return INITIAL_PROFILES[0]; // Default Administrator session only for local dev install
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isLiveSupabaseConfigured()) {
      setIsLoading(true);
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error || !session?.user) {
          setUser(null);
          localStorage.removeItem('sms_current_user');
          setIsLoading(false);
          return;
        }

        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data, error: profErr }) => {
            if (data && !profErr && data.is_active !== false) {
              setUser(data);
              localStorage.setItem('sms_current_user', JSON.stringify(data));
            } else {
              setUser(null);
              localStorage.removeItem('sms_current_user');
            }
            setIsLoading(false);
          });
      });

      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data, error: profErr } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (data && !profErr && data.is_active !== false) {
            setUser(data);
            localStorage.setItem('sms_current_user', JSON.stringify(data));
          } else {
            setUser(null);
            localStorage.removeItem('sms_current_user');
          }
        } else {
          setUser(null);
          localStorage.removeItem('sms_current_user');
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const login = async (email: string, password?: string): Promise<Profile> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        throw new Error('Please enter your email address.');
      }

      if (isLiveSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password || '',
        });
        if (error) {
          throw new Error(error.message || 'Authentication failed. Please verify your credentials.');
        }
        if (data?.user) {
          const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
          if (profErr || !profile) {
            await supabase.auth.signOut();
            throw new Error('User profile record not found in authorization directory.');
          }
          if (profile.is_active === false) {
            await supabase.auth.signOut();
            throw new Error('Your account has been deactivated. Please contact the school administrator.');
          }
          setUser(profile);
          localStorage.setItem('sms_current_user', JSON.stringify(profile));
          return profile;
        }
        throw new Error('Failed to retrieve authenticated user session.');
      } else {
        const profiles: Profile[] = (() => {
          try {
            const saved = localStorage.getItem('sms_profiles');
            if (saved) return JSON.parse(saved);
          } catch {}
          return INITIAL_PROFILES;
        })();

        const matched = profiles.find((p) => p.email.toLowerCase() === cleanEmail.toLowerCase());
        if (!matched) {
          throw new Error('Invalid credentials: No account found with this email address.');
        }

        if (matched.is_active === false) {
          throw new Error('Your account has been deactivated. Please contact the school administrator.');
        }

        // Verify password if temporary password was set
        try {
          const passMap = JSON.parse(localStorage.getItem('sms_user_passwords') || '{}');
          const requiredPass = passMap[matched.id] || passMap[matched.email.toLowerCase()];
          if (requiredPass && password && password !== requiredPass) {
            throw new Error('Invalid password: The password entered does not match.');
          }
        } catch (e: any) {
          if (e.message.startsWith('Invalid password')) throw e;
        }

        setUser(matched);
        localStorage.setItem('sms_current_user', JSON.stringify(matched));
        return matched;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (isLiveSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Error during signOut:', e);
      }
    }
    setUser(null);
    localStorage.removeItem('sms_current_user');
  };

  const role: UserRole = user?.role || 'admin';
  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
