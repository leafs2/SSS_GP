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
  Lock
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../../pages/login/AuthContext';
import { useDepartmentNurses, saveBatchNurseSchedule, useShiftAssignments } from '../../hooks/useNurseSchedule';
import { useSurgeryRoomTypes } from '../../hooks/useSurgeryRooms';

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
    alert('一鍵輪班功能將會串接演算法，自動分配護士到特定手術室');
    // TODO: 實作演算法邏輯
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
      </div>
    </Layout>
  );
};

export default NurseShiftManagePage;