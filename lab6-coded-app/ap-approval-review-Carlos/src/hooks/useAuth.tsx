import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { UiPath, UiPathError } from '@uipath/uipath-typescript/core';
import { ConversationalAgent } from '@uipath/uipath-typescript/conversational-agent';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  sdk: UiPath;
  /** Signed-in user's email, written as ReviewedBy. Null when it could not be resolved. */
  userEmail: string | null;
  /** Non-fatal: signed in, but no email was found (decisions are blocked). */
  profileWarning: string | null;
  login: () => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Fallback for the reviewer email: the `email` claim of the SDK's own access
 * token, decoded in the browser. The token itself is never stored, logged or
 * sent anywhere by app code.
 */
function emailFromToken(token: string | undefined): string | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const claims = JSON.parse(json) as Record<string, unknown>;
    const email = claims.email ?? claims.preferred_username;
    return typeof email === 'string' && email.includes('@') ? email : null;
  } catch {
    return null;
  }
}

async function resolveUserEmail(sdk: UiPath): Promise<string | null> {
  try {
    const settings = await new ConversationalAgent(sdk).user.getSettings();
    if (settings.email) return settings.email;
  } catch {
    // Fall through to the token claim.
  }
  return emailFromToken(sdk.getToken());
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileWarning, setProfileWarning] = useState<string | null>(null);
  // `new UiPath()` reads clientId/orgName/tenantName/baseUrl/scope/redirectUri
  // from <meta name="uipath:*"> tags. The uipathCodedApps() Vite plugin
  // injects them locally from uipath.json; the platform injects them in prod.
  const [sdk] = useState<UiPath>(() => new UiPath());
  const didInit = useRef(false);

  useEffect(() => {
    // Guard against React Strict Mode's double-invocation in dev.
    // OAuth authorization codes are single-use — calling completeOAuth()
    // twice would fail the second time with "Authentication failed".
    if (didInit.current) return;
    didInit.current = true;

    const initializeAuth = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (sdk.isInOAuthCallback()) {
          await sdk.completeOAuth();
          // Strip OAuth params from the URL so a refresh doesn't try to
          // re-consume the (now-invalid) code.
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        const authenticated = sdk.isAuthenticated();
        if (authenticated) {
          const email = await resolveUserEmail(sdk);
          setUserEmail(email);
          setProfileWarning(
            email ? null : 'Your UiPath profile did not return an email address, so ReviewedBy cannot be set. You can review invoices but not approve or reject them.',
          );
        }
        setIsAuthenticated(authenticated);
      } catch (err) {
        console.error('Authentication failed:', err);
        setError(err instanceof UiPathError ? err.message : 'Authentication failed');
      } finally {
        setIsLoading(false);
      }
    };
    initializeAuth();
  }, [sdk]);

  const login = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await sdk.initialize();
    } catch (err) {
      setError(err instanceof UiPathError ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    sdk.logout();
    setIsAuthenticated(false);
    setUserEmail(null);
    setProfileWarning(null);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, sdk, userEmail, profileWarning, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
