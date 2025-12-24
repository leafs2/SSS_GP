// pages/sss/PersonalSchedule.jsx
import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  MapPin, Clock, User, X, Edit, Trash2, Activity, Loader2, MoreHorizontal, Users
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import surgeryService from '../../services/surgeryService';
import { useAuth } from '../login/AuthContext';

const PersonalSchedule = () => {
  const { user } = useAuth();
  
  // --- 狀態管理 ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // --- 初始化與資料撈取 ---
  useEffect(() => {
    fetchMonthlyData();
  }, [currentDate]);

  const fetchMonthlyData = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const data = await surgeryService.getMonthlySchedule(year, month);
      setSurgeries(data || []);
    } catch (error) {
      console.error("載入失敗", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 日期操作 ---
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setIsSidebarOpen(false);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setIsSidebarOpen(false);
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedDate(null);
  };

  const getSurgeriesForDate = (date) => {
    if (!date) return [];

    // 輔助函式：取得當地時間的 YYYY-MM-DD
    // 解決使用了 toISOString() 導致時區轉換變成前一天的問題
    const getLocalDateKey = (d) => {
      const dateObj = new Date(d);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // 取得當前日曆格子的日期字串
    const targetDateStr = getLocalDateKey(date);

    return surgeries.filter(s => {
      // 取得資料庫回傳的日期字串
      const surgeryDateStr = getLocalDateKey(s.surgery_date);
      return surgeryDateStr === targetDateStr;
    }).sort((a, b) => {
      // 按開始時間排序
      if (!a.start_time_full || !b.start_time_full) return 0;
      return new Date(a.start_time_full) - new Date(b.start_time_full);
    });
  };

  // --- 月曆生成 ---
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; 
    
    const calendarDays = [];
    
    for (let i = 0; i < startDayOfWeek; i++) {
      calendarDays.push({ type: 'empty', key: `empty-${i}` });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      date.setHours(12, 0, 0, 0);
      
      calendarDays.push({ 
        type: 'day', 
        val: i, 
        date: date,
        key: `day-${i}`,
        events: getSurgeriesForDate(date)
      });
    }
    return calendarDays;
  };

  // 格式化單行手術顯示
  const formatSurgeryOneLine = (surgery) => {
    if (!surgery.start_time_full || !surgery.end_time_full) {
      return {
        display: '時間未定',
        hasData: false
      };
    }
    
    const start = new Date(surgery.start_time_full);
    const end = new Date(surgery.end_time_full);
    
    // 格式化為 HH:mm
    const formatTime = (date) => {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };
    
    const timeRange = `${formatTime(start)}-${formatTime(end)}`;
    const room = surgery.room_id || '未排';
    
    return {
      display: `${timeRange} ${room}`,
      timeRange,
      room,
      hasData: true,
      status: surgery.status
    };
  };

  const handleEdit = (surgeryId) => {
    alert(`編輯功能待實作: ${surgeryId}`);
  };

  const handleDelete = (surgeryId) => {
    if(window.confirm("確定刪除?")) alert(`刪除功能待實作: ${surgeryId}`);
  };

  return (
    <Layout>
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        
        {/* Header */}
        <PageHeader 
            title="個人排程管理" 
            subtitle="查看所有個人手術排程"
        >
             <div className="flex items-center gap-3 mr-8">
                <div className="flex items-center bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                    <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-600">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="px-4 font-semibold text-gray-700 select-none min-w-[110px] text-center text-sm">
                      {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                    </span>
                    <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-600">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
             </div>
        </PageHeader>

        {/* 內容主容器 - 保持 max-w-7xl，增加底部padding避免被遮擋 */}
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-6 min-h-0 flex flex-col">
          
          {/* 內部 Flex 容器 (月曆 + 側邊欄) */}
          <div className="flex-1 flex overflow-hidden gap-4 relative min-h-0">
            
            {/* 左側日曆區塊 */}
            <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 overflow-hidden">
                {/* 星期標題 */}
                <div className="grid grid-cols-7 gap-2 mb-2 shrink-0">
                  {['週一', '週二', '週三', '週四', '週五', '週六', '週日'].map(day => (
                      <div key={day} className="text-center text-sm font-semibold text-gray-500 py-2">
                        {day}
                      </div>
                  ))}
                </div>

                {/* 日曆格子 - 固定 6 行，確保最後一行可見 */}
                <div className="grid grid-cols-7 gap-2 flex-1 overflow-y-auto pr-1 auto-rows-[minmax(90px,_1fr)]">
                  {loading ? (
                      <div className="col-span-7 row-span-6 flex items-center justify-center bg-white/50 rounded-lg border border-gray-200">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      </div>
                  ) : (
                      generateCalendarDays().map((day) => {
                          if (day.type === 'empty') return <div key={day.key} className="bg-transparent" />;

                          const isSelected = selectedDate && day.date.toDateString() === selectedDate.toDateString();
                          const isToday = new Date().toDateString() === day.date.toDateString();
                          const eventsCount = day.events.length;
                          // 🎯 最多顯示 2 筆手術
                          const displayEvents = day.events.slice(0, 2);
                          const hasMore = eventsCount > 2;
                          // 🎨 超過2台手術時改變顏色
                          const isBusy = eventsCount > 2;

                          return (
                            <div 
                                key={day.key}
                                onClick={() => handleDateClick(day.date)}
                                className={`
                                  relative bg-white rounded-lg border p-2 cursor-pointer transition-all 
                                  hover:shadow-lg hover:z-20
                                  flex flex-col overflow-hidden
                                  ${isSelected ? 'ring-2 ring-blue-500 border-transparent z-10 shadow-lg' : 'border-gray-200'}
                                  ${isToday ? 'bg-blue-50 border-blue-300' : ''}
                                  ${isBusy ? 'bg-orange-50' : ''}
                                  ${eventsCount > 0 ? 'hover:border-blue-400' : ''}
                                `}
                            >
                                {/* 日期與數量標頭 */}
                                <div className="flex justify-between items-center mb-1.5 shrink-0">
                                  <span className={`
                                      text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full
                                      transition-colors
                                      ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}
                                  `}>
                                      {day.val}
                                  </span>

                                  {/* 更多指示器 */}
                                  {hasMore && (
                                    <div className="text-center text-[9px] text-orange-600 font-bold shrink-0 py-0.5">
                                      <span>還有 {eventsCount - 2} 筆</span>
                                    </div>
                                  )}

                                  {eventsCount > 0 && (
                                      <span className={`
                                        text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                        ${isBusy 
                                          ? 'bg-orange-500 text-white' 
                                          : 'bg-blue-100 text-blue-700'}
                                      `}>
                                        {eventsCount}台
                                      </span>
                                  )}
                                </div>

                                {/* 手術項目列表 - 最多 2 筆 */}
                                <div className="flex-1 flex flex-col gap-1 min-h-0 overflow-hidden">
                                  {displayEvents.map((surgery) => {
                                    const formatted = formatSurgeryOneLine(surgery);
                                    
                                    return (
                                      <div 
                                        key={surgery.surgery_id} 
                                        className="relative group/item shrink-0"
                                      >
                                        {/* 單行顯示：藍色圓點 + 時間 + 房間 */}
                                        <div className="flex items-center gap-1">
                                          {/* 藍色圓點 */}
                                          <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-500" />
                                          
                                          {/* 單行資訊 */}
                                          <div className={`
                                            flex-1 text-[10px] font-mono text-gray-700 font-semibold text-left
                                            px-1.5 py-0.5 rounded
                                            bg-gray-50 border border-gray-200
                                            hover:border-blue-300 hover:bg-blue-50
                                            transition-all truncate leading-tight
                                          `}>
                                            {formatted.display}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  
                                  
                                </div>
                            </div>
                          );
                      })
                  )}
                </div>
            </div>

            {/* 右側詳情欄 */}
            {isSidebarOpen && selectedDate && (
                <div className="w-96 bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-300">
                  {/* 側邊欄標題 */}
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white rounded-t-xl shrink-0">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5 text-blue-600" />
                          {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 詳情
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          共 {getSurgeriesForDate(selectedDate).length} 筆排程
                        </p>
                      </div>
                      <button 
                        onClick={closeSidebar} 
                        className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                  </div>

                  {/* 側邊欄內容 */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 rounded-b-xl">
                      {getSurgeriesForDate(selectedDate).length > 0 ? (
                        getSurgeriesForDate(selectedDate).map((surgery) => {
                          const formatted = formatSurgeryOneLine(surgery);
                          
                          return (
                            <div 
                              key={surgery.surgery_id} 
                              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all duration-200 group relative overflow-hidden"
                            >
                              {/* 左側藍色狀態條 */}
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />

                              {/* 手術名稱與狀態 - 處理長文字問題 */}
                              <div className="flex justify-between items-start mb-3 pl-2 gap-2">
                                  <h4 className="font-bold text-gray-800 text-base leading-snug flex-1 break-words text-left">
                                    {surgery.surgery_name}
                                  </h4>
                                  <span className={`px-2.5 py-1 text-xs rounded-full font-medium shrink-0 
                                    ${surgery.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' : 
                                      surgery.status === 'in-progress' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 
                                      'bg-orange-100 text-orange-700 border border-orange-200'}`}
                                  >
                                    {surgery.status === 'completed' ? '✓ 已完成' : 
                                     surgery.status === 'in-progress' ? '◉ 進行中' : '○ 待執行'}
                                  </span>
                              </div>

                              {/* 詳細資訊 */}
                              <div className="space-y-2.5 text-sm text-gray-600 pl-2">
                                  {/* 病患資訊 */}
                                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                    <User className="w-4 h-4 text-blue-500 shrink-0" />
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-gray-800">{surgery.patient_name}</span>
                                      <span className={`
                                        px-2 py-0.5 rounded text-xs font-medium
                                        ${surgery.patient_gender === 1 ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}
                                      `}>
                                        {surgery.patient_gender === 1 ? '男' : '女'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* 時間資訊 */}
                                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                                    <span className="font-mono font-semibold text-gray-800">
                                      {formatted.timeRange}
                                    </span>
                                  </div>

                                  {/* 手術房資訊 */}
                                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                    <MapPin className="w-4 h-4 text-gray-600 shrink-0" />
                                    <span className="font-bold text-gray-800">
                                      {formatted.room}
                                    </span>
                                  </div>

                                  {/* 醫療團隊資訊 */}
                                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Users className="w-4 h-4 text-blue-600 shrink-0" />
                                      <span className="font-semibold text-gray-700 text-xs">醫療團隊</span>
                                    </div>
                                    <div className="space-y-1.5 ml-6">
                                      {/* 主刀醫師 */}
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gray-500">主刀：</span>
                                        <span className="font-medium text-gray-800">
                                          {surgery.doctor_name || '待指派'}
                                        </span>
                                      </div>
                                      
                                      {/* 助手醫師 */}
                                      {surgery.assistant_doctor_name && (
                                        <div className="flex items-center gap-2 text-xs">
                                          <span className="text-gray-500">助手：</span>
                                          <span className="font-medium text-gray-800">
                                            {surgery.assistant_doctor_name}
                                          </span>
                                        </div>
                                      )}
                                      
                                      {/* 護理師 */}
                                      {surgery.nurses && surgery.nurses.length > 0 ? (
                                        <div className="flex items-start gap-2 text-xs">
                                          <span className="text-gray-500 shrink-0">護理師：</span>
                                          <div className="flex flex-wrap gap-1">
                                            {surgery.nurses.map((nurse, idx) => (
                                              <span 
                                                key={idx} 
                                                className="px-2 py-0.5 rounded text-gray-700 border bg-blue-50 border-blue-200"
                                                title={nurse.nurse_type === 'fixed' ? '固定護理師' : '流動護理師'}
                                              >
                                                {nurse.name}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 text-xs">
                                          <span className="text-gray-500">護理師：</span>
                                          <span className="text-gray-400 italic">待分配</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                              </div>

                              {/* 操作按鈕 (僅醫師可見) */}
                              {user && user.role === 'D' && (
                                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-2 pl-2">
                                    <button 
                                      onClick={() => handleEdit(surgery.surgery_id)} 
                                      className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors border border-gray-200 hover:border-blue-300"
                                    >
                                      <Edit className="w-4 h-4" />
                                      <span className="text-xs font-medium">編輯</span>
                                    </button>
                                    <button 
                                      onClick={() => handleDelete(surgery.surgery_id)} 
                                      className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors border border-gray-200 hover:border-red-300"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      <span className="text-xs font-medium">刪除</span>
                                    </button>
                                  </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3 py-20">
                            <Activity className="w-16 h-16 opacity-20" />
                            <p className="text-base font-medium">本日無相關排程</p>
                            <p className="text-sm text-gray-400">您在這天沒有安排任何手術</p>
                        </div>
                      )}
                  </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PersonalSchedule;