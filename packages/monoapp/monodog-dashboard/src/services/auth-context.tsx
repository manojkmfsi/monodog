/**
 * Authentication Context Provider
 * Manages authentication state and provides auth functions to the app
 */

import React, {
  createContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
}

export interface AuthSession {
  sessionToken: string;
  user: GitHubUser;
  scopes: string[];
  expiresAt: number;
}

export interface AuthContextType {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const apiUrl = (window as any).ENV?.API_URL ?? 'http://localhost:8999';
const API_BASE = `${apiUrl}/api`;
const SESSION_TOKEN_KEY = 'monodog_session_token';
const SESSION_DATA_KEY = 'monodog_session_data';

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load session from localStorage if available
   */
  useEffect(() => {
    const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
    const savedData = localStorage.getItem(SESSION_DATA_KEY);

    if (savedToken && savedData) {
      try {
        const data = JSON.parse(savedData);
        setSession({
          sessionToken: savedToken,
          ...data,
        });
      } catch (err) {
        // Invalid stored data, clear it
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(SESSION_DATA_KEY);
      }
    }

    setIsLoading(false);
  }, []);

  /**
   * Start GitHub OAuth login flow
   */
  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to initiate login');
      }

      const data = await response.json();

      // Redirect to GitHub OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      setIsLoading(false);
    }
  }, []);

  /**
   * Handle OAuth callback and store session
   */
  const handleOAuthCallback = useCallback(
    async (sessionToken: string) => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch user info to validate token
        const response = await fetch(`${API_BASE}/auth/me`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user info');
        }

        const userData = await response.json();

        const newSession: AuthSession = {
          sessionToken,
          user: userData.user,
          scopes: userData.scopes || [],
          expiresAt: userData.expiresAt,
        };

        // Store session
        localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
        localStorage.setItem(
          SESSION_DATA_KEY,
          JSON.stringify({
            user: userData.user,
            scopes: userData.scopes || [],
            expiresAt: userData.expiresAt,
          })
        );

        setSession(newSession);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Auth failed';
        setError(message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Logout and clear session
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);

      if (session?.sessionToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.sessionToken}`,
          },
        });
      }

      // Clear session
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(SESSION_DATA_KEY);
      setSession(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  /**
   * Validate current session with server
   */
  const checkSession = useCallback(async (): Promise<boolean> => {
    if (!session?.sessionToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/validate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      });

      if (!response.ok) {
        // Session invalid
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(SESSION_DATA_KEY);
        setSession(null);
        return false;
      }

      const data = await response.json();
      return data.valid === true;
    } catch (err) {
      console.error('Session check error:', err);
      return false;
    }
  }, [session]);

  /**
   * Refresh session token
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!session?.sessionToken) {
      return false;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh session');
      }

      const data = await response.json();

      if (data.success && data.sessionToken) {
        const newSession: AuthSession = {
          sessionToken: data.sessionToken,
          user: session.user,
          scopes: session.scopes,
          expiresAt: data.expiresAt,
        };

        // Update stored session
        localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
        localStorage.setItem(
          SESSION_DATA_KEY,
          JSON.stringify({
            user: session.user,
            scopes: session.scopes,
            expiresAt: data.expiresAt,
          })
        );

        setSession(newSession);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Session refresh error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Validate session periodically
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      checkSession();
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [session, checkSession]);

  const value: AuthContextType = {
    session,
    isAuthenticated: !!session,
    isLoading,
    error,
    login,
    logout,
    checkSession,
    refreshSession,
  };

  // Expose handleOAuthCallback for use in callback page
  (window as any).__authContext = { handleOAuthCallback };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
