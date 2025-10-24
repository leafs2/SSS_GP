// src/pages/dev/QuickLogin.jsx
// 開發模式專用：快速登入頁面（重新設計版）

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  LogIn, 
  LogOut, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Home,
  Shield,
  Search,
  X
} from 'lucide-react';
import { useAuth } from '../../pages/login/AuthContext';
import { getDevEmployees, quickLogin, getDevStatus } from '../../utils/api';

const QuickLogin = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, login, logout } = useAuth();
  
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loggingIn, setLoggingIn] = useState(null);
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * 檢查開發模式並載入測試帳號
   */
  useEffect(() => {
    loadDevStatus();
    loadEmployees();
  }, []);

  /**
   * 搜尋過濾
   */
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredEmployees(employees);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = employees.filter((emp) => {
      return (
        emp.employee_id.toLowerCase().includes(term) ||
        emp.name.toLowerCase().includes(term) ||
        emp.department_name.toLowerCase().includes(term) ||
        emp.role_display.toLowerCase().includes(term)
      );
    });
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  const loadDevStatus = async () => {
    try {
      const response = await getDevStatus();
      setIsDevelopment(response.isDevelopment);
      
      if (!response.isDevelopment) {
        setError('此功能僅在開發環境可用');
      }
    } catch (error) {
      console.error('檢查開發模式失敗:', error);
    }
  };

  const loadEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDevEmployees();
      if (response.success) {
        setEmployees(response.employees);
        setFilteredEmployees(response.employees);
      }
    } catch (error) {
      console.error('載入員工列表失敗:', error);
      setError(error.message || '載入失敗，請確認後端伺服器是否運行');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 快速登入
   */
  const handleQuickLogin = async (employeeId) => {
    setLoggingIn(employeeId);
    setError(null);
    
    try {
      const response = await quickLogin(employeeId);
      
      if (response.success) {
        login(response.user);
        
        // 根據角色跳轉到對應頁面
        if (response.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/sss/homepage');
        }
      }
    } catch (error) {
      console.error('快速登入失敗:', error);
      setError(error.message || '登入失敗');
    } finally {
      setLoggingIn(null);
    }
  };

  /**
   * 登出
   */
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('登出失敗:', error);
      alert('登出失敗：' + error.message);
    }
  };

  /**
   * 前往主頁
   */
  const goToHome = () => {
    if (user.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/sss/homepage');
    }
  };

  /**
   * 清除搜尋
   */
  const clearSearch = () => {
    setSearchTerm('');
  };

  // 載入中
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">載入測試帳號...</p>
        </div>
      </div>
    );
  }

  // 非開發環境
  if (!isDevelopment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-16 h-16 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">
            功能未啟用
          </h1>
          <p className="text-gray-600 text-center mb-6">
            快速登入功能僅在開發環境可用。
            <br />
            請設定 NODE_ENV=development 啟用此功能。
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            前往正式登入頁面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 頁面標題 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-1 flex items-center gap-3">
                🧪 開發模式 - 快速登入
              </h1>
              <p className="text-gray-600 text-sm">
                選擇測試帳號快速登入，跳過 FIDO 驗證
              </p>
            </div>
            <span className="inline-block bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full">
              開發環境
            </span>
          </div>

          {/* 當前登入狀態（精簡版） */}
          {isLoggedIn && user && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <span className="text-sm text-gray-600">已登入：</span>
                    <span className="font-semibold text-gray-800 ml-2">
                      {user.employee_id} - {user.name}
                    </span>
                    <span className="text-sm text-gray-600 ml-2">
                      ({user.department_name} / {user.role_display})
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={goToHome}
                    className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    主頁
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    登出
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 搜尋欄 */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋員工編號、姓名、科別或角色..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            找到 {filteredEmployees.length} 個測試帳號
          </p>
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 mb-1">發生錯誤</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* 測試帳號列表（表格形式） */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* 表格標題 */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-gray-700">
              <div className="col-span-3">員工編號 - 姓名</div>
              <div className="col-span-2">科別</div>
              <div className="col-span-2">角色</div>
              <div className="col-span-2">權限</div>
              <div className="col-span-1">FIDO</div>
              <div className="col-span-2 text-right">操作</div>
            </div>
          </div>

          {/* 表格內容 */}
          <div className="divide-y divide-gray-200">
            {filteredEmployees.length === 0 ? (
              <div className="p-12 text-center">
                <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  {searchTerm ? '找不到符合的帳號' : '沒有測試帳號'}
                </h3>
                <p className="text-gray-500 text-sm">
                  {searchTerm ? '請嘗試其他搜尋條件' : '請先在管理員頁面新增員工並完成註冊'}
                </p>
              </div>
            ) : (
              filteredEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                    user?.employee_id === emp.employee_id ? 'bg-green-50' : ''
                  }`}
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* 員工編號 - 姓名 */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 truncate">
                            {emp.employee_id}
                          </div>
                          <div className="text-sm text-gray-600 truncate">
                            {emp.name}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 科別 */}
                    <div className="col-span-2">
                      <div className="text-sm text-gray-700 truncate">
                        {emp.department_name}
                      </div>
                    </div>

                    {/* 角色 */}
                    <div className="col-span-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        emp.role === 'D' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {emp.role_display}
                      </span>
                    </div>

                    {/* 權限 */}
                    <div className="col-span-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        emp.permission === '1' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {emp.permission === '1' ? '可修改' : '僅查看'}
                      </span>
                    </div>

                    {/* FIDO 狀態 */}
                    <div className="col-span-1">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        emp.has_fido 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {emp.has_fido ? '✓' : '✗'}
                      </span>
                    </div>

                    {/* 操作按鈕 */}
                    <div className="col-span-2 flex justify-end">
                      {user?.employee_id === emp.employee_id ? (
                        <span className="text-xs font-medium text-green-600 px-3 py-1.5 bg-green-100 rounded">
                          ● 當前登入
                        </span>
                      ) : (
                        <button
                          onClick={() => handleQuickLogin(emp.employee_id)}
                          disabled={loggingIn !== null}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                            loggingIn === emp.employee_id
                              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {loggingIn === emp.employee_id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              登入中
                            </>
                          ) : (
                            <>
                              <LogIn className="w-4 h-4" />
                              快速登入
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 提示訊息 */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800 text-sm mb-1">
                ⚠️ 開發模式專用功能
              </h3>
              <p className="text-yellow-700 text-xs">
                此功能會跳過 FIDO 生物識別驗證，僅在 NODE_ENV=development 時可用。
                生產環境將自動禁用。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickLogin;