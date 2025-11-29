// pages/sss/NurseShiftViewPage.jsx
// 護士排班規劃頁面 - 查看模式（支援固定護士和流動護士）

import React, { useState, useEffect } from 'react';
import { 
  Calendar,
  Clock,
  Coffee,
  Sunrise,
  Sunset,
  Moon,
  Building2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  Info,
  Users,
  AlertTriangle,
  Shuffle
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../../pages/login/AuthContext';
import { 
  useMyNurseSchedule, 
  useDepartmentNurseSchedules,
  useFloatSchedule 
} from '../../hooks/useNurseSchedule';

const NurseShiftViewPage = () => {
  const { user } = useAuth();
  const userDepartment = user?.department_name || '外科部門';

  // 使用真實 API
  const { 
    schedule: nurseSchedule, 
    isLoading: scheduleLoading, 
    error: scheduleError 
  } = useMyNurseSchedule();

  const { 
    schedules: departmentSchedules, 
    isLoading: deptLoading 
  } = useDepartmentNurseSchedules();

  // 獲取流動護士排班
  const {
    floatSchedules,
    isLoading: floatLoading
  } = useFloatSchedule(nurseSchedule?.shift);

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
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-300',
          textColor: 'text-orange-700',
          iconColor: 'text-orange-500'
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

  const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  const dayFields = ['mon', 'tues', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const shifts = ['morning', 'evening', 'night'];

  // 🔥 新增：判斷是否為流動護士
  const isFloatNurse = nurseSchedule && !nurseSchedule.surgeryRoom;

  // 🔥 新增：獲取我的流動護士每日分配
  const getMyFloatSchedule = () => {
    if (!isFloatNurse || !floatSchedules || !user?.employee_id) {
      return null;
    }

    const mySchedule = floatSchedules.find(
      schedule => schedule.employee_id === user.employee_id
    );

    if (!mySchedule) return null;

    // 轉換為每日分配格式
    return {
      mon: mySchedule.mon,
      tues: mySchedule.tues,
      wed: mySchedule.wed,
      thu: mySchedule.thu,
      fri: mySchedule.fri,
      sat: mySchedule.sat,
      sun: mySchedule.sun
    };
  };

  const myFloatSchedule = getMyFloatSchedule();

  // 獲取我的手術室的固定護士夥伴（只有固定護士才有）
  const getMyRoommates = () => {
    if (isFloatNurse || !nurseSchedule?.surgeryRoom || !departmentSchedules) return [];
    
    return departmentSchedules.filter(
      nurse => 
        nurse.surgeryRoom === nurseSchedule.surgeryRoom &&
        nurse.shift === nurseSchedule.shift &&
        nurse.employeeId !== user?.employee_id
    );
  };

  // 獲取替代我的流動護士（我休假時 - 僅固定護士）
  const getMyReplacements = () => {
    if (isFloatNurse || !nurseSchedule?.surgeryRoom || !nurseSchedule?.dayOffWeek || !floatSchedules) {
      return {};
    }

    const replacements = {};
    const myRoom = nurseSchedule.surgeryRoom;

    nurseSchedule.dayOffWeek.forEach(dayIndex => {
      const dayField = dayFields[dayIndex];
      
      const floatNurse = floatSchedules.find(
        nurse => nurse[dayField] === myRoom
      );

      if (floatNurse) {
        replacements[dayIndex] = floatNurse;
      }
    });

    return replacements;
  };

  // 整理科別排班資料 - 只顯示已分配的手術室
  const organizeDepartmentSchedule = () => {
    if (!departmentSchedules || !nurseSchedule) return [];

    const myRoomType = nurseSchedule.surgeryRoomType;
    if (!myRoomType) return [];

    // 過濾出同手術室類型且已分配的護士
    const sameTypeNurses = departmentSchedules.filter(
      nurse => nurse.surgeryRoomType === myRoomType && nurse.surgeryRoom
    );

    // 按手術室分組
    const roomMap = new Map();
    
    sameTypeNurses.forEach(nurse => {
      const roomId = nurse.surgeryRoom;
      
      if (!roomMap.has(roomId)) {
        roomMap.set(roomId, {
          roomId: roomId,
          roomType: nurse.surgeryRoomType,
          isMyRoom: roomId === nurseSchedule.surgeryRoom,
          nursesByShift: {
            morning: [],
            evening: [],
            night: []
          },
          floatNursesByShift: {
            morning: {},
            evening: {},
            night: {}
          }
        });
      }
      
      const roomData = roomMap.get(roomId);
      const shift = nurse.shift || 'morning';
      
      if (roomData.nursesByShift[shift]) {
        roomData.nursesByShift[shift].push(nurse);
      }
    });

    // 🔥 修正：加入流動護士資料（支援所有時段）
    if (floatSchedules && floatSchedules.length > 0) {
      const dayFields = ['mon', 'tues', 'wed', 'thu', 'fri', 'sat', 'sun'];
      
      floatSchedules.forEach(floatNurse => {
        dayFields.forEach((dayField, dayIndex) => {
          const assignedRoom = floatNurse[dayField];
          
          if (assignedRoom && roomMap.has(assignedRoom)) {
            const roomData = roomMap.get(assignedRoom);
            
            // 🔥 修正：根據 floatNurse 本身的時段，而不是當前用戶的時段
            // 從 floatSchedules 中，每位流動護士應該有自己的時段資訊
            // 如果沒有，我們需要從 departmentSchedules 中查找
            
            let nurseShift = null;
            
            // 方法1: 如果 floatNurse 有 shift 欄位
            if (floatNurse.shift) {
              nurseShift = floatNurse.shift;
            } 
            // 方法2: 從 departmentSchedules 中查找該護士的時段
            else {
              const nurseInfo = departmentSchedules.find(
                n => n.employeeId === floatNurse.employee_id
              );
              nurseShift = nurseInfo?.shift || 'morning';
            }
            
            if (!roomData.floatNursesByShift[nurseShift][dayIndex]) {
              roomData.floatNursesByShift[nurseShift][dayIndex] = [];
            }
            
            roomData.floatNursesByShift[nurseShift][dayIndex].push(floatNurse);
          }
        });
      });
    }

    // 轉換為陣列並排序
    const roomSchedules = Array.from(roomMap.values()).sort((a, b) => {
      if (a.isMyRoom && !b.isMyRoom) return -1;
      if (!a.isMyRoom && b.isMyRoom) return 1;
      return a.roomId.localeCompare(b.roomId);
    });

    return roomSchedules;
  };

  const roomSchedules = organizeDepartmentSchedule();
  const myRoommates = getMyRoommates();
  const myReplacements = getMyReplacements();

  // Loading 狀態
  if (scheduleLoading || deptLoading || floatLoading) {
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
          <PageHeader title="排班規劃" subtitle={userDepartment} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col items-center justify-center h-64">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-red-600 font-medium mb-2">載入排班資料失敗</p>
              <p className="text-gray-600 text-sm">
                {scheduleError.message || '請稍後再試'}
              </p>
            </div>
          </main>
        </div>
      </Layout>
    );
  }

  const shiftInfo = nurseSchedule ? getShiftInfo(nurseSchedule.shift) : null;

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        <PageHeader 
          title="排班規劃" 
          subtitle={userDepartment} 
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            {/* 上方：我的排班區域 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 text-left">
                    我的排班
                    {isFloatNurse && (
                      <span className="ml-3 px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full inline-flex items-center gap-1">
                        <Shuffle className="w-4 h-4" />
                        流動護士
                      </span>
                    )}

                  </h2>
                  {nurseSchedule?.surgeryRoom && (
                    <p className="text-sm text-gray-600 mt-1">
                      手術室：<span className="font-medium text-blue-600">{nurseSchedule.surgeryRoom}</span>
                    </p>
                  )}
                  
                </div>
                
                <div className="flex items-center gap-4">
                  {/* 只有固定護士才顯示「我的固定夥伴」*/}
                  {!isFloatNurse && myRoommates.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-blue-800 font-medium">我的固定夥伴：</span>
                      <div className="flex gap-2">
                        {myRoommates.map((roommate, idx) => (
                          <span key={roommate.employeeId} className="text-sm text-blue-700">
                            {roommate.name}
                            {roommate.dayOffWeek && roommate.dayOffWeek.length > 0 && (
                              <span className="ml-1 text-xs text-blue-500">
                                (休:{roommate.dayOffWeek.map(d => weekDays[d].replace('週', '')).join(',')})
                              </span>
                            )}
                            {idx < myRoommates.length - 1 && '、'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {nurseSchedule && nurseSchedule.dayOffWeek && nurseSchedule.dayOffWeek.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Coffee className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">
                        休假日：
                        <span className="font-medium text-gray-800 ml-1">
                          {nurseSchedule.dayOffWeek.map(d => weekDays[d]).join('、')}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {nurseSchedule ? (
                <>
                  {/* 週排班表格 */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {weekDays.map((day, index) => {
                            const isToday = index === new Date().getDay() - 1 || 
                                           (new Date().getDay() === 0 && index === 6);
                            const isDayOff = nurseSchedule?.dayOffWeek?.includes(index);
                            
                            return (
                              <th 
                                key={day} 
                                className={`border border-gray-300 p-3 text-sm font-semibold
                                  ${isToday ? 'bg-blue-100 text-blue-800' : 'bg-gray-50 text-gray-700'}
                                  ${isDayOff ? 'opacity-60' : ''}
                                `}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <span>{day}</span>
                                  {isToday && (
                                    <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                      今天
                                    </span>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {weekDays.map((day, index) => {
                            const isDayOff = nurseSchedule?.dayOffWeek?.includes(index);
                            const isToday = index === new Date().getDay() - 1 || 
                                           (new Date().getDay() === 0 && index === 6);
                            const replacement = myReplacements[index];
                            
                            // 流動護士：取得該天分配的手術室
                            const floatRoomAssignment = isFloatNurse && myFloatSchedule 
                              ? myFloatSchedule[dayFields[index]] 
                              : null;
                            
                            return (
                              <td 
                                key={`${day}-content`}
                                className={`border border-gray-300 p-4 align-middle
                                  ${isToday ? 'bg-blue-50' : ''}
                                `}
                              >
                                {isDayOff ? (
                                  // 休假日
                                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                                    <div className="p-3 rounded-full bg-gray-100">
                                      <Coffee className="w-6 h-6 text-gray-500" />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-600">
                                      休假
                                    </span>
                                    
                                    {!isFloatNurse && replacement && (
                                      <div className="mt-2 pt-2 border-t border-gray-200 w-full">
                                        <div className="flex flex-col items-center gap-1">
                                          <div className="flex items-center gap-1 text-xs text-purple-600">
                                            <Shuffle className="w-3 h-3" />
                                            <span className="font-medium">流動護士代班</span>
                                          </div>
                                          <div className="px-2 py-1 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700 font-medium">
                                            {replacement.name}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center gap-3 py-4">
                                    {/* 班別圖示 */}
                                    <div className={`p-3 rounded-full ${isFloatNurse ? 'bg-purple-50' : shiftInfo?.bgColor}`}>
                                      <div className={isFloatNurse ? 'text-purple-500' : shiftInfo?.iconColor}>
                                        {isFloatNurse ? <Shuffle className="w-5 h-5" /> : shiftInfo?.icon}
                                      </div>
                                    </div>
                                    
                                    {/* 班別名稱 */}
                                    <div className="text-center">
                                      <p className={`text-sm font-bold ${isFloatNurse ? 'text-purple-700' : shiftInfo?.textColor}`}>
                                        {shiftInfo?.label}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {shiftInfo?.time}
                                      </p>
                                    </div>
                                    
                                    {/* 手術室資訊：流動護士顯示每日分配 */}
                                    <div className="flex flex-col items-center gap-1">
                                      {isFloatNurse ? (
                                        // 流動護士：顯示該天分配的手術室
                                        floatRoomAssignment ? (
                                          <div className="px-3 py-1 bg-purple-50 border border-purple-200 rounded-full">
                                            <p className="text-xs text-purple-700 font-medium">
                                              {floatRoomAssignment}
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-full">
                                            <p className="text-xs text-gray-500">
                                              未分配
                                            </p>
                                          </div>
                                        )
                                      ) : (
                                        // 固定護士：顯示固定手術室
                                        nurseSchedule?.surgeryRoom ? (
                                          <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full">
                                            <p className="text-xs text-blue-700 font-medium">
                                              {nurseSchedule.surgeryRoom}
                                            </p>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-full">
                                              <p className="text-xs text-amber-700 font-medium">
                                                {nurseSchedule.surgeryRoomType}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-amber-600">
                                              <AlertTriangle className="w-3 h-3" />
                                              <span>尚未分配</span>
                                            </div>
                                          </>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 圖例 */}
                  <div className="flex items-center gap-6 mt-6 pt-4 border-t border-gray-200 flex-wrap">
                    <span className="text-xs font-medium text-gray-500">圖例：</span>
                    <div className="flex items-center gap-2">
                      <Sunrise className="w-4 h-4 text-amber-500" />
                      <span className="text-xs text-gray-700">早班</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sunset className="w-4 h-4 text-orange-500" />
                      <span className="text-xs text-gray-700">晚班</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs text-gray-700">大夜班</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-700">休假</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shuffle className="w-4 h-4 text-purple-500" />
                      <span className="text-xs text-gray-700">流動護士</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 bg-gray-50 rounded-lg">
                  <Info className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-gray-500">尚未分配排班</p>
                </div>
              )}
            </div>

            {/* 下方：手術室護士分配概況（只顯示已分配的手術室）*/}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 text-left">
                    {nurseSchedule?.surgeryRoomType || '手術室'} 護士分配概況
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    顯示 {nurseSchedule?.surgeryRoomType || '您的手術室類型'} 各手術室的護士分配情況（含流動護士）
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  <span>共 {roomSchedules.reduce((sum, room) => {
                    return sum + Object.values(room.nursesByShift).flat().length;
                  }, 0)} 位護士</span>
                </div>
              </div>
              
              {roomSchedules && roomSchedules.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 bg-gray-100 p-3 text-sm font-semibold text-gray-700 w-24 sticky left-0 z-10">
                          班別
                        </th>
                        {roomSchedules.map((room) => (
                          <th 
                            key={room.roomId}
                            className={`border border-gray-300 p-3 text-sm font-semibold min-w-[140px]
                              ${room.isMyRoom 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-gray-50 text-gray-700'
                              }
                            `}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <Building2 className="w-4 h-4" />
                              <span className="font-bold">
                                {room.roomId}
                              </span>
                              {room.isMyRoom && !isFloatNurse && (
                                <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full mt-1">
                                  我的手術室
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map((shift) => {
                        const shiftInfo = getShiftInfo(shift);
                        return (
                          <React.Fragment key={shift}>
                            {/* 固定護士列 */}
                            <tr>
                              <td className={`border border-gray-300 p-3 ${shiftInfo.bgColor} sticky left-0 z-10`} rowSpan="2">
                                <div className="flex items-center justify-center gap-2">
                                  <div className={shiftInfo.iconColor}>
                                    {shiftInfo.icon}
                                  </div>
                                  <div className="text-center">
                                    <p className={`text-sm font-bold ${shiftInfo.textColor}`}>
                                      {shiftInfo.label}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {shiftInfo.time}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              {roomSchedules.map((room) => {
                                const nurses = room.nursesByShift[shift] || [];
                                
                                return (
                                  <td 
                                    key={`${room.roomId}-${shift}-fixed`}
                                    className={`border border-gray-300 p-3 align-top 
                                      ${room.isMyRoom ? 'bg-blue-50' : 'bg-white'}
                                    `}
                                  >
                                    <div className="text-xs text-gray-500 text-center mb-1 font-medium">
                                      固定護士 ({nurses.length})
                                    </div>
                                    <div className="space-y-1">
                                      {nurses.length > 0 ? (
                                        nurses.map((nurse, idx) => (
                                          <div 
                                            key={idx}
                                            className={`text-sm py-1.5 px-2 rounded
                                              ${room.isMyRoom && nurse.employeeId === user?.employee_id && !isFloatNurse
                                                ? 'bg-blue-200 text-blue-900 font-bold border-2 border-blue-400'
                                                : 'text-gray-700 bg-gray-50 border border-gray-200'
                                              }
                                            `}
                                          >
                                            <div className="text-center font-medium">
                                              {nurse.name}
                                              {nurse.employeeId === user?.employee_id && !isFloatNurse && ' ⭐'}
                                            </div>
                                            {nurse.dayOffWeek && nurse.dayOffWeek.length > 0 && (
                                              <div className="text-xs text-gray-500 text-center mt-0.5">
                                                休:{nurse.dayOffWeek.map(d => weekDays[d].replace('週', '')).join(',')}
                                              </div>
                                            )}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-xs text-gray-400 text-center py-2">-</div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                            
                            {/* 流動護士列 */}
                            <tr>
                              {roomSchedules.map((room) => {
                                const floatNursesByDay = room.floatNursesByShift[shift] || {};
                                const hasFloatNurses = Object.keys(floatNursesByDay).length > 0;
                                
                                return (
                                  <td 
                                    key={`${room.roomId}-${shift}-float`}
                                    className={`border border-gray-300 p-3 align-top
                                      ${room.isMyRoom ? 'bg-purple-50' : 'bg-purple-25'}
                                    `}
                                  >
                                    <div className="text-xs text-purple-600 text-center mb-1 font-medium flex items-center justify-center gap-1">
                                      <Shuffle className="w-3 h-3" />
                                      <span>流動護士</span>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                      {hasFloatNurses ? (
                                        Object.entries(floatNursesByDay).map(([dayIndex, nurses]) => (
                                          <div key={dayIndex} className="bg-white border border-purple-200 rounded p-1.5">
                                            <div className="text-purple-600 font-medium text-center mb-0.5">
                                              {weekDays[dayIndex]}
                                            </div>
                                            {nurses.map((nurse, idx) => (
                                              <div 
                                                key={idx} 
                                                className={`text-center ${
                                                  nurse.employee_id === user?.employee_id && isFloatNurse
                                                    ? 'text-purple-900 font-bold'
                                                    : 'text-purple-700'
                                                }`}
                                              >
                                                {nurse.name}
                                                {nurse.employee_id === user?.employee_id && isFloatNurse && ' ⭐'}
                                              </div>
                                            ))}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-gray-400 text-center py-2">無</div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <AlertCircle className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-gray-500">暫無手術室分配資料</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default NurseShiftViewPage;