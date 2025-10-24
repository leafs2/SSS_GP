import React, { useState } from 'react';
import { 
  Activity, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Users,
  AlertCircle
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';

const OperatingRoomStatus = () => {
  const [selectedCategory, setSelectedCategory] = useState('surgery');
  const [currentDate] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(0); // 新增：當前頁碼

  // 每頁顯示的手術室數量
  const ROOMS_PER_PAGE = 4;

  // 手術室類別定義
  const categories = [
    { 
      id: 'surgery', 
      name: '外科', 
      total: 10,
      rooms: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10'],
      subtitle: '心臟外科、神經外科、一般外科、胸腔外科、整形外科、骨科'
    },
    { 
      id: 'specialty', 
      name: '專科', 
      total: 8,
      rooms: ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08'],
      subtitle: '婦產科、泌尿科、眼科、耳鼻喉科'
    },
    { 
      id: 'emergency', 
      name: '急診用', 
      total: 3,
      rooms: ['E01', 'E02', 'E03'],
      subtitle: '急診專用手術室'
    },
    { 
      id: 'davinci', 
      name: '達文西', 
      total: 4,
      rooms: ['D01', 'D02', 'D03', 'D04'],
      subtitle: '達文西機器人手術系統'
    }
  ];

  // 模擬手術數據
  const generateMockSurgeries = (roomId) => {
    const surgeries = [];
    const surgeryTypes = [
      { name: '心臟瓣膜置換術', duration: 240, doctor: '陳醫師' },
      { name: '腹腔鏡膽囊切除術', duration: 120, doctor: '林醫師' },
      { name: '脊椎融合手術', duration: 180, doctor: '王醫師' },
      { name: '全膝關節置換術', duration: 150, doctor: '張醫師' },
      { name: '甲狀腺切除術', duration: 90, doctor: '李醫師' },
      { name: '子宮肌瘤切除術', duration: 120, doctor: '黃醫師' },
      { name: '白內障手術', duration: 60, doctor: '周醫師' },
      { name: '鼻竇內視鏡手術', duration: 90, doctor: '吳醫師' }
    ];

    // 隨機生成 1-3 個手術
    const numSurgeries = Math.floor(Math.random() * 4);
    let currentTime = 8; // 從早上 8 點開始

    for (let i = 0; i < numSurgeries; i++) {
      const surgery = surgeryTypes[Math.floor(Math.random() * surgeryTypes.length)];
      const startHour = currentTime;
      const startMinute = Math.random() > 0.5 ? 0 : 30;
      const endHour = startHour + Math.floor(surgery.duration / 60);
      const endMinute = (startMinute + (surgery.duration % 60)) % 60;
      
      const now = new Date();
      const surgeryStart = new Date(now);
      surgeryStart.setHours(startHour, startMinute, 0);
      const surgeryEnd = new Date(now);
      surgeryEnd.setHours(endHour, endMinute, 0);

      // 判斷手術狀態
      let status = 'scheduled';
      if (now >= surgeryStart && now <= surgeryEnd) {
        status = 'ongoing';
      } else if (now > surgeryEnd) {
        status = 'completed';
      }

      surgeries.push({
        id: `${roomId}-${i}`,
        name: surgery.name,
        doctor: surgery.doctor,
        patient: `病患${Math.floor(Math.random() * 1000)}`,
        startTime: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
        endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
        duration: surgery.duration,
        status: status,
        top: (startHour - 6) * 80 + (startMinute / 60) * 80, // 計算位置（從早上6點開始）
        height: (surgery.duration / 60) * 80 // 每小時 80px
      });

      currentTime = endHour + (endMinute > 0 ? 1 : 0);
      if (currentTime >= 18) break; // 最晚到晚上6點
    }

    return surgeries;
  };

  // 生成所有手術室的數據
  const [roomsData] = useState(() => {
    const data = {};
    categories.forEach(category => {
      data[category.id] = category.rooms.map(roomId => ({
        id: roomId,
        surgeries: generateMockSurgeries(roomId)
      }));
    });
    return data;
  });

  // 計算統計數據
  const calculateStats = () => {
    const currentCategory = roomsData[selectedCategory] || [];
    let ongoingCount = 0;
    let completedCount = 0;
    let totalCount = 0;
    let roomsInUse = 0;

    currentCategory.forEach(room => {
      let hasOngoingSurgery = false;
      room.surgeries.forEach(surgery => {
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

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        {/* 頂部標題欄 */}
        <PageHeader 
          title="手術室使用情形" 
          subtitle="外科部門"
        />

        {/* 主要內容區域 */}
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

            {/* 統計資訊 - 放在類別按鈕右側 */}
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

          {/* 類別說明 */}
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{currentCategory?.subtitle}</span>
          </div>
        </div>

        {/* 手術室排程表容器 */}
        <div className="bg-white rounded-lg shadow-md">
          {/* 分頁控制器 - 改為前後切換按鈕 */}
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
                        : 'bg-blue-300 text-white hover:bg-blue-700 shadow-md'
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
                        : 'bg-blue-300 text-white hover:bg-blue-700 shadow-md'
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
                  room.surgeries.filter(s => s.status === 'ongoing').length > 0 
                    ? 'bg-green-100 border-green-400' 
                    : 'bg-white'
                }`}>
                  <div className="font-bold text-lg text-gray-900">{room.id}</div>
                  <div className="text-xs text-gray-500">
                    {room.surgeries.filter(s => s.status === 'ongoing').length > 0 ? (
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
                  {room.surgeries.map((surgery) => (
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
          <div className="border-t border-gray-200 px-6 py-3">
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