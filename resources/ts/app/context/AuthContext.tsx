import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createAuthSession, type AuthUser, type UserRole } from '../lib/authSession';

export type { AuthUser, UserRole } from '../lib/authSession';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  changePassword: (newPassword: string, currentPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Cached profile data is never an authority for identity or role.
  const [state, setState] = useState<{ user: AuthUser | null; loading: boolean }>({ user: null, loading: true });
  const session = useMemo(() => createAuthSession(supabase, setState), []);

  useEffect(() => {
    window.localStorage.removeItem('buenaventura_hris_user');
    window.sessionStorage.removeItem('buenaventura_hris_user');
    session.start();
    return () => session.stop();
  }, [session]);

  const changePassword = (newPassword: string, currentPassword: string) =>
    session.changePassword(newPassword, currentPassword, state.user?.mustChangePassword === true);

  return <AuthContext.Provider value={{ ...state, login: session.login, logout: session.logout, changePassword }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
