import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, provider } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        if (!user.email?.endsWith('@tsunjin.edu.my')) {
          auth.signOut();
          setUser(null);
          alert('登录失败：仅允许 @tsunjin.edu.my 域名的师生账号登录。');
        } else {
          setUser(user);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      if (!result.user.email?.endsWith('@tsunjin.edu.my')) {
        await auth.signOut();
        alert('登录失败：仅允许 @tsunjin.edu.my 域名的师生账号登录。');
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
