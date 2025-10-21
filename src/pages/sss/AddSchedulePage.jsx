import React, { useState } from 'react';
import { 
  Calendar,
  Search,
  Users,
  Clock,
  DoorOpen,
  UserPlus,
  Stethoscope,
  CheckCircle,
  Sparkles,
  Save,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';

const AddSchedulePage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [recommendedDates, setRecommendedDates] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);
  
  // 表單狀態
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    patientFound: false,
    assistantDoctor: '',
    surgeryType: '',
    estimatedHours: '',
    roomType: '',
    nurseCount: ''
  });

  // 模擬的手術類型
  const surgeryTypes = [
    '心臟手術',
    '骨科手術',
    '神經外科手術',
    '一般外科手術',
    '泌尿科手術',
    '整形外科手術'
  ];

  // 模擬的手術室類型
  const roomTypes = [
    '外科手術室',
    '專科手術室',
    '達文西手術室',
    '急診手術室'
  ];

  // 生成日曆
  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // 填充上個月的日期
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // 填充本月日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handlePatientSearch = () => {
    setIsSearching(true);
    // 模擬 API 查詢
    setTimeout(() => {
      setFormData({
        ...formData,
        patientFound: true,
        patientName: '王小明'
      });
      setIsSearching(false);
    }, 1000);
  };

  const handleRecommendDate = () => {
    if (!validateForm()) {
      alert('請填寫所有必填欄位');
      return;
    }

    setShowRecommendation(true);
    
    // 模擬演算法推薦日期
    setTimeout(() => {
      const today = new Date();
      const recommended = [
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5),
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7),
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10)
      ];
      setRecommendedDates(recommended);
    }, 1500);
  };

  const validateForm = () => {
    return formData.patientFound &&
           formData.assistantDoctor &&
           formData.surgeryType &&
           formData.estimatedHours &&
           formData.roomType &&
           formData.nurseCount;
  };

  const isRecommendedDate = (date) => {
    return recommendedDates.some(rd => 
      rd.getDate() === date.getDate() &&
      rd.getMonth() === date.getMonth() &&
      rd.getFullYear() === date.getFullYear()
    );
  };

  const getRecommendationScore = (date) => {
    const index = recommendedDates.findIndex(rd =>
      rd.getDate() === date.getDate() &&
      rd.getMonth() === date.getMonth() &&
      rd.getFullYear() === date.getFullYear()
    );
    
    if (index === 0) return { score: 95, label: '最佳' };
    if (index === 1) return { score: 88, label: '推薦' };
    if (index === 2) return { score: 82, label: '可行' };
    return null;
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleSubmit = () => {
    if (!selectedDate) {
      alert('請選擇手術日期');
      return;
    }

    // 這裡會送到後端 API
    const scheduleData = {
      ...formData,
      surgeryDate: selectedDate.toISOString(),
      createdAt: new Date().toISOString()
    };

    console.log('提交排程資料:', scheduleData);
    alert('手術排程已成功新增！');
    
    // 重置表單
    setFormData({
      patientId: '',
      patientName: '',
      patientFound: false,
      assistantDoctor: '',
      surgeryType: '',
      estimatedHours: '',
      roomType: '',
      nurseCount: ''
    });
    setSelectedDate(null);
    setRecommendedDates([]);
    setShowRecommendation(false);
  };

  const calendarDays = generateCalendar();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <Layout>
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* 使用 PageHeader 組件 */}
      <PageHeader 
        title="新增手術排程" 
        subtitle="選擇日期並填寫手術資訊"
      />

      {/* 主要內容區 - 使用 flex-1 填滿剩餘空間 */}
      <div className="flex-1 flex gap-5 p-4 min-h-0">
        {/* 左側日曆區域 */}
        <div className="w-[650px] flex flex-col bg-white rounded-lg shadow-md p-4 min-h-0 mx-auto">
          {/* 日曆標題 */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">選擇手術日期</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-sm font-semibold text-gray-700 min-w-[100px] text-center">
                {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* 日曆網格 - 使用 flex-1 填滿剩餘空間 */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="grid grid-cols-7 gap-1">
              {/* 星期標題 */}
              {weekDays.map(day => (
                <div key={day} className="text-center py-1 font-semibold text-gray-600 text-xs">
                  {day}
                </div>
              ))}
            </div>
            
            {/* 日期格子容器 */}
            <div className="flex-1 grid grid-cols-7 gap-1 content-start overflow-y-auto">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const isToday = date.toDateString() === new Date().toDateString();
                const isPast = date < new Date() && !isToday;
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                const isRecommended = isRecommendedDate(date);
                const recommendation = getRecommendationScore(date);

                return (
                  <button
                    key={index}
                    onClick={() => !isPast && handleDateSelect(date)}
                    disabled={isPast}
                    className={`
                      aspect-square p-1 rounded-lg relative transition-all duration-200 flex items-center justify-center
                      ${isPast ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}
                      ${isToday ? 'ring-2 ring-blue-500' : ''}
                      ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-700'}
                      ${isRecommended && !isSelected ? 'bg-green-50 ring-2 ring-green-400' : ''}
                    `}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-xs font-medium">{date.getDate()}</span>
                      
                      {/* 推薦標記 */}
                      {isRecommended && !isSelected && recommendation && (
                        <span className="text-[8px] font-bold text-green-700">
                          {recommendation.label}
                        </span>
                      )}
                    </div>

                    {/* 已選擇標記 */}
                    {isSelected && (
                      <div className="absolute top-0.5 right-0.5">
                        <CheckCircle className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 已選擇日期顯示 */}
          {selectedDate && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-blue-700">
                      已選擇：{selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-blue-600" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 右側表單區域 */}
        <div className="w-96 bg-white rounded-lg shadow-md p-4 flex flex-col min-h-0">
          <h2 className="text-lg font-bold text-gray-800 mb-3">手術資訊</h2>

          {/* 表單內容 - 改為不需滾動 */}
          <div className="space-y-5">
            {/* 病患查詢 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 text-left">
                病患病歷號 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={formData.patientId}
                  onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                  placeholder="請輸入病歷號"
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left"
                />
                <button
                  onClick={handlePatientSearch}
                  disabled={!formData.patientId || isSearching}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <Search className="w-3 h-3" />
                  {isSearching ? '查詢中' : '查詢'}
                </button>
              </div>
              
              {formData.patientFound && (
                <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-700">
                    病患：{formData.patientName}
                  </span>
                </div>
              )}
            </div>

            {/* 助手醫師 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 text-left">
                助手醫師 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Users className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  value={formData.assistantDoctor}
                  onChange={(e) => setFormData({...formData, assistantDoctor: e.target.value})}
                  placeholder="請輸入助手醫師姓名"
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left"
                />
              </div>
            </div>

            {/* 手術類型 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 text-left">
                手術類型 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Stethoscope className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                <select
                  value={formData.surgeryType}
                  onChange={(e) => setFormData({...formData, surgeryType: e.target.value})}
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-left"
                >
                  <option value="">請選擇手術類型</option>
                  {surgeryTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 預估時間 和 護士人數 - 合併成一排 */}
            <div className="grid grid-cols-2 gap-2">
              {/* 預估時間 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 text-left">
                  預估時間（小時）<span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Clock className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    type="number"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({...formData, estimatedHours: e.target.value})}
                    placeholder="2.5"
                    step="0.5"
                    min="0.5"
                    className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left"
                  />
                </div>
              </div>

              {/* 護士人數 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 text-left">
                  護士人數 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserPlus className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    type="number"
                    value={formData.nurseCount}
                    onChange={(e) => setFormData({...formData, nurseCount: e.target.value})}
                    placeholder="人數"
                    min="1"
                    className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left"
                  />
                </div>
              </div>
            </div>

            {/* 手術室類型 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 text-left">
                手術室類型 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DoorOpen className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                <select
                  value={formData.roomType}
                  onChange={(e) => setFormData({...formData, roomType: e.target.value})}
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-left"
                >
                  <option value="">請選擇手術室類型</option>
                  {roomTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 操作按鈕 - 固定在底部 */}
          <div className="space-y-2 mt-auto pt-3 border-t border-gray-200">
            <button
              onClick={handleRecommendDate}
              disabled={!validateForm()}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 font-medium"
            >
              <Sparkles className="w-4 h-4" />
              分析合適手術日期
            </button>

            <button
              onClick={handleSubmit}
              disabled={!selectedDate}
              className="w-full py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Save className="w-4 h-4" />
              確認新增排程
            </button>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
};

export default AddSchedulePage;