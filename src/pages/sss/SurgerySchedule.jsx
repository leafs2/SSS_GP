import React, { useState, useEffect } from 'react';
import { 
  Calendar,
  ChevronLeft, 
  ChevronRight,
  Clock,
  User,
  FileText,
  AlertCircle,
  Loader2,
  Activity,
  ClipboardList,
  X
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../../pages/login/AuthContext';
import surgeryRoomService from '../../services/surgeryRoomService';
import surgeryService from '../../services/surgeryService';

const SurgerySchedule = () => {
  const { user } = useAuth();
  const userDepartment = user?.department_name || '外科部門';
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(0); // 0 = 本週
  
  // 資料狀態
  const [categories, setCategories] = useState([]);
  const [roomsData, setRoomsData] = useState({});
  const [scheduleData, setScheduleData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 待排程清單狀態
  const [isPendingListOpen, setIsPendingListOpen] = useState(false);
  const [pendingSurgeries, setPendingSurgeries] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // 獲取指定週的日期範圍 (週一到週六)
  const getWeekDates = (weekOffset = 0) => {
    // 動態獲取當前日期
    const now = new Date();
    const currentDay = now.getDay(); // 0=週日, 1=週一, ..., 6=週六
    
    // 計算到本週一的天數差
    // 如果今天是週日(0),則往前推6天到週一
    // 如果今天是週一(1),則差距是0
    // 如果今天是週二(2),則往前推1天到週一
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    
    // 獲取本週一的日期
    const baseMonday = new Date(now);
    baseMonday.setDate(now.getDate() + diffToMonday + (weekOffset * 7));
    baseMonday.setHours(0, 0, 0, 0);
    
    const dates = [];
    for (let i = 0; i < 6; i++) { // 只取週一到週六,共6天
      const date = new Date(baseMonday);
      date.setDate(baseMonday.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  // 格式化日期顯示
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
    return `${formatDate(dates[0])} - ${formatDate(dates[5])}`; // 週一到週六
  };

  // 載入手術室類型和資料
    useEffect(() => {
    const loadSurgeryRoomData = async () => {
        try {
        setLoading(true);
        setError(null);

        // 使用 service 取代直接 fetch
        const data = await surgeryRoomService.getTypesWithCount();
        
        if (data && data.length > 0) {
            // 後端已經格式化好資料,直接使用
            const formattedCategories = data.map(item => ({
            id: item.type,                    // 後端的 type
            name: item.displayName,            // 後端的 displayName (中文名稱)
            total: item.roomCount,             // 後端的 roomCount
            rooms: item.roomIds || [],         // 後端的 roomIds
            subtitle: item.typeInfo || ''      // 後端的 typeInfo
            }));

            setCategories(formattedCategories);

            if (formattedCategories.length > 0) {
            setSelectedCategory(formattedCategories[0].id);
            }

            // 載入各類型的手術室詳細資料
            const roomsDataTemp = {};
            for (const category of formattedCategories) {
            const rooms = await surgeryRoomService.getRoomsByType(category.id);
            roomsDataTemp[category.id] = rooms;
            }
            
            setRoomsData(roomsDataTemp);

            // 生成模擬排程資料
            const currentWeekDates = getWeekDates(currentWeek);
            generateScheduleData(formattedCategories, roomsDataTemp, currentWeekDates);
        }
        } catch (err) {
        console.error('載入手術室資料失敗:', err);
        setError(err.error || err.message || '載入資料失敗,請稍後再試');
        } finally {
        setLoading(false);
        }
    };

    loadSurgeryRoomData();
    }, []);

  // 生成模擬排程資料
  const generateScheduleData = (cats, rooms, dates) => {
    const schedule = {};
    // 動態獲取當前日期作為基準
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const surgeryTypes = [
      { code: 'CVS-001', name: '冠狀動脈繞道', doctor: '陳醫師', duration: 240, dept: 'surgery' },
      { code: 'CVS-002', name: '心臟瓣膜置換', doctor: '林醫師', duration: 300, dept: 'surgery' },
      { code: 'GEN-001', name: '腹腔鏡膽囊切除', doctor: '王醫師', duration: 120, dept: 'surgery' },
      { code: 'ORT-001', name: '全膝關節置換', doctor: '張醫師', duration: 150, dept: 'surgery' },
      { code: 'NEU-001', name: '腦瘤切除', doctor: '李醫師', duration: 360, dept: 'surgery' },
      { code: 'OBG-001', name: '剖腹產', doctor: '黃醫師', duration: 90, dept: 'specialty' },
      { code: 'OBG-002', name: '子宮肌瘤切除', doctor: '周醫師', duration: 150, dept: 'specialty' },
      { code: 'URO-001', name: '前列腺切除', doctor: '吳醫師', duration: 180, dept: 'specialty' },
      { code: 'OPH-001', name: '白內障手術', doctor: '鄭醫師', duration: 45, dept: 'specialty' },
      { code: 'ENT-001', name: '鼻竇內視鏡', doctor: '趙醫師', duration: 90, dept: 'specialty' },
      { code: 'EMG-001', name: '急診剖腹探查', doctor: '錢醫師', duration: 120, dept: 'emergency' },
      { code: 'ROB-001', name: '達文西前列腺', doctor: '孫醫師', duration: 240, dept: 'davinci' },
      { code: 'ROB-002', name: '達文西胃切除', doctor: '馬醫師', duration: 300, dept: 'davinci' },
    ];

    cats.forEach(category => {
      schedule[category.id] = {};
      
      const categoryRooms = rooms[category.id] || [];
      
      const relevantSurgeries = surgeryTypes.filter(s => {
        if (category.id === 'surgery') return s.dept === 'surgery';
        if (category.id === 'specialty') return s.dept === 'specialty';
        if (category.id === 'emergency') return s.dept === 'emergency';
        if (category.id === 'davinci') return s.dept === 'davinci';
        return false;
      });

      const surgeriesToUse = relevantSurgeries.length > 0 ? relevantSurgeries : [
        { code: 'GEN-999', name: '一般手術', doctor: '醫師', duration: 120, dept: category.id }
      ];

      categoryRooms.forEach(room => {
        schedule[category.id][room.id] = {};
        
        dates.forEach((date) => {
          const dateKey = date.toISOString().split('T')[0];
          
          // 計算距離今天的天數
          const diffTime = date - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // 70% 機率有手術
          if (Math.random() > 0.3) {
            const numSurgeries = Math.floor(Math.random() * 3) + 1;
            const daySurgeries = [];
            
            let currentTime = 8;
            
            for (let i = 0; i < numSurgeries && currentTime < 18; i++) {
              const surgery = surgeriesToUse[Math.floor(Math.random() * surgeriesToUse.length)];
              
              if (!surgery || !surgery.duration) {
                continue;
              }
              
              const startHour = currentTime;
              const startMinute = Math.random() > 0.5 ? 0 : 30;
              const durationHours = surgery.duration / 60;
              const endHour = Math.floor(startHour + durationHours);
              const endMinute = Math.round((startHour + durationHours - endHour) * 60);
              
              // 根據距離今天的天數決定狀態: 3天內為已確認,其他為暫定
              const status = diffDays <= 3 ? 'confirmed' : 'tentative';
              
              daySurgeries.push({
                id: `${room.id}-${dateKey}-${i}`,
                code: surgery.code || 'UNKNOWN',
                name: surgery.name || '未知手術',
                doctor: surgery.doctor || '醫師',
                startTime: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
                endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
                duration: surgery.duration,
                status: status
              });
              
              currentTime = endHour + (endMinute > 30 ? 1 : 0) + 0.5;
            }
            
            schedule[category.id][room.id][dateKey] = daySurgeries;
          } else {
            schedule[category.id][room.id][dateKey] = [];
          }
        });
      });
    });
    
    setScheduleData(schedule);
  };

  // 計算統計數據
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
        confirmedSurgeries += daySurgeries.filter(s => s.status === 'confirmed').length;
      });
    });

    const avgPerDay = (totalSurgeries / 6).toFixed(1); // 改為6天
    const totalSlots = (roomsData[selectedCategory]?.length || 0) * 6; // 改為6天
    const utilizationRate = totalSlots > 0 ? Math.round((totalSurgeries / totalSlots) * 100) : 0;

    return { totalSurgeries, confirmedSurgeries, avgPerDay, utilizationRate };
  };

  // 切換類別
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  // 切換週次
  const handleWeekChange = (offset) => {
    setCurrentWeek(prev => prev + offset);
  };

  // 載入待排程清單
  const loadPendingSurgeries = async () => {
    try {
      setPendingLoading(true);
      
      // 獲取當前週的日期範圍
      const dates = getWeekDates(currentWeek);
      const startDate = dates[0].toISOString().split('T')[0];
      const endDate = dates[5].toISOString().split('T')[0];
      
      const response = await surgeryService.getPendingSurgeries(startDate, endDate);
      
      if (response.success) {
        setPendingSurgeries(response.data || []);
        setPendingCount(response.total || 0);
      }
    } catch (err) {
      console.error('載入待排程清單失敗:', err);
    } finally {
      setPendingLoading(false);
    }
  };

  // 打開/關閉待排程清單
  const togglePendingList = () => {
    if (!isPendingListOpen) {
      loadPendingSurgeries();
    }
    setIsPendingListOpen(!isPendingListOpen);
  };

  // 當週次改變時,如果側邊欄是開啟的,重新載入資料
  useEffect(() => {
    if (isPendingListOpen) {
      loadPendingSurgeries();
    }
  }, [currentWeek]);

  const stats = calculateStats();
  const currentCategory = categories.find(c => c.id === selectedCategory);
  const currentRooms = roomsData[selectedCategory] || [];
  const weekDates = getWeekDates(currentWeek);

  // 載入中狀態
  if (loading) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader 
            title="預期手術行程" 
            subtitle={userDepartment}
          />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">載入排程資料中...</p>
              </div>
            </div>
          </main>
        </div>
      </Layout>
    );
  }

  // 錯誤狀態
  if (error) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader 
            title="預期手術行程" 
            subtitle={userDepartment}
          />
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

  // 沒有資料狀態
  if (categories.length === 0) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader 
            title="預期手術行程" 
            subtitle={userDepartment}
          />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">目前沒有可用的手術室資料</p>
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
        {/* 頂部標題欄 */}
        <PageHeader 
          title="預期手術行程" 
          subtitle={userDepartment}
        />

        {/* 主要內容區域 */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 w-32">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">總排程</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">{stats.totalSurgeries}</div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 w-32">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700">已確認</span>
                  </div>
                  <div className="text-2xl font-bold text-green-700">{stats.confirmedSurgeries}</div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 w-32">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700">日均量</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-700">{stats.avgPerDay}</div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 w-32">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">使用率</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-700">{stats.utilizationRate}%</div>
                </div>
              </div>
            </div>

            {/* 類別說明 */}
            {currentCategory && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{currentCategory.subtitle}</span>
              </div>
            )}
          </div>

          {/* 週次選擇器 */}
          <div className="bg-white rounded-lg shadow-md mb-4 p-4">
            <div className="flex items-center justify-between gap-4">
              {/* 待排程清單按鈕 */}
              <button
                onClick={togglePendingList}
                className="flex items-center gap-2 px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-md relative"
              >
                <ClipboardList className="w-5 h-5" />
                <span className="font-medium">待排程清單</span>
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>

              {/* 週次切換 */}
              <div className="flex items-center gap-4 flex-1 justify-center">
                <button
                  onClick={() => handleWeekChange(-1)}
                  className="p-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="text-center min-w-[200px]">
                  <div className="text-sm font-medium text-gray-600 mb-0.5">
                    {currentWeek === 0 ? '本週' : currentWeek === 1 ? '下週' : currentWeek === -1 ? '上週' : `第 ${currentWeek + 1} 週`}
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {formatWeekRange(weekDates)}
                  </div>
                </div>
                
                <button
                  onClick={() => handleWeekChange(1)}
                  className="p-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* 佔位元素保持對稱 */}
              <div className="w-[140px]"></div>
            </div>
          </div>

          {/* 排程表格容器 */}
          <div className="bg-white rounded-lg shadow-md">
            {/* 排程表格 */}
            <div className="p-6">
              <div>
                <table className="w-full border-collapse table-fixed">
                  {/* 表頭 - 日期列 */}
                  <thead>
                    <tr>
                      <th className="bg-gray-50 border-2 border-gray-300 px-4 py-3 text-center font-semibold text-gray-700" style={{width: '120px'}}>
                        手術室
                      </th>
                      {weekDates.map((date, index) => {
                        const isToday = date.toDateString() === new Date().toDateString();
                        
                        return (
                          <th 
                            key={index}
                            className={`border-2 border-gray-300 px-2 py-3 text-center
                              ${isToday ? 'bg-blue-100' : 'bg-gray-50'}
                            `}
                          >
                            <div className="font-bold text-gray-800 mb-1 text-sm">
                              {formatDate(date)}
                            </div>
                            <div className={`text-xs font-medium ${
                              isToday ? 'text-blue-600' : 'text-gray-600'
                            }`}>
                              週{formatWeekday(date)}
                            </div>
                            {isToday && (
                              <div className="mt-1 text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 inline-block">
                                今天
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* 表格內容 */}
                  <tbody>
                    {currentRooms.map((room, roomIndex) => {
                      const roomSchedule = scheduleData[selectedCategory]?.[room.id] || {};
                      
                      return (
                        <tr 
                          key={room.id}
                          className={roomIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          {/* 手術室名稱列 */}
                          <td className="border-2 border-gray-300 px-4 py-4 bg-gray-50 text-center">
                            <div className="font-bold text-lg text-gray-800">
                              {room.id}
                            </div>
                          </td>

                          {/* 每日排程格 */}
                          {weekDates.map((date, dayIndex) => {
                            const dateKey = date.toISOString().split('T')[0];
                            const daySurgeries = roomSchedule[dateKey] || [];
                            const isToday = date.toDateString() === new Date().toDateString();

                            return (
                              <td 
                                key={dayIndex}
                                className={`border-2 border-gray-300 px-2 py-2 align-top
                                  ${isToday ? 'bg-blue-50' : 'bg-white'}
                                `}
                              >
                                <div className="space-y-2 min-h-[100px]">
                                  {daySurgeries.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-gray-400 text-sm py-8">
                                      無排程
                                    </div>
                                  ) : (
                                    daySurgeries.map((surgery) => (
                                      <div
                                        key={surgery.id}
                                        className={`
                                          rounded-lg p-1.5 border-l-4 text-xs
                                          ${surgery.status === 'confirmed' 
                                            ? 'bg-green-50 border-green-500' 
                                            : 'bg-amber-50 border-amber-400'
                                          }
                                        `}
                                      >
                                        {/* 時間 */}
                                        <div className="flex items-center gap-1 mb-1">
                                          <Clock className="w-3 h-3 text-gray-600 flex-shrink-0" />
                                          <span className="font-bold text-gray-800 text-xs">
                                            {surgery.startTime}-{surgery.endTime}
                                          </span>
                                        </div>

                                        {/* 醫師 */}
                                        <div className="flex items-center gap-1 mb-1">
                                          <User className="w-3 h-3 text-gray-600 flex-shrink-0" />
                                          <span className="font-semibold text-gray-700 text-xs truncate">
                                            {surgery.doctor}
                                          </span>
                                        </div>

                                        {/* 手術代號 */}
                                        <div className="flex items-center gap-1">
                                          <FileText className="w-3 h-3 text-gray-600 flex-shrink-0" />
                                          <span className="font-mono font-semibold text-gray-600 text-xs">
                                            {surgery.code}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 底部圖例 */}
              <div className="border-t border-gray-200 px-6 py-3 mt-6">
                <div className="flex items-center gap-6 text-sm">
                  <span className="font-medium text-gray-700">狀態圖例：</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-50 border-l-4 border-green-500 rounded"></div>
                    <span className="text-gray-600">已確認排程 (3天內)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-50 border-l-4 border-amber-400 rounded"></div>
                    <span className="text-gray-600">暫定排程 (3天後)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 rounded border border-blue-300"></div>
                    <span className="text-gray-600">今日</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* 待排程清單對話框 */}
        {isPendingListOpen && (
          <>
            {/* 遮罩層 */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center"
              onClick={togglePendingList}
            >
              {/* 對話框 */}
              <div 
                className="bg-white rounded-xl shadow-2xl w-[90%] max-w-6xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 標題列 */}
                <div className="bg-orange-400 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-6 h-6" />
                    <div>
                      <h2 className="text-xl font-bold text-left">待排程清單</h2>
                      <p className="text-sm text-orange-100">
                        {formatWeekRange(weekDates)} ({pendingCount} 台手術)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={togglePendingList}
                    className="p-2 hover:bg-orange-700 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* 內容區 */}
                <div className="flex-1 overflow-auto p-6">
                  {pendingLoading ? (
                    <div className="flex items-center justify-center h-full min-h-[300px]">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 text-orange-600 animate-spin mx-auto mb-2" />
                        <p className="text-gray-600">載入中...</p>
                      </div>
                    </div>
                  ) : pendingSurgeries.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[300px]">
                      <div className="text-center">
                        <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg font-medium">本週沒有待排程手術</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b-2 border-gray-200">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">手術編號</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">手術日期</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">手術名稱</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">病患</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">主刀醫師</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">助理醫師</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">手術室類型</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">時長</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">護理師</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingSurgeries.map((surgery, index) => (
                            <tr 
                              key={surgery.id}
                              className={`border-b border-gray-200 hover:bg-orange-50 transition-colors ${
                                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                              }`}
                            >
                              {/* 手術編號 */}
                              <td className="px-4 py-3">
                                <span className="font-mono text-sm font-semibold text-gray-800">
                                  {surgery.surgery_id}
                                </span>
                              </td>

                              {/* 手術日期 */}
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-orange-600">
                                  {new Date(surgery.surgery_date).toLocaleDateString('zh-TW', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    weekday: 'short'
                                  })}
                                </span>
                              </td>

                              {/* 手術名稱 */}
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-800 max-w-[200px] truncate text-left" title={surgery.surgery_name}>
                                  {surgery.surgery_name || surgery.surgery_type_code}
                                </div>
                                {surgery.department_name && (
                                  <div className="text-xs text-gray-500 mt-0.5 text-left">
                                    {surgery.department_name}
                                  </div>
                                )}
                              </td>

                              {/* 病患 */}
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-700 text-left">
                                  {surgery.patient_name}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5 text-left">
                                  {surgery.patient_id_number}
                                </div>
                              </td>

                              {/* 主刀醫師 */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                  <span className="text-sm text-gray-700">
                                    {surgery.doctor_name}
                                  </span>
                                </div>
                              </td>

                              {/* 助理醫師 */}
                              <td className="px-4 py-3">
                                {surgery.assistant_doctor_name ? (
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-green-500 flex-shrink-0" />
                                    <span className="text-sm text-gray-700">
                                      {surgery.assistant_doctor_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-400">-</span>
                                )}
                              </td>

                              {/* 手術室類型 */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <FileText className="w-3 h-3 text-purple-500 flex-shrink-0" />
                                  <span className="text-sm text-gray-700">
                                    {surgery.room_type_info}
                                  </span>
                                </div>
                              </td>

                              {/* 時長 */}
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  <span className="text-sm font-semibold text-gray-700">
                                    {surgery.duration}h
                                  </span>
                                </div>
                              </td>

                              {/* 護理師數量 */}
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">
                                  <Activity className="w-3 h-3" />
                                  {surgery.nurse_count}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default SurgerySchedule;