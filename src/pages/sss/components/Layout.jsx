import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* 側邊欄 */}
      <Sidebar />
      
      {/* 主要內容區域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 主要內容 */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;