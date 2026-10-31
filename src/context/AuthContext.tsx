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

    if (isLiveSupabaseConfigured() && import.meta.env.VITE_ENABLE_OFFLINE_FALLBACK !== 'true') {
      return null;
    }

    return INITIAL_PROFILES[0]; // Default Administrator session for local / dev install
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (isLiveSupabaseConfigured()) {
      const saved = localStorage.getItem('sms_current_user');
      return !saved && import.meta.env.VITE_ENABLE_OFFLINE_FALLBACK !== 'true';
    }
    return false;
  });

  useEffect(() => {
    let isMounted = true;
    if (isLiveSupabaseConfigured()) {
      if (!user && import.meta.env.VITE_ENABLE_OFFLINE_FALLBACK !== 'true') {
        setIsLoading(true);
      }

      supabase.auth
        .getSession()
        .then(async ({ data: { session }, error }) => {
          if (!isMounted) return;
          if (session?.user && !error) {
            try {
              const { data, error: profErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

              if (!isMounted) return;

              if (data && !profErr && data.is_active !== false) {
                setUser(data);
                localStorage.setItem('sms_current_user', JSON.stringify(data));
              } else {
                setUser(null);
                localStorage.removeItem('sms_current_user');
              }
            } catch {
              // Retain local session on temporary network failure
            } finally {
              if (isMounted) setIsLoading(false);
            }
          } else {
            // No Supabase auth session
            if (import.meta.env.VITE_ENABLE_OFFLINE_FALLBACK === 'true') {
              const saved = localStorage.getItem('sms_current_user');
              if (saved) {
                try {
                  const parsed = JSON.parse(saved);
                  if (parsed && parsed.id && parsed.role) {
                    setUser(parsed);
                    if (isMounted) setIsLoading(false);
                    return;
                  }
                } catch {}
              }
              if (!saved && import.meta.env.DEV) {
                setUser(INITIAL_PROFILES[0]);
                localStorage.setItem('sms_current_user', JSON.stringify(INITIAL_PROFILES[0]));
                if (isMounted) setIsLoading(false);
                return;
              }
            }
            setUser(null);
            localStorage.removeItem('sms_current_user');
            if (isMounted) setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoading(false);
        });

      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          try {
            const { data, error: profErr } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (isMounted && data && !profErr && data.is_active !== false) {
              setUser(data);
              localStorage.setItem('sms_current_user', JSON.stringify(data));
            } else if (isMounted) {
              setUser(null);
              localStorage.removeItem('sms_current_user');
            }
          } catch {
            // retain current
          }
        } else if (event === 'SIGNED_OUT') {
          if (isMounted) {
            setUser(null);
            localStorage.removeItem('sms_current_user');
          }
        }
      });

      return () => {
        isMounted = false;
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
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: password || '',
          });
          if (!error && data?.user) {
            const { data: profile, error: profErr } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .maybeSingle();

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
        } catch (supabaseErr: any) {
          if (import.meta.env.VITE_ENABLE_OFFLINE_FALLBACK !== 'true') {
            throw new Error(supabaseErr.message || 'Authentication failed. Please verify your credentials.');
          }
        }
      }

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
