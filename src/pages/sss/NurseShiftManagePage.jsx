// pages/sss/NurseShiftManagePage.jsx
// 護士排班輪值管理頁面 - 僅限有權限的護士使用

import React, { useState, useEffect } from 'react';
import { 
  Sunrise,
  Sunset,
  Moon,
  Building2,
  Plus,
  X,
  Search,
  UserPlus,
  Trash2,
  Sparkles,
  Save,
  AlertCircle,
  Info,
  CheckSquare,
  Square,
  Shuffle,
  Lock,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  Clock
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../../pages/login/AuthContext';
import { useDepartmentNurses, saveBatchNurseSchedule, useShiftAssignments } from '../../hooks/useNurseSchedule';
import { useSurgeryRoomTypes } from '../../hooks/useSurgeryRooms';
// 引入修改後的 Service 函式
import { checkAlgorithmHealth, runAutoScheduleForShift } from '../../services/algorithmService';

const NurseShiftManagePage = () => {
  const { user } = useAuth();
  const userDepartment = user?.department_name || '外科部門';
  
  // 當前選擇的時段
  const [selectedShift, setSelectedShift] = useState('morning');
  
  // 排班執行範圍 ('single' | 'all')
  const [scheduleScope, setScheduleScope] = useState('single');

  // 追蹤連續排班的當前步驟 (null | 'morning' | 'evening' | 'night')
  const [currentSequenceStep, setCurrentSequenceStep] = useState(null);

  // 使用真實 API 獲取科別護士列表（根據當前時段過濾）
  const { 
    nurses: availableNurses, 
    isLoading: nursesLoading, 
    error: nursesError 
  } = useDepartmentNurses(selectedShift); 

  // 使用真實 API 獲取手術室類型和數量（根據時段）
  const { 
    roomTypes: surgeryRoomTypes, 
    isLoading: roomTypesLoading, 
    error: roomTypesError 
  } = useSurgeryRoomTypes(selectedShift); 

  // 載入當前時段的排班資料
  const {
    assignments: savedAssignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
    refetch: refetchAssignments
  } = useShiftAssignments(selectedShift);
  
  // 模態框狀態
  const [showAddNurseModal, setShowAddNurseModal] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNurseIds, setSelectedNurseIds] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  
  // 演算法結果狀態
  const [algorithmResults, setAlgorithmResults] = useState(null);
  
  // 手術室類型和分配的護士 (前端本地狀態)
  const [roomTypeAssignments, setRoomTypeAssignments] = useState({
    morning: {},
    evening: {},
    night: {}
  });

  // 當手術室類型載入完成後，初始化分配狀態
  useEffect(() => {
    if (surgeryRoomTypes && surgeryRoomTypes.length > 0) {
      setRoomTypeAssignments(prev => {
        const updated = { ...prev };
        if (!updated[selectedShift]) {
          updated[selectedShift] = {};
        }
        surgeryRoomTypes.forEach(roomType => {
          if (!updated[selectedShift][roomType.type]) {
            updated[selectedShift][roomType.type] = [];
          }
        });
        return updated;
      });
    }
  }, [surgeryRoomTypes, selectedShift]);

  // 當資料庫排班資料載入完成後，更新到對應的時段
  // 這是保持前端資料與後端同步的關鍵
  useEffect(() => {
    if (savedAssignments && surgeryRoomTypes) {
      setRoomTypeAssignments(prev => {
        const updated = { ...prev };
        updated[selectedShift] = {};
        surgeryRoomTypes.forEach(roomType => {
          updated[selectedShift][roomType.type] = [];
        });
        if (Object.keys(savedAssignments).length > 0) {
          Object.keys(savedAssignments).forEach(roomType => {
            if (savedAssignments[roomType] && Array.isArray(savedAssignments[roomType])) {
              updated[selectedShift][roomType] = savedAssignments[roomType];
            }
          });
        }
        return updated;
      });
    }
  }, [savedAssignments, selectedShift, surgeryRoomTypes]);

  const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

  // 獲取班別資訊
  const getShiftInfo = (shift) => {
    switch (shift) {
      case 'morning':
        return {
          label: '早班',
          time: '08:00 - 16:00',
          icon: <Sunrise className="w-5 h-5" />,
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-300',
          textColor: 'text-amber-700',
          iconColor: 'text-amber-500'
        };
      case 'evening':
        return {
          label: '晚班',
          time: '16:00 - 24:00',
          icon: <Sunset className="w-5 h-5" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-300',
          textColor: 'text-green-700',
          iconColor: 'text-green-500'
        };
      case 'night':
        return {
          label: '大夜班',
          time: '00:00 - 08:00',
          icon: <Moon className="w-5 h-5" />,
          bgColor: 'bg-indigo-50',
          borderColor: 'border-indigo-300',
          textColor: 'text-indigo-700',
          iconColor: 'text-indigo-500'
        };
      default:
        return null;
    }
  };

  // 檢查手術室是否可在當前時段操作
  const isRoomAvailableForShift = (roomType) => {
    if (selectedShift === 'night') {
      return roomType === 'RE';
    }
    return true;
  };

  // 切換勾選護士
  const toggleNurseSelection = (nurseId) => {
    setSelectedNurseIds(prev => 
      prev.includes(nurseId)
        ? prev.filter(id => id !== nurseId)
        : [...prev, nurseId]
    );
  };

  // 全選/取消全選
  const toggleSelectAll = () => {
    const filteredNurses = getFilteredNurses();
    if (selectedNurseIds.length === filteredNurses.length) {
      setSelectedNurseIds([]);
    } else {
      setSelectedNurseIds(filteredNurses.map(n => n.id));
    }
  };

  // 批次新增護士到手術室類型
  const handleBatchAddNurses = () => {
    if (!selectedRoomType || selectedNurseIds.length === 0) {
      alert('請至少選擇一位護士');
      return;
    }

    const nursesToAdd = availableNurses.filter(n => selectedNurseIds.includes(n.id));
    const isEmergencyRoom = selectedRoomType === 'RE';
    
    setRoomTypeAssignments(prev => ({
      ...prev,
      [selectedShift]: {
        ...prev[selectedShift],
        [selectedRoomType]: [
          ...prev[selectedShift][selectedRoomType],
          ...nursesToAdd.map(nurse => ({ 
            ...nurse, 
            dayOff: isEmergencyRoom ? [] : [6]
          }))
        ]
      }
    }));

    setShowAddNurseModal(false);
    setSearchQuery('');
    setSelectedNurseIds([]);
  };

  // 開啟新增護士模態框
  const openAddNurseModal = (roomType) => {
    setSelectedRoomType(roomType);
    setSelectedNurseIds([]);
    setShowAddNurseModal(true);
  };

  // 關閉新增護士模態框
  const closeAddNurseModal = () => {
    setShowAddNurseModal(false);
    setSearchQuery('');
    setSelectedNurseIds([]);
  };

  // 移除護士
  const handleRemoveNurse = (roomType, nurseId) => {
    setRoomTypeAssignments(prev => ({
      ...prev,
      [selectedShift]: {
        ...prev[selectedShift],
        [roomType]: prev[selectedShift][roomType].filter(n => n.id !== nurseId)
      }
    }));
  };

  // 切換休假日
  const toggleDayOff = (roomType, nurseId, dayIndex) => {
    setRoomTypeAssignments(prev => {
      const updatedNurses = prev[selectedShift][roomType].map(nurse => {
        if (nurse.id === nurseId) {
          const currentDayOff = nurse.dayOff || [];
          const isEmergencyRoom = roomType === 'RE';
          
          if (isEmergencyRoom) {
            const newDayOff = currentDayOff.includes(dayIndex)
              ? currentDayOff.filter(d => d !== dayIndex)
              : currentDayOff.length < 2
                ? [...currentDayOff, dayIndex].sort()
                : currentDayOff;
            return { ...nurse, dayOff: newDayOff };
          } else {
            const SUNDAY = 6;
            if (dayIndex === SUNDAY) return nurse;
            
            if (currentDayOff.includes(dayIndex)) {
              return { ...nurse, dayOff: currentDayOff.filter(d => d !== dayIndex) };
            } else {
              const otherDays = currentDayOff.filter(d => d !== SUNDAY);
              if (otherDays.length < 1) {
                return { ...nurse, dayOff: [...currentDayOff, dayIndex].sort() };
              }
              return { ...nurse, dayOff: [SUNDAY, dayIndex].sort() };
            }
          }
        }
        return nurse;
      });

      return {
        ...prev,
        [selectedShift]: {
          ...prev[selectedShift],
          [roomType]: updatedNurses
        }
      };
    });
  };

  // 過濾可用護士
  const getFilteredNurses = () => {
    if (!selectedRoomType || !availableNurses) return [];
    
    const currentShiftAssignedIds = new Set();
    Object.values(currentAssignments).forEach(nurses => {
      nurses.forEach(nurse => currentShiftAssignedIds.add(nurse.id));
    });
    
    return availableNurses
      .filter(nurse => !currentShiftAssignedIds.has(nurse.id))
      .filter(nurse => 
        nurse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nurse.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
  };

  // 關閉輪班彈窗
  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setScheduleError(null);
    setAlgorithmResults(null);
    setCurrentSequenceStep(null);
  };

  // --------------------------------------------------------
  // 觸發排班流程 (Entry Point)
  // --------------------------------------------------------
  const handleAutoSchedule = () => {
    setShowScheduleModal(true);
    setScheduleError(null);
    setAlgorithmResults(null);
    setCurrentSequenceStep(null);
  };

  // 執行並顯示特定時段的結果 (使用 Service)
  // 這裡我們依賴後端 Service 讀取資料庫中已經 "分類好" 的資料
  const executeAndShowShift = async (shift) => {
    try {
      // 呼叫 Service 層的函式 (該函式內部使用 fetch)
      // 注意：這會基於資料庫中目前的 savedAssignments 進行運算
      const response = await runAutoScheduleForShift(shift);
      
      if (!response.data || response.data.results.length === 0) {
        throw new Error(`${getShiftInfo(shift).label} 沒有產生任何排班結果。請確認您是否已新增護士並點擊「儲存設定」。`);
      }

      setAlgorithmResults({
        shift: shift, // 記錄這是哪個時段的結果
        ...response.data // 展開 Service 回傳的 results, assignments, floatSchedules
      });
      setScheduleLoading(false);
    } catch (error) {
      throw error;
    }
  };

  // 處理一鍵輪班按鈕點擊
  const handleQuickSchedule = async (scopeOverride) => {
    try {
      const effectiveScope = scopeOverride || scheduleScope;
      
      // 更新狀態以供後續步驟使用
      if (scopeOverride) {
        setScheduleScope(scopeOverride);
      }

      setScheduleLoading(true);
      setScheduleError(null);
      setAlgorithmResults(null);

      // 檢查服務狀態
      const healthCheck = await checkAlgorithmHealth();
      if (!healthCheck.healthy) throw new Error('演算法服務未啟動');
      if (!surgeryRoomTypes || surgeryRoomTypes.length === 0) throw new Error('無法取得手術室類型資訊');

      if (effectiveScope === 'single') {
        // 單一時段模式：只處理當前選擇的時段
        await executeAndShowShift(selectedShift);
      } else {
        // 全時段模式：從早班開始
        setCurrentSequenceStep('morning');
        await executeAndShowShift('morning');
      }

    } catch (error) {
      console.error('❌ 排班失敗:', error);
      setScheduleError(error.message);
      setScheduleLoading(false);
    }
  };

  // --------------------------------------------------------
  // 應用結果並 (可能) 進入下一階段
  // --------------------------------------------------------
  const handleApplyAlgorithmResults = async () => {
    if (!algorithmResults) return;

    try {
      setScheduleLoading(true);

      const currentShift = algorithmResults.shift;
      const shiftMapping = { 'morning': '早班', 'evening': '晚班', 'night': '大夜班' };
      const shiftName = shiftMapping[currentShift];

      console.log(`正在寫入 ${shiftName} 資料...`);

      // 1. 寫入資料庫
      const { assignments, floatSchedules } = algorithmResults;

      // 使用 fetch 呼叫後端 API
      if (assignments && Object.keys(assignments).length > 0) {
        const fixedResponse = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/nurse-schedules/apply-algorithm-results`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shift: shiftName, assignments: assignments })
          }
        );
        if (!fixedResponse.ok) throw new Error(`${shiftName} 更新固定護士失敗`);
      }

      if (floatSchedules && Object.keys(floatSchedules).length > 0) {
        const floatResponse = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/nurse-schedules/apply-float-schedule`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shift: shiftName, floatSchedules: floatSchedules })
          }
        );
        if (!floatResponse.ok) throw new Error(`${shiftName} 更新流動護士失敗`);
      }

      // 2. 決定下一步
      if (scheduleScope === 'all') {
        if (currentSequenceStep === 'morning') {
          // 準備進入晚班
          setCurrentSequenceStep('evening');
          await executeAndShowShift('evening');
        } else if (currentSequenceStep === 'evening') {
          // 準備進入大夜班
          setCurrentSequenceStep('night');
          await executeAndShowShift('night');
        } else {
          // 全部完成
          alert('🎉 全時段排班順利完成！');
          closeScheduleModal();
          refetchAssignments();
        }
      } else {
        // 單一時段完成
        alert(`✅ ${shiftName} 排班更新完成！`);
        closeScheduleModal();
        refetchAssignments();
      }

    } catch (error) {
      console.error('更新資料庫失敗:', error);
      setScheduleError(error.message);
      setScheduleLoading(false);
    }
  };

  // 渲染單一時段結果的組件
  const RenderSingleShiftResult = ({ results, floatSchedules, shiftLabel, nurseNameMap }) => (
    <div className="space-y-4">
      {results.map(({ roomType, result }) => {
        return (
          <div key={roomType} className="bg-white rounded-lg p-4 border border-green-200">
            {/* 標題列 */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h4 className="font-bold text-gray-800 text-base">{roomType}</h4>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                  {shiftLabel}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>總成本: {result.total_cost.toFixed(2)}</span>
                <span className={result.metadata.optimal_solution ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                  {result.metadata.optimal_solution ? '✓ 最佳解' : '⚠ 次佳解'}
                </span>
              </div>
            </div>

            {/* 統計數據 */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-blue-50 rounded p-2">
                <p className="text-xs text-gray-600">固定護士</p>
                <p className="text-lg font-bold text-blue-700">
                  {result.assignments.filter(a => a.assigned_room).length}
                </p>
              </div>
              <div className="bg-purple-50 rounded p-2">
                <p className="text-xs text-gray-600">流動護士</p>
                <p className="text-lg font-bold text-purple-700">
                  {floatSchedules?.[roomType]?.summary?.total_float_nurses || 0}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-xs text-gray-600">手術室數</p>
                <p className="text-lg font-bold text-gray-700">
                  {Object.keys(result.room_assignments).length}
                </p>
              </div>
            </div>

            {/* 手術室分配詳情 (固定分配) */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600 mb-2">手術室分配詳情：</p>
              {Object.entries(result.room_assignments)
                // ★ 修正：加入手術室 ID 排序
                .sort(([roomIdA], [roomIdB]) => 
                  roomIdA.localeCompare(roomIdB, undefined, { numeric: true })
                )
                .map(([roomId, summary]) => (
                  <div key={roomId} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{roomId}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                          {summary.nurses.length} 位護士
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        總成本: {summary.total_cost?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    
                    {/* 該房間的護士列表 */}
                    <div className="space-y-1.5 mt-2">
                      {summary.nurses.map((nurseId, idx) => {
                        const fullAssignment = result.assignments.find(
                          a => a.employee_id === nurseId && a.assigned_room === roomId
                        );
                        
                        // 使用 nurseNameMap 反查名字
                        const nurseName = nurseNameMap?.[nurseId] || fullAssignment?.nurse_name || '未知';

                        return (
                          <div key={idx} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-gray-200">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-800">
                                {nurseName}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({nurseId})
                              </span>
                              {fullAssignment?.position && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                  位置 {fullAssignment.position}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              {fullAssignment && (
                                <span>成本: {fullAssignment.cost?.toFixed(2) || '0.00'}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
              ))}
            </div>

            {/* 流動護士分配詳情 */}
            {floatSchedules && floatSchedules[roomType] && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-medium text-purple-600 mb-2 flex items-center gap-1">
                  <Shuffle className="w-3 h-3" />
                  流動護士排班詳情：
                </p>
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2 text-left">
                    <div>
                      <span className="text-gray-600">流動護士數：</span>
                      <span className="font-medium text-purple-700 ml-1">
                        {floatSchedules[roomType].summary?.total_float_nurses || 0}
                      </span>
                    </div>
                  </div>
                  
                  {floatSchedules[roomType].schedule && floatSchedules[roomType].schedule.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {floatSchedules[roomType].schedule.map((floatNurse, idx) => {
                        const workDays = ['mon', 'tues', 'wed', 'thu', 'fri', 'sat', 'sun'].filter(
                          day => floatNurse[day] && floatNurse[day] !== null
                        ).length;

                        // 使用 nurseNameMap 反查流動護士名字
                        const nurseName = nurseNameMap?.[floatNurse.employee_id] || floatNurse.nurse_name || '未知';

                        return (    
                        <div key={idx} className="bg-white rounded px-3 py-2 border border-purple-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-purple-800">
                              {nurseName}
                            </span>
                            <span className="text-xs text-purple-600 ml-2">
                              ({floatNurse.employee_id})
                            </span>
                            <span className="text-xs text-purple-600 ml-auto">
                              工作 {workDays} 天
                            </span>
                          </div>
                          <div className="flex gap-1 text-xs">
                            {['mon', 'tues', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day, dayIdx) => {
                              const room = floatNurse[day];
                              const dayLabel = ['一', '二', '三', '四', '五', '六', '日'][dayIdx];
                              return (
                                <div 
                                  key={day} 
                                  className={`flex-1 text-center py-1 rounded ${
                                    room 
                                      ? 'bg-purple-100 text-purple-700 font-medium' 
                                      : 'bg-gray-100 text-gray-400'
                                  }`}
                                >
                                  <div>{dayLabel}</div>
                                  <div className="text-xs">{room || '-'}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                    )})}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // 儲存排班設定
  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setSaveError(null);

      let incompleteNurses = [];
      Object.entries(currentAssignments).forEach(([roomType, nurses]) => {
        nurses.forEach(nurse => {
          if (!nurse.dayOff || nurse.dayOff.length < 2) {
            incompleteNurses.push(`${nurse.name} (${roomType})`);
          }
        });
      });

      if (incompleteNurses.length > 0) {
        setSaveError(`以下護士尚未設定完整休假日：\n${incompleteNurses.join(', ')}`);
        setSaveLoading(false);
        return;
      }

      const result = await saveBatchNurseSchedule(selectedShift, currentAssignments);

      if (result.success) {
        alert(`儲存成功！\n${result.message}\n成功: ${result.data.successCount} 位`);
        setSaveError(null);
        refetchAssignments();
      } else {
        setSaveError(result.error || '儲存失敗');
      }
    } catch (error) {
      setSaveError(error.message || '儲存失敗，請稍後再試');
    } finally {
      setSaveLoading(false);
    }
  };

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const currentShiftInfo = getShiftInfo(selectedShift);
  const currentAssignments = roomTypeAssignments[selectedShift];
  const totalRoomsForShift = surgeryRoomTypes?.reduce((sum, rt) => sum + rt.roomCount, 0) || 0;

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        <PageHeader 
          title="排班輪值管理" 
          subtitle={userDepartment} 
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* 頂部控制列 */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg text-left font-bold text-gray-800">排班設定</h2>
                {selectedShift && (
                  <p className="text-sm text-gray-600 mt-1">
                    {currentShiftInfo.label} - 共 {totalRoomsForShift} 間手術室開放
                    {selectedShift === 'night' && (
                      <span className="ml-2 text-indigo-600 font-medium">
                        （僅急診手術室）
                      </span>
                    )}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAutoSchedule}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  一鍵輪班
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      儲存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      儲存設定
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 錯誤訊息 */}
            {saveError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">儲存失敗</p>
                  <p className="text-xs text-red-600 mt-1 whitespace-pre-line">{saveError}</p>
                </div>
                <button
                  onClick={() => setSaveError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 時段切換 */}
            <div className="mb-6">
              <div className="flex gap-3">
                {['morning', 'evening', 'night'].map(shift => {
                  const info = getShiftInfo(shift);
                  const isSelected = selectedShift === shift;
                  
                  return (
                    <button
                      key={shift}
                      onClick={() => setSelectedShift(shift)}
                      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? `${info.bgColor} ${info.borderColor}`
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <div className={isSelected ? info.iconColor : 'text-gray-400'}>
                          {info.icon}
                        </div>
                        <div className="text-left">
                          <p className={`text-sm font-bold ${
                            isSelected ? info.textColor : 'text-gray-700'
                          }`}>
                            {info.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {info.time}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 手術室類型區塊 */}
            <div className="space-y-4">
              {roomTypesLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-sm text-gray-500">載入手術室類型中...</p>
                </div>
              ) : roomTypesError ? (
                <div className="text-center py-12 text-red-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">載入手術室類型失敗</p>
                  <p className="text-xs mt-1">{roomTypesError.message}</p>
                </div>
              ) : surgeryRoomTypes && surgeryRoomTypes.length > 0 ? (
                surgeryRoomTypes.map(roomTypeData => {
                  const nurses = currentAssignments[roomTypeData.type] || [];
                  const isAvailable = isRoomAvailableForShift(roomTypeData.type);
                  
                  return (
                    <div 
                      key={roomTypeData.type}
                      className={`border-2 rounded-lg p-4 transition-colors ${
                        isAvailable 
                          ? 'border-gray-200 hover:border-gray-300' 
                          : 'border-gray-100 bg-gray-50 opacity-60'
                      }`}
                    >
                      {/* 手術室類型標題 */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {!isAvailable && (
                            <Lock className="w-5 h-5 text-gray-400" />
                          )}
                          <Building2 className={`w-5 h-5 ${isAvailable ? 'text-blue-600' : 'text-gray-400'}`} />
                          <div className="flex items-center gap-2">
                            <h3 className={`text-base font-bold ${isAvailable ? 'text-gray-800' : 'text-gray-500'}`}>
                              {roomTypeData.displayName || roomTypeData.type}
                            </h3>
                            {roomTypeData.displayName && (
                              <span className="text-sm text-gray-500">
                                ({roomTypeData.type})
                              </span>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isAvailable 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-gray-200 text-gray-500'
                          }`}>
                            {roomTypeData.roomCount} 間手術室
                          </span>
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                            {nurses.length} 位護士
                          </span>
                          {!isAvailable && (
                            <span className="px-2 py-1 bg-red-100 rounded text-xs text-red-600 font-medium">
                              此時段未開放
                            </span>
                          )}
                        </div>
                        
                        <button
                          onClick={() => openAddNurseModal(roomTypeData.type)}
                          disabled={!isAvailable}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                            isAvailable
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          新增護士
                        </button>
                      </div>

                      {/* 護士列表 */}
                      {isAvailable && nurses.length > 0 ? (
                        <div className="space-y-3">
                          {nurses.map(nurse => (
                            <div 
                              key={nurse.id}
                              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                            >
                              <div className="flex items-center justify-between gap-4">
                                {/* 護士資訊 */}
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <div className="flex-shrink-0">
                                    <p className="font-medium text-gray-800">
                                      {nurse.name}
                                      <span className="ml-2 text-xs text-gray-500">
                                        ({nurse.id})
                                      </span>
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      休假日：
                                      {nurse.dayOff && nurse.dayOff.length > 0
                                        ? nurse.dayOff.map(d => weekDays[d]).join('、')
                                        : '尚未設定'
                                      }
                                      {nurse.dayOff && nurse.dayOff.length < 2 && (
                                        <span className="text-amber-600 ml-1">
                                          {roomTypeData.type === 'RE' 
                                            ? `(選擇 ${2 - nurse.dayOff.length} 天)`
                                            : `(再選擇 ${2 - nurse.dayOff.length} 天)`
                                          }
                                        </span>
                                      )}
                                    </p>
                                  </div>

                                  {/* 休假日選擇器 */}
                                  <div className="flex items-center gap-2 flex-1">
                                    {weekDays.map((day, index) => {
                                      const isSelected = nurse.dayOff?.includes(index);
                                      const isEmergencyRoom = roomTypeData.type === 'RE';
                                      const isSunday = index === 6;
                                      
                                      let canSelect, isDisabled, isFixed;
                                      
                                      if (isEmergencyRoom) {
                                        canSelect = !isSelected && (nurse.dayOff?.length || 0) < 2;
                                        isDisabled = !isSelected && !canSelect;
                                        isFixed = false;
                                      } else {
                                        if (isSunday) {
                                          canSelect = false;
                                          isDisabled = false;
                                          isFixed = true;
                                        } else {
                                          const otherDays = (nurse.dayOff || []).filter(d => d !== 6);
                                          canSelect = !isSelected && otherDays.length < 1;
                                          isDisabled = !isSelected && !canSelect;
                                          isFixed = false;
                                        }
                                      }
                                      
                                      return (
                                        <button
                                          key={index}
                                          onClick={() => !isDisabled && !isFixed && toggleDayOff(roomTypeData.type, nurse.id, index)}
                                          disabled={isDisabled}
                                          className={`flex items-center gap-1 px-3 py-1.5 rounded border text-sm transition-colors ${
                                            isFixed
                                              ? 'bg-gray-200 border-gray-400 text-gray-700 cursor-not-allowed'
                                              : isSelected
                                                ? 'bg-blue-100 border-blue-400 text-blue-700'
                                                : isDisabled
                                                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                                  : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                                          }`}
                                          title={isFixed ? '固定休假日' : ''}
                                        >
                                          {isSelected ? (
                                            <CheckSquare className="w-3 h-3" />
                                          ) : (
                                            <Square className="w-3 h-3" />
                                          )}
                                          {day}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                
                                {/* 移除按鈕 */}
                                <button
                                  onClick={() => handleRemoveNurse(roomTypeData.type, nurse.id)}
                                  className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="移除護士"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : isAvailable ? (
                        <div className="text-center py-8 text-gray-400">
                          <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">尚未新增護士</p>
                          <p className="text-xs mt-1">點擊上方「新增護士」按鈕開始新增</p>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">此時段未開放此類型手術室</p>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">此時段暫無開放的手術室</p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* 新增護士模態框 */}
        {showAddNurseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    新增護士到 {selectedRoomType}
                  </h3>
                  {selectedNurseIds.length > 0 && (
                    <p className="text-sm text-blue-600 mt-1">
                      已選擇 {selectedNurseIds.length} 位護士
                    </p>
                  )}
                </div>
                <button
                  onClick={closeAddNurseModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="p-4 border-b border-gray-200 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜尋護士姓名或編號..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {getFilteredNurses().length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    {selectedNurseIds.length === getFilteredNurses().length ? (
                      <>
                        <CheckSquare className="w-4 h-4" />
                        取消全選
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4" />
                        全選 ({getFilteredNurses().length} 位)
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {nursesLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-500">載入護士列表中...</p>
                  </div>
                ) : nursesError ? (
                  <div className="text-center py-12 text-red-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">載入護士列表失敗</p>
                    <p className="text-xs mt-1">{nursesError.message}</p>
                  </div>
                ) : getFilteredNurses().length > 0 ? (
                  <div className="space-y-2">
                    {getFilteredNurses().map(nurse => {
                      const isSelected = selectedNurseIds.includes(nurse.id);
                      
                      return (
                        <button
                          key={nurse.id}
                          onClick={() => toggleNurseSelection(nurse.id)}
                          className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-all text-left ${
                            isSelected
                              ? 'bg-blue-50 border-blue-400'
                              : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium ${
                              isSelected ? 'text-blue-900' : 'text-gray-800'
                            }`}>
                              {nurse.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {nurse.id} · {nurse.departmentName || nurse.department || userDepartment}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      {searchQuery ? '找不到符合的護士' : '所有護士都已加入此類別'}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={closeAddNurseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchAddNurses}
                  disabled={selectedNurseIds.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  確認新增 {selectedNurseIds.length > 0 && `(${selectedNurseIds.length})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 一鍵輪班選項彈窗 */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* 標題 */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    一鍵輪班
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {scheduleScope === 'all' 
                      ? '全時段排班模式' 
                      : `${currentShiftInfo.label} · 單一時段排班`}
                  </p>
                </div>
                <button
                  onClick={closeScheduleModal}
                  disabled={scheduleLoading}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* 內容 */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* 錯誤訊息 */}
                {scheduleError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 font-medium">排班失敗</p>
                      <p className="text-xs text-red-600 mt-1 whitespace-pre-line">{scheduleError}</p>
                    </div>
                  </div>
                )}

                {/* 演算法結果顯示區 */}
                {algorithmResults && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3 mb-4">
                      <CheckSquare className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-green-800 font-medium">演算法執行成功</p>
                        <p className="text-xs text-green-600 mt-1">
                          目前顯示: {getShiftInfo(algorithmResults.shift).label} ({algorithmResults.results.length} 個類型)
                        </p>
                        {scheduleScope === 'all' && (
                          <div className="flex items-center gap-2 mt-2 text-xs">
                            {['morning', 'evening', 'night'].map((step, idx) => {
                              const stepInfo = getShiftInfo(step);
                              const isCompleted = 
                                (step === 'morning' && currentSequenceStep !== 'morning') ||
                                (step === 'evening' && currentSequenceStep === 'night');
                              const isCurrent = currentSequenceStep === step;

                              return (
                                <div key={step} className={`flex items-center ${isCurrent ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                                  {isCompleted ? <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" /> : <span className="mr-1">{idx + 1}.</span>}
                                  {stepInfo.label}
                                  {step !== 'night' && <ArrowRight className="w-3 h-3 mx-1 text-gray-300" />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 詳細結果 */}
                    <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
                        <RenderSingleShiftResult 
                          results={algorithmResults.results} 
                          floatSchedules={algorithmResults.floatSchedules}
                          shiftLabel={getShiftInfo(algorithmResults.shift).label}
                          nurseNameMap={algorithmResults.nurseNameMap}
                        />
                    </div>

                    {/* 應用結果按鈕 */}
                    <button
                      onClick={handleApplyAlgorithmResults}
                      disabled={scheduleLoading}
                      className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {scheduleLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          處理中...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {scheduleScope === 'all' 
                            ? (currentSequenceStep === 'night' 
                                ? '應用並完成排班' 
                                : `應用並繼續處理${currentSequenceStep === 'morning' ? '晚班' : '大夜班'}`)
                            : '應用此分配結果到資料庫'
                          }
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* 選項卡片 */}
                {!algorithmResults && (
                  <div className="space-y-4">
                    {/* 兩大操作按鈕 */}
                    <div className="grid grid-cols-1 gap-4">
                      {/* 選項 1: 僅目前時段 */}
                      <button
                        onClick={() => handleQuickSchedule('single')}
                        disabled={scheduleLoading}
                        className="flex flex-col items-center justify-center p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-gray-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Clock className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-3 transition-colors" />
                        <span className="text-lg font-bold text-gray-800 mb-1">
                          僅排目前時段
                        </span>
                        <span className="text-sm text-gray-500">
                          只計算並分配 {currentShiftInfo.label} 的人員
                        </span>
                      </button>

                      {/* 選項 2: 全時段連續排班 */}
                      <button
                        onClick={() => handleQuickSchedule('all')}
                        disabled={scheduleLoading}
                        className="flex flex-col items-center justify-center p-6 border-2 border-blue-200 bg-blue-50/30 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CalendarDays className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform mb-3" />
                        <span className="text-lg font-bold text-blue-900 mb-1">
                          全時段連續排班
                        </span>
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <span>早班</span>
                          <ArrowRight className="w-3 h-3" />
                          <span>晚班</span>
                          <ArrowRight className="w-3 h-3" />
                          <span>大夜班</span>
                        </div>
                        <span className="text-xs text-blue-600 mt-2">
                          * 將依序計算並請您確認每個時段的排班結果
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 載入中 */}
                {scheduleLoading && !algorithmResults && (
                  <div className="mt-6 flex flex-col items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-sm text-gray-600 font-medium">
                      {currentSequenceStep 
                        ? `正在計算 ${getShiftInfo(currentSequenceStep).label} 排班...` 
                        : '演算法執行中...'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">這可能需要幾秒鐘</p>
                  </div>
                )}
              </div>

              {/* 底部 */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={closeScheduleModal}
                  disabled={scheduleLoading}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default NurseShiftManagePage;