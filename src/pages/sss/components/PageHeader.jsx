// components/PageHeader.jsx
import React, { useState, useEffect } from 'react';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '../../login/AuthContext';
import { useNavigate } from 'react-router-dom';

const PageHeader = ({ title, subtitle, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
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

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* 自定義內容區域 */}
            {children}
            
            {/* 日期時間 */}
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{formatDate(currentTime)}</p>
              <p className="text-lg font-mono text-blue-600">{formatTime(currentTime)}</p>
            </div>

          </div>
        </div>
      </div>
    </header>
  );
};

export default PageHeader;