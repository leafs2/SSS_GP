import React, { useState, useEffect } from 'react';
import { 
  Calendar,
  ChevronLeft, 
  ChevronRight,
  Clock,
  User,
  AlertCircle,
  Loader2,
  Activity,
  ClipboardList,
  X,
  Zap,
  CheckCircle,
  FileText
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../../pages/login/AuthContext';
import surgeryRoomService from '../../services/surgeryRoomService';
import tshsoSchedulingService from '../../services/TS-HSO_schedulingService'; // 記得確認 Service 路徑

const SurgerySchedule = () => {
  const { user } = useAuth();
  const userDepartment = user?.department_name || '外科部門';
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  
  // 資料狀態
  const [categories, setCategories] = useState([]);
  const [roomsData, setRoomsData] = useState({});
  const [scheduleData, setScheduleData] = useState({}); // 用於顯示的過濾後資料
  const [allScheduleData, setAllScheduleData] = useState([]); // 儲存所有原始資料 (快取用)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 待排程清單狀態
  const [isPendingListOpen, setIsPendingListOpen] = useState(false);
  const [pendingSurgeries, setPendingSurgeries] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  // 排程執行狀態
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedulingResult, setSchedulingResult] = useState(null);

  // === 日期計算函數 ===
  const getWeekDates = (weekOffset = 0) => {
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const baseMonday = new Date(now);
    baseMonday.setDate(now.getDate() + diffToMonday + (weekOffset * 7));
    baseMonday.setHours(0, 0, 0, 0);
    
    const dates = [];
    for (let i = 0; i < 6; i++) { // 週一到週六
      const date = new Date(baseMonday);
      date.setDate(baseMonday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const formatDate = (date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  const formatWeekday = (date) => {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return weekdays[date.getDay()];
  };

  const formatWeekRange = (dates) => {
    if (dates.length === 0) return '';
    return `${formatDate(dates[0])} - ${formatDate(dates[5])}`;
  };

  // === 狀態判斷與樣式 (恢復原本設計) ===
  const determineStatus = (surgeryDate, startTime, endTime) => {
    const now = new Date();
    // 簡單將日期字串轉為 Date 物件進行比較
    // 實務上建議用 moment.js 或 dayjs 處理精確時間，這裡做簡單比對
    const sDateStr = typeof surgeryDate === 'string' ? surgeryDate.substring(0, 10) : '';
    const sDate = new Date(sDateStr);
    
    // 設定當天手術的開始與結束時間
    const [sHour, sMin] = startTime.split(':').map(Number);
    const [eHour, eMin] = endTime.split(':').map(Number);
    
    const startDateTime = new Date(sDate);
    startDateTime.setHours(sHour, sMin, 0);
    
    const endDateTime = new Date(sDate);
    endDateTime.setHours(eHour, eMin, 0);
    
    // 為了處理 "今日" 的狀態，我們需要把 now 的日期也正規化
    const todayStr = now.toISOString().split('T')[0];

    if (sDateStr < todayStr) {
      return 'completed'; // 過去日期為已完成
    } else if (sDateStr === todayStr) {
        // 如果是今天，判斷時間
        if (now >= startDateTime && now <= endDateTime) return 'ongoing';
        if (now > endDateTime) return 'completed';
        return 'confirmed';
    } else {
      // 未來日期
      // 假設 3 天內為已確認，之後為暫定 (可依需求調整邏輯)
      const diffDays = Math.ceil((sDate - now) / (1000 * 60 * 60 * 24));
      return diffDays <= 3 ? 'confirmed' : 'tentative';
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'ongoing':
        return 'bg-green-50 border-green-500 text-green-900';
      case 'confirmed':
        return 'bg-blue-50 border-blue-500 text-blue-900';
      case 'tentative':
        return 'bg-yellow-50 border-yellow-500 text-yellow-900';
      case 'completed':
        return 'bg-gray-100 border-gray-400 text-gray-500'; // 加上透明度或灰色讓它看起來像過去式
      default:
        return 'bg-gray-50 border-gray-300 text-gray-700';
    }
  };

  // === 1. 初始化資料載入 (僅執行一次) ===
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 平行載入：手術室分類 + 所有已排程資料
        const [roomsResponse, scheduleResponse] = await Promise.all([
          surgeryRoomService.getTypesWithCount(),
          tshsoSchedulingService.fetchAllScheduledSurgeries()
        ]);
        
        // 處理手術室資料
        if (roomsResponse && roomsResponse.length > 0) {
          const formattedCategories = roomsResponse.map(item => ({
            id: item.type,
            name: item.displayName,
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
        }

        // 處理排程資料
        if (scheduleResponse && scheduleResponse.schedules) {
          console.log("已載入排程總數:", scheduleResponse.schedules.length);
          setAllScheduleData(scheduleResponse.schedules);
        }

      } catch (err) {
        console.error('初始化資料失敗:', err);
        setError('載入資料失敗,請稍後再試');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // === 2. 視圖更新 (前端過濾，無 API 請求) ===
  useEffect(() => {
    if (categories.length === 0 || !roomsData[selectedCategory]) return;

    const updateViewData = () => {
      const dates = getWeekDates(currentWeek);
      const schedule = {};
      
      schedule[selectedCategory] = {};
      const categoryRooms = roomsData[selectedCategory] || [];
      
      categoryRooms.forEach(room => {
        schedule[selectedCategory][room.id] = {};
        
        dates.forEach(date => {
          // ✅ 使用本地時間 YYYY-MM-DD 鍵值，解決時區空白問題
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const dateKey = `${year}-${month}-${day}`;
          
          const daySurgeries = allScheduleData.filter(s => {
            // 處理資料庫回傳的日期格式
            let sDateStr = '';
            if (typeof s.surgery_date === 'string') {
                sDateStr = s.surgery_date.substring(0, 10);
            } else if (s.surgery_date) {
                const d = new Date(s.surgery_date);
                const dYear = d.getFullYear();
                const dMonth = String(d.getMonth() + 1).padStart(2, '0');
                const dDay = String(d.getDate()).padStart(2, '0');
                sDateStr = `${dYear}-${dMonth}-${dDay}`;
            }
            
            return s.room_id === room.id && sDateStr === dateKey;
          }).map(s => ({
            id: s.surgery_id,
            code: s.surgery_type_code,
            name: s.surgery_name || s.surgery_type_code, // 若無名稱顯示代碼
            doctor: s.doctor_name,
            patient: s.patient_name,
            startTime: s.start_time.substring(0, 5),
            endTime: s.end_time.substring(0, 5),
            duration: typeof s.duration === 'number' ? s.duration * 60 : parseFloat(s.duration) * 60,
            status: determineStatus(s.surgery_date, s.start_time, s.end_time)
          }));
          
          schedule[selectedCategory][room.id][dateKey] = daySurgeries;
        });
      });
      
      setScheduleData(prev => ({
        ...prev,
        ...schedule
      }));
    };

    updateViewData();
  }, [currentWeek, selectedCategory, roomsData, allScheduleData]);

  // === 統計數據計算 ===
  const calculateStats = () => {
    if (!selectedCategory || !scheduleData[selectedCategory]) {
      return { totalSurgeries: 0, confirmedSurgeries: 0, avgPerDay: 0, utilizationRate: 0 };
    }

    let totalSurgeries = 0;
    let confirmedSurgeries = 0;
    const roomSchedules = scheduleData[selectedCategory];

    Object.values(roomSchedules).forEach(roomData => {
      Object.values(roomData).forEach(daySurgeries => {
        totalSurgeries += daySurgeries.length;
        // 包含 confirmed 與 ongoing
        confirmedSurgeries += daySurgeries.filter(s => ['confirmed', 'ongoing'].includes(s.status)).length;
      });
    });

    const avgPerDay = (totalSurgeries / 6).toFixed(1);
    const totalSlots = (roomsData[selectedCategory]?.length || 0) * 6;
    const utilizationRate = totalSlots > 0 ? Math.round((totalSurgeries / totalSlots) * 100) : 0;

    return { totalSurgeries, confirmedSurgeries, avgPerDay, utilizationRate };
  };

  // === 載入待排程清單 (維持不變) ===
  const loadPendingSurgeries = async () => {
    try {
      setPendingLoading(true);
      const dates = getWeekDates(currentWeek);
      const startDate = dates[0].toISOString().split('T')[0];
      const endDate = dates[5].toISOString().split('T')[0];
      
      // 使用 Service
      const { surgeries, total } = await tshsoSchedulingService.fetchPendingSurgeries(
        startDate, 
        endDate
      );
      
      setPendingSurgeries(surgeries || []);
      setPendingCount(total || 0);
      
    } catch (err) {
      console.error('載入待排程清單失敗:', err);
    } finally {
      setPendingLoading(false);
    }
  };

  // === 觸發排程 (維持不變) ===
  const handleTriggerScheduling = async () => {
    if (pendingSurgeries.length === 0) {
      alert('沒有待排程的手術');
      return;
    }
    
    if (!confirm(`確定要排程 ${pendingSurgeries.length} 台手術嗎？`)) {
      return;
    }
    
    try {
      setIsScheduling(true);
      setSchedulingResult(null);
      
      const result = await tshsoSchedulingService.triggerScheduling();
      setSchedulingResult(result);
      
      alert(`排程完成！成功：${result.data?.length || 0} 台`);
      
      // 重新載入資料 (這裡需要重新 fetch all，因為資料庫變更了)
      const scheduleResponse = await tshsoSchedulingService.fetchAllScheduledSurgeries();
      if (scheduleResponse.schedules) {
          setAllScheduleData(scheduleResponse.schedules);
      }
      await loadPendingSurgeries();
      
    } catch (err) {
      console.error('排程執行失敗:', err);
      alert('排程失敗：' + err.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const togglePendingList = () => {
    if (!isPendingListOpen) {
      loadPendingSurgeries();
    }
    setIsPendingListOpen(!isPendingListOpen);
  };

  useEffect(() => {
    if (isPendingListOpen) {
      loadPendingSurgeries();
    }
  }, [currentWeek]);


  // === 渲染 ===
  const stats = calculateStats();
  const currentCategory = categories.find(c => c.id === selectedCategory);
  const currentRooms = roomsData[selectedCategory] || [];
  const weekDates = getWeekDates(currentWeek);

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        <PageHeader title="預期手術行程" subtitle={userDepartment} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {/* 類別切換區域 */}
          <div className="bg-white rounded-lg shadow-md mb-4 p-4">
             <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 w-28">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">總手術</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">{stats.totalSurgeries}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 w-28">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700">已確認</span>
                  </div>
                  <div className="text-2xl font-bold text-green-700">{stats.confirmedSurgeries}</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 w-28">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700">使用率</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-700">{stats.utilizationRate}%</div>
                </div>
              </div>
            </div>
             {currentCategory && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{currentCategory.subtitle}</span>
              </div>
            )}
          </div>

          {/* 週次與功能列 */}
          <div className="bg-white rounded-lg shadow-md mb-4 p-4">
            <div className="flex items-center justify-between gap-4">
              <button
                  onClick={togglePendingList}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-md relative"
                >
                  <ClipboardList className="w-5 h-5" />
                  <span className="font-medium">待排程清單</span>
                  {pendingCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
              </button>

              <div className="flex items-center gap-4 flex-1 justify-center">
                <button
                  onClick={() => setCurrentWeek(prev => prev - 1)}
                  className="p-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center min-w-[200px]">
                  <div className="text-sm font-medium text-gray-600 mb-0.5">
                    {currentWeek === 0 ? '本週' : currentWeek > 0 ? `未來第 ${currentWeek} 週` : `過去第 ${Math.abs(currentWeek)} 週`}
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {formatWeekRange(weekDates)}
                  </div>
                </div>
                <button
                  onClick={() => setCurrentWeek(prev => prev + 1)}
                  className="p-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="w-[140px]"></div>
            </div>
          </div>

          {/* 排程表格 */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 border-r border-gray-200" style={{width: '100px'}}>
                      手術室
                    </th>
                    {weekDates.map((date, index) => {
                       const isToday = date.toDateString() === new Date().toDateString();
                       return (
                        <th key={index} className={`px-2 py-3 text-center font-semibold border-r border-gray-200 ${isToday ? 'bg-blue-50' : ''}`} style={{width: '16%'}}>
                            <div className="text-gray-800">{formatWeekday(date)}</div>
                            <div className="text-sm font-normal text-gray-500">{formatDate(date)}</div>
                        </th>
                       )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {currentRooms.map((room, roomIndex) => (
                    <tr key={room.id} className={roomIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-4 font-bold text-gray-900 border-r border-gray-200 text-center">
                        {room.id}
                      </td>
                      {weekDates.map((date, dateIndex) => {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const dateKey = `${year}-${month}-${day}`;
                        
                        const daySurgeries = scheduleData[selectedCategory]?.[room.id]?.[dateKey] || [];
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                          <td key={dateIndex} className={`px-2 py-2 border-r border-gray-200 align-top ${isToday ? 'bg-blue-50' : ''}`}>
                            <div className="space-y-1 min-h-[60px]">
                              {daySurgeries.length === 0 ? (
                                <div className="text-center text-gray-300 text-sm py-4">-</div>
                              ) : (
                                daySurgeries.map((surgery) => (
                                  <div
                                    key={surgery.id}
                                    className={`
                                      p-2 rounded border-l-4 text-xs mb-1 shadow-sm
                                      ${getStatusStyle(surgery.status)}
                                    `}
                                  >
                                    <div className="flex justify-between items-center mb-1 text-left">
                                       <span className="font-bold whitespace-nowrap">
                                         {surgery.startTime}-{surgery.endTime}
                                       </span>
                                    </div>
                                    <div className="truncate text-left items-baseline" title={`${surgery.doctor} 醫師 - ${surgery.name}`}>
                                      {/* 醫師姓名 (粗體+大字) */}
                                      <span className="font-bold text-sm text-gray-900">
                                        {surgery.doctor}
                                      </span>
                                      
                                      {/* 分隔符號 */}
                                      <span className="text-gray-400 mr-1">-</span>
                                      
                                      {/* 手術名稱 */}
                                      <span className="text-gray-700 font-medium">
                                        {surgery.name}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="border-t border-gray-200 px-6 py-4 bg-white">
              <div className="flex items-center gap-6 text-sm">
                <span className="font-medium text-gray-700">狀態圖例：</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-50 border border-green-500 rounded"></div>
                  <span className="text-gray-600">進行中</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 bg-blue-50 border border-blue-500 rounded"></div>
                  <span className="text-gray-600">已確認</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 bg-yellow-50 border border-yellow-500 rounded"></div>
                  <span className="text-gray-600">暫定</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 bg-gray-100 border border-gray-400 rounded"></div>
                  <span className="text-gray-600">已完成</span>
                </div>
              </div>
            </div>
          </div>

          {/* 待排程清單 Modal (維持不變) */}
          {isPendingListOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center"
              onClick={togglePendingList}
            >
              <div 
                className="bg-white rounded-xl shadow-2xl w-[90%] max-w-6xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-6 h-6" />
                    <div>
                      <h2 className="text-xl font-bold text-left">待排程清單</h2>
                      <p className="text-sm text-orange-100">
                        {formatWeekRange(weekDates)} ({pendingCount} 台手術)
                      </p>
                    </div>
                  </div>
                  <button onClick={togglePendingList} className="p-2 hover:bg-orange-600 rounded-lg">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                {/* 操作區 */}
                 {pendingSurgeries.length > 0 && (
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                       共有 <span className="font-bold text-orange-600">{pendingSurgeries.length}</span> 台待排程
                    </div>
                    <button
                        onClick={handleTriggerScheduling}
                        disabled={isScheduling}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium shadow
                          ${isScheduling ? 'bg-gray-300' : 'bg-green-600 text-white hover:bg-green-700'}
                        `}
                      >
                        {isScheduling ? <Loader2 className="animate-spin" /> : <Zap className="w-4 h-4" />}
                        立即執行排程
                    </button>
                  </div>
                 )}

                {/* 表格內容 (簡化顯示) */}
                <div className="flex-1 overflow-auto p-6">
                   {pendingLoading ? (
                      <div className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></div>
                   ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="bg-gray-50 border-b"><th className="p-3">編號</th><th className="p-3">名稱</th><th className="p-3">醫師</th></tr>
                        </thead>
                        <tbody>
                           {pendingSurgeries.map(s => (
                             <tr key={s.surgery_id} className="border-b hover:bg-gray-50">
                               <td className="p-3 font-mono">{s.surgery_id}</td>
                               <td className="p-3">{s.surgery_name}</td>
                               <td className="p-3">{s.doctor_name}</td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                   )}
                </div>
              </div>
            </div>
          )}
          
        </main>
      </div>
    </Layout>
  );
};

export default SurgerySchedule;