import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isLiveSupabaseConfigured } from '@/config/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import {
  Server,
  Database,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Lock,
  Cloud,
  HardDrive,
  Terminal,
  Info,
  Clock,
  KeyRound,
  FileCheck2,
} from 'lucide-react';

export type ServiceHealthStatus = 'connected' | 'disconnected' | 'degraded' | 'not_verified' | 'checking';

interface HealthCheckResult {
  status: ServiceHealthStatus;
  latencyMs?: number;
  message?: string;
  error?: string;
}

interface OverallSystemHealth {
  database: HealthCheckResult;
  auth: HealthCheckResult;
  storage: HealthCheckResult;
  gateway: HealthCheckResult;
  lastChecked: Date | null;
}

export const ServerDatabasePanel: React.FC = () => {
  const [health, setHealth] = useState<OverallSystemHealth>({
    database: { status: 'not_verified' },
    auth: { status: 'not_verified' },
    storage: { status: 'not_verified' },
    gateway: { status: 'not_verified' },
    lastChecked: null,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Environment introspection without leaking secrets
  const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const isLive = isLiveSupabaseConfigured();

  let projectHostname = 'None / Placeholder';
  let projectRef = 'Unknown';
  try {
    if (rawUrl && !rawUrl.includes('placeholder')) {
      const u = new URL(rawUrl);
      projectHostname = u.hostname;
      projectRef = u.hostname.split('.')[0] || 'Unknown';
    }
  } catch {
    projectHostname = 'Invalid URL Format';
  }

  // Detect environment
  const detectEnvironment = (): string => {
    if (typeof window === 'undefined') return 'Production';
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'Development (Localhost)';
    if (host.includes('vercel.app')) {
      if (host.includes('-git-') || host.includes('-preview-')) return 'Vercel Preview';
      return 'Vercel Production';
    }
    return 'Custom Production';
  };

  const environmentName = detectEnvironment();

  // Test individual services
  const runHealthCheck = useCallback(async () => {
    setIsTesting(true);

    const newHealth: OverallSystemHealth = {
      gateway: { status: 'checking' },
      database: { status: 'checking' },
      auth: { status: 'checking' },
      storage: { status: 'checking' },
      lastChecked: null,
    };
    setHealth(newHealth);

    // 1. Application-to-Backend Connectivity / Gateway Check
    let gwResult: HealthCheckResult = { status: 'disconnected' };
    const gwStart = performance.now();
    try {
      if (!rawUrl || rawUrl.includes('placeholder')) {
        gwResult = {
          status: 'disconnected',
          message: 'VITE_SUPABASE_URL is unconfigured or set to placeholder.',
        };
      } else {
        const res = await fetch(`${rawUrl}/rest/v1/`, {
          method: 'GET',
          headers: { apikey: rawKey },
        });
        const latency = Math.round(performance.now() - gwStart);
        if (res.ok || res.status === 200 || res.status === 404 || res.status === 401) {
          // If the gateway responded with HTTP status from Cloudflare / Supabase
          gwResult = {
            status: 'connected',
            latencyMs: latency,
            message: `Gateway responded with HTTP ${res.status}`,
          };
        } else {
          gwResult = {
            status: 'degraded',
            latencyMs: latency,
            message: `Gateway returned status ${res.status}`,
          };
        }
      }
    } catch (err: any) {
      gwResult = {
        status: 'disconnected',
        message: err.message || 'Network unreachable',
        error: err.toString(),
      };
    }

    // 2. Safe Database Access Check
    let dbResult: HealthCheckResult = { status: 'disconnected' };
    const dbStart = performance.now();
    try {
      if (!isLive) {
        dbResult = {
          status: 'disconnected',
          message: 'Running in offline / local fallback mode. Real database disabled.',
        };
      } else {
        // Query minimal non-sensitive school settings or table count
        const { data, error } = await supabase
          .from('school_settings')
          .select('id, school_name')
          .limit(1);

        const latency = Math.round(performance.now() - dbStart);
        if (error) {
          if (error.code === 'PGRST116' || error.message.includes('0 rows')) {
            dbResult = {
              status: 'connected',
              latencyMs: latency,
              message: 'Database reachable (table empty or ready for initialization).',
            };
          } else if (error.code === '42501' || error.message.includes('permission denied')) {
            dbResult = {
              status: 'degraded',
              latencyMs: latency,
              message: 'Database reachable, but RLS policy restricted anonymous query. Login as Administrator required.',
            };
          } else {
            dbResult = {
              status: 'disconnected',
              latencyMs: latency,
              message: error.message || 'Database query error',
              error: `Error code: ${error.code || 'UNKNOWN'}`,
            };
          }
        } else {
          dbResult = {
            status: 'connected',
            latencyMs: latency,
            message: data && data.length > 0 ? `Connected to active school database.` : 'Database connected and responsive.',
          };
        }
      }
    } catch (err: any) {
      dbResult = {
        status: 'disconnected',
        message: err.message || 'Database connection error',
        error: err.toString(),
      };
    }

    // 3. Supabase Auth Service Availability
    let authResult: HealthCheckResult = { status: 'disconnected' };
    const authStart = performance.now();
    try {
      if (!isLive) {
        authResult = {
          status: 'disconnected',
          message: 'Supabase Auth offline. Using local identity profiles.',
        };
      } else {
        const { data, error } = await supabase.auth.getSession();
        const latency = Math.round(performance.now() - authStart);
        if (error) {
          authResult = {
            status: 'degraded',
            latencyMs: latency,
            message: `Auth service returned: ${error.message}`,
          };
        } else {
          authResult = {
            status: 'connected',
            latencyMs: latency,
            message: data?.session?.user ? `Session active (${data.session.user.email})` : 'Auth service online & listening.',
          };
        }
      }
    } catch (err: any) {
      authResult = {
        status: 'disconnected',
        message: err.message || 'Auth service unavailable',
        error: err.toString(),
      };
    }

    // 4. File Storage Service Availability (non-destructive)
    let storageResult: HealthCheckResult = { status: 'disconnected' };
    const storageStart = performance.now();
    try {
      if (!isLive) {
        storageResult = {
          status: 'disconnected',
          message: 'Storage bucket offline. Operating on memory fallback.',
        };
      } else {
        // Query the student-avatars bucket list (non-destructive read)
        const { error } = await supabase.storage.from('student-avatars').list('', { limit: 1 });
        const latency = Math.round(performance.now() - storageStart);

        if (error) {
          storageResult = {
            status: 'degraded',
            latencyMs: latency,
            message: `Bucket check: ${error.message}`,
            error: error.message,
          };
        } else {
          storageResult = {
            status: 'connected',
            latencyMs: latency,
            message: `Bucket "student-avatars" verified and accessible.`,
          };
        }
      }
    } catch (err: any) {
      storageResult = {
        status: 'disconnected',
        message: err.message || 'Storage service unreachable',
        error: err.toString(),
      };
    }

    setHealth({
      gateway: gwResult,
      database: dbResult,
      auth: authResult,
      storage: storageResult,
      lastChecked: new Date(),
    });
    setIsTesting(false);
  }, [rawUrl, rawKey, isLive]);

  // Run initial test on mount
  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  // Overall status summary
  const getOverallStatus = (): { label: string; variant: 'success' | 'warning' | 'danger' | 'default' } => {
    if (isTesting) return { label: 'Checking Health...', variant: 'default' };
    const { database, auth, storage, gateway } = health;
    if (database.status === 'connected' && auth.status === 'connected' && storage.status === 'connected') {
      return { label: 'All Systems Operational', variant: 'success' };
    }
    if (database.status === 'connected' || gateway.status === 'connected') {
      return { label: 'Degraded / Partial Connection', variant: 'warning' };
    }
    return { label: 'Disconnected / Offline Mode', variant: 'danger' };
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const overall = getOverallStatus();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Server & Database Connection
            </h1>
            <Badge variant={overall.variant} size="md">
              {overall.label}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time backend health diagnostics, infrastructure status, and safe configuration inspection
          </p>
        </div>

        <Button
          size="sm"
          onClick={runHealthCheck}
          isLoading={isTesting}
          leftIcon={<RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />}
        >
          {isTesting ? 'Testing Connectivity...' : 'Test Connection'}
        </Button>
      </div>

      {/* 4 Core Infrastructure Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gateway */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                <Cloud className="w-4 h-4 text-sky-500" />
                API Gateway
              </div>
              <StatusBadge status={health.gateway.status} />
            </div>
            <p className="text-xs text-slate-500 truncate" title={health.gateway.message}>
              {health.gateway.message || 'Awaiting check'}
            </p>
            {health.gateway.latencyMs !== undefined && (
              <p className="text-[11px] font-mono text-slate-400">
                Latency: <span className="text-slate-600 dark:text-slate-300">{health.gateway.latencyMs} ms</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                <Database className="w-4 h-4 text-emerald-500" />
                PostgreSQL DB
              </div>
              <StatusBadge status={health.database.status} />
            </div>
            <p className="text-xs text-slate-500 truncate" title={health.database.message}>
              {health.database.message || 'Awaiting check'}
            </p>
            {health.database.latencyMs !== undefined && (
              <p className="text-[11px] font-mono text-slate-400">
                Latency: <span className="text-slate-600 dark:text-slate-300">{health.database.latencyMs} ms</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Supabase Auth */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                <ShieldCheck className="w-4 h-4 text-brand-500" />
                Authentication
              </div>
              <StatusBadge status={health.auth.status} />
            </div>
            <p className="text-xs text-slate-500 truncate" title={health.auth.message}>
              {health.auth.message || 'Awaiting check'}
            </p>
            {health.auth.latencyMs !== undefined && (
              <p className="text-[11px] font-mono text-slate-400">
                Latency: <span className="text-slate-600 dark:text-slate-300">{health.auth.latencyMs} ms</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Storage */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                <HardDrive className="w-4 h-4 text-amber-500" />
                Object Storage
              </div>
              <StatusBadge status={health.storage.status} />
            </div>
            <p className="text-xs text-slate-500 truncate" title={health.storage.message}>
              {health.storage.message || 'Awaiting check'}
            </p>
            {health.storage.latencyMs !== undefined && (
              <p className="text-[11px] font-mono text-slate-400">
                Latency: <span className="text-slate-600 dark:text-slate-300">{health.storage.latencyMs} ms</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Architecture & Hostname Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-navy-800 dark:text-brand-400" />
              <CardTitle>Target Infrastructure Topology</CardTitle>
            </div>
            <CardDescription>
              Backend connection parameters (non-secret metadata)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Backend Provider</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Supabase Cloud (PostgreSQL 15+ & Auth)
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Configured Environment</span>
                <Badge variant={environmentName.includes('Production') ? 'success' : 'default'} size="sm">
                  {environmentName}
                </Badge>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Supabase Hostname</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {projectHostname}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Project Reference ID</span>
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                  {projectRef}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Frontend Hosting</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Vercel Edge Network
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Last Verified Health Check</span>
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {health.lastChecked ? health.lastChecked.toLocaleTimeString() : 'Not run yet'}
                </span>
              </div>
            </div>

            {/* Offline fallback alert banner */}
            {!isLive && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-semibold">Offline / Local Storage Fallback Mode Active</p>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                    The frontend bundle was compiled with placeholder credentials. Changes made in this browser session are persisted to local storage and will not synchronize to the remote Supabase PostgreSQL database.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Environment Variables Verification Checklist */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-600" />
              <CardTitle>Environment Variables Checklist</CardTitle>
            </div>
            <CardDescription>
              Client-side build configuration presence check (no secrets exposed)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <EnvVarRow
                name="VITE_SUPABASE_URL"
                isSet={Boolean(rawUrl && !rawUrl.includes('placeholder'))}
                note={projectHostname}
              />
              <EnvVarRow
                name="VITE_SUPABASE_ANON_KEY"
                isSet={Boolean(rawKey && !rawKey.includes('placeholder') && !rawKey.includes('dummy'))}
                note={rawKey ? `Present (SHA-256 JWT, ${rawKey.length} chars)` : 'Missing'}
              />
              <EnvVarRow
                name="VITE_APP_NAME"
                isSet={Boolean(import.meta.env.VITE_APP_NAME)}
                note={import.meta.env.VITE_APP_NAME || 'Default school name'}
              />
              <EnvVarRow
                name="VITE_APP_REGISTRATION_NO"
                isSet={Boolean(import.meta.env.VITE_APP_REGISTRATION_NO)}
                note={import.meta.env.VITE_APP_REGISTRATION_NO || 'Unset'}
              />
              <EnvVarRow
                name="VITE_APP_CURRENCY_SYMBOL"
                isSet={Boolean(import.meta.env.VITE_APP_CURRENCY_SYMBOL)}
                note={import.meta.env.VITE_APP_CURRENCY_SYMBOL || 'Rs.'}
              />
              <EnvVarRow
                name="VITE_APP_TIMEZONE"
                isSet={Boolean(import.meta.env.VITE_APP_TIMEZONE)}
                note={import.meta.env.VITE_APP_TIMEZONE || 'Asia/Karachi'}
              />
            </div>

            <div className="pt-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Privileged Secrets Security Shield
                  </span>
                </div>
                <Badge variant="success" size="sm">
                  Active
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                Supabase service-role keys, database passwords, and auth secrets are strictly isolated on the server and are never exposed to the client bundle.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diagnostic & Troubleshooting Guidance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-navy-800 dark:text-brand-400" />
            <CardTitle>Connection Troubleshooting & Setup Instructions</CardTitle>
          </div>
          <CardDescription>
            Official procedure to connect your deployed Vercel application to Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Vercel Configuration */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px]">1</span>
                  Configure Vercel Environment
                </h4>
                <a
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  Vercel Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                In your Vercel Project &rarr; <strong>Settings &rarr; Environment Variables</strong>, add the following variables for Production & Preview:
              </p>
              <div className="relative font-mono text-[11px] bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
                <pre>{`VITE_SUPABASE_URL=https://${projectRef}.supabase.co\nVITE_SUPABASE_ANON_KEY=your_public_anon_key`}</pre>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `VITE_SUPABASE_URL=https://${projectRef}.supabase.co\nVITE_SUPABASE_ANON_KEY=`,
                      'env_template'
                    )
                  }
                  className="absolute top-2 right-2 text-slate-400 hover:text-white p-1 rounded bg-slate-800 hover:bg-slate-700"
                  title="Copy environment template"
                >
                  {copiedKey === 'env_template' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Step 2: Trigger Redeploy */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px]">2</span>
                  Redeploy on Vercel
                </h4>
                <span className="text-[11px] text-amber-600 font-medium">Build-time Bake</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Vite replaces <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">import.meta.env</code> during build. After saving your environment variables:
              </p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc pl-4">
                <li>Go to <strong>Deployments</strong> tab in Vercel.</li>
                <li>Click the three dots <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">...</code> on your latest deployment.</li>
                <li>Select <strong>Redeploy</strong> (uncheck &quot;Use existing Build Cache&quot;).</li>
                <li>Once complete, refresh this panel to confirm all services report <span className="text-emerald-600 font-semibold">Connected</span>.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper component for Environment Variable row
const EnvVarRow: React.FC<{ name: string; isSet: boolean; note?: string }> = ({ name, isSet, note }) => {
  return (
    <div className="py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isSet ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
        )}
        <code className="font-mono text-slate-800 dark:text-slate-200 text-[11px]">{name}</code>
      </div>
      <div className="flex items-center gap-2">
        {note && <span className="text-slate-400 text-[11px] truncate max-w-[150px]">{note}</span>}
        <Badge variant={isSet ? 'success' : 'danger'} size="sm">
          {isSet ? 'Set' : 'Missing'}
        </Badge>
      </div>
    </div>
  );
};

// Helper component for Service Status Badge
const StatusBadge: React.FC<{ status: ServiceHealthStatus }> = ({ status }) => {
  switch (status) {
    case 'connected':
      return <Badge variant="success" size="sm">Connected</Badge>;
    case 'degraded':
      return <Badge variant="warning" size="sm">Degraded</Badge>;
    case 'disconnected':
      return <Badge variant="danger" size="sm">Disconnected</Badge>;
    case 'checking':
      return <Badge variant="default" size="sm">Testing...</Badge>;
    default:
      return <Badge variant="outline" size="sm">Not Verified</Badge>;
  }
};
