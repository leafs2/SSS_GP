// pages/sss/AssistantShiftManagePage.jsx
// 助理醫師排班管理頁面 - 排班管理（僅住院總醫師可用）

import React, { useState, useEffect } from 'react';
import { 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Save,
  X,
  RefreshCw,
  Search,
  TrendingUp,
  Award,
  AlertTriangle
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../login/AuthContext';
import assistantShiftService from '../../services/assistantShiftService';

const AssistantShiftManagePage = () => {
  const { user } = useAuth();
  const userDepartment = user?.department_name || '外科部門';
  const userDepartmentCode = user?.department_code || 'SURG';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [statistics, setStatistics] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [shifts, setShifts] = useState({}); // 編輯中的排班資料
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // 選擇醫師對話框
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [selectedDoctors, setSelectedDoctors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // 載入資料
  useEffect(() => {
    loadData();
  }, [year, month, userDepartmentCode]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, calendarDataResult] = await Promise.all([
        assistantShiftService.getAssistantDoctorStatistics(userDepartmentCode, year, month),
        assistantShiftService.getAssistantShiftCalendar(userDepartmentCode, year, month)
      ]);

      setStatistics(statsData);
      setCalendarData(calendarDataResult);

      // 初始化 shifts 狀態
      const initialShifts = {};
      if (calendarDataResult?.shifts) { 
      Object.keys(calendarDataResult.shifts).forEach(dateStr => {
            const doctors = calendarDataResult.shifts[dateStr].doctors || [];
            initialShifts[dateStr] = doctors.map(d => d.employee_id);
        });
      }
      setShifts(initialShifts);

    } catch (err) {
      console.error('載入排班資料失敗:', err);
      setError(err.message || '載入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 上一月
  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  // 下一月
  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  // 回到本月
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // 開啟選擇醫師對話框
  const handleOpenDoctorModal = async (dateStr) => {
    setSelectedDate(dateStr);
    setShowDoctorModal(true);
    setSearchQuery('');
    setSelectedDoctors(shifts[dateStr] || []);
    
    try {
      setLoadingDoctors(true);
      
      // 傳遞暫存的排班資料給 API
      const tempShifts = Object.keys(shifts).map(date => ({
        date,
        doctor_ids: shifts[date]
      })).filter(item => item.doctor_ids.length > 0);
      
      const doctors = await assistantShiftService.getAvailableDoctorsForDate(
        dateStr, 
        userDepartmentCode,
        tempShifts 
      );
      setAvailableDoctors(doctors);
    } catch (err) {
      console.error('載入可用醫師失敗:', err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // 關閉對話框
  const handleCloseDoctorModal = () => {
    setShowDoctorModal(false);
    setSelectedDate(null);
    setAvailableDoctors([]);
    setSelectedDoctors([]);
    setSearchQuery('');
  };

  // 切換醫師選擇
  const handleToggleDoctor = (doctorId) => {
    setSelectedDoctors(prev => {
      if (prev.includes(doctorId)) {
        return prev.filter(id => id !== doctorId);
      } else {
        if (prev.length >= 2) {
          // 如果已經選了2位，替換最後一位
          return [...prev.slice(0, 1), doctorId];
        }
        return [...prev, doctorId];
      }
    });
  };

  // 確認選擇
  const handleConfirmSelection = async () => {
    if (!selectedDate || selectedDoctors.length === 0) {
      handleCloseDoctorModal();
      return;
    }

    try {
      setSaveLoading(true);
      setSaveError(null);

      // ⭐ 立即儲存到資料庫
      const result = await assistantShiftService.saveAssistantShifts(
        userDepartmentCode,
        year,
        month,
        [{
          date: selectedDate,
          doctor_ids: selectedDoctors
        }]
      );

      if (!result.success) {
        setSaveError(result.error || '儲存失敗');
        return;
      }

      // ✅ 儲存成功後重新載入完整資料
      await loadData();
      
      // 顯示成功訊息
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

    } catch (err) {
      console.error('儲存排班失敗:', err);
      setSaveError(err.message || '儲存失敗，請稍後再試');
    } finally {
      setSaveLoading(false);
      handleCloseDoctorModal();
    }
  };

  // 清除選擇
  const handleClearSelection = () => {
    setSelectedDoctors([]);
  };

  // 儲存排班
  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setSaveError(null);
      setSaveSuccess(false);

      // 轉換格式
      const shiftsToSave = Object.keys(shifts).map(dateStr => ({
        date: dateStr,
        doctor_ids: shifts[dateStr]
      })).filter(item => item.doctor_ids.length > 0);

      const result = await assistantShiftService.saveAssistantShifts(
        userDepartmentCode,
        year,
        month,
        shiftsToSave
      );

      if (result.success) {
        setSaveSuccess(true);
        // 重新載入資料
        await loadData();
        // 3 秒後隱藏成功訊息
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(result.error || '儲存失敗');
      }
    } catch (err) {
      setSaveError(err.message || '儲存失敗，請稍後再試');
    } finally {
      setSaveLoading(false);
    }
  };

    // 取消編輯
    const handleCancel = () => {
        // 恢復原始資料
        if (calendarData?.shifts) {
            const initialShifts = {};
            Object.keys(calendarData.shifts).forEach(dateStr => {
            const doctors = calendarData.shifts[dateStr].doctors || [];
            initialShifts[dateStr] = doctors.map(d => d.employee_id);
            });
            setShifts(initialShifts);
        }
        
        // ✅ 重新載入資料以恢復統計
        loadData();
        setSaveError(null);
    };

  // 生成日曆網格資料
  const generateCalendarGrid = () => {
    if (!calendarData || !calendarData.month_info) return [];

    const { month_info } = calendarData;
    const firstDay = month_info.first_day_of_week;
    const totalDays = month_info.total_days;

    const totalCells = Math.ceil((firstDay + totalDays) / 7) * 7;
    const grid = [];

    for (let i = 0; i < totalCells; i++) {
      const dayNumber = i - firstDay + 1;
      
      if (dayNumber > 0 && dayNumber <= totalDays) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
        
        grid.push({
          date: dayNumber,
          dateStr
        });
      } else {
        grid.push(null);
      }
    }

    return grid;
  };

  // 獲取某天的值班醫師
  const getDoctorsForDate = (dateStr) => {
    const doctorIds = shifts[dateStr] || [];
    if (!statistics?.doctors) return [];
    
    return doctorIds.map(id => {
      const doctor = statistics.doctors.find(d => d.employee_id === id);
      return doctor ? doctor.name : id;
    });
  };

  // 獲取某天的狀態
  const getDateStatus = (dateStr) => {
    const doctors = shifts[dateStr] || [];
    if (doctors.length === 0) return 'empty';
    if (doctors.length === 1) return 'incomplete';
    if (doctors.length === 2) return 'complete';
    return 'violation';
  };

  // 獲取狀態樣式
  const getStatusStyle = (status) => {
    switch (status) {
      case 'complete':
        return 'bg-green-50 border-green-300';
      case 'incomplete':
        return 'bg-yellow-50 border-yellow-300';
      case 'violation':
        return 'bg-red-50 border-red-300';
      default:
        return 'bg-white border-gray-200';
    }
  };

  // 獲取狀態圖示
  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'incomplete':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'violation':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  // 過濾醫師
  const filteredDoctors = availableDoctors.filter(doctor => 
    doctor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 分組醫師
  const groupedDoctors = {
    recommended: filteredDoctors.filter(d => d.available && d.priority === 'recommended'),
    normal: filteredDoctors.filter(d => d.available && d.priority === 'normal'),
    warning: filteredDoctors.filter(d => d.available && d.priority === 'warning'),
    unavailable: filteredDoctors.filter(d => !d.available)
  };

  // Loading 狀態
  if (loading) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader title="排班管理" subtitle={userDepartment} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-600">載入排班資料中...</span>
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
          <PageHeader title="排班管理" subtitle={userDepartment} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col items-center justify-center h-64">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-red-600 font-medium mb-2">載入排班資料失敗</p>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                onClick={loadData}
              >
                重新載入
              </button>
            </div>
          </main>
        </div>
      </Layout>
    );
  }

  const calendarGrid = generateCalendarGrid();
  const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        <PageHeader 
          title="排班管理" 
          subtitle={userDepartment}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-6">
            {/* 住院醫師統計區域 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  住院醫師統計
                </h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>總計: {statistics?.summary?.total_doctors || 0}位</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    <span>平均: {statistics?.summary?.average_shifts?.toFixed(1) || 0}天</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="w-4 h-4 text-green-600" />
                    <span>最多: {statistics?.summary?.max_shifts || 0}天</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="w-4 h-4 text-gray-400" />
                    <span>最少: {statistics?.summary?.min_shifts || 0}天</span>
                  </div>
                </div>
              </div>

              {/* 醫師統計列表 */}

            <div className="grid grid-cols-2 gap-3">
            {statistics?.doctors?.map((doctor) => (
                <div 
                key={doctor.employee_id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >

                {/* 醫師姓名 */}
                <div className="w-16 flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{doctor.name}</p>
                </div>

                {/* 進度條 */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                        className={`h-full transition-all duration-300 ${
                            doctor.shift_percentage >= 80 
                            ? 'bg-red-500' 
                            : doctor.shift_percentage >= 60 
                            ? 'bg-yellow-500' 
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(doctor.shift_percentage, 100)}%` }}
                        />
                    </div>
                    <span className="text-xs font-medium text-gray-600 w-10 text-right">
                        {doctor.shift_percentage}%
                    </span>
                    </div>
                </div>

                {/* 統計數據（緊湊版） */}
                <div className="flex items-center gap-2 text-xs">
                    <div className="text-center">
                    <p className="text-gray-500">本月</p>
                    <p className="font-semibold text-gray-900">{doctor.total_shifts_this_month}天</p>
                    </div>
                    <div className="text-center">
                    <p className="text-gray-500">本週</p>
                    <p className={`font-semibold ${
                        doctor.shifts_this_week >= 3 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                        {doctor.shifts_this_week}天
                    </p>
                    </div>
                    <div className="text-center min-w-[60px]">
                    <p className="text-gray-500">下次可排</p>
                    <p className="font-medium text-gray-700">
                        {doctor.next_available_date 
                        ? new Date(doctor.next_available_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
                        : '—'
                        }
                    </p>
                    </div>
                </div>

                {/* 狀態標記（小版） */}
                <div className="flex-shrink-0">
                    {doctor.status === 'available' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        可排
                    </span>
                    )}
                    {doctor.status === 'warning' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                        <AlertCircle className="w-3 h-3" />
                        接近上限
                    </span>
                    )}
                    {doctor.status === 'unavailable' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                        <AlertCircle className="w-3 h-3" />
                        本週已滿
                    </span>
                    )}
                </div>
                </div>
            ))}
            </div>
            </div>

            {/* 月份排班日曆 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6 ">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  月份排班日曆
                </h2>

                <div className="flex items-center gap-3">
                  {saveSuccess && (
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                      <CheckCircle className="w-4 h-4" />
                      <span>儲存成功</span>
                    </div>
                  )}

                  {/* 月份切換 */}
                  <button
                    onClick={handlePrevMonth}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  
                  <div className="flex items-center gap-2 min-w-[140px] justify-center">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-base font-semibold text-gray-700">
                      {year}年 {month}月
                    </span>
                  </div>

                  <button
                    onClick={handleNextMonth}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>

                  <button
                    onClick={handleToday}
                    className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    本月
                  </button>
                </div>
              </div>

              {/* 錯誤訊息 */}
              {saveError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium text-sm">儲存失敗</p>
                    <p className="text-red-600 text-xs mt-1">{saveError}</p>
                  </div>
                </div>
              )}

              {/* 日曆網格 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden items-center max-w-5xl mx-auto">
                {/* 星期標題 */}
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                  {weekDays.map((day) => (
                    <div 
                      key={day}
                      className="p-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* 日期網格 */}
                <div className="grid grid-cols-7 ">
                  {calendarGrid.map((cell, index) => {
                    if (!cell) {
                      return (
                        <div 
                          key={`empty-${index}`}
                          className="h-32 border-r border-b border-gray-200 bg-gray-50 last:border-r-0"
                        />
                      );
                    }

                    const isToday = cell.date === new Date().getDate() && 
                                   month === new Date().getMonth() + 1 && 
                                   year === new Date().getFullYear();
                    
                    const status = getDateStatus(cell.dateStr);
                    const doctors = getDoctorsForDate(cell.dateStr);

                    return (
                      <div 
                        key={cell.dateStr}
                        className={`h-32 border-r border-b border-gray-200 last:border-r-0 p-2 cursor-pointer hover:shadow-lg transition-shadow ${getStatusStyle(status)} ${
                          isToday ? 'ring-2 ring-blue-500 ring-inset' : ''
                        }`}
                        onClick={() => handleOpenDoctorModal(cell.dateStr)}
                      >
                        <div className="h-full flex flex-col">
                          {/* 日期和狀態 */}
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-semibold ${
                              isToday ? 'text-blue-600' : 'text-gray-700'
                            }`}>
                              {cell.date}
                            </span>
                            {getStatusIcon(status)}
                          </div>

                          {/* 值班醫師 */}
                          <div className="flex-1 flex flex-col gap-1 justify-center">
                            {doctors.length > 0 ? (
                              doctors.map((name, idx) => (
                                <div 
                                  key={idx}
                                  className="text-xs font-medium text-black text-center bg-white shadow-sm border border-gray-300 rounded px-1 py-0.5"
                                >
                                  {name}
                                </div>
                              ))
                            ) : (
                              <div className="text-center text-gray-400">
                                <Clock className="w-4 h-4 mx-auto mb-1" />
                                <p className="text-xs">點擊排班</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 圖例 */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-200">
                <span className="text-xs font-medium text-gray-500">圖例：</span>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-50 border border-green-300 rounded"></div>
                    <span className="text-xs text-gray-600">已完成（2位）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-50 border border-yellow-300 rounded"></div>
                    <span className="text-xs text-gray-600">不完整（1位）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-50 border border-red-300 rounded"></div>
                    <span className="text-xs text-gray-600">違規</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-white border border-gray-200 rounded"></div>
                    <span className="text-xs text-gray-600">未排班</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* 選擇醫師對話框 */}
        {showDoctorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              {/* 標題 */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    選擇值班醫師 - {selectedDate && new Date(selectedDate).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 text-left">
                    已選擇 {selectedDoctors.length}/2 位
                  </p>
                </div>
                <button
                  onClick={handleCloseDoctorModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* 搜尋和操作 */}
              <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="搜尋醫師..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleClearSelection}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  清除選擇
                </button>
              </div>

              {/* 醫師列表 */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingDoctors ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-gray-600">載入中...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 優先推薦 */}
                    {groupedDoctors.recommended.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          優先推薦（排班較少）
                        </h4>
                        <div className="space-y-2">
                          {groupedDoctors.recommended.map((doctor) => (
                            <DoctorCard 
                              key={doctor.employee_id}
                              doctor={doctor}
                              selected={selectedDoctors.includes(doctor.employee_id)}
                              onToggle={() => handleToggleDoctor(doctor.employee_id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 可選 */}
                    {groupedDoctors.normal.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          可選
                        </h4>
                        <div className="space-y-2">
                          {groupedDoctors.normal.map((doctor) => (
                            <DoctorCard 
                              key={doctor.employee_id}
                              doctor={doctor}
                              selected={selectedDoctors.includes(doctor.employee_id)}
                              onToggle={() => handleToggleDoctor(doctor.employee_id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 接近上限 */}
                    {groupedDoctors.warning.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-700 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          接近上限（本週已2天）
                        </h4>
                        <div className="space-y-2">
                          {groupedDoctors.warning.map((doctor) => (
                            <DoctorCard 
                              key={doctor.employee_id}
                              doctor={doctor}
                              selected={selectedDoctors.includes(doctor.employee_id)}
                              onToggle={() => handleToggleDoctor(doctor.employee_id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 不可選擇 */}
                    {groupedDoctors.unavailable.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                          <X className="w-4 h-4" />
                          不可選擇
                        </h4>
                        <div className="space-y-2">
                          {groupedDoctors.unavailable.map((doctor) => (
                            <DoctorCard 
                              key={doctor.employee_id}
                              doctor={doctor}
                              disabled
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 底部按鈕 */}
              <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={handleCloseDoctorModal}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmSelection}
                  disabled={selectedDoctors.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  確認選擇
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

// 醫師卡片組件
const DoctorCard = ({ doctor, selected, disabled, onToggle }) => {
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
        disabled
          ? 'bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed'
          : selected
          ? 'bg-blue-50 border-blue-400 shadow-md'
          : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* 選擇框 */}
        {!disabled && (
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
            selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
          }`}>
            {selected && <CheckCircle className="w-4 h-4 text-white" />}
          </div>
        )}

        {/* 醫師頭像 */}
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
          {doctor.name?.charAt(0) || 'U'}
        </div>

        {/* 醫師資訊 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-gray-900">{doctor.name}</p>
            {selected && !disabled && (
              <span className="text-xs text-blue-600 font-medium">已選</span>
            )}
          </div>
          
          {/* 進度條 */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  doctor.shift_percentage >= 80 
                    ? 'bg-red-500' 
                    : doctor.shift_percentage >= 60 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(doctor.shift_percentage, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-600">{doctor.shift_percentage}%</span>
          </div>

          {/* 統計 */}
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>本月 {doctor.total_shifts}天</span>
            <span className={doctor.weekly_shifts >= 3 ? 'text-red-600 font-semibold' : ''}>
              本週 {doctor.weekly_shifts}天
            </span>
            {doctor.last_shift_date && (
              <span>上次: {new Date(doctor.last_shift_date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span>
            )}
          </div>

          {/* 不可選原因 */}
          {disabled && doctor.unavailable_reason && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="w-3 h-3" />
              <span>
                {doctor.unavailable_reason === 'weekly_limit' && '本週已達上限（3天）'}
                {doctor.unavailable_reason === 'must_rest' && '值班後需休息'}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};

export default AssistantShiftManagePage;