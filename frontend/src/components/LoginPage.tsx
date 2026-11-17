import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react';
import { ApiError, login } from '../api.ts';
import type { User } from '../types.ts';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

const DEMO_ACCOUNTS = [
  { role: 'Admin', name: 'Admin', email: 'admin@novaworks.example' },
  { role: 'Manager', name: 'Ayesha Khan', email: 'ayesha@novaworks.example' },
  { role: 'Manager', name: 'Bilal Ahmed', email: 'bilal@novaworks.example' },
  { role: 'Manager', name: 'Hina Malik', email: 'hina@novaworks.example' },
  { role: 'Agent', name: 'Ali Raza', email: 'ali@novaworks.example' },
  { role: 'Agent', name: 'Hamza Shah', email: 'hamza@novaworks.example' },
  { role: 'Agent', name: 'Sara Noor', email: 'sara@novaworks.example' },
  { role: 'Agent', name: 'Usman Tariq', email: 'usman@novaworks.example' },
  { role: 'Agent', name: 'Zain Abbas', email: 'zain@novaworks.example' },
  { role: 'Agent', name: 'Maryam Asif', email: 'maryam@novaworks.example' },
];

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const user = await login(email.trim(), password);
      onLoginSuccess(user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to reach server. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('Demo123!');
    setError(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              NovaWorks Project CRM
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Sign in to manage projects, meeting transcripts, and assigned tasks.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Work email
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@novaworks.example"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign in'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <h2 className="text-base font-semibold text-slate-900">
              Demo Accounts
            </h2>
            <p className="text-xs text-slate-500">
              Shared password for all accounts:{' '}
              <code className="font-mono font-medium text-slate-800">Demo123!</code>
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {DEMO_ACCOUNTS.map((acct) => (
                  <tr key={acct.email} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {acct.role}
                    </td>
                    <td className="py-2 px-3 text-slate-900 font-medium whitespace-nowrap">
                      {acct.name}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {acct.email}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleFillDemo(acct.email)}
                        className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline cursor-pointer px-2 py-1"
                      >
                        Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
