import React, { useState } from 'react';
import { Clock, Calendar, MapPin, AlertCircle } from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';

const Homepage = () => {
  // 模擬手術資料 - 醫生個人視角
  const surgeryData = [
    {
      id: 1,
      patientName: '王小明',
      surgeryType: '膝關節置換術',
      room: '手術室 A',
      scheduledTime: '08:00',
      estimatedDuration: '2小時',
      status: 'completed',
      actualStartTime: '08:00',
      actualEndTime: '10:15'
    },
    {
      id: 2,
      patientName: '李小華',
      surgeryType: '腹腔鏡膽囊切除術',
      room: '手術室 B',
      scheduledTime: '10:30',
      estimatedDuration: '1.5小時',
      status: 'in-progress',
      actualStartTime: '10:35',
      progress: 60
    },
    {
      id: 3,
      patientName: '陳小美',
      surgeryType: '甲狀腺切除術',
      room: '手術室 C',
      scheduledTime: '13:00',
      estimatedDuration: '3小時',
      status: 'upcoming'
    },
    {
      id: 4,
      patientName: '劉小強',
      surgeryType: '心臟瓣膜修復術',
      room: '手術室 D',
      scheduledTime: '15:30',
      estimatedDuration: '4小時',
      status: 'upcoming'
    },
    {
      id: 5,
      patientName: '黃小雯',
      surgeryType: '脊椎融合術',
      room: '手術室 A',
      scheduledTime: '07:30',
      estimatedDuration: '2.5小時',
      status: 'completed',
      actualStartTime: '07:30',
      actualEndTime: '09:45'
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'in-progress':
        return 'bg-blue-50 border-blue-200';
      case 'upcoming':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'upcoming':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'in-progress':
        return '進行中';
      case 'upcoming':
        return '即將開始';
      default:
        return '未知';
    }
  };

  const filterSurgeries = (status) => {
    return surgeryData.filter(surgery => surgery.status === status);
  };

  const SurgeryCard = ({ surgery }) => (
    <div className={`p-3 rounded-lg border-2 transition-all hover:shadow-md ${getStatusColor(surgery.status)}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-base text-gray-800">{surgery.patientName}</h3>
          <p className="text-gray-600 text-sm">{surgery.surgeryType}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(surgery.status)}`}>
          {getStatusText(surgery.status)}
        </span>
      </div>
      
      <div className="space-y-1.5 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          <span>預定: {surgery.scheduledTime}</span>
          <span className="text-gray-400">({surgery.estimatedDuration})</span>
        </div>
        
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5" />
          <span>{surgery.room}</span>
        </div>
        
        {surgery.status === 'in-progress' && surgery.progress && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>進度</span>
              <span>{surgery.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${surgery.progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              實際開始: {surgery.actualStartTime}
            </p>
          </div>
        )}
        
        {surgery.status === 'completed' && (
          <div className="mt-1.5 text-xs text-gray-500">
            <p>實際時間: {surgery.actualStartTime} - {surgery.actualEndTime}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="min-h-full">
        {/* 使用 PageHeader 組件 */}
        <PageHeader 
          title="我的手術排程" 
          subtitle="今日個人手術安排"
        />

        {/* 主要內容區域 */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 三欄手術狀態顯示 - 直式佈局 */}
          <div className="grid grid-cols-3 gap-4 h-[calc(100vh-360px)]">
            {/* 進行中欄位 */}
            <div className="bg-white rounded-lg shadow flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  進行中 ({filterSurgeries('in-progress').length})
                </h2>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {filterSurgeries('in-progress').length > 0 ? (
                  <div className="space-y-3">
                    {filterSurgeries('in-progress').map(surgery => (
                      <SurgeryCard key={surgery.id} surgery={surgery} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">目前沒有進行中的手術</p>
                  </div>
                )}
              </div>
            </div>

            {/* 即將開始欄位 */}
            <div className="bg-white rounded-lg shadow flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  即將開始 ({filterSurgeries('upcoming').length})
                </h2>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {filterSurgeries('upcoming').length > 0 ? (
                  <div className="space-y-3">
                    {filterSurgeries('upcoming').map(surgery => (
                      <SurgeryCard key={surgery.id} surgery={surgery} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Clock className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">目前沒有待開始的手術</p>
                  </div>
                )}
              </div>
            </div>

            {/* 已完成欄位 */}
            <div className="bg-white rounded-lg shadow flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  已完成 ({filterSurgeries('completed').length})
                </h2>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {filterSurgeries('completed').length > 0 ? (
                  <div className="space-y-3">
                    {filterSurgeries('completed').map(surgery => (
                      <SurgeryCard key={surgery.id} surgery={surgery} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Calendar className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">今日尚無已完成的手術</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default Homepage;