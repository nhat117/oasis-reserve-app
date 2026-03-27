import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isEmployee: boolean;
  isStaff: boolean; // admin or employee
  userRole: 'admin' | 'employee' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  logActivity: (action: string, details?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [loading, setLoading] = useState(true);
  const roleRequestRef = useRef(0);

  const checkRoles = async (userId: string) => {
    const [{ data: admin }, { data: employee }] = await Promise.all([
      supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
      supabase.rpc('has_role', { _user_id: userId, _role: 'employee' }),
    ]);

    return {
      admin: !!admin,
      employee: !!employee,
    };
  };

  useEffect(() => {
    let mounted = true;

    const applySession = async (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        roleRequestRef.current += 1;
        setIsAdmin(false);
        setIsEmployee(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setIsAdmin(false);
      setIsEmployee(false);

      const requestId = ++roleRequestRef.current;
      const roles = await checkRoles(nextSession.user.id);

      if (!mounted || requestId !== roleRequestRef.current) return;

      setIsAdmin(roles.admin);
      setIsEmployee(roles.employee);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const logActivity = async (action: string, details?: string) => {
    if (!user) return;
    try {
      await supabase.from('activity_logs' as any).insert({
        user_id: user.id,
        user_email: user.email,
        action,
        details,
      });
    } catch (e) {
      console.error('Failed to log activity:', e);
    }
  };

  const isStaff = isAdmin || isEmployee;
  const userRole = isAdmin ? 'admin' : isEmployee ? 'employee' : null;

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isEmployee, isStaff, userRole, loading, signIn, signOut, logActivity }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
