import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getCadetByAuthId, signOut, getCurrentUser, type AuthUser } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  name: string;
  role: 'cadet' | 'admin';
  platoon?: string;
  squad?: number;
  cadetId?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  loading: boolean;
  shouldRedirect: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  
  // Таймер для автоматического выхода при долгой загрузке
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Проверяем текущую сессию Supabase при загрузке
    const checkCurrentSession = async () => {
      setLoading(true);
      try {
        console.log('🔄 Starting auth session check...');
        
        // Устанавливаем таймер на 15 секунд
        loadingTimeoutRef.current = setTimeout(() => {
          console.log('⏰ Auth loading timeout - forcing logout');
          handleAuthTimeout();
        }, 15000);
        
        // Получаем пользователя напрямую из Supabase auth
        const { data: { user: supabaseUser }, error: supabaseError } = await supabase.auth.getUser();
        
        // Очищаем таймер сразу после получения ответа от Supabase
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }

        if (supabaseError) {
          console.error('Supabase getUser error:', supabaseError);
          setUser(null);
          localStorage.removeItem('auth_user');
          setShouldRedirect(true);
          return;
        }

        if (supabaseUser) {
          console.log('Supabase user found:', supabaseUser.email);
          const currentUser = await getCurrentUser();
          if (currentUser) {
            console.log('Current user data from DB found:', currentUser);
            const success = await handleAuthUser(currentUser);
            if (success) {
              setShouldRedirect(false);
            } else {
              console.warn('Failed to process auth user data, redirecting to login.');
              setUser(null);
              localStorage.removeItem('auth_user');
              setShouldRedirect(true);
            }
          } else {
            console.warn('No user data found in DB for authenticated Supabase user. Forcing logout.');
            setUser(null);
            localStorage.removeItem('auth_user');
            setShouldRedirect(true);
          }
        } else {
          console.log('No current user found');
          setUser(null);
          localStorage.removeItem('auth_user');
        }
      } catch (error) {
        console.error('Error checking current session:', error);
        setUser(null);
        localStorage.removeItem('auth_user');
        setShouldRedirect(true);
      } finally {
        setLoading(false);
        console.log('✅ Auth session check completed');
      }
    };

    checkCurrentSession();

    // Слушаем изменения состояния аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        localStorage.removeItem('auth_user');
      } else if (event === 'SIGNED_IN' && session.user) {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          await handleAuthUser(currentUser);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      // Очищаем таймер при размонтировании
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  const handleAuthTimeout = () => {
    console.log('🚨 Authentication timeout - logging out user');
    setUser(null);
    localStorage.removeItem('auth_user');
    setShouldRedirect(true);
    
    // Очищаем таймер
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    setLoading(false);
  };

  const handleAuthUser = async (authUser: AuthUser) => {
    try {
      console.log('Handling auth user:', authUser);
      
      if (authUser.role === 'cadet') {
        // Получаем данные кадета
        const cadetData = await getCadetByAuthId(authUser.id);
        
        if (!cadetData) {
          console.warn('No cadet profile found for user:', authUser.id);
          // Для кадета без профиля создаем базовые данные пользователя
          const userData = {
            id: authUser.id,
            name: authUser.name,
            role: 'cadet' as const
          };
          setUser(userData);
          localStorage.setItem('auth_user', JSON.stringify(userData));
          return true;
        }
        
        // Если профиль кадета найден, используем полные данные
        const userData = {
          id: authUser.id,
          name: authUser.name,
          role: 'cadet' as const,
          platoon: cadetData.platoon,
          squad: cadetData.squad,
          cadetId: cadetData.id
        };
        console.log('Setting cadet user data:', userData);
        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        return true;
      } else if (authUser.role === 'admin') {
        const userData = {
          id: authUser.id,
          name: authUser.name,
          role: 'admin' as const
        };
        console.log('Setting admin user data:', userData);
        setUser(userData);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error handling auth user:', error);
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('Login attempt for:', email);
      
      // Устанавливаем таймер для логина
      loadingTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Login timeout - aborting');
        handleAuthTimeout();
      }, 10000);
      
      // Используем Supabase signInWithPassword напрямую
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      // Очищаем таймер сразу после получения ответа от Supabase
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      if (authError) {
        console.error('Supabase signInWithPassword error:', authError);
        return false;
      }

      if (authData.user) {
        console.log('Authentication successful with Supabase user:', authData.user.email);
        const currentUser = await getCurrentUser();
        if (currentUser) {
          const success = await handleAuthUser(currentUser);
          if (success) {
            setShouldRedirect(false);
            return true;
          } else {
            console.warn('Failed to process auth user data after login.');
            setUser(null);
            localStorage.removeItem('auth_user');
            setShouldRedirect(true);
            return false;
          }
        } else {
          console.warn('No user data found in DB for newly authenticated Supabase user.');
          setUser(null);
          localStorage.removeItem('auth_user');
          setShouldRedirect(true);
          return false;
        }
      }

      console.log('Authentication failed: No user data from Supabase.');
      return false;
    } catch (error) {
      console.error('Login error:', error);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      return false;
    }
  };


  const logout = () => {
    console.log('Logging out user');
    // Очищаем таймер при выходе
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    signOut();
    setUser(null);
    localStorage.removeItem('auth_user');
    setShouldRedirect(true);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, loading, shouldRedirect }}>
      {children}
    </AuthContext.Provider>
  );
};