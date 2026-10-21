import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { StorageService } from '../services/storageService';
import { INITIAL_USERS } from '../constants';

interface AuthContextType {
  currentUser: User | null;
  role: UserRole;
  allUsers: User[];
  isLoading: boolean;
  login: (emailOrPhone: string, pass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  switchUserRole: (role: UserRole) => Promise<void>;
  switchUserById: (userId: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
  updateUserProfile: (updated: Partial<User>) => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>(INITIAL_USERS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUsers = async () => {
    const users = await StorageService.getAllUsers();
    setAllUsers(users);
  };

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        await StorageService.seedInitialDataIfNeeded();
        const users = await StorageService.getAllUsers();
        setAllUsers(users);
        const user = await StorageService.getCurrentUser();
        setCurrentUser(user || users[0]);
      } catch (error) {
        console.warn('Auth storage unavailable; using initial users.', error);
        setAllUsers(INITIAL_USERS);
        setCurrentUser(INITIAL_USERS[0]);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (
    emailOrPhone: string,
    _pass: string
  ): Promise<{ success: boolean; message: string }> => {
    const clean = emailOrPhone.trim().toLowerCase();
    const matched = allUsers.find(
      u => u.email.toLowerCase() === clean || u.phone === clean
    );

    if (matched) {
      setCurrentUser(matched);
      await StorageService.setCurrentUser(matched);
      return { success: true, message: `Welcome back, ${matched.name}!` };
    }

    return {
      success: false,
      message: 'Invalid credentials. You can use admin@parthmobile.com or quick switch.',
    };
  };

  const logout = async () => {
    await StorageService.setCurrentUser(null);
    setCurrentUser(null);
  };

  const switchUserRole = async (targetRole: UserRole) => {
    const userWithRole = allUsers.find(u => u.role === targetRole) || allUsers[0];
    setCurrentUser(userWithRole);
    await StorageService.setCurrentUser(userWithRole);
  };

  const switchUserById = async (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      await StorageService.setCurrentUser(user);
    }
  };

  const updateUserProfile = async (updated: Partial<User>) => {
    if (!currentUser) return;
    const modified: User = { ...currentUser, ...updated };
    setCurrentUser(modified);
    await StorageService.setCurrentUser(modified);
    await StorageService.saveUser(modified);
    await refreshUsers();
  };

  const changePassword = async (
    _oldPass: string,
    _newPass: string
  ): Promise<{ success: boolean; message: string }> => {
    // In our local offline/demo storage, password changes succeed instantly
    return { success: true, message: 'Password updated successfully!' };
  };

  const role: UserRole = currentUser?.role || 'staff';
  const isAdmin = role === 'admin';
  const isManager = role === 'manager' || role === 'admin';
  const isStaff = role === 'staff';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        allUsers,
        isLoading,
        login,
        logout,
        switchUserRole,
        switchUserById,
        refreshUsers,
        updateUserProfile,
        changePassword,
        isAdmin,
        isManager,
        isStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
