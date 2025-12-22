import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Play, CheckCircle, PlusCircle, Timer, Loader, Lock, AlertTriangle } from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import surgeryService from '../../services/surgeryService';

// --- Custom Hook: 處理計時與進度計算 ---
const useSurgeryTimer = (startTime, estimatedHours, extensionMinutes) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    
    const update = () => {
      // 確保 startTime 字串被正確解析 (後端已加 UTC，這裡會自動轉為本地時間)
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      // 避免時間差為負數 (防止未來時間導致錯誤)
      setElapsedMs(Math.max(0, now - start));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // 格式化時間 HH:MM:SS
  const formatElapsed = () => {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 計算進度百分比
  const calculateProgress = () => {
    const elapsedMinutes = elapsedMs / (1000 * 60);
    // 總目標時間 = (預計小時 * 60) + 延長分鐘
    const totalTargetMinutes = (Number(estimatedHours) * 60) + Number(extensionMinutes);
    
    if (totalTargetMinutes <= 0) return 0;
    
    const percent = (elapsedMinutes / totalTargetMinutes) * 100;
    return Math.min(100, Math.max(0, percent)); // 限制在 0-100%
  };

  return {
    elapsedTime: formatElapsed(),
    progressPercent: calculateProgress(),
    isOvertime: elapsedMs / (1000 * 60) > ((Number(estimatedHours) * 60) + Number(extensionMinutes))
  };
};

const Homepage = () => {
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchData();
    // 每分鐘更新一次 "currentTime" 以觸發按鈕狀態檢查
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      const data = await surgeryService.getTodaySurgeries();
      setSurgeries(data);
    } catch (error) {
      console.error("載入失敗", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 操作邏輯 ---
  const handleStart = async (id) => {
    if (window.confirm('確認開始手術並啟動計時？')) {
      await surgeryService.startSurgery(id);
      fetchData();
    }
  };

  const handleExtend = async (id) => {
    if (window.confirm('確認延長 30 分鐘？')) {
      await surgeryService.extendSurgery(id, 30);
      fetchData();
    }
  };

  const handleFinish = async (id) => {
    if (window.confirm('確認手術已結束？')) {
      await surgeryService.finishSurgery(id);
      fetchData();
    }
  };

  // --- 輔助函式 ---
  const mapDbStatusToUi = (status) => {
    if (status === 'scheduled' || status === 'pending') return 'upcoming';
    return status;
  };

  const filterSurgeries = (uiStatus) => {
    return surgeries.filter(s => mapDbStatusToUi(s.status) === uiStatus);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '--:--';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return timeStr.substring(0, 5);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const canStartSurgery = (scheduledTimeStr) => {
    if (!scheduledTimeStr) return false;
    const scheduledTime = new Date(scheduledTimeStr).getTime();
    const now = currentTime.getTime();
    return now >= (scheduledTime - 60 * 60 * 1000); // 1小時前開放
  };

  // --- 樣式設定 ---
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-50 border-green-200';
      case 'in-progress': return 'bg-blue-50 border-blue-200';
      case 'upcoming': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusBadge = (status, isStartable) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border border-green-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'upcoming': 
        // 如果進入1小時前 (可啟動) -> 黃色 "即將開始"
        // 否則 -> 灰色 "待執行"
        return isStartable 
          ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' 
          : 'bg-gray-100 text-gray-600 border border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getStatusText = (status, isStartable) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in-progress': return '進行中';
      case 'upcoming': 
        // 判斷文字顯示
        return isStartable ? '即將開始' : '待執行';
      default: return '未知';
    }
  };

  // --- 內嵌元件：計時與進度區塊 ---
  const TimerSection = ({ surgery }) => {
    const { elapsedTime, progressPercent, isOvertime } = useSurgeryTimer(
      surgery.actual_start_time, 
      surgery.estimated_duration_hours, 
      surgery.extension_minutes
    );

    // 計算總預計時間 (用於顯示)
    const totalExpectedMin = (Number(surgery.estimated_duration_hours) * 60) + Number(surgery.extension_minutes);
    const expectedHours = Math.floor(totalExpectedMin / 60);
    const expectedMins = totalExpectedMin % 60;

    return (
      <div className="mt-2 bg-white bg-opacity-70 p-3 rounded border border-blue-100 shadow-sm">
        {/* 計時器 Header */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
              <Timer className={`w-4 h-4 ${isOvertime ? 'text-red-600 animate-pulse' : 'text-blue-600 animate-pulse'}`} />
              <span className="text-xs text-gray-500 font-medium">已進行:</span>
              <span className={`font-mono font-bold ${isOvertime ? 'text-red-600' : 'text-blue-700'}`}>
                {elapsedTime}
              </span>
          </div>
          {surgery.extension_minutes > 0 && (
              <span className="text-xs text-red-500 font-bold flex items-center bg-red-50 px-1.5 py-0.5 rounded">
                <PlusCircle className="w-3 h-3 mr-1"/>
                延 {surgery.extension_minutes} 分
              </span>
          )}
        </div>

        {/* 進度條 */}
        <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>進度</span>
                <span>{Math.round(progressPercent)}% (預計 {expectedHours}時{expectedMins > 0 ? `${expectedMins}分` : ''})</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div 
                    className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${isOvertime ? 'bg-red-500' : 'bg-blue-500'}`} 
                    style={{ width: `${progressPercent}%` }}
                ></div>
            </div>
        </div>
        
        {/* 控制按鈕 */}
        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
          <button 
            onClick={() => handleExtend(surgery.surgery_id)} 
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
          >
            <PlusCircle className="w-3 h-3" /> 延長
          </button>
          <button 
            onClick={() => handleFinish(surgery.surgery_id)} 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
          >
            <CheckCircle className="w-3 h-3" /> 結束
          </button>
        </div>
      </div>
    );
  };

  // --- 卡片元件 ---
  const SurgeryCard = ({ surgery }) => {
    const uiStatus = mapDbStatusToUi(surgery.status);
    const isStartable = canStartSurgery(surgery.scheduled_start_time);

    return (
      <div className={`p-3 rounded-lg border-2 transition-all hover:shadow-md ${getStatusColor(uiStatus)}`}>
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-base text-gray-800 leading-tight">
              {surgery.surgery_name} - {surgery.patient_name}
            </h3>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(uiStatus)}`}>
            {getStatusText(uiStatus, isStartable)}
          </span>
        </div>
        
        {/* Info */}
        <div className="space-y-1.5 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>預定: {formatTime(surgery.scheduled_start_time)}</span>
            {/* 修正：單位改為小時 */}
            <span className="text-gray-400">({surgery.estimated_duration_hours}小時)</span>
          </div>
          
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            <span>{surgery.room_id || '未排房'}</span>
          </div>
          
          {/* --- 進行中：顯示計時與進度條區塊 --- */}
          {uiStatus === 'in-progress' && <TimerSection surgery={surgery} />}

          {/* --- 即將開始：按鈕邏輯 --- */}
          {uiStatus === 'upcoming' && (
            <div className="mt-2 pt-2 border-t border-yellow-200 border-opacity-50">
                {isStartable ? (
                  <button 
                    onClick={() => handleStart(surgery.surgery_id)} 
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-2 rounded flex items-center justify-center gap-1 transition-colors shadow-sm font-medium"
                  >
                    <Play className="w-3 h-3" /> 啟動手術
                  </button>
                ) : (
                  <button 
                    disabled
                    className="w-full bg-gray-200 text-gray-400 cursor-not-allowed text-xs py-2 rounded flex items-center justify-center gap-1 transition-colors"
                  >
                    <Lock className="w-3 h-3" /> 於預定一小時前開放
                  </button>
                )}
            </div>
          )}
          
          {/* --- 已完成 --- */}
          {uiStatus === 'completed' && (
            <div className="mt-2 text-xs text-gray-500 bg-green-50 p-2 rounded border border-green-100">
              <div className="flex items-center gap-1">
                 <CheckCircle className="w-3 h-3 text-green-600"/>
                 <span className="font-medium text-green-800">執行紀錄</span>
              </div>
              <p className="mt-1 pl-4 text-left">手術時間: {formatTime(surgery.actual_start_time)} ~ {formatTime(surgery.actual_end_time)}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="min-h-full">
        <PageHeader title="我的手術排程" subtitle="今日個人手術安排" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {loading ? (
             <div className="flex justify-center items-center h-64 gap-2 text-gray-500">
                <Loader className="w-6 h-6 animate-spin" />
                載入中...
             </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 h-[calc(100vh-360px)]">
                {/* 進行中 */}
                <div className="bg-white rounded-lg shadow flex flex-col border-t-4 border-blue-500">
                    <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-blue-50">
                        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        進行中 ({filterSurgeries('in-progress').length})
                        </h2>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
                        {filterSurgeries('in-progress').map(surgery => <SurgeryCard key={surgery.surgery_id} surgery={surgery} />)}
                        {filterSurgeries('in-progress').length === 0 && <div className="text-center text-gray-400 mt-10 text-sm">無進行中手術</div>}
                    </div>
                </div>

                {/* 即將開始 */}
                <div className="bg-white rounded-lg shadow flex flex-col border-t-4 border-yellow-500">
                    <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-yellow-50">
                        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        待執行 ({filterSurgeries('upcoming').length})
                        </h2>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
                        {filterSurgeries('upcoming').map(surgery => <SurgeryCard key={surgery.surgery_id} surgery={surgery} />)}
                        {filterSurgeries('upcoming').length === 0 && <div className="text-center text-gray-400 mt-10 text-sm">無待執行的手術</div>}
                    </div>
                </div>

                {/* 已完成 */}
                <div className="bg-white rounded-lg shadow flex flex-col border-t-4 border-green-500">
                    <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-green-50">
                        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        已完成 ({filterSurgeries('completed').length})
                        </h2>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-3">
                        {filterSurgeries('completed').map(surgery => <SurgeryCard key={surgery.surgery_id} surgery={surgery} />)}
                        {filterSurgeries('completed').length === 0 && <div className="text-center text-gray-400 mt-10 text-sm">無已完成手術</div>}
                    </div>
                </div>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
};

export default Homepage;