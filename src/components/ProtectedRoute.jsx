// src/components/ProtectedRoute.jsx
// 路由保護元件：未登入則跳轉到登入頁

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../pages/login/AuthContext';
import { FullScreenLoader } from './LoadingSpinner';

/**
 * 路由保護元件
 * 
 * 使用方式：
 * <Route path="/protected" element={<ProtectedRoute><YourPage /></ProtectedRoute>} />
 * 
 * 或使用 requireAuth：
 * <Route path="/protected" element={<ProtectedRoute requireAuth><YourPage /></ProtectedRoute>} />
 * 
 * 或使用 requireRole：
 * <Route path="/admin" element={<ProtectedRoute requireRole="admin"><AdminPage /></ProtectedRoute>} />
 */
function ProtectedRoute({ 
  children, 
  requireAuth = true,
  requireRole = null,
  requirePermission = null,
  redirectTo = '/login'
}) {
  const { user, isLoggedIn, isLoading } = useAuth();
  const location = useLocation();

  // 載入中
  if (isLoading) {
    return <FullScreenLoader message="驗證登入狀態中..." />;
  }

  // 檢查是否需要登入
  if (requireAuth && !isLoggedIn) {
    // 記住使用者原本要去的頁面，登入後可以跳回
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // 檢查角色權限
  if (requireRole && user?.role !== requireRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            權限不足
          </h1>
          <p className="text-gray-600 mb-6">
            您沒有權限訪問此頁面。
            <br />
            此頁面僅限 {requireRole === 'admin' ? '管理員' : requireRole === 'D' ? '醫師' : '護理師'} 使用。
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回上一頁
          </button>
        </div>
      </div>
    );
  }

  // 檢查操作權限
  if (requirePermission && user?.permission !== requirePermission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            權限不足
          </h1>
          <p className="text-gray-600 mb-6">
            您的帳號僅有「僅查看」權限，無法執行此操作。
            <br />
            請聯絡管理員申請「可修改」權限。
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回上一頁
          </button>
        </div>
      </div>
    );
  }

  // 通過所有檢查，顯示頁面
  return children;
}

/**
 * 快速建立受保護路由的 Helper
 */
export function withAuth(Component, options = {}) {
  return function ProtectedComponent(props) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

export default ProtectedRoute;