import React, { useState } from 'react';
import { 
  Menu, 
  X, 
  Calendar, 
  Clock, 
  Settings, 
  Building2, 
  Activity, 
  BarChart3,
  Plus,
  Users,
  ChevronDown,
  ChevronRight,
  Home,
  LogOut
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../login/AuthContext';

const Sidebar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState([]);

  const menuItems = [
    {
      id: 'personal',
      title: '個人排程',
      icon: Calendar,
      defaultPath: '/sss/homepage',
      submenu: [
        { id: 'today-schedule', title: '今日手術安排', icon: Home, path: '/sss/homepage' },
        { id: 'tomorrow-schedule', title: '明日行程確認', icon: Clock, path: '/sss/personal/tomorrow' },
        { id: 'schedule-management', title: '個人排程管理', icon: Settings, path: '/sss/personal/management' }
      ]
    },
    {
      id: 'hospital',
      title: '全院手術概況',
      icon: Building2,
      defaultPath: '/sss/operation/rooms',
      submenu: [
        { id: 'operating-room-status', title: '目前手術室使用情形', icon: Activity, path: '/sss/operation/rooms' },
        { id: 'hospital-schedule', title: '預期手術行程', icon: BarChart3, path: '/sss/surgery/schedule' }
      ]
    },
    ...(user?.role === 'N' ? [
      {
        id: 'patient-info',
        title: '病患資訊管理',
        icon: Plus,
        path: '/sss/patient/management'
      }
    ] : [
      {
        id: 'add-schedule',
        title: '新增排程',
        icon: Plus,
        path: '/sss/add/schedule',
        requirePermission: '1' 
      }
    ]),
    // 排班規劃 - 根據角色顯示不同內容
    ...(user?.role === 'N' ? [
      {
        id: 'shift-planning',
        title: '排班規劃',
        icon: Users,
        defaultPath: '/sss/nurse/shift/view',
        submenu: [
          { 
            id: 'nurse-shift-view', 
            title: '本週排班', 
            icon: Calendar, 
            path: '/sss/nurse/shift/view' 
          },
          ...(user?.permission === '1' ? [
            { 
              id: 'nurse-shift-manage', 
              title: '排班輪值', 
              icon: Settings, 
              path: '/sss/nurse/shift/manage',
              requirePermission: '1'
            }
          ] : [])
        ]
      }
    ] : user?.role === 'A' ? [
      {
        id: 'shift-planning',
        title: '排班規劃',
        icon: Users,
        defaultPath: '/sss/assistant/shift/view',
        submenu: [
          { 
            id: 'assistant-shift-view', 
            title: '本月排班', 
            icon: Calendar, 
            path: '/sss/assistant/shift/view' 
          },
          ...(user?.permission === '1' ? [
            { 
              id: 'assistant-shift-manage', 
              title: '排班管理', 
              icon: Settings, 
              path: '/sss/assistant/shift/manage',
              requirePermission: '1'
            }
          ] : [])
        ]
      }
    ] : [
      {
        id: 'shift-planning',
        title: '排班規劃',
        icon: Users,
        path: '/sss/shift/planning',
      }
    ])
  ];

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setOpenSubmenu(['personal', 'hospital', 'shift-planning']);
    } else {
      setOpenSubmenu([]);
    }
  };

  const toggleSubmenu = (item) => {
    if (!isOpen) {
      if (item.defaultPath) {
        handleNavigation(item.defaultPath);
      }
      return;
    }
    
    setOpenSubmenu(prev => {
      const currentSubmenu = Array.isArray(prev) ? prev : [];
      
      if (currentSubmenu.includes(item.id)) {
        return currentSubmenu.filter(id => id !== item.id);
      } else {
        return [...currentSubmenu, item.id];
      }
    });
  };

  const handleNavigation = (path, requirePermission = null) => {
    // 檢查權限
    if (requirePermission && user?.permission !== requirePermission) {
      alert('您沒有權限訪問此功能\n需要「可修改」權限');
      return;
    }
    
    navigate(path);
    setIsOpen(false);
    setOpenSubmenu([]);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('登出失敗:', error);
      alert('登出失敗，請重試');
    }
  };

  // 檢查選單項目是否可用
  const isMenuItemDisabled = (item) => {
    return item.requirePermission && user?.permission !== item.requirePermission;
  };

  return (
    <>
      {/* 遮罩層 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* 側邊欄 */}
      <div className={`
        fixed left-0 top-0 h-full bg-white shadow-lg z-50 transition-all duration-300 ease-in-out
        text-left flex flex-col
        ${isOpen ? 'w-64' : 'w-16'}
        ${isOpen ? 'translate-x-0' : '-translate-x-0'}
        lg:relative lg:translate-x-0
      `}>
        {/* 頂部標題區 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className={`transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            {isOpen && (
              <div>
                <h1 className="text-lg font-semibold text-gray-900">手術排程系統</h1>
                <p className="text-sm text-gray-500">Surgery Scheduling</p>
              </div>
            )}
          </div>
          
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            {isOpen ? (
              <X className="w-5 h-5 text-gray-600" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* 導航選單 */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const disabled = isMenuItemDisabled(item);
              
              return (
                <li key={item.id}>
                  <div>
                    {item.submenu ? (
                      // 有子選單的項目
                      <button
                        onClick={() => toggleSubmenu(item)}
                        className={`
                          w-full flex items-center justify-between p-3 rounded-lg text-left
                          transition-all duration-200 group
                          ${Array.isArray(openSubmenu) && openSubmenu.includes(item.id) ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
                        `}
                        title={!isOpen ? item.title : ''}
                      >
                        <div className="flex items-center">
                          <item.icon className={`
                            w-5 h-5 transition-colors duration-200 flex-shrink-0
                            ${Array.isArray(openSubmenu) && openSubmenu.includes(item.id) ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}
                          `} />
                          {isOpen && (
                            <span className="ml-3 font-medium transition-opacity duration-300">
                              {item.title}
                            </span>
                          )}
                        </div>
                        
                        {isOpen && (
                          <div className="transition-transform duration-200">
                            {Array.isArray(openSubmenu) && openSubmenu.includes(item.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </div>
                        )}
                      </button>
                    ) : (
                      // 沒有子選單的項目
                      <button
                        onClick={() => handleNavigation(item.path, item.requirePermission)}
                        disabled={disabled}
                        className={`
                          w-full flex items-center p-3 rounded-lg text-left transition-all duration-200 group
                          ${disabled 
                            ? 'text-gray-400 cursor-not-allowed opacity-50' 
                            : 'text-gray-700 hover:bg-gray-50'
                          }
                        `}
                        title={!isOpen ? item.title : (disabled ? '需要修改權限' : '')}
                      >
                        <item.icon className={`
                          w-5 h-5 transition-colors duration-200 flex-shrink-0
                          ${disabled ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-700'}
                        `} />
                        {isOpen && (
                          <div className="flex items-center justify-between flex-1 ml-3">
                            <span className="font-medium transition-opacity duration-300">
                              {item.title}
                            </span>
                            {disabled && (
                              <span className="text-xs text-gray-400 ml-2">🔒</span>
                            )}
                          </div>
                        )}
                      </button>
                    )}
                  </div>

                  {/* 子選單 */}
                  {item.submenu && (
                    <div className={`
                      overflow-hidden transition-all duration-300 ease-in-out
                      ${Array.isArray(openSubmenu) && openSubmenu.includes(item.id) && isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                    `}>
                      <ul className="mt-2 ml-4 space-y-1">
                        {item.submenu.map((subItem) => {
                          const subItemDisabled = isMenuItemDisabled(subItem);
                          
                          return (
                            <li key={subItem.id}>
                              <button
                                onClick={() => handleNavigation(subItem.path, subItem.requirePermission)}
                                disabled={subItemDisabled}
                                className={`
                                  w-full flex items-center p-2 rounded-lg text-left transition-all duration-200 group
                                  ${subItemDisabled 
                                    ? 'text-gray-400 cursor-not-allowed opacity-50' 
                                    : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                                  }
                                `}
                                title={subItemDisabled ? '需要修改權限' : ''}
                              >
                                <subItem.icon className={`
                                  w-4 h-4 transition-colors duration-200
                                  ${subItemDisabled 
                                    ? 'text-gray-300' 
                                    : 'text-gray-400 group-hover:text-blue-600'
                                  }
                                `} />
                                <div className="flex items-center justify-between flex-1 ml-3">
                                  <span className="text-sm font-medium">
                                    {subItem.title}
                                  </span>
                                  {subItemDisabled && (
                                    <span className="text-xs text-gray-400 ml-2">🔒</span>
                                  )}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 底部用戶資訊 */}
        <div className="border-t border-gray-200 p-4 text-left mt-auto flex-shrink-0">
          {isOpen ? (
            <div className="text-left">
              {/* 使用者資訊 - 靠左對齊 */}
              <div className="flex items-start mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    {/* 第一行：姓名 + 職位 */}
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user?.name || '使用者'}&nbsp;&nbsp;&nbsp;{user?.role_display}
                    </p>
                    {/* 第二行：科別 + 編號 */}
                    <p className="text-xs text-gray-500 truncate">
                      {user?.department_name}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;{user?.employee_id}
                    </p>
                  </div>
                </div>

              {/* 登出按鈕 */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                登出
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
                {/* 收合狀態：只顯示頭像 */}
                <div 
                  className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold cursor-pointer hover:shadow-lg transition-shadow"
                  title={user?.name || '使用者'}
                >
                  {user?.name?.charAt(0) || 'U'}
                </div>
                
              {/* 登出按鈕（圖示） */}
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors duration-200"
                title="登出"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;