/**
 * LTK Connect Modal Component (Example)
 * 
 * A Plaid-style modal for connecting LTK accounts.
 * Put this in your CreatorMetrics frontend.
 * 
 * Usage:
 * <LTKConnectModal 
 *   isOpen={showModal} 
 *   onClose={() => setShowModal(false)}
 *   onSuccess={() => refetchData()}
 * />
 */

import { useState } from 'react';
import { X, Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface LTKConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  middlewareUrl?: string; // Your Railway URL
}

type ConnectionState = 'idle' | 'connecting' | 'success' | 'error';

export function LTKConnectModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  middlewareUrl = import.meta.env.VITE_LTK_MIDDLEWARE_URL || 'http://localhost:3000',
}: LTKConnectModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    
    setState('connecting');
    setError(null);
    
    try {
      const response = await fetch(`${middlewareUrl}/api/ltk/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          email,
          password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Connection failed');
      }
      
      setState('success');
      
      // Wait a moment to show success, then close
      setTimeout(() => {
        onSuccess();
        onClose();
        // Reset form
        setEmail('');
        setPassword('');
        setState('idle');
      }, 1500);
      
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleClose = () => {
    if (state === 'connecting') return; // Don't close while connecting
    onClose();
    // Reset form
    setEmail('');
    setPassword('');
    setState('idle');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Connect LTK
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Securely connect your account
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"
            disabled={state === 'connecting'}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {state === 'success' ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Connected!
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Your LTK account has been successfully connected.
              </p>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-4">
              {/* Security notice */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm">
                <p className="text-blue-800 dark:text-blue-200">
                  <strong>🔒 Your credentials are secure.</strong> We use them once to 
                  connect your account, then discard them. Only encrypted access tokens 
                  are stored.
                </p>
              </div>
              
              {/* Error message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
              
              {/* Email field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  LTK Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                  disabled={state === 'connecting'}
                  required
                />
              </div>
              
              {/* Password field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  LTK Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                    disabled={state === 'connecting'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              
              {/* Submit button */}
              <button
                type="submit"
                disabled={state === 'connecting'}
                className="w-full py-3 px-4 bg-pink-600 hover:bg-pink-700 disabled:bg-pink-400 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
              >
                {state === 'connecting' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Account'
                )}
              </button>
              
              {/* Footer */}
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                By connecting, you agree to allow CreatorMetrics to access your LTK analytics.
                You can disconnect at any time.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default LTKConnectModal;
