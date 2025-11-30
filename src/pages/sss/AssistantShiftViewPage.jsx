// pages/sss/ShiftPlanningPage.jsx
// 排班規劃頁面 - 彈性時段自動推算版本

import React, { useState, useEffect } from 'react';
import { 
  Calendar,
  Stethoscope,
  Coffee,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Edit,
  Save,
  X,
  Scissors,
  Users,
  CircleDashed,
  Loader2,
  AlertCircle
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useMySchedule, useDepartmentSchedules } from '../../hooks/useSchedule';
import { fillFlexibleSlots } from '../../utils/scheduleDataTransformer';
import { useAuth } from '../../pages/login/AuthContext';

const ShiftPlanningPage = () => {
  const { user } = useAuth();
  const userDepartment = user?.department_name || '外科部門';
  const userDepartmentCode = user?.department_code || 'SURG';
  // 當前週的日期
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [editMode, setEditMode] = useState(false);

  const canEdit = user?.permission === '1';

  // 使用真實 API 資料
  const { 
    schedule: apiSchedule, 
    isLoading: scheduleLoading,
    error: scheduleError,
    updateSchedule,
    refetch: refetchSchedule
  } = useMySchedule();

  // 取得科別排班
  
  const { 
    schedules: departmentSchedules,
    isLoading: deptLoading,
    refetch: refetchDepartment
  } = useDepartmentSchedules(userDepartmentCode);

  // 個人排班資料（自動填充彈性時段）
  const [personalSchedule, setPersonalSchedule] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  const periods = ['上午', '下午'];

  // 當 API 資料載入完成後，初始化並填充彈性時段
  useEffect(() => {
    if (apiSchedule) {
      // 自動填充空白時段為彈性
      const filledSchedule = fillFlexibleSlots(apiSchedule);
      setPersonalSchedule(filledSchedule);
    }
  }, [apiSchedule]);

  // 獲取週的開始日期
  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  // 上一週
  const handlePrevWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  // 下一週
  const handleNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  // 格式化日期範圍
  const getWeekRange = () => {
    const start = new Date(currentWeekStart);
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    
    return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
  };

  // 獲取排班類型的樣式
  const getScheduleStyle = (type) => {
    switch (type) {
      case 'surgery':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'clinic':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'off':
        return 'bg-gray-100 text-gray-500 border-gray-300';
      case 'flexible':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      default:
        return 'bg-white text-gray-400 border-gray-200';
    }
  };

  // 獲取排班類型的圖標
  const getScheduleIcon = (type) => {
    switch (type) {
      case 'surgery':
        return <Scissors className="w-4 h-4" />;
      case 'clinic':
        return <Stethoscope className="w-4 h-4" />;
      case 'off':
        return <Coffee className="w-4 h-4" />;
      case 'flexible':
        return <CircleDashed className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // 處理個人排班修改
  const handleScheduleChange = (day, period, type) => {
    if (!editMode) return;
    
    const newSchedule = { ...personalSchedule };
    
    // 如果選擇手術或休假，設定為全天
    if (type === 'surgery' || type === 'off') {
      // 刪除該天的上午和下午
      delete newSchedule[`${day}上午`];
      delete newSchedule[`${day}下午`];
      
      // 設定全天排班
      newSchedule[day] = { 
        type, 
        label: type === 'surgery' ? '手術' : '休假', 
        fullDay: true,
        backendType: type === 'surgery' ? 'A' : 'E'
      };
    } 
    // 如果選擇彈性，刪除該時段（讓它變回空白）
    else if (type === 'flexible') {
      const key = `${day}${period}`;
      delete newSchedule[day]; // 確保沒有全天排班
      
      // 如果該時段有排班，刪除它
      if (newSchedule[key]) {
        delete newSchedule[key];
      }
      
      // 設定為彈性（但不會存入資料庫）
      newSchedule[key] = {
        type: 'flexible',
        label: '彈性',
        fullDay: false,
        backendType: null // 不存入資料庫
      };
    }
    // 如果選擇看診
    else if (type === 'clinic') {
      const key = `${day}${period}`;
      
      // 移除全天排班
      delete newSchedule[day];
      
      // 設定當前時段為看診
      newSchedule[key] = { 
        type: 'clinic', 
        label: '看診',
        fullDay: false,
        backendType: period === '上午' ? 'B' : 'C'
      };
      
      // 檢查另一個時段
      const otherPeriod = period === '上午' ? '下午' : '上午';
      const otherKey = `${day}${otherPeriod}`;
      
      // 如果另一個時段也是看診，合併為全天門診
      if (newSchedule[otherKey]?.type === 'clinic') {
        delete newSchedule[key];
        delete newSchedule[otherKey];
        newSchedule[day] = {
          type: 'clinic',
          label: '看診',
          fullDay: true,
          backendType: 'D'
        };
      } 
      // 如果另一個時段沒有排班或是彈性，設為彈性
      else if (!newSchedule[otherKey] || newSchedule[otherKey]?.type === 'flexible') {
        newSchedule[otherKey] = {
          type: 'flexible',
          label: '彈性',
          fullDay: false,
          backendType: null
        };
      }
    }
    
    setPersonalSchedule(newSchedule);
  };

  // 檢查某天是否為全天排班
  const isFullDaySchedule = (day) => {
    return personalSchedule[day]?.fullDay === true;
  };

  // 獲取特定時段的排班
  const getScheduleForPeriod = (day, period) => {
    // 先檢查是否有全天排班
    if (isFullDaySchedule(day)) {
      return personalSchedule[day];
    }
    // 否則返回該時段的排班
    const schedule = personalSchedule[`${day}${period}`];
    
    // 如果沒有排班，返回彈性
    if (!schedule) {
      return {
        type: 'flexible',
        label: '彈性',
        fullDay: false,
        backendType: null
      };
    }
    
    return schedule;
  };

  // 儲存排班
  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setSaveError(null);
      setSaveSuccess(false);

      // 過濾掉彈性時段（不存入資料庫）
      const scheduleToSave = {};
      Object.keys(personalSchedule).forEach(key => {
        const item = personalSchedule[key];
        // 只保留非彈性的排班
        if (item.type !== 'flexible') {
          scheduleToSave[key] = item;
        }
      });

      const result = await updateSchedule(scheduleToSave);
      
      if (result.success) {
        setSaveSuccess(true);
        setEditMode(false);
        
        // 重新載入科別排班
        refetchDepartment();
        
        // 3 秒後隱藏成功訊息
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(result.error?.message || '儲存失敗');
      }
    } catch (error) {
      setSaveError(error.message || '儲存失敗，請稍後再試');
    } finally {
      setSaveLoading(false);
    }
  };

  // 取消編輯
  const handleCancel = () => {
    setEditMode(false);
    // 恢復原始資料並填充彈性
    if (apiSchedule) {
      const filledSchedule = fillFlexibleSlots(apiSchedule);
      setPersonalSchedule(filledSchedule);
    }
    setSaveError(null);
  };

  // 將科別排班資料轉換為原本的格式
  const getDepartmentScheduleData = () => {
    const result = {};
    
    weekDays.forEach(day => {
      periods.forEach(period => {
        const key = `${day}${period}`;
        result[key] = {
          surgery: [],
          clinic: [],
          off: [],
          flexible: []
        };
      });
    });

    // 填入每位醫師的排班
    if (departmentSchedules && departmentSchedules.length > 0) {
      departmentSchedules.forEach(doctorSchedule => {
        const { doctorName, schedule } = doctorSchedule;
        
        if (!schedule) return;

        // 遍歷每一天
        weekDays.forEach(day => {
          // 先檢查是否有全天排班
          const fullDaySchedule = schedule[day];
          
          if (fullDaySchedule?.fullDay) {
            // 全天排班，兩個時段都算
            const type = fullDaySchedule.type;
            periods.forEach(period => {
              const key = `${day}${period}`;
              if (result[key][type]) {
                result[key][type].push(doctorName);
              }
            });
          } else {
            // 分時段排班
            periods.forEach(period => {
              const key = `${day}${period}`;
              const scheduleData = schedule[key];
              
              if (scheduleData) {
                const type = scheduleData.type;
                if (result[key][type]) {
                  result[key][type].push(doctorName);
                }
              } else {
                // 沒有排班的時段算彈性
                result[key].flexible.push(doctorName);
              }
            });
          }
        });
      });
    }

    return result;
  };

  const departmentSchedule = getDepartmentScheduleData();

  // Loading 狀態
  if (scheduleLoading || deptLoading) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader title="排班規劃" subtitle={userDepartment} />
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
  if (scheduleError) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader title="排班規劃" subtitle="外科部門" />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col items-center justify-center h-64">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-red-600 font-medium mb-2">載入排班資料失敗</p>
              <p className="text-gray-600 text-sm mb-4">
                {scheduleError.message || '請稍後再試'}
              </p>
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                onClick={refetchSchedule}
              >
                重新載入
              </button>
            </div>
          </main>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        <PageHeader 
          title="排班規劃" 
          subtitle={userDepartment} 
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            {/* 上方：個人排班區域 */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-800">我的排班</h2>
                <div className="flex items-center gap-3">
                  {saveSuccess && (
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                      <span>✓ 儲存成功</span>
                    </div>
                  )}

                  {/* 週切換 */}
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <button
                      onClick={handlePrevWeek}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
                        {getWeekRange()}
                      </span>
                    </div>
                    <button
                      onClick={handleNextWeek}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {/* 編輯/儲存按鈕 */}
                  {!editMode ? (
                    // 只有有權限的人才顯示編輯按鈕
                    canEdit && (
                      <button
                        onClick={() => setEditMode(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <Edit className="w-4 h-4" />
                        編輯排班
                      </button>
                    )
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saveLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {saveLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        儲存
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={saveLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        取消
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 編輯模式提示 */}
              {editMode && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <span>手術/休假為全天，看診可分時段，未排班時段自動為彈性</span>
                </div>
              )}

              {/* 錯誤訊息 */}
              {saveError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium text-sm">儲存失敗</p>
                    <p className="text-red-600 text-xs mt-1">{saveError}</p>
                  </div>
                </div>
              )}

              {/* 個人排班表格 */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-fixed">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 p-2 text-sm font-semibold text-gray-700 w-20">
                        時段
                      </th>
                      {weekDays.map(day => (
                        <th key={day} className="border border-gray-300 bg-gray-50 p-2 text-sm font-semibold text-gray-700">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period, periodIndex) => (
                      <tr key={period}>
                        <td className="border border-gray-300 bg-gray-50 p-2 text-center">
                          <div className="flex items-center justify-center gap-1 text-sm font-medium text-gray-700">
                            {period === '上午' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                            {period}
                          </div>
                        </td>
                        {weekDays.map(day => {
                          const schedule = getScheduleForPeriod(day, period);
                          const isFullDay = isFullDaySchedule(day);
                          const isFirstPeriod = periodIndex === 0;
                          
                          if (isFullDay && !isFirstPeriod) {
                            return null;
                          }
                          
                          return (
                            <td 
                              key={`${day}-${period}`} 
                              className="border border-gray-300 p-1"
                              rowSpan={isFullDay ? 2 : 1}
                            >
                              {editMode ? (
                                <div className="flex gap-1 justify-center flex-wrap">
                                  <button
                                    onClick={() => handleScheduleChange(day, period, 'surgery')}
                                    className={`flex-1 min-w-[40px] p-2 rounded border transition-colors ${
                                      schedule?.type === 'surgery' 
                                        ? 'bg-orange-100 border-orange-400' 
                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                    }`}
                                    title="手術（全天）"
                                  >
                                    <Scissors className="w-4 h-4 mx-auto text-orange-600" />
                                  </button>
                                  <button
                                    onClick={() => handleScheduleChange(day, period, 'clinic')}
                                    className={`flex-1 min-w-[40px] p-2 rounded border transition-colors ${
                                      schedule?.type === 'clinic' 
                                        ? 'bg-green-100 border-green-400' 
                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                    }`}
                                    title="看診"
                                  >
                                    <Stethoscope className="w-4 h-4 mx-auto text-green-600" />
                                  </button>
                                  <button
                                    onClick={() => handleScheduleChange(day, period, 'flexible')}
                                    className={`flex-1 min-w-[40px] p-2 rounded border transition-colors ${
                                      schedule?.type === 'flexible' 
                                        ? 'bg-purple-100 border-purple-400' 
                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                    }`}
                                    title="彈性"
                                  >
                                    <CircleDashed className="w-4 h-4 mx-auto text-purple-600" />
                                  </button>
                                  <button
                                    onClick={() => handleScheduleChange(day, period, 'off')}
                                    className={`flex-1 min-w-[40px] p-2 rounded border transition-colors ${
                                      schedule?.type === 'off' 
                                        ? 'bg-gray-100 border-gray-400' 
                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                    }`}
                                    title="休假（全天）"
                                  >
                                    <Coffee className="w-4 h-4 mx-auto text-gray-500" />
                                  </button>
                                </div>
                              ) : (
                                <div className={`flex items-center justify-center gap-2 rounded border ${
                                  isFullDay 
                                    ? 'h-full min-h-[120px] p-4' 
                                    : 'h-full p-3'
                                } ${getScheduleStyle(schedule?.type)}`}>
                                  {getScheduleIcon(schedule?.type)}
                                  <span className={`font-medium ${isFullDay ? 'text-base' : 'text-sm'}`}>
                                    {schedule?.label}
                                  </span>
                                  {isFullDay && (
                                    <span className="text-xs opacity-75">(全)</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 圖例 */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                <span className="text-xs font-medium text-gray-500">圖例：</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 px-2 py-1 rounded border bg-orange-100 text-orange-700 border-orange-300">
                    <Scissors className="w-3 h-3" />
                    <span className="text-xs">手術</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded border bg-green-100 text-green-700 border-green-300">
                    <Stethoscope className="w-3 h-3" />
                    <span className="text-xs">看診</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded border bg-purple-100 text-purple-700 border-purple-300">
                    <CircleDashed className="w-3 h-3" />
                    <span className="text-xs">彈性</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded border bg-gray-100 text-gray-500 border-gray-300">
                    <Coffee className="w-3 h-3" />
                    <span className="text-xs">休假</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 下方：科別整合排班區域 */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-800">科別整合排班</h2>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  <span>外科 - {departmentSchedules?.length || 0}位醫師</span>
                </div>
              </div>

              {/* 科別整合排班表格 */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse table-fixed">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-100 p-3 text-sm font-semibold text-gray-700" style={{width: '80px'}}>
                        時段
                      </th>
                      <th className="border border-gray-300 bg-gray-100 p-3 text-sm font-semibold text-gray-700" style={{width: '60px'}}>
                        類型
                      </th>
                      {weekDays.map(day => (
                        <th key={day} className="border border-gray-300 bg-gray-100 p-3 text-sm font-semibold text-gray-700">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) => {
                      const scheduleTypes = [
                        { 
                          type: 'surgery', 
                          label: '手術', 
                          icon: <Scissors className="w-3 h-3" />, 
                          bgClass: 'bg-orange-50',
                          iconColor: 'text-orange-600',
                          textColor: 'text-orange-700'
                        },
                        { 
                          type: 'clinic', 
                          label: '看診', 
                          icon: <Stethoscope className="w-3 h-3" />, 
                          bgClass: 'bg-green-50',
                          iconColor: 'text-green-600',
                          textColor: 'text-green-700'
                        },
                        { 
                          type: 'flexible', 
                          label: '彈性', 
                          icon: <CircleDashed className="w-3 h-3" />, 
                          bgClass: 'bg-purple-50',
                          iconColor: 'text-purple-600',
                          textColor: 'text-purple-700'
                        },
                        { 
                          type: 'off', 
                          label: '休假', 
                          icon: <Coffee className="w-3 h-3" />, 
                          bgClass: 'bg-gray-100',
                          iconColor: 'text-gray-600',
                          textColor: 'text-gray-700'
                        }
                      ];

                      return scheduleTypes.map((scheduleType, typeIdx) => (
                        <tr key={`${period}-${scheduleType.type}`}>
                          {typeIdx === 0 && (
                            <td 
                              className="border border-gray-300 bg-gray-50 p-3 text-center align-middle"
                              rowSpan={4}
                            >
                              <div className="flex flex-col items-center justify-center gap-1">
                                {period === '上午' ? 
                                  <Sun className="w-5 h-5 text-yellow-500" /> : 
                                  <Moon className="w-5 h-5 text-indigo-500" />
                                }
                                <span className="text-sm font-semibold text-gray-700">{period}</span>
                              </div>
                            </td>
                          )}
                          
                          <td className={`border border-gray-300 p-2 ${scheduleType.bgClass} align-middle`}>
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className={scheduleType.iconColor}>{scheduleType.icon}</span>
                              <span className={`text-xs font-bold ${scheduleType.textColor}`}>
                                {scheduleType.label}
                              </span>
                            </div>
                          </td>
                          
                          {weekDays.map((day) => {
                            const key = `${day}${period}`;
                            const stats = departmentSchedule[key];
                            const doctors = stats[scheduleType.type] || [];
                            
                            const isAllOff = scheduleType.type === 'off' && day === '週日' && 
                                            doctors.length === departmentSchedules?.length;
                            
                            return (
                              <td 
                                key={`${day}-${scheduleType.type}`} 
                                className={`border border-gray-300 p-2 ${scheduleType.bgClass} align-top`}
                              >
                                <div className="space-y-1 min-h-[50px] flex flex-col justify-center">
                                  {doctors.length > 0 ? (
                                    isAllOff ? (
                                      <div className="text-xs text-gray-800 text-center font-medium">
                                        全體
                                      </div>
                                    ) : (
                                      doctors.map((doctor, idx) => (
                                        <div key={idx} className="text-xs text-gray-800 text-center font-medium">
                                          {doctor}
                                        </div>
                                      ))
                                    )
                                  ) : (
                                    <div className="text-xs text-gray-400 text-center">—</div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default ShiftPlanningPage;