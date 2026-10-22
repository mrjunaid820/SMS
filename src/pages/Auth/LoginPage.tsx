import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Shield, Lock, Mail, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const { settings } = useSchool();

  const [email, setEmail] = useState('admin@islamiapublic.edu.pk');
  const [password, setPassword] = useState('••••••••••••');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, email.includes('admin') ? 'admin' : 'teacher');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoRole: 'admin' | 'teacher') => {
    setEmail(demoEmail);
    try {
      await login(demoEmail, demoRole);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
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
            Institutional Administration & Faculty Portal
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Staff Email Address"
            type="email"
            required
            leftIcon={<Mail className="w-4 h-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Password"
            type="password"
            required
            leftIcon={<Lock className="w-4 h-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" size="md" isLoading={isLoading}>
            Sign In to ERP Portal
          </Button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
            One-Click Evaluator Sign-In
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() =>
                handleQuickDemoLogin('admin@islamiapublic.edu.pk', 'admin')
              }
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 hover:border-brand-500 text-left transition-colors"
            >
              <div className="font-bold text-slate-900 dark:text-slate-100">Administrator</div>
              <div className="text-[10px] text-slate-400">Full Access</div>
            </button>

            <button
              type="button"
              onClick={() =>
                handleQuickDemoLogin('tariq.math@islamiapublic.edu.pk', 'teacher')
              }
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 hover:border-brand-500 text-left transition-colors"
            >
              <div className="font-bold text-slate-900 dark:text-slate-100">Teacher Account</div>
              <div className="text-[10px] text-slate-400">Scoped to Class 9</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
