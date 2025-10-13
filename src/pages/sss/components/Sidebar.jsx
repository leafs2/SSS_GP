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
  Home
} from 'lucide-react';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [openSubmenu, setOpenSubmenu] = useState(['personal', 'hospital']); // 改為陣列，預設展開所有子選單

  const menuItems = [
    {
      id: 'personal',
      title: '個人排程',
      icon: Calendar,
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
      submenu: [
        { id: 'operating-room-status', title: '目前手術室使用情形', icon: Activity, path: '/sss/hospital/rooms' },
        { id: 'hospital-schedule', title: '預期手術行程', icon: BarChart3, path: '/sss/hospital/schedule' }
      ]
    },
    {
      id: 'add-schedule',
      title: '新增排程',
      icon: Plus,
      path: '/sss/scheduling/add'
    },
    {
      id: 'shift-planning',
      title: '排班規劃',
      icon: Users,
      path: '/sss/scheduling/shifts'
    }
  ];

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // 展開側邊欄時，自動展開所有子選單
      setOpenSubmenu(['personal', 'hospital']);
    } else {
      // 收合側邊欄時，關閉所有子選單
      setOpenSubmenu([]);
    }
  };

  const toggleSubmenu = (menuId) => {
    if (!isOpen) return; // 側邊欄收合時不操作子選單
    
    setOpenSubmenu(prev => {
      // 確保 prev 是陣列
      const currentSubmenu = Array.isArray(prev) ? prev : [];
      
      if (currentSubmenu.includes(menuId)) {
        // 如果已展開，則收合
        return currentSubmenu.filter(id => id !== menuId);
      } else {
        // 如果未展開，則展開
        return [...currentSubmenu, menuId];
      }
    });
  };

  const handleNavigation = (path) => {
    window.location.href = path;
  };

  return (
    <>
      {/* 遮罩層 - 行動裝置時使用 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* 側邊欄 */}
      <div className={`
        fixed left-0 top-0 h-full bg-white shadow-lg z-50 transition-all duration-300 ease-in-out
        ${isOpen ? 'w-64' : 'w-16'}
        ${isOpen ? 'translate-x-0' : '-translate-x-0'}
        lg:relative lg:translate-x-0
      `}>
        {/* 頂部標題區 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className={`transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            {isOpen && (
              <div>
                <h1 className="text-lg font-semibold text-gray-900">手術排程系統</h1>
                <p className="text-sm text-gray-500">Surgery Scheduling</p>
              </div>
            )}
          </div>
          
          {/* 漢堡選單按鈕 */}
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
            {menuItems.map((item) => (
              <li key={item.id}>
                {/* 主選單項目 */}
                <div>
                  {item.submenu ? (
                    // 有子選單的項目
                    <button
                      onClick={() => toggleSubmenu(item.id)}
                      className={`
                        w-full flex items-center justify-between p-3 rounded-lg text-left
                        transition-all duration-200 group
                        ${Array.isArray(openSubmenu) && openSubmenu.includes(item.id) ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
                      `}
                      title={!isOpen ? item.title : ''} // 收合時顯示提示文字
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
                      onClick={() => handleNavigation(item.path)}
                      className="w-full flex items-center p-3 rounded-lg text-left transition-all duration-200 group text-gray-700 hover:bg-gray-50"
                      title={!isOpen ? item.title : ''} // 收合時顯示提示文字
                    >
                      <item.icon className="w-5 h-5 text-gray-500 group-hover:text-gray-700 transition-colors duration-200 flex-shrink-0" />
                      {isOpen && (
                        <span className="ml-3 font-medium transition-opacity duration-300">
                          {item.title}
                        </span>
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
                      {item.submenu.map((subItem) => (
                        <li key={subItem.id}>
                          <button
                            onClick={() => handleNavigation(subItem.path)}
                            className="w-full flex items-center p-2 rounded-lg text-left transition-all duration-200 group text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <subItem.icon className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors duration-200" />
                            <span className="ml-3 text-sm font-medium">
                              {subItem.title}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* 底部用戶資訊 */}
        <div className="border-t border-gray-200 p-4">
          <div className={`transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            {isOpen ? (
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">陳醫師</p>
                  <p className="text-xs text-gray-500">外科醫師</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;