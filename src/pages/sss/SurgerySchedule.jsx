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
  CheckCircle,
  FileText
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../../pages/login/AuthContext';
import surgeryRoomService from '../../services/surgeryRoomService';
import tshsoSchedulingService from '../../services/TS-HSO_schedulingService';

const SurgerySchedule = () => {
  const { user } = useAuth();
  const userDepartment = user?.department_name || '外科部門';
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  
  // 資料狀態
  const [categories, setCategories] = useState([]);
  const [roomsData, setRoomsData] = useState({});
  const [scheduleData, setScheduleData] = useState({});
  const [allScheduleData, setAllScheduleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 狀態監控 (來自後端演算法執行時間)
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // 待排程清單狀態
  const [isPendingListOpen, setIsPendingListOpen] = useState(false);
  const [pendingSurgeries, setPendingSurgeries] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

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

  // 輔助函數：將 Date 物件轉為 YYYY-MM-DD (本地時間)
  const toLocalISODate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  // === 狀態判斷與樣式 ===
  const determineStatus = (surgeryDate, startTime, endTime) => {
    const now = new Date();
    const sDateStr = typeof surgeryDate === 'string' ? surgeryDate.substring(0, 10) : '';
    if (!sDateStr) return 'tentative';

    const todayStr = toLocalISODate(now);

    if (sDateStr < todayStr) {
      return 'completed';
    } else if (sDateStr === todayStr) {
        const [sHour, sMin] = startTime.split(':').map(Number);
        const [eHour, eMin] = endTime.split(':').map(Number);
        const startDateTime = new Date(); startDateTime.setHours(sHour, sMin, 0);
        const endDateTime = new Date(); endDateTime.setHours(eHour, eMin, 0);

        if (now >= startDateTime && now <= endDateTime) return 'ongoing';
        if (now > endDateTime) return 'completed';
        return 'confirmed';
    } else {
      const sDate = new Date(sDateStr);
      const diffDays = Math.ceil((sDate - now) / (1000 * 60 * 60 * 24));
      return diffDays <= 3 ? 'confirmed' : 'tentative';
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'ongoing': return 'bg-green-50 border-green-500 text-green-900';
      case 'confirmed': return 'bg-blue-50 border-blue-500 text-blue-900';
      case 'tentative': return 'bg-yellow-50 border-yellow-500 text-yellow-900';
      case 'completed': return 'bg-gray-100 border-gray-400 text-gray-500';
      default: return 'bg-gray-50 border-gray-300 text-gray-700';
    }
  };

  // === 1. 初始化資料載入 ===
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [roomsResponse, scheduleResponse] = await Promise.all([
          surgeryRoomService.getTypesWithCount(),
          tshsoSchedulingService.fetchAllScheduledSurgeries()
        ]);
        
        if (roomsResponse && roomsResponse.length > 0) {
          const formattedCategories = roomsResponse.map(item => ({
            id: item.type,
            name: item.displayName,
            total: item.roomCount,
            rooms: item.roomIds || [],
            subtitle: item.typeInfo || ''
          }));
          setCategories(formattedCategories);
          if (formattedCategories.length > 0) setSelectedCategory(formattedCategories[0].id);

          const roomsDataTemp = {};
          for (const category of formattedCategories) {
            roomsDataTemp[category.id] = await surgeryRoomService.getRoomsByType(category.id);
          }
          setRoomsData(roomsDataTemp);
        }

        if (scheduleResponse && scheduleResponse.schedules) {
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

  // === 2. 待排程數量與狀態同步 (根據週次更新) ===
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // 計算當週的日期範圍
        const dates = getWeekDates(currentWeek);
        const startDate = toLocalISODate(dates[0]); // 週一
        const endDate = toLocalISODate(dates[5]);   // 週六

        // 傳入日期範圍取得當週數量
        const data = await tshsoSchedulingService.fetchPendingCount(startDate, endDate);
        
        setPendingCount(data.count || 0);
        
        // 更新演算法最後執行時間 (若後端有值)
        if (data.last_updated) {
          setLastUpdated(new Date(data.last_updated));
        }
      } catch (err) {
        console.error("無法取得待排程狀態", err);
      }
    };

    fetchStatus();
  }, [currentWeek, allScheduleData]); // 週次改變或資料更新時觸發

  // === 3. 視圖更新 ===
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
          const dateKey = toLocalISODate(date);
          
          const daySurgeries = allScheduleData.filter(s => {
            let sDateStr = '';
            if (typeof s.surgery_date === 'string') {
                sDateStr = s.surgery_date.substring(0, 10);
            } else if (s.surgery_date) {
                const d = new Date(s.surgery_date);
                sDateStr = toLocalISODate(d);
            }
            return s.room_id === room.id && sDateStr === dateKey;
          }).map(s => ({
            id: s.surgery_id,
            code: s.surgery_type_code,
            name: s.surgery_name || s.surgery_type_code,
            doctor: s.doctor_name,
            startTime: s.start_time.substring(0, 5),
            endTime: s.end_time.substring(0, 5),
            status: determineStatus(s.surgery_date, s.start_time, s.end_time)
          }));
          
          schedule[selectedCategory][room.id][dateKey] = daySurgeries;
        });
      });
      
      setScheduleData(prev => ({ ...prev, ...schedule }));
    };

    updateViewData();
  }, [currentWeek, selectedCategory, roomsData, allScheduleData]);

  // === 統計 ===
  const calculateStats = () => {
    if (!selectedCategory || !scheduleData[selectedCategory]) {
      return { totalSurgeries: 0, confirmedSurgeries: 0, utilizationRate: 0 };
    }
    let totalSurgeries = 0;
    let confirmedSurgeries = 0;
    const roomSchedules = scheduleData[selectedCategory];
    Object.values(roomSchedules).forEach(roomData => {
      Object.values(roomData).forEach(daySurgeries => {
        totalSurgeries += daySurgeries.length;
        confirmedSurgeries += daySurgeries.filter(s => ['confirmed', 'ongoing'].includes(s.status)).length;
      });
    });
    const totalSlots = (roomsData[selectedCategory]?.length || 0) * 6;
    const utilizationRate = totalSlots > 0 ? Math.round((totalSurgeries / totalSlots) * 100) : 0;
    return { totalSurgeries, confirmedSurgeries, utilizationRate };
  };

  // === 載入待排程清單 ===
  const loadPendingSurgeries = async () => {
    try {
      setPendingLoading(true);
      const dates = getWeekDates(currentWeek);
      const startDate = toLocalISODate(dates[0]);
      const endDate = toLocalISODate(dates[5]);
      
      const { surgeries } = await tshsoSchedulingService.fetchPendingSurgeries(startDate, endDate);
      setPendingSurgeries(surgeries || []);
    } catch (err) {
      console.error('載入待排程清單失敗:', err);
    } finally {
      setPendingLoading(false);
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
                      <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCategory === category.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
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
          </div>

          {/* 週次與功能列 */}
          <div className="bg-white rounded-lg shadow-md mb-4 p-4">
            <div className="flex items-center justify-between gap-4">
              
              {/* 左側：待排程清單按鈕 (靜態數字，不閃爍) */}
              <button
                  onClick={togglePendingList}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-md relative"
                >
                  <ClipboardList className="w-5 h-5" />
                  <span className="font-medium">待排程清單</span>
                  {pendingCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
                      {pendingCount}
                    </span>
                  )}
              </button>

              {/* 中間：週次切換 */}
              <div className="flex items-center gap-4 flex-1 justify-center">
                <button onClick={() => setCurrentWeek(prev => prev - 1)} className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50">
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
                <button onClick={() => setCurrentWeek(prev => prev + 1)} className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* 右側：狀態顯示 (顯示演算法最後執行時間) */}
              <div className="w-[200px] flex flex-col items-end justify-center">
                 <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200 mb-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">智慧排程運作中</span>
                 </div>
                 {lastUpdated ? (
                    <div className="text-[10px] text-gray-400 mr-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        最後排程: {lastUpdated.toLocaleString([], {
                           year: 'numeric', month: '2-digit', day: '2-digit',
                           hour: '2-digit', minute:'2-digit'
                        })}
                    </div>
                 ) : (
                    <div className="text-[10px] text-gray-300 mr-1">尚未執行排程</div>
                 )}
              </div>

            </div>
          </div>

          {/* 排程表格 */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 border-r border-gray-200" style={{width: '100px'}}>手術室</th>
                    {weekDates.map((date, index) => {
                       const isToday = toLocalISODate(date) === toLocalISODate(new Date());
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
                      <td className="px-4 py-4 font-bold text-gray-900 border-r border-gray-200 text-center">{room.id}</td>
                      {weekDates.map((date, dateIndex) => {
                        const dateKey = toLocalISODate(date);
                        const daySurgeries = scheduleData[selectedCategory]?.[room.id]?.[dateKey] || [];
                        const isToday = dateKey === toLocalISODate(new Date());

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
                                      <span className="font-bold text-sm text-gray-900">{surgery.doctor}</span>
                                      <span className="text-gray-400 mr-1">-</span>
                                      <span className="text-gray-700 font-medium">{surgery.name}</span>
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
            
            {/* 圖例 */}
            <div className="border-t border-gray-200 px-6 py-4 bg-white">
              <div className="flex items-center gap-6 text-sm">
                <span className="font-medium text-gray-700">狀態圖例：</span>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-50 border border-green-500 rounded"></div><span className="text-gray-600">進行中</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-50 border border-blue-500 rounded"></div><span className="text-gray-600">已確認</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-50 border border-yellow-500 rounded"></div><span className="text-gray-600">暫定</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-100 border border-gray-400 rounded"></div><span className="text-gray-600">已完成</span></div>
              </div>
            </div>
          </div>

          {/* 待排程清單 Modal */}
          {isPendingListOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center" onClick={togglePendingList}>
              <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-6xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-6 h-6" />
                    <div>
                      <h2 className="text-xl font-bold text-left">待排程清單</h2>
                      <p className="text-sm text-orange-100">{formatWeekRange(weekDates)} ({pendingCount} 台手術)</p>
                    </div>
                  </div>
                  <button onClick={togglePendingList} className="p-2 hover:bg-orange-600 rounded-lg"><X className="w-6 h-6" /></button>
                </div>
                {pendingSurgeries.length > 0 ? (
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-600 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-orange-500" />
                    系統將在新增手術後自動進行排程優化
                  </div>
                 ) : null}
                <div className="flex-1 overflow-auto p-6">
                   {pendingLoading ? (
                      <div className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></div>
                   ) : pendingSurgeries.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">目前沒有待排程的手術</div>
                   ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="bg-gray-50 border-b">
                             <th className="p-3 font-semibold text-gray-700">編號</th>
                             <th className="p-3 font-semibold text-gray-700">名稱</th>
                             <th className="p-3 font-semibold text-gray-700">醫師</th>
                             <th className="p-3 font-semibold text-gray-700 text-center">狀態</th>
                           </tr>
                        </thead>
                        <tbody>
                           {pendingSurgeries.map(s => (
                             <tr key={s.surgery_id} className="border-b hover:bg-gray-50">
                               <td className="p-3 font-mono text-gray-600">{s.surgery_id}</td>
                               <td className="p-3">{s.surgery_name}</td>
                               <td className="p-3">{s.doctor_name}</td>
                               <td className="p-3 text-center"><span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">等待中</span></td>
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