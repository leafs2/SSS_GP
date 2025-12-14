// OperatingRoomStatus.jsx - 串接真實排程資料版本
// 主要修改：從資料庫讀取當天排程，而非模擬資料

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Users,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../../pages/login/AuthContext';
import surgeryRoomService from '../../services/surgeryRoomService';
import tshsoSchedulingService from '../../services/TS-HSO_schedulingService';  // 新增

const OperatingRoomStatus = () => {
  const { user } = useAuth();
  const userDepartment = user?.department_name || '外科部門';
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());  // 修改：支援日期切換
  const [currentPage, setCurrentPage] = useState(0);
  
  // 資料狀態
  const [categories, setCategories] = useState([]);
  const [roomsData, setRoomsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 每頁顯示的手術室數量
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

          // 載入每個類型的手術室
          const roomsDataTemp = {};
          for (const category of formattedCategories) {
            const rooms = await surgeryRoomService.getRoomsByType(category.id);
            roomsDataTemp[category.id] = rooms;
          }
          
          setRoomsData(roomsDataTemp);

          // 新增：載入當天真實排程資料
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
  }, [currentDate]);  // 新增：日期改變時重新載入

  // === 新增：載入當天排程資料 ===
  const loadTodaySchedule = async (cats, rooms) => {
    try {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // 呼叫 API 取得當天排程
      const schedules = await tshsoSchedulingService.fetchScheduleByDate(dateStr);
      
      // 整理成介面需要的格式
      cats.forEach(category => {
        const categoryRooms = rooms[category.id] || [];
        
        categoryRooms.forEach(room => {
          // 找出這個手術室當天的手術
          const roomSurgeries = schedules.filter(s => s.room_id === room.id);
          
          // 轉換為前端格式
          room.surgeries = roomSurgeries.map(s => {
            const startTime = s.start_time.substring(0, 5);  // "HH:MM"
            const endTime = s.end_time.substring(0, 5);
            
            // 計算位置（基於時間軸）
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const [endHour, endMinute] = endTime.split(':').map(Number);
            
            const top = (startHour - 6) * 80 + (startMinute / 60) * 80;
            const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
            const height = (durationMinutes / 60) * 80;
            
            return {
              id: s.surgery_id,
              name: s.surgery_name || s.surgery_type_code,
              doctor: s.doctor_name,
              patient: s.patient_name,
              startTime: startTime,
              endTime: endTime,
              duration: s.duration * 60,  // 轉換為分鐘
              status: determineStatus(startTime, endTime),
              top: top,
              height: height
            };
          });
        });
      });
      
    } catch (err) {
      console.error('載入排程資料失敗:', err);
      // 失敗時設定空排程
      Object.values(rooms).flat().forEach(room => {
        room.surgeries = [];
      });
    }
  };

  // === 新增：判斷手術狀態 ===
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

  // 切換分頁時重置到第一頁
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    setCurrentPage(0);
  };

  // 處理分頁切換
  const handlePageChange = (pageIndex) => {
    setCurrentPage(pageIndex);
  };

  // === 新增：切換日期 ===
  const handleDateChange = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + offset);
    setCurrentDate(newDate);
  };

  // 時間軸（6:00 - 22:00）
  const timeSlots = Array.from({ length: 17 }, (_, i) => i + 6);

  // 獲取手術狀態樣式
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

  // 載入中狀態（保持原樣）
  if (loading) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader title="手術室使用情形" subtitle={userDepartment} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">載入手術室資料中...</p>
              </div>
            </div>
          </main>
        </div>
      </Layout>
    );
  }

  // 錯誤狀態（保持原樣）
  if (error) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader title="手術室使用情形" subtitle={userDepartment} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 font-medium mb-2">載入失敗</p>
                <p className="text-gray-600">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  重新載入
                </button>
              </div>
            </div>
          </main>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        <PageHeader title="手術室使用情形" subtitle={userDepartment} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-x-auto">
          {/* 類別切換區域 */}
          <div className="bg-white rounded-lg shadow-md mb-4 p-4">
            <div className="flex items-center justify-between mb-3">
              {/* 類別切換按鈕 */}
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
                      <span className={`
                        text-xs px-2 py-0.5 rounded-full
                        ${selectedCategory === category.id 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-600'
                        }
                      `}>
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

                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 w-32">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700">使用率</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-700">{stats.usageRate}%</div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 w-32">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">今日總量</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">{stats.totalCount}</div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 w-32">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <span className="text-xs font-medium text-gray-700">已完成</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-700">{stats.completedCount}</div>
                </div>
              </div>
            </div>

            {/* 類別說明 + 日期切換 */}
            <div className="flex items-center justify-between">
              {currentCategory && (
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{currentCategory.subtitle}</span>
                </div>
              )}
              
              {/* 新增：日期切換 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDateChange(-1)}
                  className="p-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="text-center min-w-[150px]">
                  <div className="text-sm font-medium text-gray-600 mb-0.5">
                    {currentDate.toLocaleDateString('zh-TW', { weekday: 'long' })}
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {currentDate.toLocaleDateString('zh-TW', { 
                      year: 'numeric', 
                      month: '2-digit', 
                      day: '2-digit' 
                    })}
                  </div>
                </div>
                
                <button
                  onClick={() => handleDateChange(1)}
                  className="p-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* 手術室排程表容器（保持原樣）*/}
          <div className="bg-white rounded-lg shadow-md">
            {/* 分頁控制器 */}
            {totalPages > 1 && (
              <div className="border-b border-gray-200 px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    顯示第 {startIndex + 1}-{Math.min(endIndex, currentRooms.length)} 間手術室（共 {currentRooms.length} 間）
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 0}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
                        ${currentPage === 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                        }
                      `}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <span className="text-sm font-medium text-gray-700">
                      {currentPage + 1} / {totalPages}
                    </span>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages - 1}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
                        ${currentPage === totalPages - 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                        }
                      `}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 手術室排程表 */}
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
                        className="h-20 flex items-start justify-end pr-3 text-sm font-medium text-gray-600 border-b border-gray-200"
                      >
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                </div>

                {/* 手術室列 */}
                {displayedRooms.map((room) => (
                  <div key={room.id} className="flex-shrink-0 w-64">
                    {/* 手術室標題 */}
                    <div className={`h-16 border-2 border-gray-300 rounded-t-lg flex flex-col items-center justify-center shadow-sm transition-colors ${
                      (room.surgeries || []).filter(s => s.status === 'ongoing').length > 0 
                        ? 'bg-green-100 border-green-400' 
                        : 'bg-white'
                    }`}>
                      <div className="font-bold text-lg text-gray-900">{room.id}</div>
                      <div className="text-xs text-gray-500">
                        {(room.surgeries || []).filter(s => s.status === 'ongoing').length > 0 ? (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <Activity className="w-3 h-3" />
                            使用中
                          </span>
                        ) : (
                          <span className="text-gray-400">空閒</span>
                        )}
                      </div>
                    </div>

                    {/* 手術時間軸 */}
                    <div className="relative bg-white border-l-2 border-r-2 border-b-2 border-gray-300 rounded-b-lg">
                      {/* 時間格線 */}
                      {timeSlots.map((hour, index) => (
                        <div 
                          key={hour}
                          className={`h-20 border-b ${index === timeSlots.length - 1 ? 'border-b-0' : 'border-gray-200'}`}
                        />
                      ))}

                      {/* 手術卡片 */}
                      {(room.surgeries || []).map((surgery) => (
                        <div
                          key={surgery.id}
                          className={`
                            absolute left-1 right-1 rounded-lg border-l-4 p-3 shadow-md
                            transition-all duration-200 hover:shadow-lg hover:scale-[1.02]
                            ${getSurgeryStatusStyle(surgery.status)}
                          `}
                          style={{
                            top: `${surgery.top}px`,
                            height: `${surgery.height}px`,
                            minHeight: '60px'
                          }}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="text-xs font-semibold">
                              {surgery.startTime} - {surgery.endTime}
                            </div>
                            {surgery.status === 'ongoing' && (
                              <span className="flex items-center gap-1 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                                <Activity className="w-3 h-3" />
                                進行中
                              </span>
                            )}
                          </div>
                          
                          <div className="font-semibold text-sm mb-1 line-clamp-2">
                            {surgery.name}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs">
                            <Users className="w-3 h-3" />
                            <span>{surgery.doctor}</span>
                          </div>
                          
                          <div className="text-xs text-gray-600 mt-1">
                            {surgery.patient} • {surgery.duration}分鐘
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 底部圖例 */}
              <div className="border-t border-gray-200 px-6 py-3 mt-6">
                <div className="flex items-center gap-6 text-sm">
                  <span className="font-medium text-gray-700">狀態圖例：</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 border-l-4 border-green-500 rounded"></div>
                    <span className="text-gray-600">進行中</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border-l-4 border-blue-500 rounded"></div>
                    <span className="text-gray-600">已排程</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-100 border-l-4 border-gray-400 rounded"></div>
                    <span className="text-gray-600">已完成</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default OperatingRoomStatus;