import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { isLiveSupabaseConfigured } from '@/config/supabase';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Shield, Lock, Mail, Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, isAuthenticated, role } = useAuth();
  const { settings } = useSchool();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Automatically redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (role === 'teacher') {
        navigate('/teacher-dashboard', { replace: true });
      } else if (role === 'student') {
        navigate('/student-dashboard', { replace: true });
      } else {
        navigate('/admin-dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    try {
      const authenticatedUser = await login(email.trim(), password);
      if (authenticatedUser?.role === 'teacher') {
        navigate('/teacher-dashboard');
      } else if (authenticatedUser?.role === 'student') {
        navigate('/student-dashboard');
      } else {
        navigate('/admin-dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 px-4 py-8 relative overflow-hidden">
      {/* Background Graphic Accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-600/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-navy-600/20 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 z-10">
        {/* School Branding */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-navy-950 text-white flex items-center justify-center font-bold text-xl mx-auto mb-3 shadow-md border border-navy-800">
            <Shield className="w-8 h-8 text-brand-400" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {settings.school_name || 'Islamia Public High School'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Institutional Administration, Faculty & Student Portal
          </p>

          <div className="mt-2.5">
            {isLiveSupabaseConfigured() ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Supabase Cloud Connected</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Local Development Mode</span>
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Account Email Address"
            type="email"
            required
            placeholder="e.g. user@islamiapublic.edu.pk"
            leftIcon={<Mail className="w-4 h-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="Enter your password"
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none p-1 rounded"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" size="md" isLoading={isLoading}>
            Sign In to ERP Portal
          </Button>
        </form>
      </div>
    </div>
  );
};
