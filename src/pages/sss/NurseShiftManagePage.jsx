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
  Lock
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../../pages/login/AuthContext';
import { useDepartmentNurses, saveBatchNurseSchedule, useShiftAssignments } from '../../hooks/useNurseSchedule';
import { useSurgeryRoomTypes } from '../../hooks/useSurgeryRooms';
import { assignNursesWithHungarian, checkAlgorithmHealth, formatNursesForAlgorithm, formatRoomsForAlgorithm } from '../../services/algorithmService';

const NurseShiftManagePage = () => {
  const { user } = useAuth();
  const userDepartment = user?.department_name || '外科部門';
  
  // 當前選擇的時段
  const [selectedShift, setSelectedShift] = useState('morning');

  // 使用真實 API 獲取科別護士列表（根據當前時段過濾）
  const { 
    nurses: availableNurses, 
    isLoading: nursesLoading, 
    error: nursesError 
  } = useDepartmentNurses(selectedShift); // 傳入當前時段

  // 使用真實 API 獲取手術室類型和數量（根據時段）
  const { 
    roomTypes: surgeryRoomTypes, 
    isLoading: roomTypesLoading, 
    error: roomTypesError 
  } = useSurgeryRoomTypes(selectedShift); // 傳入當前時段

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
  const [algorithmResults, setAlgorithmResults] = useState(null);
  
  // 手術室類型和分配的護士
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
        
        // 只更新當前時段的資料
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
  useEffect(() => {
    console.log('🔄 savedAssignments 變化:', {
      shift: selectedShift,
      data: savedAssignments
    });
    
    if (savedAssignments && surgeryRoomTypes) {
      setRoomTypeAssignments(prev => {
        const updated = { ...prev };
        
        // 先清空當前時段的資料，避免混入其他時段資料
        updated[selectedShift] = {};
        
        // 初始化所有手術室類型
        surgeryRoomTypes.forEach(roomType => {
          updated[selectedShift][roomType.type] = [];
        });
        
        // 只有當 savedAssignments 有資料時才合併
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
    // 大夜班只能操作急診（RE）
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
    
    // 判斷是否為急診手術房
    const isEmergencyRoom = selectedRoomType === 'RE';
    
    setRoomTypeAssignments(prev => ({
      ...prev,
      [selectedShift]: {
        ...prev[selectedShift],
        [selectedRoomType]: [
          ...prev[selectedShift][selectedRoomType],
          ...nursesToAdd.map(nurse => ({ 
            ...nurse, 
            // 急診：空陣列；其他：預設週日(6)
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
          
          // 判斷是否為急診手術房（RE）
          const isEmergencyRoom = roomType === 'RE';
          
          if (isEmergencyRoom) {
            // 急診：可自由選擇任意兩天
            const newDayOff = currentDayOff.includes(dayIndex)
              ? currentDayOff.filter(d => d !== dayIndex)
              : currentDayOff.length < 2
                ? [...currentDayOff, dayIndex].sort()
                : currentDayOff;
            
            return { ...nurse, dayOff: newDayOff };
          } else {
            // 其他手術室：固定週日(6) + 自選一天
            const SUNDAY = 6;
            
            if (dayIndex === SUNDAY) {
              // 點擊週日：不允許取消
              return nurse;
            }
            
            // 點擊其他天
            if (currentDayOff.includes(dayIndex)) {
              // 取消選擇（但保留週日）
              return { 
                ...nurse, 
                dayOff: currentDayOff.filter(d => d !== dayIndex) 
              };
            } else {
              // 新增選擇
              const otherDays = currentDayOff.filter(d => d !== SUNDAY);
              if (otherDays.length < 1) {
                // 還可以選一天
                return { 
                  ...nurse, 
                  dayOff: [...currentDayOff, dayIndex].sort() 
                };
              }
              // 已經選滿，替換掉之前選的那天
              return { 
                ...nurse, 
                dayOff: [SUNDAY, dayIndex].sort() 
              };
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

  // 過濾可用護士（後端API已排除其他時段的護士，這裡排除當前時段所有手術室類型已分配的）
  const getFilteredNurses = () => {
    if (!selectedRoomType || !availableNurses) return [];
    
    // 收集當前時段所有手術室類型中已分配的護士 ID
    const currentShiftAssignedIds = new Set();
    Object.values(currentAssignments).forEach(nurses => {
      nurses.forEach(nurse => currentShiftAssignedIds.add(nurse.id));
    });
    
    return availableNurses
      .filter(nurse => !currentShiftAssignedIds.has(nurse.id)) // 排除當前時段已分配的護士
      .filter(nurse => 
        nurse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nurse.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
  };

  // 一鍵輪班
  const handleAutoSchedule = () => {
    setShowScheduleModal(true);
    setScheduleError(null);
    setAlgorithmResults(null);
  };

  // 關閉輪班彈窗
  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setScheduleError(null);
    setAlgorithmResults(null);
  };

  // 選項 1: 完整輪班（暫未實作）
  const handleFullSchedule = () => {
    alert('完整輪班功能開發中...\n此功能將包含：\n1. 跨週期輪班規劃\n2. 考慮休假歷史\n3. 公平性最佳化');
    closeScheduleModal();
  };

  // 選項 2: 使用現有資料進行排班（呼叫匈牙利演算法）
  const handleQuickSchedule = async () => {
    try {
      setScheduleLoading(true);
      setScheduleError(null);
      setAlgorithmResults(null);

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const ALGORITHM_API_URL = import.meta.env.VITE_ALGORITHM_API_URL || 'http://localhost:8000';

      // 檢查演算法服務
      const healthCheck = await checkAlgorithmHealth();
      if (!healthCheck.healthy) {
        throw new Error('演算法服務未啟動');
      }

      if (!surgeryRoomTypes || surgeryRoomTypes.length === 0) {
        throw new Error('當前時段沒有開放的手術室');
      }

      const shiftMapping = {
        'morning': '早班',
        'evening': '晚班',
        'night': '大夜'
      };
      const shiftName = shiftMapping[selectedShift];

      console.group('🚀 開始完整排班流程');
      console.log('時段:', shiftName);

      const allResults = [];
      const allAssignments = {};
      const allFloatSchedules = {};

      // 對每個手術室類型執行排班
      for (const roomTypeData of surgeryRoomTypes) {
        const roomType = roomTypeData.type;
        const nurses = currentAssignments[roomType] || [];
        
        if (nurses.length === 0) {
          console.warn(`⚠️ ${roomType} 沒有護士，跳過`);
          continue;
        }

        console.log(`\n━━━ 處理 ${roomType} ━━━`);

        // === 步驟 1: 獲取手術室列表並過濾 ===
        const dbShiftMapping = {
          'morning': 'morning_shift',
          'evening': 'night_shift',
          'night': 'graveyard_shift'
        };
        const dbShift = dbShiftMapping[selectedShift];

        const roomsResponse = await fetch(
          `${API_URL}/api/surgery-rooms/type/${encodeURIComponent(roomType)}?shift=${dbShift}`,
          {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (!roomsResponse.ok) {
          throw new Error(`無法獲取 ${roomType} 手術室列表`);
        }

        const roomsData = await roomsResponse.json();
        const allRooms = roomsData.data || [];

        // 過濾該時段開放的手術室
        const shiftFieldMapping = {
          'morning': 'morningShift',
          'evening': 'nightShift',
          'night': 'graveyardShift'
        };
        const shiftField = shiftFieldMapping[selectedShift];

        const rooms = allRooms.filter(room => room[shiftField] === true || room[shiftField] === 1);

        if (rooms.length === 0) {
          console.warn(`⚠️ ${roomType} 在 ${selectedShift} 時段沒有開放的手術室`);
          continue;
        }

        console.log(`手術室數量: ${rooms.length}`);

        // === 步驟 2: 執行匈牙利演算法（固定護士分配）===
        const formattedNurses = formatNursesForAlgorithm(
          nurses.map(n => ({
            ...n,
            roomType: roomType,
            schedulingTime: shiftName
          }))
        );

        const formattedRooms = formatRoomsForAlgorithm(rooms, roomType, selectedShift);

        const hungarianResult = await assignNursesWithHungarian({
          shift: shiftName,
          roomType: roomType,
          nurses: formattedNurses,
          rooms: formattedRooms,
          config: {
            cost_weights: {
              familiarity: 0.5,
              workload: 0.3,
              experience: 0.2
            }
          }
        });

        if (!hungarianResult.success) {
          throw new Error(`${roomType} 固定護士分配失敗: ${hungarianResult.error}`);
        }

        console.log(`✅ 固定護士分配完成`);

        const fixedAssignments = hungarianResult.data.assignments;
        allResults.push({
          roomType: roomType,
          result: hungarianResult.data
        });

        // === 步驟 3: 識別流動護士（surgery_room_id = null） ===
        const assignedNurseIds = new Set(
          fixedAssignments.map(a => a.employee_id)
        );

        const floatNurses = nurses
          .filter(n => !assignedNurseIds.has(n.id))
          .map(n => ({
            employee_id: n.id,
            name: n.name,
            day_off: n.dayOff || []
          }));

        console.log(`流動護士數量: ${floatNurses.length}`);

        if (floatNurses.length === 0) {
          console.log('⏭️ 沒有流動護士，跳過流動排班');
          allAssignments[roomType] = fixedAssignments;
          continue;
        }

        // === 步驟 4: 準備固定護士資料（用於計算空缺） ===
        const fixedAssignmentsByRoom = {};
        const roomRequirements = {};

        // 按手術室分組固定護士
        fixedAssignments.forEach(assignment => {
          const roomId = assignment.assigned_room;
          
          if (!fixedAssignmentsByRoom[roomId]) {
            fixedAssignmentsByRoom[roomId] = [];
          }

          // 找到原始護士資料（包含 dayOff）
          const nurseData = nurses.find(n => n.id === assignment.employee_id);
          
          fixedAssignmentsByRoom[roomId].push({
            employee_id: assignment.employee_id,
            day_off: nurseData?.dayOff || []
          });
        });

        // 設定每間手術室的需求人數
        rooms.forEach(room => {
          const nurseField = {
            'morning': 'morning_shift_nurses',
            'evening': 'night_shift_nurses',
            'night': 'graveyard_shift_nurses'
          }[selectedShift];

          roomRequirements[room.id] = parseInt(
            room[nurseField] || room.nurse_count || room.nurseCount || 3
          );
        });

        console.log('手術室需求:', roomRequirements);

        // === 步驟 5: 呼叫流動護士排班 API ===
        const floatScheduleResponse = await fetch(
          `${ALGORITHM_API_URL}/api/assignment/float-nurse-schedule`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shift: shiftName,
              room_type: roomType,
              float_nurses: floatNurses,
              fixed_assignments: fixedAssignmentsByRoom,
              room_requirements: roomRequirements,
              config: {
                strategy: 'balanced'  // 可選: 'balanced' 或 'room_priority'
              }
            })
          }
        );

        if (!floatScheduleResponse.ok) {
          const errorData = await floatScheduleResponse.json().catch(() => ({}));
          throw new Error(`流動護士排班失敗: ${errorData.detail || '未知錯誤'}`);
        }

        const floatScheduleData = await floatScheduleResponse.json();

        console.log(`✅ 流動護士排班完成`);
        console.log('空缺情況:', floatScheduleData.vacancies);
        console.log('流動護士排班:', floatScheduleData.schedule);

        // === 步驟 6: 合併結果 ===
        allAssignments[roomType] = fixedAssignments;
        allFloatSchedules[roomType] = floatScheduleData;
      }

      console.groupEnd();

      if (allResults.length === 0) {
        throw new Error('沒有可以進行排班的手術室類型');
      }

      // 儲存結果
      setAlgorithmResults({
        results: allResults,
        assignments: allAssignments,
        floatSchedules: allFloatSchedules  // 新增流動護士排班結果
      });

      alert(`✅ 完整排班成功！\n\n` +
        `固定護士分配: ${allResults.length} 個手術室類型\n` +
        `流動護士排班: ${Object.keys(allFloatSchedules).length} 個手術室類型`
      );

    } catch (error) {
      console.error('❌ 排班失敗:', error);
      setScheduleError(error.message);
    } finally {
      setScheduleLoading(false);
    }
  };


  // 應用完整排班結果到資料庫
  const handleApplyAlgorithmResults = async () => {
    if (!algorithmResults) return;

    try {
      setScheduleLoading(true);

      const shiftMapping = {
        'morning': '早班',
        'evening': '晚班',
        'night': '大夜'
      };
      const shiftName = shiftMapping[selectedShift];

      // 步驟 1: 更新固定護士分配
      const fixedResponse = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/nurse-schedules/apply-algorithm-results`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shift: shiftName,
            assignments: algorithmResults.assignments
          })
        }
      );

      if (!fixedResponse.ok) {
        const errorData = await fixedResponse.json();
        throw new Error(errorData.error || '更新固定護士失敗');
      }

      console.log('✅ 固定護士分配已更新');

      // 步驟 2: 更新流動護士排班
      if (algorithmResults.floatSchedules && Object.keys(algorithmResults.floatSchedules).length > 0) {
        const floatResponse = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/nurse-schedules/apply-float-schedule`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shift: shiftName,
              floatSchedules: algorithmResults.floatSchedules
            })
          }
        );

        if (!floatResponse.ok) {
          const errorData = await floatResponse.json();
          throw new Error(errorData.error || '更新流動護士失敗');
        }

        console.log('✅ 流動護士排班已更新');
      }

      alert(`✅ 成功更新資料庫！\n\n包含固定護士和流動護士排班`);
      
      // 重新載入排班資料
      refetchAssignments();
      
      // 關閉彈窗
      closeScheduleModal();

    } catch (error) {
      console.error('更新資料庫失敗:', error);
      setScheduleError(error.message);
    } finally {
      setScheduleLoading(false);
    }
  };


  // 儲存排班設定
  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setSaveError(null);

      // 檢查是否所有護士都已設定完整的休假日
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

      // 呼叫 API 儲存
      const result = await saveBatchNurseSchedule(selectedShift, currentAssignments);

      if (result.success) {
        alert(`儲存成功！\n${result.message}\n成功: ${result.data.successCount} 位`);
        setSaveError(null);
        
        // 重新載入排班資料
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

  // 計算當前時段的手術室總數
  const totalRoomsForShift = surgeryRoomTypes?.reduce((sum, rt) => sum + rt.roomCount, 0) || 0;

  // 監控時段切換和排班資料變化，輸出到 console
  useEffect(() => {
    console.group(`📋 時段切換: ${currentShiftInfo?.label || selectedShift}`);
    console.log('當前時段:', selectedShift);
    console.log('時段資訊:', currentShiftInfo);
    console.log('當前時段排班資料:', currentAssignments);
    console.log('所有時段排班資料:', roomTypeAssignments);
    console.groupEnd();
  }, [selectedShift, currentAssignments, savedAssignments, surgeryRoomTypes]);

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
                                      
                                      // 急診：可自由選擇任意兩天
                                      // 其他：週日固定，只能再選一天
                                      let canSelect, isDisabled, isFixed;
                                      
                                      if (isEmergencyRoom) {
                                        // 急診邏輯
                                        canSelect = !isSelected && (nurse.dayOff?.length || 0) < 2;
                                        isDisabled = !isSelected && !canSelect;
                                        isFixed = false;
                                      } else {
                                        // 其他手術室邏輯
                                        if (isSunday) {
                                          // 週日固定選中，不可取消
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

          {/* 提示訊息 - 移至最下方 */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-800 font-medium">
                排班輪值管理說明
              </p>
              <p className="text-xs text-blue-600 mt-1">
                1. 選擇時段（早班 25間 / 晚班 14間 / 大夜班 3間急診）<br />
                2. 為每個手術室類型新增護士<br />
                3. 設定每位護士的休假日（每週兩天）<br />
                4. 點擊「一鍵輪班」自動分配護士到特定手術室<br />
                5. 大夜班僅開放急診手術室（RE）排班
              </p>
            </div>
          </div>
        </main>

        {/* 新增護士模態框 */}
        {showAddNurseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              {/* 模態框標題 */}
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

              {/* 搜尋列和全選按鈕 */}
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

              {/* 護士列表 */}
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
                          {/* 勾選框 */}
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          
                          {/* 護士資訊 */}
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

              {/* 底部按鈕 */}
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
                    {currentShiftInfo.label} · 選擇排班方式
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

                {/* 演算法結果 */}
                {algorithmResults && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3 mb-4">
                      <CheckSquare className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-green-800 font-medium">演算法執行成功</p>
                        <p className="text-xs text-green-600 mt-1">
                          {currentShiftInfo.label} - 共處理 {algorithmResults.results.length} 個手術室類型
                        </p>
                      </div>
                    </div>

                    {/* 詳細結果 */}
                    <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
                      {algorithmResults.results.map(({ roomType, result }) => (
                        <div key={roomType} className="bg-white rounded-lg p-4 border border-green-200">
                          {/* 手術室類型標題 */}
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-5 h-5 text-blue-600" />
                              <h4 className="font-bold text-gray-800 text-base">{roomType}</h4>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                                {currentShiftInfo.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>總成本: {result.total_cost.toFixed(2)}</span>
                              <span>執行時間: {(result.metadata.execution_time * 1000).toFixed(0)}ms</span>
                              <span className={result.metadata.optimal_solution ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                                {result.metadata.optimal_solution ? '✓ 最佳解' : '⚠ 次佳解'}
                              </span>
                            </div>
                          </div>

                          {/* 統計摘要 */}
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
                                {algorithmResults.floatSchedules[roomType].summary?.total_float_nurses}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <p className="text-xs text-gray-600">手術室數</p>
                              <p className="text-lg font-bold text-gray-700">
                                {Object.keys(result.room_assignments).length}
                              </p>
                            </div>
                          </div>

                          {/* 手術室分配詳情 */}
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-600 mb-2">手術室分配詳情：</p>
                            {Object.entries(result.room_assignments).map(([roomId, summary]) => (
                              <div key={roomId} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800">{roomId}</span>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                      {summary.nurses.length} 位護士
                                    </span>
                                    {summary.complexity && (
                                      <span className={`px-2 py-0.5 text-xs rounded ${
                                        summary.complexity === 'high' 
                                          ? 'bg-red-100 text-red-700'
                                          : summary.complexity === 'medium'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-green-100 text-green-700'
                                      }`}>
                                        {summary.complexity === 'high' ? '高複雜度' : summary.complexity === 'medium' ? '中複雜度' : '低複雜度'}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    總成本: {summary.total_cost?.toFixed(2) || '0.00'}
                                  </span>
                                </div>
                                
                                {/* 護士列表 */}
                                <div className="space-y-1.5 mt-2">
                                  {summary.nurses.map((nurse, idx) => {
                                    // 找到對應的完整分配資料
                                    const fullAssignment = result.assignments.find(
                                      a => a.employee_id === nurse && a.assigned_room === roomId
                                    );
                                    const nurseName = fullAssignment?.nurse_name || '未知';
                                    return (
                                      <div key={idx} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-gray-200">
                                        <div className="flex items-center gap-3">
                                          <span className="text-sm font-medium text-gray-800">
                                            {nurseName}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            ({nurse || fullAssignment?.employee_id})
                                          </span>
                                          {fullAssignment?.position && (
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                              位置 {fullAssignment.position}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                          {fullAssignment && (
                                            <>
                                              <span>成本: {fullAssignment.cost?.toFixed(2) || '0.00'}</span>
                                              {fullAssignment.cost_breakdown && (
                                                <span className="text-gray-400">
                                                  (熟悉度:{fullAssignment.cost_breakdown.familiarity?.toFixed(1)} 
                                                  + 負荷:{fullAssignment.cost_breakdown.workload?.toFixed(1)}
                                                  + 資歷:{fullAssignment.cost_breakdown.experience?.toFixed(1)})
                                                </span>
                                              )}
                                            </>
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
                          {algorithmResults.floatSchedules && algorithmResults.floatSchedules[roomType] && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs font-medium text-purple-600 mb-2 flex items-center gap-1">
                                <Shuffle className="w-3 h-3" />
                                流動護士排班詳情：
                              </p>
                              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                  <div>
                                    <span className="text-gray-600">流動護士數：</span>
                                    <span className="font-medium text-purple-700 ml-1">
                                      {algorithmResults.floatSchedules[roomType].summary?.total_float_nurses || 0}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">總分配次數：</span>
                                    <span className="font-medium text-purple-700 ml-1">
                                      {algorithmResults.floatSchedules[roomType].summary?.total_assignments || 0}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* 流動護士每日分配 */}
                                {algorithmResults.floatSchedules[roomType].schedule && 
                                 algorithmResults.floatSchedules[roomType].schedule.length > 0 && (
                                  <div className="space-y-1.5 mt-2">
                                    {algorithmResults.floatSchedules[roomType].schedule.map((floatNurse, idx) => {
                                      const nurseData  = currentAssignments[roomType].find(
                                        n => n.id === floatNurse.employee_id
                                      );
                                      const nurseName = nurseData?.name || '未知';

                                      const workDays = ['mon', 'tues', 'wed', 'thu', 'fri', 'sat', 'sun'].filter(
                                        day => floatNurse[day] && floatNurse[day] !== null
                                      ).length;

                                      return (    
                                      <div key={idx} className="bg-white rounded px-3 py-2 border border-purple-200">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-sm font-medium text-purple-800">
                                            {nurseName} ({floatNurse.employee_id})
                                          </span>
                                          <span className="text-xs text-purple-600">
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
                      ))}
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
                          更新中...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          應用此分配結果到資料庫
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* 選項卡片 */}
                {!algorithmResults && (
                  <div className="space-y-4">
                    {/* 選項 2: 快速排班（匈牙利演算法）*/}
                    <button
                      onClick={handleQuickSchedule}
                      disabled={scheduleLoading}
                      className="w-full text-left p-6 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                          <Sparkles className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-gray-800 mb-1">
                            使用現有資料排班（推薦）
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            使用匈牙利演算法，根據當前已設定的護士和休假日，自動分配到具體手術室
                          </p>
                          <div className="space-y-1.5 text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                              <CheckSquare className="w-4 h-4 text-green-500" />
                              <span>考慮護士對手術室的熟悉度</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckSquare className="w-4 h-4 text-green-500" />
                              <span>平衡護士工作負荷</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckSquare className="w-4 h-4 text-green-500" />
                              <span>匹配護士資歷與手術室複雜度</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckSquare className="w-4 h-4 text-green-500" />
                              <span>找到總成本最小的最佳分配方案</span>
                            </div>
                          </div>
                          <div className="mt-3 px-3 py-1.5 bg-blue-100 rounded text-xs text-blue-700 inline-block">
                            ⚡ 快速執行 · 適合立即使用
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* 選項 1: 完整輪班（暫未實作）*/}
                    <button
                      onClick={handleFullSchedule}
                      disabled={scheduleLoading}
                      className="w-full text-left p-6 border-2 border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                          <Building2 className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
                            完整輪班規劃
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                              開發中
                            </span>
                          </h4>
                          <p className="text-sm text-gray-600 mb-3">
                            從零開始規劃整個排班週期，包含護士選擇、休假日設定、手術室分配
                          </p>
                          <div className="space-y-1.5 text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                              <Square className="w-4 h-4 text-gray-400" />
                              <span>跨週期輪班規劃</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Square className="w-4 h-4 text-gray-400" />
                              <span>考慮歷史休假記錄</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Square className="w-4 h-4 text-gray-400" />
                              <span>公平性最佳化</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Square className="w-4 h-4 text-gray-400" />
                              <span>自動平衡工作量</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {/* 載入中 */}
                {scheduleLoading && !algorithmResults && (
                  <div className="mt-6 flex flex-col items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-sm text-gray-600 font-medium">演算法執行中...</p>
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