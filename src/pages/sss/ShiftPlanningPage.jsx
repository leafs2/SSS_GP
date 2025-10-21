import React, { useState } from 'react';
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
  CircleDashed
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';

const ShiftPlanningPage = () => {
  // 當前週的日期
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [editMode, setEditMode] = useState(false);

  // 個人排班資料 - 手術日會是全天
  const [personalSchedule, setPersonalSchedule] = useState({
    '週一': { type: 'surgery', label: '手術', fullDay: true },
    '週二上午': { type: 'clinic', label: '看診' },
    '週二下午': { type: 'flexible', label: '彈性' },
    '週三': { type: 'off', label: '休假', fullDay: true },
    '週四上午': { type: 'clinic', label: '看診' },
    '週四下午': { type: 'clinic', label: '看診' },
    '週五': { type: 'surgery', label: '手術', fullDay: true },
    '週六上午': { type: 'clinic', label: '看診' },
    '週六下午': { type: 'flexible', label: '彈性' },
    '週日': { type: 'off', label: '休假', fullDay: true },
  });

  // 科別整合排班資料 - 列出各時段的醫師名單
  const [departmentSchedule] = useState({
    '週一上午': { 
      surgery: ['陳醫師', '林醫師'], 
      clinic: ['王醫師'], 
      off: ['張醫師'], 
      flexible: [] 
    },
    '週一下午': { 
      surgery: ['陳醫師', '林醫師'], 
      clinic: ['王醫師'], 
      off: ['張醫師'], 
      flexible: [] 
    },
    '週二上午': { 
      surgery: ['林醫師'], 
      clinic: ['陳醫師', '王醫師'], 
      off: [], 
      flexible: ['張醫師'] 
    },
    '週二下午': { 
      surgery: ['林醫師'], 
      clinic: ['王醫師'], 
      off: ['陳醫師'], 
      flexible: ['張醫師'] 
    },
    '週三上午': { 
      surgery: ['王醫師'], 
      clinic: ['林醫師', '張醫師'], 
      off: ['陳醫師'], 
      flexible: [] 
    },
    '週三下午': { 
      surgery: ['王醫師'], 
      clinic: ['張醫師'], 
      off: ['陳醫師'], 
      flexible: ['林醫師'] 
    },
    '週四上午': { 
      surgery: [], 
      clinic: ['陳醫師', '林醫師', '王醫師'], 
      off: ['張醫師'], 
      flexible: [] 
    },
    '週四下午': { 
      surgery: [], 
      clinic: ['陳醫師', '林醫師'], 
      off: ['張醫師'], 
      flexible: ['王醫師'] 
    },
    '週五上午': { 
      surgery: ['陳醫師', '林醫師'], 
      clinic: ['張醫師'], 
      off: [], 
      flexible: ['王醫師'] 
    },
    '週五下午': { 
      surgery: ['陳醫師', '林醫師'], 
      clinic: ['張醫師'], 
      off: [], 
      flexible: ['王醫師'] 
    },
    '週六上午': { 
      surgery: ['王醫師'], 
      clinic: ['陳醫師', '林醫師'], 
      off: ['張醫師'], 
      flexible: [] 
    },
    '週六下午': { 
      surgery: ['王醫師'], 
      clinic: ['林醫師'], 
      off: ['張醫師'], 
      flexible: ['陳醫師'] 
    },
    '週日上午': { 
      surgery: [], 
      clinic: [], 
      off: ['陳醫師', '林醫師', '王醫師', '張醫師'], 
      flexible: [] 
    },
    '週日下午': { 
      surgery: [], 
      clinic: [], 
      off: ['陳醫師', '林醫師', '王醫師', '張醫師'], 
      flexible: [] 
    },
  });

  const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  const periods = ['上午', '下午'];

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
    
    // 如果選擇手術，設定為全天
    if (type === 'surgery' || type === 'off') {
      setPersonalSchedule({
        ...personalSchedule,
        [day]: { type, label: type === 'surgery' ? '手術' : '休假', fullDay: true },
        [`${day}上午`]: undefined,
        [`${day}下午`]: undefined,
      });
    } else {
      // 如果是看診或彈性，需要分上下午
      const key = `${day}${period}`;
      const labels = {
        clinic: '看診',
        flexible: '彈性'
      };
      
      // 移除全天排班
      const newSchedule = { ...personalSchedule };
      delete newSchedule[day];
      
      newSchedule[key] = { type, label: labels[type] };
      setPersonalSchedule(newSchedule);
    }
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
    return personalSchedule[`${day}${period}`];
  };

  // 儲存排班
  const handleSave = () => {
    setEditMode(false);
    alert('排班已儲存！');
  };

  // 取消編輯
  const handleCancel = () => {
    setEditMode(false);
  };

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        {/* 使用 PageHeader 組件 */}
        <PageHeader 
          title="排班規劃" 
          subtitle="外科部門"
        >
        </PageHeader>

        {/* 主要內容區域 */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            {/* 上方：個人排班區域 */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-800">我的排班</h2>
                <div className="flex items-center gap-3">
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
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Edit className="w-4 h-4" />
                      編輯排班
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        <Save className="w-4 h-4" />
                        儲存
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium"
                      >
                        <X className="w-4 h-4" />
                        取消
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 編輯模式提示 - 移到這裡 */}
              {editMode && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <span>手術/休假為全天，看診/彈性可分時段</span>
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
                          
                          // 如果是全天排班且不是第一個時段，跳過此格子
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
                  <span>外科 - 4位醫師</span>
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
                          {/* 時段欄位 - 只在第一個類型時顯示 */}
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
                          
                          {/* 類型欄位 */}
                          <td className={`border border-gray-300 p-2 ${scheduleType.bgClass} align-middle`}>
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className={scheduleType.iconColor}>{scheduleType.icon}</span>
                              <span className={`text-xs font-bold ${scheduleType.textColor}`}>
                                {scheduleType.label}
                              </span>
                            </div>
                          </td>
                          
                          {/* 各天的醫師 */}
                          {weekDays.map((day) => {
                            const key = `${day}${period}`;
                            const stats = departmentSchedule[key];
                            const doctors = stats[scheduleType.type] || [];
                            
                            // 特殊處理：週日全體休假
                            const isAllOff = scheduleType.type === 'off' && day === '週日' && 
                                            doctors.length === 4;
                            
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