// pages/sss/AddSchedulePage.jsx
// 新增手術排程頁面 - 整合真實演算法 API

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
import { useAuth } from '../login/AuthContext';

import surgeryTypeService from '../../services/surgeryTypeService';
import surgeryService from '../../services/surgeryService';
import IBRSAService from '../../services/IBRSAService';
import employeeService from '../../services/employeeService';
import surgeryRoomService from '../../services/surgeryRoomService';
import patientService from '../../services/patientService';
import tshsoSchedulingService from '../../services/TS-HSO_schedulingService';

const AddSchedulePage = () => {
  const { user } = useAuth(); // 取得當前登入醫師資訊
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [recommendedDates, setRecommendedDates] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);
  
  // 推薦狀態
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState(null);
  
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
    surgeryCode: '',
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

  // 載入助手醫師列表 - 使用 employeeService
  useEffect(() => {
    const loadAssistantDoctors = async () => {
      if (!department) return;

      setLoadingAssistants(true);
      try {
        const doctors = await employeeService.getAssistantDoctors(department.code);
        setAssistantDoctors(doctors);
        console.log('Department:', department);
        console.log('✅ 載入助手醫師列表:', doctors);
      } catch (error) {
        console.error('❌ 載入助手醫師列表失敗:', error);
      } finally {
        setLoadingAssistants(false);
      }
    };

    loadAssistantDoctors();
  }, [department]);

  // 載入手術室類型列表 - 使用 surgeryRoomService
  useEffect(() => {
    const loadRoomTypes = async () => {
      setLoadingRoomTypes(true);
      try {
        const types = await surgeryRoomService.getRoomTypes();
        setRoomTypes(types);
        console.log('✅ 載入手術室類型:', types);
      } catch (error) {
        console.error('❌ 載入手術室類型失敗:', error);
      } finally {
        setLoadingRoomTypes(false);
      }
    };

    loadRoomTypes();
  }, []);

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
        estimatedHours: surgery.default_duration,
        nurseCount: surgery.default_nurse_count.toString()
      });
      
      console.log('✅ 自動填入預設值:', {
        手術名稱: surgery.surgery_name,
        預估時間: surgery.default_duration,
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
      
      // 全天門診 - 淺灰色
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
   * ✅ 修改：搜尋病患資料 - 使用 patientService
   */
  const handlePatientSearch = async () => {
    if (!formData.patientId) {
      alert('請輸入病歷號');
      return;
    }

    setPatientPreviewDialog({ open: true, patient: null, loading: true });

    try {
      const patient = await patientService.getPatientById(formData.patientId);
      setPatientPreviewDialog({ open: true, patient, loading: false });
    } catch (error) {
      console.error('搜尋病患失敗:', error);
      alert(error.message || error.error || '找不到該病患資料');
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

  /**
   * 🎯 ✅ 修改：推薦手術日期 - 使用 IBRSAService
   */
  const handleRecommendDate = async () => {
    if (!validateForm()) {
      alert('請填寫所有必填欄位');
      return;
    }

    if (!user?.employee_id) {
      alert('無法取得醫師資訊');
      return;
    }

    setShowRecommendation(true);
    setRecommendLoading(true);
    setRecommendError(null);
    setRecommendedDates([]);

    try {
      const requestData = {
        doctorId: user.employee_id,
        surgeryTypeCode: formData.surgeryCode,
        surgeryDuration: parseFloat(formData.estimatedHours),
        surgeryRoomType: formData.roomType,
        assistantId: formData.assistantDoctor || null,
        returnLimit: 5
      };

      console.log('📤 送出推薦請求:', requestData);

      // 🎯 使用 IBRSAService
      const data = await IBRSAService.recommendSurgeryDates(requestData);

      console.log('📥 收到推薦結果:', data);

      if (data.success && data.recommendations && data.recommendations.length > 0) {
        const dates = data.recommendations.map(rec => ({
          date: new Date(rec.date + 'T00:00:00'),
          score: rec.totalScore,
          rank: rec.rank,
          label: rec.rank === 1 ? '最佳' : rec.rank === 2 ? '推薦' : '可行',
          details: rec
        }));

        setRecommendedDates(dates);
        setRecommendError(null);
        console.log('✅ 推薦成功:', dates.length, '個日期');
      } else {
        setRecommendedDates([]);
        setRecommendError(data.message || '找不到適合的日期');
        alert(data.message || '未來一個月內找不到適合的日期，請調整條件或聯絡排程人員');
      }

    } catch (error) {
      console.error('❌ 推薦日期失敗:', error);
      setRecommendError(error.message || error.error || '推薦失敗');
      setRecommendedDates([]);
      alert(`推薦失敗：${error.message || error.error || '無法連接到伺服器'}`);
    } finally {
      setRecommendLoading(false);
    }
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
      rd.date.getDate() === date.getDate() &&
      rd.date.getMonth() === date.getMonth() &&
      rd.date.getFullYear() === date.getFullYear()
    );
  };

  const getRecommendationScore = (date) => {
    const recommended = recommendedDates.find(rd =>
      rd.date.getDate() === date.getDate() &&
      rd.date.getMonth() === date.getMonth() &&
      rd.date.getFullYear() === date.getFullYear()
    );
    
    return recommended ? {
      score: recommended.score,
      label: recommended.label,
      rank: recommended.rank,
      details: recommended.details
    } : null;
  };

  /**
   * 🚫 檢查日期是否可以選擇
   * - 過去的日期不可選（含今天）
   * - 今天和未來 3 天不可選（準備期）
   * - 從第 4 天開始可選
   */
  const isDateSelectable = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    // 計算準備期結束日期（今天 + 3 天）
    const preparationEndDate = new Date(today);
    preparationEndDate.setDate(today.getDate() + 3);
    
    // 日期必須在準備期之後
    return targetDate > preparationEndDate;
  };

  /**
   * 🆕 檢查日期是否在準備期內
   * - 今天（含）到未來 3 天
   */
  const isInPreparationPeriod = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const preparationEndDate = new Date(today);
    preparationEndDate.setDate(today.getDate() + 3);
    
    // 在今天（含）到準備期結束日期之間
    return targetDate >= today && targetDate <= preparationEndDate;
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleSubmit = async () => {
    if (!selectedDate) {
      alert('請選擇手術日期');
      return;
    }

    if (!validateForm()) {
      alert('請填寫所有必填欄位');
      return;
    }

    try {
      // 準備送到後端的資料
      const surgeryData = {
        patientId: parseInt(formData.patientId),
        assistantDoctorId: formData.assistantDoctor || null,
        surgeryTypeCode: formData.surgeryCode,
        surgeryRoomType: formData.roomType,
        surgeryDate: selectedDate.toISOString().split('T')[0], // YYYY-MM-DD 格式
        duration: formData.estimatedHours,
        nurseCount: parseInt(formData.nurseCount)
      };

      console.log('送出手術排程資料:', surgeryData);

      // 呼叫 API
      const result = await surgeryService.createSurgery(surgeryData);

      console.log('✅ 手術排程新增成功:', result);
      
      alert(`手術排程已成功新增！\n手術編號：${result.data.surgeryId}`);

      try {
        console.log('執行自動排程檢查...');
        // 方案 A (依照演算法閾值): await tshsoSchedulingService.checkAndTrigger();
        
        // 直接觸發更新
        await tshsoSchedulingService.triggerScheduling(); 
        console.log('✅ 自動排程更新完成');
      } catch (scheduleError) {
        console.warn('⚠️ 自動排程觸發失敗 (不影響新增結果):', scheduleError);
      }
      
      // 重置表單
      setFormData({
        patientId: '',
        patientName: '',
        patientFound: false,
        assistantDoctor: '',
        surgeryType: '',
        surgeryCode: '',
        estimatedHours: '',
        roomType: '',
        nurseCount: ''
      });
      setSelectedDate(null);
      setRecommendedDates([]);
      setShowRecommendation(false);
      setRecommendError(null);

    } catch (error) {
      console.error('❌ 新增手術排程失敗:', error);
      alert(`新增失敗：${error.message || error.error || '未知錯誤'}`);
    }
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

          {/* 推薦載入狀態 */}
          {recommendLoading && (
            <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200 flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              <div>
                <p className="text-sm font-medium text-purple-700">正在分析合適的手術日期...</p>
                <p className="text-xs text-purple-600 mt-0.5">考慮醫師排班、助手值班、手術房使用率等因素</p>
              </div>
            </div>
          )}

          {/* 推薦錯誤訊息 */}
          {recommendError && !recommendLoading && (
            <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">無法推薦日期</p>
                <p className="text-xs text-amber-700 mt-1">{recommendError}</p>
              </div>
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

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const targetDate = new Date(date);
                targetDate.setHours(0, 0, 0, 0);
                
                const isToday = targetDate.getTime() === today.getTime();
                const isPast = targetDate < today; // 過去的日期（不含今天）
                const isPreparation = isInPreparationPeriod(date); // 準備期（含今天）
                const isSelectable = isDateSelectable(date); // 可選擇
                
                const isSelected = selectedDate && 
                  date.getDate() === selectedDate.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear();
                
                const isRecommended = isRecommendedDate(date);
                const recommendation = isRecommended ? getRecommendationScore(date) : null;
                
                // 取得排班狀態
                const scheduleStatus = getDayScheduleStatus(date);

                // 不可選的日期不載入排班
                const displayScheduleStatus = isSelectable ? scheduleStatus : null;

                return (
                  <button
                    key={index}
                    onClick={() => isSelectable && handleDateSelect(date)}
                    disabled={!isSelectable}
                    className={`
                      rounded-lg border-2 transition-all duration-200 relative min-h-[70px] flex items-center justify-center
                      ${!isSelectable ? 'bg-gray-50 text-gray-300 cursor-not-allowed border-gray-200' : 'hover:bg-gray-50 cursor-pointer'}
                      ${isToday && isSelectable ? 'ring-2 ring-blue-500' : ''}
                      ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600' : isSelectable ? 'text-gray-700' : ''}
                      ${isRecommended && !isSelected && isSelectable ? 'bg-green-50 ring-2 ring-green-400 border-green-400' : ''}
                      ${displayScheduleStatus && !isSelected && !isRecommended && isSelectable ? displayScheduleStatus.bgColor + ' ' + displayScheduleStatus.borderColor : !displayScheduleStatus && isSelectable && !isRecommended && !isSelected ? 'border-gray-200' : ''}
                    `}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      {/* 日期數字 */}
                      <span className={`text-xs font-medium ${
                        isSelected ? 'text-white' : 
                        !isSelectable ? 'text-gray-300' :
                        displayScheduleStatus?.textColor || 'text-gray-700'
                      }`}>
                        {date.getDate()}
                      </span>
                      
                      {/* 排班狀態指示器 */}
                      {displayScheduleStatus && !isSelected && !isRecommended && isSelectable && (
                        <div className="flex items-center gap-0.5 mt-0.5">
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
                      {isRecommended && !isSelected && recommendation && isSelectable && (
                        <div className="flex flex-col items-center mt-0.5">
                          <span className="text-[8px] font-bold text-green-700">
                            {recommendation.label}
                          </span>
                          <span className="text-[7px] text-green-600">
                            {Math.round(recommendation.score)}分
                          </span>
                        </div>
                      )}
                      
                      {/* 準備期標記 - 顯示在今天和未來3天 */}
                      {isPreparation && (
                        <div className="mt-0.5">
                          <span className="text-[8px] text-gray-400 font-medium">
                            準備期
                          </span>
                        </div>
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
                      const recommendation = getRecommendationScore(selectedDate);
                      
                      return (
                        <>
                          {status && (
                            <p className="text-[10px] text-blue-600 mt-0.5">
                              排班狀態：{status.label}
                            </p>
                          )}
                          {recommendation && (
                            <p className="text-[10px] text-green-600 mt-0.5">
                              推薦等級：{recommendation.label}（{Math.round(recommendation.score)}分）
                            </p>
                          )}
                        </>
                      );
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

            {/* 手術類型 */}
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

            {/* 預估時間 和 護士人數 */}
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
                disabled={loadingRoomTypes}
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-left disabled:bg-gray-100"
              >
                <option value="">
                  {loadingRoomTypes ? '載入中...' : '請選擇手術室類型'}
                </option>
                {roomTypes.map(type => (
                  <option key={type.type} value={type.type}>
                    {type.type_info}手術室
                  </option>
                ))}
              </select>
            </div>
            {roomTypes.length === 0 && !loadingRoomTypes && (
              <p className="mt-1 text-xs text-amber-600">
                目前無可用的手術室類型
              </p>
            )}
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="space-y-2 mt-auto pt-3 border-t border-gray-200">
            <button
              onClick={handleRecommendDate}
              disabled={!validateForm() || scheduleLoading || recommendLoading}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 font-medium"
            >
              {recommendLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  分析合適手術日期
                </>
              )}
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