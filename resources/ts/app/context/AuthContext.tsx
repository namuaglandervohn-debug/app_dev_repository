import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createAuthSession, type AuthUser, type UserRole } from '../lib/authSession';
import { saveEmployeeProfilePhoto } from '../lib/profilePhoto';

export type { AuthUser, UserRole } from '../lib/authSession';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  profilePhoto: string | null;
  updateProfilePhoto: (photo: string) => Promise<void>;
  login: (email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  changePassword: (newPassword: string, currentPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Cached profile data is never an authority for identity or role.
  const [state, setState] = useState<{ user: AuthUser | null; loading: boolean }>({ user: null, loading: true });
  const [accountPhoto, setAccountPhoto] = useState<{ owner: string; src: string | null } | null>(null);
  const session = useMemo(() => createAuthSession(supabase, setState), []);
  const applicantId = state.user?.role === 'applicant' ? state.user.id : null;
  const employeeId = state.user?.role === 'employee' ? state.user.employeeId : null;
  const photoOwner = applicantId ? `applicant:${applicantId}` : employeeId ? `${state.user?.id}:employee:${employeeId}` : null;

  useEffect(() => {
    window.localStorage.removeItem('buenaventura_hris_user');
    window.sessionStorage.removeItem('buenaventura_hris_user');
    session.start();
    return () => session.stop();
  }, [session]);

  useEffect(() => {
    setAccountPhoto(photoOwner ? { owner: photoOwner, src: null } : null);
    if (!photoOwner) return;

    let active = true;
    const loadPhoto = async () => {
      const { data, error } = await (applicantId
        ? supabase.from('applicant_profiles').select('profile_photo').eq('auth_user_id', applicantId).maybeSingle()
        : supabase.from('employees').select('profile_photo').eq('employee_id', employeeId).maybeSingle());
      if (active && !error && data?.profile_photo) {
        setAccountPhoto(current => current?.owner === photoOwner && current.src === null
          ? { owner: photoOwner, src: data.profile_photo }
          : current);
      }
    };
    void loadPhoto().catch(() => { /* Initials remain available during a photo service error. */ });
    return () => { active = false; };
  }, [applicantId, employeeId, photoOwner]);

  const updateProfilePhoto = async (photo: string) => {
    if (!photoOwner) throw new Error('Sign in again to update your profile picture.');
    if (applicantId) {
      const { error } = await supabase.from('applicant_profiles').update({ profile_photo: photo })
        .eq('auth_user_id', applicantId).select('auth_user_id').single();
      if (error) throw new Error('Could not save your profile picture. Try again.');
    } else if (employeeId) {
      await saveEmployeeProfilePhoto(employeeId, photo);
    }
    setAccountPhoto(current => current?.owner === photoOwner ? { owner: photoOwner, src: photo } : current);
  };

  const changePassword = (newPassword: string, currentPassword: string) =>
    session.changePassword(newPassword, currentPassword, state.user?.mustChangePassword === true);

  return <AuthContext.Provider value={{ ...state, login: session.login, logout: session.logout, changePassword,
    profilePhoto: accountPhoto?.owner === photoOwner ? accountPhoto.src : null, updateProfilePhoto }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
