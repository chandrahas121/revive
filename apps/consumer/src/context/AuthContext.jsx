import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '@amazon-hackon/shared';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      try {
        const response = await api.get('/api/auth/me/');
        setUser(response.data);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/api/auth/login/', { email, password });
    setUser(response.data.user);
    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await api.post('/api/auth/register/', { name, email, password });
    setUser(response.data.user);
    return response.data;
  };

  const logout = async () => {
    await api.post('/api/auth/logout/');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
