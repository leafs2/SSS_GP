// pages/sss/AssistantShiftViewPage.jsx
// 助理醫師排班頁面 - 本週排班視圖

import React, { useState, useEffect } from 'react'
import {
  Calendar,
  Sun,
  Moon,
  Coffee,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  AlertCircle,
  Briefcase,
  Home,
  Users,
} from 'lucide-react'
import Layout from './components/Layout'
import PageHeader from './components/PageHeader'
import { useAuth } from '../../pages/login/AuthContext'
import assistantShiftService from '../../services/assistantShiftService'

const AssistantShiftViewPage = () => {
  const { user } = useAuth()
  const userDepartment = user?.department_name || '外科部門'
  const userDepartmentCode = user?.department_code || 'SURG'

  // 當前週的日期
  const [currentWeekStart, setCurrentWeekStart] = useState(
    getWeekStart(new Date()),
  )
  const [calendarData, setCalendarData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

  // 獲取週的開始日期（週一）
  function getWeekStart(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  // 格式化日期為 YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 取得本週日期陣列
  const getWeekDates = () => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart)
      date.setDate(date.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  // 載入排班資料
  const loadShiftData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const weekDates = getWeekDates()
      const startDate = weekDates[0]
      const year = startDate.getFullYear()
      const month = startDate.getMonth() + 1

      // 取得該月份的排班日曆資料
      const data = await assistantShiftService.getAssistantShiftCalendar(
        userDepartmentCode,
        year,
        month,
      )

      setCalendarData(data)
    } catch (err) {
      console.error('載入排班資料失敗:', err)
      setError(err.message || '載入排班資料失敗')
    } finally {
      setIsLoading(false)
    }
  }

  // 當週變更時重新載入資料
  useEffect(() => {
    loadShiftData()
  }, [currentWeekStart, userDepartmentCode])

  // 上一週
  const handlePrevWeek = () => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentWeekStart(newDate)
  }

  // 下一週
  const handleNextWeek = () => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentWeekStart(newDate)
  }

  // 格式化週範圍顯示
  const getWeekRange = () => {
    const weekDates = getWeekDates()
    const start = weekDates[0]
    const end = weekDates[6]

    return `${start.getMonth() + 1}月${start.getDate()}日 - ${
      end.getMonth() + 1
    }月${end.getDate()}日`
  }

  // 判斷當前用戶在某日是否值班
  const isUserOnDuty = (dateStr) => {
    if (!calendarData?.shifts || !calendarData.shifts[dateStr]) {
      return false
    }

    const dayShift = calendarData.shifts[dateStr]
    return dayShift.doctors?.some(
      (doctor) => doctor.employee_id === user?.employee_id,
    )
  }

  // 判斷前一天是否值班（用於判斷休息）
  const wasUserOnDutyPreviousDay = (currentDate) => {
    const prevDate = new Date(currentDate)
    prevDate.setDate(prevDate.getDate() - 1)
    const prevDateStr = formatDate(prevDate)
    return isUserOnDuty(prevDateStr)
  }

  // 取得某日的時段狀態
  const getDaySchedule = (date) => {
    const dateStr = formatDate(date)
    const onDutyToday = isUserOnDuty(dateStr)
    const restingToday = wasUserOnDutyPreviousDay(date)

    // 找出最後一次值班日期
    const lastDutyDate = getLastDutyDate()
    const isAfterLastDuty = lastDutyDate && dateStr > lastDutyDate
    
    // 檢查當週是否已完成排班（已排2次以上值班）
    const weeklyDutyCount = getWeeklyDutyCount()
    const isScheduleComplete = weeklyDutyCount >= 2

    if (onDutyToday) {
      // 值班日：早上不值班(休假)，正常上班(08-17)，從17:00開始值班(17-24)
      return {
        dutyEvening: { type: 'duty', label: '值班' },
        dutyNight: { type: 'off', label: '休假' }, // 值班當天的早晨時段(00-08)是休假
        work: { type: 'work', label: '正常上班' },
        off: { type: 'off', label: '休假' },
      }
    } else if (restingToday) {
      // 值班隔日：早上00-08繼續值班，然後全天休假
      return {
        dutyEvening: { type: 'off', label: '休假' },
        dutyNight: { type: 'duty', label: '值班' }, // 接續前一天17:00開始的值班，到隔天08:00
        work: { type: 'off', label: '休假' },
        off: { type: 'off', label: '休假' },
      }
    } else if (isAfterLastDuty && !isScheduleComplete) {
      // 在最後值班日期之後且當週值班未滿2次：只有正常上班時段顯示未排班，其他顯示休假
      return {
        dutyEvening: { type: 'off', label: '休假' },
        dutyNight: { type: 'off', label: '休假' },
        work: { type: 'unscheduled', label: '未排班' },
        off: { type: 'off', label: '休假' },
      }
    } else {
      // 一般日子或已完成排班：正常上班 + 其他時段休假
      return {
        dutyEvening: { type: 'off', label: '休假' },
        dutyNight: { type: 'off', label: '休假' },
        work: { type: 'work', label: '正常上班' },
        off: { type: 'off', label: '休假' },
      }
    }
  }

  // 取得最後一次值班日期
  const getLastDutyDate = () => {
    if (!calendarData?.shifts) return null

    let lastDate = null
    Object.keys(calendarData.shifts).forEach((dateStr) => {
      const shift = calendarData.shifts[dateStr]
      const isUserDuty = shift.doctors?.some(
        (doctor) => doctor.employee_id === user?.employee_id,
      )
      if (isUserDuty) {
        if (!lastDate || dateStr > lastDate) {
          lastDate = dateStr
        }
      }
    })

    // 如果有最後值班日期，需要加上隔天（因為隔天也是休假）
    if (lastDate) {
      const [y, m, d] = lastDate.split('-').map(Number)
      const nextDay = new Date(y, m - 1, d + 1)
      const nextYear = nextDay.getFullYear()
      const nextMonth = String(nextDay.getMonth() + 1).padStart(2, '0')
      const nextDate = String(nextDay.getDate()).padStart(2, '0')
      return `${nextYear}-${nextMonth}-${nextDate}`
    }

    return lastDate
  }

  // 計算當週值班次數
  const getWeeklyDutyCount = () => {
    const weekDates = getWeekDates()
    return weekDates.filter((date) => isUserOnDuty(formatDate(date))).length
  }

  // 檢查本週是否有未排班的日期
  const hasUnscheduledDays = () => {
    const weekDates = getWeekDates()
    return weekDates.some((date) => {
      const schedule = getDaySchedule(date)
      return schedule.work.type === 'unscheduled'
    })
  }

  // 取得時段樣式
  const getPeriodStyle = (type) => {
    switch (type) {
      case 'work':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'duty':
        return 'bg-orange-100 text-orange-700 border-orange-300'
      case 'off':
        return 'bg-gray-50 text-gray-500 border-gray-200'
      case 'unscheduled':
        return 'bg-yellow-50 text-yellow-700 border-yellow-300 border-dashed'
      default:
        return 'bg-white text-gray-400 border-gray-200'
    }
  }

  // 取得時段圖標
  const getPeriodIcon = (type) => {
    switch (type) {
      case 'work':
        return <Briefcase className="w-4 h-4" />
      case 'duty':
        return <Moon className="w-4 h-4" />
      case 'off':
        return <Home className="w-4 h-4" />
      case 'unscheduled':
        return <AlertCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  // Loading 狀態
  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader title="助理醫師排班" subtitle={userDepartment} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-600">載入排班資料中...</span>
            </div>
          </main>
        </div>
      </Layout>
    )
  }

  // 錯誤狀態
  if (error) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader title="助理醫師排班" subtitle={userDepartment} />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col items-center justify-center h-64">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-red-600 font-medium mb-2">載入排班資料失敗</p>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                onClick={loadShiftData}
              >
                重新載入
              </button>
            </div>
          </main>
        </div>
      </Layout>
    )
  }

  const weekDates = getWeekDates()

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        <PageHeader title="助理醫師排班" subtitle={userDepartment} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 我的本週排班 */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">我的本週排班</h2>

              <div className="flex items-center gap-3">
                {/* 未排班提示 */}
                {hasUnscheduledDays() && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-300 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-700">
                      本週有未排班日期
                    </span>
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
              </div>
            </div>

            {/* 排班表格 */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed">
                <thead>
                  <tr>
                    <th className="border border-gray-300 bg-gray-50 p-3 text-sm font-semibold text-gray-700 w-24">
                      時段
                    </th>
                    {weekDates.map((date, index) => {
                      const isToday =
                        formatDate(date) === formatDate(new Date())
                      return (
                        <th
                          key={index}
                          className={`border border-gray-300 p-3 text-sm font-semibold ${
                            isToday
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span>{weekDays[index]}</span>
                            <span className="text-xs font-normal opacity-75">
                              {date.getMonth() + 1}/{date.getDate()}
                            </span>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* 值班後段 (00:00-08:00) */}
                  <tr>
                    <td className="border border-gray-300 bg-gray-50 p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Moon className="w-5 h-5 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">
                          值班後段
                        </span>
                        <span className="text-xs text-gray-500">
                          00:00-08:00
                        </span>
                      </div>
                    </td>
                    {weekDates.map((date, index) => {
                      const schedule = getDaySchedule(date)
                      const period = schedule.dutyNight

                      return (
                        <td key={index} className="border border-gray-300 p-2">
                          {period.type === 'duty' ? (
                            <div
                              className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 min-h-[80px] ${getPeriodStyle(
                                period.type,
                              )}`}
                            >
                              {getPeriodIcon(period.type)}
                              <div className="text-center">
                                <span className="text-sm font-medium block">
                                  {period.label}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="min-h-[80px]"></div>
                          )}
                        </td>
                      )
                    })}
                  </tr>

                  {/* 正常上班時段 (08:00-17:00) */}
                  <tr>
                    <td className="border border-gray-300 bg-gray-50 p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Sun className="w-5 h-5 text-yellow-500" />
                        <span className="text-sm font-medium text-gray-700">
                          正常上班
                        </span>
                        <span className="text-xs text-gray-500">
                          08:00-17:00
                        </span>
                      </div>
                    </td>
                    {weekDates.map((date, index) => {
                      const schedule = getDaySchedule(date)
                      const period = schedule.work
                      return (
                        <td key={index} className="border border-gray-300 p-2">
                          <div
                            className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 min-h-[80px] ${getPeriodStyle(
                              period.type,
                            )}`}
                          >
                            {getPeriodIcon(period.type)}
                            <span className="text-sm font-medium">
                              {period.label}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>

                  {/* 值班前段 (17:00-24:00) */}
                  <tr>
                    <td className="border border-gray-300 bg-gray-50 p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Moon className="w-5 h-5 text-indigo-600" />
                        <span className="text-sm font-medium text-gray-700">
                          值班前段
                        </span>
                        <span className="text-xs text-gray-500">
                          17:00-24:00
                        </span>
                      </div>
                    </td>
                    {weekDates.map((date, index) => {
                      const schedule = getDaySchedule(date)
                      const period = schedule.dutyEvening
                      return (
                        <td key={index} className="border border-gray-300 p-2">
                          {period.type === 'duty' ? (
                            <div
                              className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 min-h-[80px] ${getPeriodStyle(
                                period.type,
                              )}`}
                            >
                              {getPeriodIcon(period.type)}
                              <span className="text-sm font-medium">
                                {period.label}
                              </span>
                            </div>
                          ) : (
                            <div className="min-h-[80px]"></div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 圖例 */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
              <span className="text-xs font-medium text-gray-500">圖例：</span>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-orange-100 text-orange-700 border-orange-300">
                  <Moon className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">值班</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-700 border-blue-200">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">正常上班</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-gray-50 text-gray-500 border-gray-200">
                  <Home className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">休假</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed bg-yellow-50 text-yellow-700 border-yellow-300">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">未排班</span>
                </div>
              </div>
            </div>
          </div>
            {/* 本週值班表 */}
            <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-700">
                  本週值班表
                </h3>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {weekDates.map((date, index) => {
                  const dateStr = formatDate(date)
                  const isToday = dateStr === formatDate(new Date())
                  const dayShift = calendarData?.shifts?.[dateStr]
                  const doctors = dayShift?.doctors || []
                  
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        isToday
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="text-center mb-2">
                        <div className={`text-xs font-semibold ${
                          isToday ? 'text-blue-700' : 'text-gray-600'
                        }`}>
                          {weekDays[index]}
                        </div>
                        <div className={`text-xs ${
                          isToday ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          {date.getMonth() + 1}/{date.getDate()}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        {doctors.length > 0 ? (
                          doctors.map((doctor, idx) => (
                            <div
                              key={idx}
                              className={`text-xs font-medium text-center px-2 py-1.5 rounded ${
                                doctor.employee_id === user?.employee_id
                                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                                  : 'bg-white text-gray-700 border border-gray-200'
                              }`}
                            >
                              {doctor.name}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-gray-400 text-center py-1.5">
                            無值班
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
        </main>
      </div>
    </Layout>
  )
}

export default AssistantShiftViewPage