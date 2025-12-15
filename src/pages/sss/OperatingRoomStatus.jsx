// pages/sss/OperatingRoomStatus.jsx
// 手術室使用情形 - 修正跑版與資訊顯示版本

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Users,
  AlertCircle,
  Loader2,
  Stethoscope
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../../pages/login/AuthContext';
import surgeryRoomService from '../../services/surgeryRoomService';
import tshsoSchedulingService from '../../services/TS-HSO_schedulingService';

const OperatingRoomStatus = () => {
  const { user } = useAuth();
  const userDepartment = user?.department_name || '外科部門';
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(0);
  
  // 資料狀態
  const [categories, setCategories] = useState([]);
  const [roomsData, setRoomsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 常數定義：確保 CSS 高度與 JS 計算一致
  const SLOT_HEIGHT = 80; // 每一小時的高度 (px)
  const ROOMS_PER_PAGE = 4;

  // === 載入手術室類型和資料 ===
  useEffect(() => {
    const loadSurgeryRoomData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await surgeryRoomService.getTypesWithCount();
        
        if (data && data.length > 0) {
          const formattedCategories = data.map(item => ({
            id: item.type,
            name: item.displayName || item.type,
            total: item.roomCount,
            rooms: item.roomIds || [],
            subtitle: item.typeInfo || ''
          }));

          setCategories(formattedCategories);

          if (formattedCategories.length > 0) {
            setSelectedCategory(formattedCategories[0].id);
          }

          const roomsDataTemp = {};
          for (const category of formattedCategories) {
            const rooms = await surgeryRoomService.getRoomsByType(category.id);
            roomsDataTemp[category.id] = rooms;
          }
          
          setRoomsData(roomsDataTemp);
          await loadTodaySchedule(formattedCategories, roomsDataTemp);
        }
      } catch (err) {
        console.error('載入手術室資料失敗:', err);
        setError(err.error || err.message || '載入資料失敗,請稍後再試');
      } finally {
        setLoading(false);
      }
    };

    loadSurgeryRoomData();
  }, [currentDate]);

  // === 載入當天排程資料 ===
  const loadTodaySchedule = async (cats, rooms) => {
    try {
      const dateStr = currentDate.toISOString().split('T')[0];
      const schedules = await tshsoSchedulingService.fetchScheduleByDate(dateStr);
      
      cats.forEach(category => {
        const categoryRooms = rooms[category.id] || [];
        
        categoryRooms.forEach(room => {
          const roomSurgeries = schedules.filter(s => s.room_id === room.id);
          
          room.surgeries = roomSurgeries.map(s => {
            const startTime = s.start_time.substring(0, 5);
            const endTime = s.end_time.substring(0, 5);
            
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const [endHour, endMinute] = endTime.split(':').map(Number);
            
            // 使用常數 SLOT_HEIGHT 進行精確計算
            const top = (startHour - 6) * SLOT_HEIGHT + (startMinute / 60) * SLOT_HEIGHT;
            const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
            const height = (durationMinutes / 60) * SLOT_HEIGHT;
            
            return {
              id: s.surgery_id,
              name: s.surgery_name || s.surgery_type_code,
              doctor: s.doctor_name,
              assistant: s.assistant_doctor_name, // 新增：取得助手醫師名稱
              startTime: startTime,
              endTime: endTime,
              status: determineStatus(startTime, endTime),
              top: top,
              height: height
            };
          });
        });
      });
      
    } catch (err) {
      console.error('載入排程資料失敗:', err);
      Object.values(rooms).flat().forEach(room => {
        room.surgeries = [];
      });
    }
  };

  // === 判斷手術狀態 ===
  const determineStatus = (startTime, endTime) => {
    const now = new Date();
    
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const surgeryStart = new Date(currentDate);
    surgeryStart.setHours(startHour, startMinute, 0);
    
    const surgeryEnd = new Date(currentDate);
    surgeryEnd.setHours(endHour, endMinute, 0);
    
    if (now >= surgeryStart && now <= surgeryEnd) {
      return 'ongoing';
    } else if (now > surgeryEnd) {
      return 'completed';
    } else {
      return 'scheduled';
    }
  };

  // === 計算統計數據 ===
  const calculateStats = () => {
    if (!selectedCategory || !roomsData[selectedCategory]) {
      return { ongoingCount: 0, completedCount: 0, totalCount: 0, usageRate: 0 };
    }

    const currentCategory = roomsData[selectedCategory] || [];
    let ongoingCount = 0;
    let completedCount = 0;
    let totalCount = 0;
    let roomsInUse = 0;

    currentCategory.forEach(room => {
      let hasOngoingSurgery = false;
      const surgeries = room.surgeries || [];
      
      surgeries.forEach(surgery => {
        totalCount++;
        if (surgery.status === 'ongoing') {
          ongoingCount++;
          hasOngoingSurgery = true;
        }
        if (surgery.status === 'completed') {
          completedCount++;
        }
      });
      
      if (hasOngoingSurgery) {
        roomsInUse++;
      }
    });

    const totalRooms = currentCategory.length;
    const usageRate = totalRooms > 0 ? Math.round((roomsInUse / totalRooms) * 100) : 0;

    return { ongoingCount, completedCount, totalCount, usageRate };
  };

  const stats = calculateStats();
  const currentCategory = categories.find(c => c.id === selectedCategory);
  const currentRooms = roomsData[selectedCategory] || [];

  // 分頁計算
  const totalPages = Math.ceil(currentRooms.length / ROOMS_PER_PAGE);
  const startIndex = currentPage * ROOMS_PER_PAGE;
  const endIndex = startIndex + ROOMS_PER_PAGE;
  const displayedRooms = currentRooms.slice(startIndex, endIndex);

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    setCurrentPage(0);
  };

  const handlePageChange = (pageIndex) => {
    setCurrentPage(pageIndex);
  };

  const handleDateChange = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + offset);
    setCurrentDate(newDate);
  };

  // 時間軸（6:00 - 22:00）
  const timeSlots = Array.from({ length: 17 }, (_, i) => i + 6);

  const getSurgeryStatusStyle = (status) => {
    switch (status) {
      case 'ongoing':
        return 'bg-green-100 border-green-500 text-green-900';
      case 'completed':
        return 'bg-gray-100 border-gray-400 text-gray-600';
      case 'scheduled':
        return 'bg-blue-100 border-blue-500 text-blue-900';
      default:
        return 'bg-gray-100 border-gray-400 text-gray-600';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50 flex items-center justify-center">
           <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        <PageHeader title="手術室使用情形" subtitle={userDepartment} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-x-auto">
          {/* 類別與統計區塊 */}
          <div className="bg-white rounded-lg shadow-md mb-4 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryChange(category.id)}
                    className={`
                      px-6 py-3 rounded-lg font-medium transition-all duration-200 
                      ${selectedCategory === category.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <span>{category.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCategory === category.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {category.total}間
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* 統計資訊 */}
              <div className="flex gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 w-32">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700">進行中</span>
                  </div>
                  <div className="text-2xl font-bold text-green-700">{stats.ongoingCount}</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 w-32">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">今日總量</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">{stats.totalCount}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              {currentCategory && (
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{currentCategory.subtitle}</span>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <button onClick={() => handleDateChange(-1)} className="p-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center min-w-[150px]">
                  <div className="text-sm font-medium text-gray-600 mb-0.5">
                    {currentDate.toLocaleDateString('zh-TW', { weekday: 'long' })}
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {currentDate.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </div>
                </div>
                <button onClick={() => handleDateChange(1)} className="p-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* 手術室排程表 */}
          <div className="bg-white rounded-lg shadow-md">
            {/* 分頁 */}
            {totalPages > 1 && (
              <div className="border-b border-gray-200 px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    顯示第 {startIndex + 1}-{Math.min(endIndex, currentRooms.length)} 間手術室
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} className="p-2 rounded hover:bg-gray-100 disabled:opacity-50">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-gray-700">{currentPage + 1} / {totalPages}</span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages - 1} className="p-2 rounded hover:bg-gray-100 disabled:opacity-50">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6">
              <div className="flex gap-4 justify-center">
                {/* 時間軸 */}
                <div className="flex-shrink-0">
                  <div className="h-16 flex items-center justify-center font-semibold text-gray-700 border-b-2 border-gray-300 bg-gray-50 rounded-t-lg px-4">
                    時間
                  </div>
                  <div className="relative">
                    {timeSlots.map((hour) => (
                      <div 
                        key={hour} 
                        // ✅ 強制設定高度為 80px，解決跑版問題
                        className="h-[80px] flex items-start justify-end pr-3 text-sm font-medium text-gray-600 border-b border-gray-200 pt-1"
                      >
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                </div>

                {/* 手術室列 */}
                {displayedRooms.map((room) => (
                  <div key={room.id} className="flex-shrink-0 w-64">
                    <div className={`h-16 border-2 border-gray-300 rounded-t-lg flex flex-col items-center justify-center shadow-sm ${
                      (room.surgeries || []).some(s => s.status === 'ongoing') ? 'bg-green-100 border-green-400' : 'bg-white'
                    }`}>
                      <div className="font-bold text-lg text-gray-900">{room.id}</div>
                    </div>

                    <div className="relative bg-white border-l-2 border-r-2 border-b-2 border-gray-300 rounded-b-lg">
                      {/* 背景格線 */}
                      {timeSlots.map((hour, index) => (
                        <div 
                          key={hour}
                          // ✅ 強制設定高度為 80px，與時間軸同步
                          className={`h-[80px] border-b ${index === timeSlots.length - 1 ? 'border-b-0' : 'border-gray-200'}`}
                        />
                      ))}

                      {/* 手術卡片 */}
                      {(room.surgeries || []).map((surgery) => (
                        <div
                          key={surgery.id}
                          // ✅ z-10 確保浮在線上, overflow-hidden 避免內容突出
                          className={`
                            absolute left-1 right-1 rounded-lg border-l-4 p-2 shadow-md z-10 overflow-hidden
                            transition-all duration-200 hover:shadow-lg hover:z-20
                            ${getSurgeryStatusStyle(surgery.status)}
                          `}
                          style={{
                            top: `${surgery.top}px`,
                            height: `${surgery.height}px`,
                            minHeight: '45px' // 最小高度稍微縮小，適應短手術
                          }}
                        >
                          <div className="flex flex-col h-full">
                             {/* 時間標示 */}
                             <div className="flex items-center justify-between mb-0.5">
                                <span className="font-bold text-sm">
                                  {surgery.startTime} - {surgery.endTime}
                                </span>
                             </div>
                             
                             {/* 手術名稱 - 自動截斷 */}
                             <div className="font-bold text-sm leading-tight line-clamp-2 flex-1 mb-1 text-left">
                               {surgery.name}
                             </div>
                             
                             {/* 醫師資訊 - 移除病患與時長，改顯示醫師 */}
                             <div className="flex items-center gap-1 text-xs mt-auto pt-1 border-t border-black/5">
                                <Stethoscope className="w-3 h-3 flex-shrink-0 opacity-60" />
                                <span className="truncate font-medium">
                                  {surgery.doctor} (主)
                                  {surgery.assistant ? ` &  ${surgery.assistant} (助)` : ''}
                                </span>
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 底部圖例 */}
              <div className="border-t border-gray-200 px-6 py-3 mt-6 flex gap-6 text-sm">
                  <span className="font-medium text-gray-700">狀態圖例：</span>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 border-l-4 border-green-500 rounded"></div><span className="text-gray-600">進行中</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-100 border-l-4 border-blue-500 rounded"></div><span className="text-gray-600">已排程</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-100 border-l-4 border-gray-400 rounded"></div><span className="text-gray-600">已完成</span></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default OperatingRoomStatus;