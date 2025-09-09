import React from 'react';
import { useNavigate } from 'react-router-dom';

const NavigationPage = () => {
  const navigate = useNavigate();

  const navItems = [
    {
      title: '🔐 登入頁面',
      description: '醫護人員使用手機生物識別登入',
      path: '/login',
      color: 'blue'
    },
    {
      title: '🔐 主系統頁面',
      description: '醫護人員使用手機生物識別登入',
      path: '/sss/homepage',
      color: 'blue'
    },
    {
      title: '👥 管理員後台',
      description: '員工管理和系統設定',
      path: '/admin',
      color: 'purple'
    },
    {
      title: '➕ 新增員工',
      description: '新增醫護人員帳號',
      path: '/admin/add',
      color: 'green'
    },
    {
      title: '📧 註冊驗證',
      description: '員工點擊註冊信件後的驗證頁面',
      path: '/register/demo-token',
      color: 'orange',
      note: '實際使用時會是動態 token'
    },
    {
      title: '📱 FIDO 設定',
      description: '手機安全金鑰註冊頁面',
      path: '/register/fido',
      color: 'indigo',
      note: '需要先完成員工驗證'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-600 hover:bg-blue-700 border-blue-200',
      purple: 'bg-purple-600 hover:bg-purple-700 border-purple-200', 
      green: 'bg-green-600 hover:bg-green-700 border-green-200',
      orange: 'bg-orange-600 hover:bg-orange-700 border-orange-200',
      indigo: 'bg-indigo-600 hover:bg-indigo-700 border-indigo-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-4">
            <svg className="h-16 w-16 text-blue-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            醫院手術排程系統
          </h1>
          <p className="text-gray-600 text-lg">
            Surgery Scheduling System
          </p>
          <div className="mt-4 inline-block px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
            🚧 開發導航頁面 - 選擇要測試的功能
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-200"
            >
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                  {item.description}
                </p>
                
                {item.note && (
                  <div className="mb-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-700">
                      💡 {item.note}
                    </p>
                  </div>
                )}
                
                <button
                  onClick={() => navigate(item.path)}
                  className={`w-full text-white font-medium py-3 px-4 rounded-lg transition duration-200 transform hover:scale-[1.02] ${getColorClasses(item.color)}`}
                >
                  前往測試
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* System Status */}
        <div className="mt-12 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🔧 系統狀態</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-green-600 font-bold text-lg">✅</div>
              <div className="text-sm text-green-800">登入頁面</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-green-600 font-bold text-lg">✅</div>
              <div className="text-sm text-green-800">註冊流程</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-green-600 font-bold text-lg">✅</div>
              <div className="text-sm text-green-800">管理後台</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-yellow-600 font-bold text-lg">🚧</div>
              <div className="text-sm text-yellow-800">主系統</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">⚡ 快速操作</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => window.open('http://localhost:3001/api/health', '_blank')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition"
            >
              檢查後端 API
            </button>
            <button
              onClick={() => window.open('http://localhost:3001/api/employees', '_blank')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition"
            >
              查看員工資料
            </button>
            <button
              onClick={() => window.open('http://localhost:3001/api/departments', '_blank')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition"
            >
              查看部門資料
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>醫院資訊室 | 開發環境 v1.0</p>
        </div>
      </div>
    </div>
  );
};

export default NavigationPage;