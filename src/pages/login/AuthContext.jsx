// src/contexts/AuthContext.jsx
// 全域認證狀態管理

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, checkLoginStatus, logout as apiLogout } from '../../utils/api.js';

const AuthContext = createContext(null);

/**
 * 認證上下文 Provider
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  /**
   * 檢查登入狀態
   */
  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const response = await checkLoginStatus();
      
      if (response.isLoggedIn && response.user) {
        setUser(response.user);
        setIsLoggedIn(true);
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('檢查登入狀態失敗:', error);
      setUser(null);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 取得完整的使用者資訊
   */
  const fetchUserInfo = async () => {
    try {
      const response = await getCurrentUser();
      if (response.success && response.user) {
        setUser(response.user);
        setIsLoggedIn(true);
        return response.user;
      }
    } catch (error) {
      console.error('取得使用者資訊失敗:', error);
      setUser(null);
      setIsLoggedIn(false);
      throw error;
    }
  };

  /**
   * 登入（設定使用者資訊）
   */
  const login = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  /**
   * 登出
   */
  const logout = async () => {
    try {
      await apiLogout();
      setUser(null);
      setIsLoggedIn(false);
      return true;
    } catch (error) {
      console.error('登出失敗:', error);
      // 即使 API 失敗，也清除本地狀態
      setUser(null);
      setIsLoggedIn(false);
      throw error;
    }
  };

  /**
   * 頁面載入時檢查登入狀態
   */
  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    isLoggedIn,
    isLoading,
    login,
    logout,
    checkAuth,
    fetchUserInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 使用認證上下文的 Hook
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必須在 AuthProvider 內使用');
  }
  return context;
}

export default AuthContext;