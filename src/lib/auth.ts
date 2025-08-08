import { supabase } from './supabase';
import { handleSupabaseError, handleAuthError, safeLog } from '../utils/errorHandler';

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'cadet';
  name: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateUserData {
  email: string;
  name: string;
  role: 'admin' | 'cadet';
}

// Аутентификация через Supabase Auth
export const authenticateUser = async (credentials: LoginCredentials): Promise<AuthUser | null> => {
  try {
    safeLog('Attempting to authenticate user', { email: credentials.email });
    
    // Используем Supabase Auth для входа
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    });

    if (authError) {
      const error = handleAuthError(authError);
      safeLog('Authentication failed', error);
      return null;
    }

    if (!authData.user) {
      return null;
    }

    console.log('Auth successful, user:', authData.user);

    // Получаем дополнительные данные пользователя из таблицы users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', credentials.email)
      .single();

    if (userError) {
      const error = handleSupabaseError(userError);
      safeLog('User data not found, creating new user', error);
      
      // Если нет записи в таблице users, создаем её в БД
      try {
        const newUserData = {
          id: authData.user.id,
          email: authData.user.email!,
          role: 'cadet' as const,
          name: authData.user.email!.split('@')[0]
        };
        
        await createUserInDatabase(newUserData);
        return newUserData;
      } catch (createError) {
        safeLog('Failed to create user in database', createError);
        return null;
      }
    }

    safeLog('User authentication successful', { id: userData.id, role: userData.role });
    return {
      id: authData.user.id,
      email: userData.email,
      role: userData.role,
      name: userData.name
    };

  } catch (error) {
    safeLog('Authentication error', error);
    return null;
  }
};

// Создание пользователя в базе данных
const createUserInDatabase = async (userData: CreateUserData & { id: string }): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .insert([{
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role
    }]);
  
  if (error) {
    safeLog('Error inserting user into database', error);
    throw error;
  }
};

// Получение данных кадета по ID пользователя
export const getCadetByAuthId = async (authUserId: string) => {
  try {
    safeLog('Getting cadet by auth ID', { authUserId });
    
    const { data, error } = await supabase
      .from('cadets')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      safeLog('Error fetching cadet data', handleSupabaseError(error));
      return null;
    }
    
    return data;
  } catch (error) {
    safeLog('Error fetching cadet by auth ID', error);
    return null;
  }
};

// Выход из системы
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      safeLog('Sign out error', error);
    }
  } catch (error) {
    safeLog('Sign out error', error);
  }
};

// Получение текущего пользователя
export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    console.log('🔍 Getting current user from Supabase...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('❌ No authenticated user found');
      return null;
    }

    console.log('✅ Authenticated user found:', user.email);

    // Получаем данные из таблицы users
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      safeLog('Error fetching current user data', handleSupabaseError(error));
      console.log('❌ Failed to fetch user data from users table');
      return null;
    }

    console.log('✅ User data fetched successfully:', userData.email, userData.role);

    return {
      id: user.id,
      email: userData.email,
      role: userData.role,
      name: userData.name
    };
  } catch (error) {
    safeLog('Error getting current user', error);
    console.log('❌ Error in getCurrentUser:', error);
    return null;
  }
};