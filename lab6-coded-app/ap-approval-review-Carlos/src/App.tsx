import { useState } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { GatePage } from '@/screens/GatePage';
import { Worklist } from '@/screens/Worklist';

type Screen = 'gate' | 'worklist';

function AppContent() {
  const { isAuthenticated, isLoading, error, login, logout } = useAuth();
  const [screen, setScreen] = useState<Screen>('gate');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" role="status" aria-live="polite">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
        <span className="sr-only">Signing in</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <button
          type="button"
          onClick={login}
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 active:bg-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 focus-visible:ring-offset-2"
        >
          Sign in with UiPath
        </button>
        {error && (
          <p role="alert" className="max-w-sm text-center text-sm text-red-700 break-words">
            Sign-in failed: {error}
          </p>
        )}
      </div>
    );
  }

  const signOut = () => {
    logout();
    setScreen('gate');
  };

  return screen === 'gate'
    ? <GatePage onContinue={() => setScreen('worklist')} />
    : <Worklist onSignOut={signOut} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
