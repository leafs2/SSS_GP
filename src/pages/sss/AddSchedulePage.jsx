// pages/sss/AddSchedulePage.jsx
// 新增手術排程頁面 - 整合醫師排班顯示

import React, { useState, useEffect } from 'react';
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
  ChevronRight,
  Loader2,
  AlertCircle,
  Scissors,
  Coffee,
  User,
  FileText,
  Heart,
  Activity,
  AlertTriangle,
  Droplet
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useMySchedule } from '../../hooks/useSchedule';
import { useMySurgeryTypes } from '../../hooks/useSurgeryType';
import surgeryTypeService from '../../services/surgeryTypeService';

const AddSchedulePage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [recommendedDates, setRecommendedDates] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);
  
  // 病患預覽對話框
  const [patientPreviewDialog, setPatientPreviewDialog] = useState({
    open: false,
    patient: null,
    loading: false
  });
  
  // 載入醫師排班
  const { 
    schedule: doctorSchedule, 
    isLoading: scheduleLoading 
  } = useMySchedule();
  
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

  // 載入手術類型 - 使用 custom hook
  const {
    surgeryTypes,
    department,
    isLoading: loadingSurgeryTypes,
    error: surgeryTypesError
  } = useMySurgeryTypes();

  // 助手醫師列表
  const [assistantDoctors, setAssistantDoctors] = useState([]);
  const [loadingAssistants, setLoadingAssistants] = useState(false);

  // 載入助手醫師列表
  useEffect(() => {
    const loadAssistantDoctors = async () => {
      if (!department) return;

      setLoadingAssistants(true);
      try {
        const response = await fetch(
          `http://localhost:3001/api/employees/by-department-role?department_code=${department.code}&role=A`
        );
        const data = await response.json();

        if (data.success) {
          setAssistantDoctors(data.data);
          console.log('Department:', department);
          console.log('✅ 載入助手醫師列表:', data.data);
        }
      } catch (error) {
        console.error('❌ 載入助手醫師列表失敗:', error);
      } finally {
        setLoadingAssistants(false);
      }
    };

    loadAssistantDoctors();
  }, [department]);

  // 模擬的手術室類型
  const roomTypes = [
    '外科手術室',
    '專科手術室',
    '達文西手術室',
    '急診手術室'
  ];

  /**
   * 當選擇手術類型時，取得詳細資訊並自動填入預設值
   */
  const handleSurgeryTypeChange = async (surgeryCode) => {
    if (!surgeryCode) {
      setFormData({
        ...formData,
        surgeryType: '',
        surgeryCode: '',
        estimatedHours: '',
        nurseCount: ''
      });
      return;
    }

    try {
      const surgery = await surgeryTypeService.fetchSurgeryTypeDetail(surgeryCode);
      
      setFormData({
        ...formData,
        surgeryType: surgery.surgery_name,
        surgeryCode: surgery.surgery_code,
        estimatedHours: surgery.default_duration_min,
        nurseCount: surgery.default_nurse_count.toString()
      });
      
      console.log('✅ 自動填入預設值:', {
        手術名稱: surgery.surgery_name,
        預估時間: surgery.default_duration_min,
        護士人數: surgery.default_nurse_count
      });
    } catch (error) {
      console.error('❌ 取得手術類型詳細資訊失敗:', error);
    }
  };

  /**
   * 獲取某個日期的排班狀態
   * @param {Date} date - 要檢查的日期
   * @returns {Object} { type, label, color, textColor }
   */
  const getDayScheduleStatus = (date) => {
    if (!doctorSchedule) return null;

    // 取得星期幾（中文）
    const weekDays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const dayOfWeek = weekDays[date.getDay()];
    
    // 檢查是否有全天排班
    const fullDaySchedule = doctorSchedule[dayOfWeek];
    if (fullDaySchedule?.fullDay) {
      const type = fullDaySchedule.type;
      
      // 手術日 - 橘紅色
      if (type === 'surgery') {
        return {
          type: 'surgery',
          label: '手術',
          bgColor: 'bg-orange-100',
          borderColor: 'border-orange-400',
          textColor: 'text-orange-700',
          dotColor: 'bg-orange-500'
        };
      }
      
      // 休假 - 灰色
      if (type === 'off') {
        return {
          type: 'off',
          label: '休假',
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-400',
          textColor: 'text-gray-600',
          dotColor: 'bg-gray-500'
        };
      }
      
      // 全天門診 - 淺灰色（避免與手術日混淆）
      if (type === 'clinic') {
        return {
          type: 'clinic-fullday',
          label: '看診',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-600',
          dotColor: 'bg-gray-400'
        };
      }
    }
    
    // 檢查分時段排班
    const morningSchedule = doctorSchedule[`${dayOfWeek}上午`];
    const afternoonSchedule = doctorSchedule[`${dayOfWeek}下午`];
    
    // 如果包含彈性時段，不標註顏色
    if (morningSchedule?.type === 'flexible' || afternoonSchedule?.type === 'flexible') {
      return null;
    }
    
    // 如果上午或下午有看診，但不是全天，也不標註顏色（避免混淆）
    return null;
  };

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

  /**
   * 搜尋病患資料
   */
  const handlePatientSearch = async () => {
    if (!formData.patientId) {
      alert('請輸入病歷號');
      return;
    }

    setPatientPreviewDialog({ open: true, patient: null, loading: true });

    try {
      const response = await fetch(`http://localhost:3001/api/patients/${formData.patientId}`);
      const data = await response.json();

      if (data.success) {
        setPatientPreviewDialog({ open: true, patient: data.data, loading: false });
      } else {
        alert('找不到該病患資料');
        setPatientPreviewDialog({ open: false, patient: null, loading: false });
      }
    } catch (error) {
      console.error('搜尋病患失敗:', error);
      alert('搜尋失敗：無法連接到伺服器');
      setPatientPreviewDialog({ open: false, patient: null, loading: false });
    }
  };

  /**
   * 確認選擇病患
   */
  const handleConfirmPatient = () => {
    if (patientPreviewDialog.patient) {
      setFormData({
        ...formData,
        patientFound: true,
        patientName: patientPreviewDialog.patient.name
      });
      setPatientPreviewDialog({ open: false, patient: null, loading: false });
    }
  };

  /**
   * 取消選擇病患
   */
  const handleCancelPatient = () => {
    setPatientPreviewDialog({ open: false, patient: null, loading: false });
  };

  /**
   * 格式化日期
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW');
  };

  /**
   * 計算年齡
   */
  const calculateAge = (birthDate) => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleRecommendDate = () => {
    if (!validateForm()) {
      alert('請填寫所有必填欄位');
      return;
    }

    setShowRecommendation(true);
    
    // 模擬演算法推薦日期 - 優先推薦手術日
    setTimeout(() => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      
      // 找出未來的手術日
      const surgeryDates = [];
      
      // 檢查未來 30 天
      for (let i = 1; i <= 30; i++) {
        const checkDate = new Date(year, month, today.getDate() + i);
        const status = getDayScheduleStatus(checkDate);
        
        if (status?.type === 'surgery') {
          surgeryDates.push(checkDate);
        }
        
        // 找到 3 個就停止
        if (surgeryDates.length >= 3) break;
      }
      
      // 如果手術日不足 3 個，補充其他可用日期
      if (surgeryDates.length < 3) {
        for (let i = 1; i <= 30 && surgeryDates.length < 3; i++) {
          const checkDate = new Date(year, month, today.getDate() + i);
          const status = getDayScheduleStatus(checkDate);
          
          // 不是休假日且不是已選的手術日
          if (!status || status.type === 'clinic-fullday') {
            const alreadyExists = surgeryDates.some(d => 
              d.getDate() === checkDate.getDate() &&
              d.getMonth() === checkDate.getMonth()
            );
            
            if (!alreadyExists) {
              surgeryDates.push(checkDate);
            }
          }
        }
      }
      
      setRecommendedDates(surgeryDates);
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
        <div className="w-[800px] flex flex-col bg-white rounded-lg shadow-md p-4 min-h-0 mx-auto">
          {/* 日曆標題 */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">選擇手術日期</h2>
            {/* 圖例說明 */}
            <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <span className="font-medium text-gray-600">圖例：</span>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-gray-700">手術日</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                  <span className="text-gray-700">休假</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <span className="text-gray-700">看診日</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-700">推薦日期</span>
                </div>
              </div>
            </div>
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

          {/* 載入狀態 */}
          {scheduleLoading && (
            <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-xs text-blue-700">載入排班資料中...</span>
            </div>
          )}

          {/* 日曆網格 */}
          <div className="flex-1 flex flex-col">
            {/* 星期標題 */}
            <div className="grid grid-cols-7 gap-2 mb-1">
              {weekDays.map(day => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-gray-600 py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 日期格子 */}
            <div className="grid grid-cols-7 gap-1 mt-6">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="min-h-[70px] rounded-lg border-2 border-transparent" />;
                }

                const isToday = date.toDateString() === new Date().toDateString();
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                const isSelected = selectedDate && 
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear();
                
                const isRecommended = isRecommendedDate(date);
                const recommendation = isRecommended ? getRecommendationScore(date) : null;
                
                // 取得排班狀態
                const scheduleStatus = getDayScheduleStatus(date);

                // 過去的日期不載入排班，直接顯示為灰色
                const displayScheduleStatus = isPast ? null : scheduleStatus;

                return (
                  <button
                    key={index}
                    onClick={() => !isPast && handleDateSelect(date)}
                    disabled={isPast}
                    className={`
                      rounded-lg border-2 transition-all duration-200 relative min-h-[70px] flex items-center justify-center
                      ${isPast ? 'bg-gray-50 text-gray-300 cursor-not-allowed border-gray-200' : 'hover:bg-gray-50 cursor-pointer'}
                      ${isToday && !isPast ? 'ring-2 ring-blue-500' : ''}
                      ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600' : !isPast ? 'text-gray-700' : ''}
                      ${isRecommended && !isSelected && !isPast ? 'bg-green-50 ring-2 ring-green-400 border-green-400' : ''}
                      ${displayScheduleStatus && !isSelected && !isRecommended && !isPast ? displayScheduleStatus.bgColor + ' ' + displayScheduleStatus.borderColor : !displayScheduleStatus && !isPast && !isRecommended && !isSelected ? 'border-gray-200' : ''}
                    `}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      {/* 日期數字 */}
                      <span className={`text-xs font-medium ${
                        isSelected ? 'text-white' : 
                        isPast ? 'text-gray-300' :
                        displayScheduleStatus?.textColor || 'text-gray-700'
                      }`}>
                        {date.getDate()}
                      </span>
                      
                      {/* 排班狀態指示器 - 只顯示「看診」文字，手術和休假只保留背景色 */}
                      {displayScheduleStatus && !isSelected && !isRecommended && !isPast && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {/* 只有看診類型才顯示文字標籤 */}
                          {displayScheduleStatus.type === 'clinic-fullday' && (
                            <>
                              <div className={`w-1.5 h-1.5 rounded-full ${displayScheduleStatus.dotColor}`}></div>
                              <span className={`text-[8px] font-bold ${displayScheduleStatus.textColor}`}>
                                {displayScheduleStatus.label}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      
                      {/* 推薦標記 */}
                      {isRecommended && !isSelected && recommendation && !isPast && (
                        <span className="text-[8px] font-bold text-green-700 mt-0.5">
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
                    {/* 顯示該日期的排班狀態 */}
                    {(() => {
                      const status = getDayScheduleStatus(selectedDate);
                      if (status) {
                        return (
                          <p className="text-[10px] text-blue-600 mt-0.5">
                            排班狀態：{status.label}
                          </p>
                        );
                      }
                      return null;
                    })()}
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

          {/* 表單內容 */}
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
                  查詢
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
                <select
                  value={formData.assistantDoctor}
                  onChange={(e) => setFormData({...formData, assistantDoctor: e.target.value})}
                  disabled={loadingAssistants}
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-left disabled:bg-gray-100"
                >
                  <option value="">
                    {loadingAssistants ? '載入中...' : '請選擇助手醫師'}
                  </option>
                  {assistantDoctors.map(doctor => (
                    <option key={doctor.employee_id} value={doctor.employee_id}>
                      {doctor.name} ({doctor.employee_id})
                    </option>
                  ))}
                </select>
              </div>
              {assistantDoctors.length === 0 && !loadingAssistants && (
                <p className="mt-1 text-xs text-amber-600">
                  目前無可用的助手醫師
                </p>
              )}
            </div>

            {/* 手術類型 - 使用 custom hook */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 text-left">
                手術類型 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Stethoscope className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                <select
                  value={formData.surgeryCode}
                  onChange={(e) => handleSurgeryTypeChange(e.target.value)}
                  disabled={loadingSurgeryTypes}
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-left disabled:bg-gray-100"
                >
                  <option value="">
                    {loadingSurgeryTypes ? '載入中...' : '請選擇手術類型'}
                  </option>
                  {surgeryTypes.map(type => (
                    <option key={type.surgery_code} value={type.surgery_code}>
                      {type.surgery_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 預估時間 和 護士人數 - 會自動填入 */}
            <div className="grid grid-cols-2 gap-2">
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

          {/* 操作按鈕 */}
          <div className="space-y-2 mt-auto pt-3 border-t border-gray-200">
            <button
              onClick={handleRecommendDate}
              disabled={!validateForm() || scheduleLoading}
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

      {/* 病患預覽對話框 */}
      {patientPreviewDialog.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* 標題列 */}
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6" />
                <h2 className="text-xl font-semibold">病患資訊確認</h2>
              </div>
              <button
                onClick={handleCancelPatient}
                className="hover:bg-blue-700 p-1 rounded transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 內容區 */}
            <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
              {patientPreviewDialog.loading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">載入病患資料中...</p>
                </div>
              ) : patientPreviewDialog.patient ? (
                <div className="p-6 space-y-6">
                  {/* 基本資訊 - 左右條列式 */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <User className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">基本資訊</h3>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-x-12 gap-y-3">
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">病歷號</label>
                          <p className="text-base font-medium text-gray-900">
                            {patientPreviewDialog.patient.patient_id}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">姓名</label>
                          <p className="text-base font-medium text-gray-900">
                            {patientPreviewDialog.patient.name}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">性別</label>
                          <p className="text-base font-medium text-gray-900">
                            {patientPreviewDialog.patient.gender_name}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">血型</label>
                          <p className="text-base font-medium text-gray-900">
                            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">
                              {patientPreviewDialog.patient.blood_type_name}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">生日</label>
                          <p className="text-base font-medium text-gray-900">
                            {formatDate(patientPreviewDialog.patient.birth_date)}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">年齡</label>
                          <p className="text-base font-medium text-gray-900">
                            {calculateAge(patientPreviewDialog.patient.birth_date)} 歲
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">身分證</label>
                          <p className="text-base font-medium font-mono text-gray-900">
                            {patientPreviewDialog.patient.id_number}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">建檔日期</label>
                          <p className="text-base font-medium text-gray-900">
                            {formatDate(patientPreviewDialog.patient.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 所有主題區 - 橫向排列 */}
                  <div className="grid grid-cols-4 gap-4">
                    {/* 藥物過敏 */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <h3 className="text-sm font-semibold text-gray-900">藥物過敏</h3>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 flex-1 overflow-y-auto max-h-48">
                        {patientPreviewDialog.patient.allergies && patientPreviewDialog.patient.allergies.length > 0 ? (
                          <div className="space-y-2">
                            {patientPreviewDialog.patient.allergies.map((allergy) => (
                              <div
                                key={allergy.allergy_id}
                                className="bg-orange-200 text-orange-800 px-3 py-2 rounded-lg text-sm font-medium"
                              >
                                {allergy.drug_allergy}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">無記錄</p>
                        )}
                      </div>
                    </div>

                    {/* 個人病史 */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <h3 className="text-sm font-semibold text-gray-900">個人病史</h3>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 flex-1 overflow-y-auto max-h-48">
                        {patientPreviewDialog.patient.personalHistory && patientPreviewDialog.patient.personalHistory.length > 0 ? (
                          <div className="space-y-2">
                            {patientPreviewDialog.patient.personalHistory.map((history) => (
                              <div
                                key={history.history_id}
                                className="bg-purple-200 text-purple-800 px-3 py-2 rounded-lg text-sm font-medium"
                              >
                                {history.history_option}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">無記錄</p>
                        )}
                      </div>
                    </div>

                    {/* 家族病史 */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <Heart className="w-4 h-4 text-pink-600" />
                        <h3 className="text-sm font-semibold text-gray-900">家族病史</h3>
                      </div>
                      <div className="bg-pink-50 rounded-lg p-3 flex-1 overflow-y-auto max-h-48">
                        {patientPreviewDialog.patient.familyHistory && patientPreviewDialog.patient.familyHistory.length > 0 ? (
                          <div className="space-y-2">
                            {patientPreviewDialog.patient.familyHistory.map((history, index) => (
                              <div key={index} className="bg-pink-200 text-pink-800 px-3 py-2 rounded-lg text-sm font-medium">
                                <div>{history.history_option}</div>
                                <div className="text-xs text-pink-700 mt-1">({history.kinship})</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">無記錄</p>
                        )}
                      </div>
                    </div>

                    {/* 生活習慣 */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-green-600" />
                        <h3 className="text-sm font-semibold text-gray-900">生活習慣</h3>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 flex-1 overflow-y-auto max-h-48">
                        {patientPreviewDialog.patient.lifestyle && patientPreviewDialog.patient.lifestyle.length > 0 ? (
                          <div className="space-y-2">
                            {patientPreviewDialog.patient.lifestyle.map((item) => (
                              <div
                                key={item.lifestyle_id}
                                className="bg-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-medium"
                              >
                                {item.lifestyle}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">無記錄</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 底部操作區 */}
            {!patientPreviewDialog.loading && patientPreviewDialog.patient && (
              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={handleCancelPatient}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmPatient}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  確認選擇此病患
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
};

export default AddSchedulePage;