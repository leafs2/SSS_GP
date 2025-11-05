// pages/sss/NurseShiftViewPage.jsx
// 護士排班規劃頁面 - 查看模式

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
  AlertTriangle
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';
import { useAuth } from '../../pages/login/AuthContext';
import { useMyNurseSchedule, useDepartmentNurseSchedules } from '../../hooks/useNurseSchedule';

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
  const shifts = ['morning', 'evening', 'night'];

  // 整理科別排班資料
  const organizeDepartmentSchedule = () => {
    if (!departmentSchedules) return [];

    // 按手術室類型分組（surgeryRoomType）
    const roomTypeMap = new Map();
    
    departmentSchedules.forEach(nurse => {
      const roomType = nurse.surgeryRoomType || '未分配';
      
      if (!roomTypeMap.has(roomType)) {
        roomTypeMap.set(roomType, {
          roomType: roomType,
          displayName: nurse.surgeryRoomType || '未分配手術室',
          isMyRoom: nurse.surgeryRoomType === nurseSchedule?.surgeryRoomType,
          hasSpecificRoom: false, // 是否有指定準確手術室
          nursesByShift: {
            morning: [],
            evening: [],
            night: []
          }
        });
      }
      
      const roomData = roomTypeMap.get(roomType);
      const shift = nurse.shift || 'morning';
      
      if (roomData.nursesByShift[shift]) {
        roomData.nursesByShift[shift].push(nurse);
      }
      
      // 檢查是否有準確的手術室 ID
      if (nurse.surgeryRoom) {
        roomData.hasSpecificRoom = true;
      }
    });

    // 轉換為陣列並排序（我的手術室類型優先）
    const roomSchedules = Array.from(roomTypeMap.values()).sort((a, b) => {
      if (a.isMyRoom && !b.isMyRoom) return -1;
      if (!a.isMyRoom && b.isMyRoom) return 1;
      return a.roomType.localeCompare(b.roomType);
    });

    return roomSchedules;
  };

  const roomSchedules = organizeDepartmentSchedule();

  // 調試：輸出排班資料
  useEffect(() => {
    if (nurseSchedule) {
      console.log('我的排班資料:', nurseSchedule);
    }
    if (departmentSchedules && departmentSchedules.length > 0) {
      console.log('科別排班資料:', departmentSchedules);
    }
  }, [nurseSchedule, departmentSchedules]);

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
                <h2 className="text-lg font-bold text-gray-800">我的排班</h2>
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
                            
                            return (
                              <td 
                                key={`${day}-content`}
                                className={`border border-gray-300 p-4 align-middle
                                  ${isToday ? 'bg-blue-50' : ''}
                                `}
                              >
                                {isDayOff ? (
                                  // 休假日顯示
                                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                                    <div className="p-3 rounded-full bg-gray-100">
                                      <Coffee className="w-6 h-6 text-gray-500" />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-600">
                                      休假
                                    </span>
                                  </div>
                                ) : (
                                  // 上班日顯示
                                  <div className="flex flex-col items-center justify-center gap-3 py-4">
                                    {/* 班別圖示 */}
                                    <div className={`p-3 rounded-full ${shiftInfo?.bgColor}`}>
                                      <div className={shiftInfo?.iconColor}>
                                        {shiftInfo?.icon}
                                      </div>
                                    </div>
                                    
                                    {/* 班別名稱 */}
                                    <div className="text-center">
                                      <p className={`text-sm font-bold ${shiftInfo?.textColor}`}>
                                        {shiftInfo?.label}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {shiftInfo?.time}
                                      </p>
                                    </div>
                                    
                                    {/* 手術室資訊 */}
                                    <div className="flex flex-col items-center gap-1">
                                      {nurseSchedule?.surgeryRoom ? (
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
                      <span className="text-xs text-gray-700">早班 (08:00-16:00)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sunset className="w-4 h-4 text-orange-500" />
                      <span className="text-xs text-gray-700">晚班 (16:00-24:00)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs text-gray-700">大夜班 (00:00-08:00)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-700">休假</span>
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

            {/* 下方：科別護士排班概況 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">科別護士排班概況</h2>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  <span>本週總計 {departmentSchedules?.length || 0} 位護士</span>
                </div>
              </div>
              
              {roomSchedules && roomSchedules.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 bg-gray-100 p-3 text-sm font-semibold text-gray-700 w-24">
                          班別
                        </th>
                        {roomSchedules.map((room) => (
                          <th 
                            key={room.roomType}
                            className={`border border-gray-300 p-3 text-sm font-semibold
                              ${room.isMyRoom 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-gray-50 text-gray-700'
                              }
                            `}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <Building2 className="w-4 h-4" />
                              <span>{room.displayName}</span>
                              {!room.hasSpecificRoom && (
                                <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>尚未分配</span>
                                </div>
                              )}
                              {room.isMyRoom && (
                                <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full mt-1">
                                  我的手術室類型
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
                          <tr key={shift}>
                            <td className={`border border-gray-300 p-3 ${shiftInfo.bgColor}`}>
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
                                  key={`${room.roomType}-${shift}`}
                                  className={`border border-gray-300 p-3 align-top
                                    ${room.isMyRoom ? 'bg-blue-50' : 'bg-white'}
                                  `}
                                >
                                  <div className="space-y-1 min-h-[60px]">
                                    {nurses.length > 0 ? (
                                      nurses.map((nurse, idx) => (
                                        <div 
                                          key={idx}
                                          className={`text-sm py-1 px-2 rounded
                                            ${room.isMyRoom && nurse.employeeId === user?.employee_id
                                              ? 'bg-blue-200 text-blue-900 font-bold'
                                              : 'text-gray-700 bg-gray-50'
                                            }
                                          `}
                                        >
                                          <div className="text-center">
                                            {nurse.name}
                                            {nurse.employeeId === user?.employee_id && ' (我)'}
                                          </div>
                                          {nurse.dayOffWeek && nurse.dayOffWeek.length > 0 && (
                                            <div className="text-xs text-gray-500 text-center mt-0.5">
                                              休假: {nurse.dayOffWeek.map(d => weekDays[d]).join('、')}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-xs text-gray-400 text-center py-4">
                                        無排班
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-400">暫無科別排班資料</p>
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