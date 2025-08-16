import React, { useState, useEffect } from 'react'; 
import { useNavigate } from 'react-router-dom';

// 科別選項
const departments = [
  { code: 'CV', name: '心臟外科' },
  { code: 'NS', name: '神經外科' },
  { code: 'GS', name: '一般外科' },
  { code: 'OR', name: '骨科' },
  { code: 'UR', name: '泌尿科' },
  { code: 'OB', name: '婦產科' },
  { code: 'OP', name: '眼科' },
  { code: 'ENT', name: '耳鼻喉科' },
  { code: 'TS', name: '胸腔外科' },
  { code: 'PS', name: '整形外科' },
  { code: 'AN', name: '麻醉科' }
];

function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sendingEmail, setSendingEmail] = useState({});

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/employees');
      const data = await response.json();
      
      if (data.success) {
        setEmployees(data.data);
      } else {
        console.error('API 錯誤:', data.error);
        alert('載入員工資料失敗: ' + data.error);
      }
    } catch (error) {
      console.error('載入員工資料失敗:', error);
      alert('無法連接到伺服器，請確認 API 服務是否啟動');
    } finally {
      setLoading(false);
    }
  };

  // 載入員工列表
  useEffect(() => {
    loadEmployees();
  }, []);

  // 篩選員工列表
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === '' || employee.status === statusFilter;
    const matchesDepartment = departmentFilter === '' || employee.department_code === departmentFilter;
    const matchesRole = roleFilter === '' || employee.role === roleFilter;
    
    return matchesSearch && matchesStatus && matchesDepartment && matchesRole;
  });
  
  const getDepartmentName = (code) => {
    const dept = departments.find(d => d.code === code);
    return dept ? dept.name : code;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { text: '待註冊', color: 'bg-yellow-100 text-yellow-800' },
      active: { text: '啟用中', color: 'bg-green-100 text-green-800' },
      inactive: { text: '已停用', color: 'bg-red-100 text-red-800' }
    };
    const statusInfo = statusMap[status] || statusMap.pending;
    
    return (
      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  const getRoleText = (role) => {
    return role === 'D' ? '醫師' : '護理人員';
  };

  const getPermissionText = (permission) => {
    return permission === '1' ? '可修改' : '僅查看';
  };

  // 處理編輯員工
  const handleEdit = (employeeId) => {
    alert(`編輯員工 ID: ${employeeId} (功能開發中)`);
  };

  // 處理重發邀請
  const handleResendInvite = async (employeeId, employeeName) => {
    if (!confirm(`確定要重新發送註冊邀請給 ${employeeName} 嗎？`)) return;
    
    setSendingEmail(prev => ({ ...prev, [employeeId]: true }));
    
    try {
      const response = await fetch(`http://localhost:3001/api/send-registration-email/${employeeId}`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ 註冊邀請已重新發送給 ${employeeName}！\n信箱：${data.email}`);
        loadEmployees(); // 重新載入列表
      } else {
        alert(`❌ 發送失敗：${data.error}`);
      }
    } catch (error) {
      console.error('發送邀請失敗:', error);
      alert('❌ 發送失敗：網路錯誤');
    }
    
    setSendingEmail(prev => ({ ...prev, [employeeId]: false }));
  };

  // 處理刪除員工
  const handleDelete = async (employeeId, employeeName, status) => {
    if (status !== 'pending') {
      alert('只能刪除待註冊狀態的員工，已啟用的員工請使用停用功能');
      return;
    }
    
    if (!confirm(`確定要刪除 ${employeeName} 嗎？此操作無法復原。`)) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/employees/${employeeId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ 員工 ${employeeName} 已刪除`);
        loadEmployees();
      } else {
        alert(`❌ 刪除失敗：${data.error}`);
      }
    } catch (error) {
      console.error('刪除員工失敗:', error);
      alert('❌ 刪除失敗：無法連接到伺服器');
    }
  };

  const handleStatusChange = async (employeeId, currentStatus, employeeName) => {
    let newStatus;
    let actionText;
    
    if (currentStatus === 'active') {
      newStatus = 'inactive';
      actionText = '停用';
    } else if (currentStatus === 'inactive') {
      newStatus = 'active';
      actionText = '啟用';
    } else {
      // pending 狀態不允許直接切換，需要完成註冊
      alert('待註冊狀態的員工需要完成 FIDO 註冊後才能啟用');
      return;
    }
    
    if (!confirm(`確定要${actionText} ${employeeName} 嗎？`)) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/employees/${employeeId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${employeeName} 已${actionText}`);
        loadEmployees();
      } else {
        alert(`❌ ${actionText}失敗：${data.error}`);
      }
    } catch (error) {
      console.error(`${actionText}失敗:`, error);
      alert(`❌ ${actionText}失敗：網路錯誤`);
    }
  };

  const handleAddEmployee = () => {
    window.location.href = '/admin/add';
  };

  // 清除所有篩選
  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setDepartmentFilter('');
    setRoleFilter('');
  };

  return (
    <div className="min-h-screen w-full bg-stone-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* 標題區域 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 text-left">員工管理</h1>
              <p className="text-gray-600 mt-2">手術排程系統員工管理後台</p>
            </div>
            <button
              onClick={handleAddEmployee} 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-md"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              新增員工
            </button>
          </div>
        </div>

        {/* 統計卡片 */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">總員工數</p>
                <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">已啟用</p>
                <p className="text-2xl font-bold text-gray-900">
                  {employees.filter(emp => emp.status === 'active').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">待註冊</p>
                <p className="text-2xl font-bold text-gray-900">
                  {employees.filter(emp => emp.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 text-red-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">已停用</p>
                <p className="text-2xl font-bold text-gray-900">
                  {employees.filter(emp => emp.status === 'inactive').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 員工列表 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 text-left">員工列表</h2>
                <p className="text-sm text-gray-600 mt-1">管理所有員工的基本資料和權限設定</p>
              </div>
            </div>
            
            {/* 搜尋和篩選區域 */}
            <div className="grid grid-cols-1 grid-cols-5 gap-4">
              {/* 搜尋框 */}
              <div className="relative lg:col-span-2">
                <input
                  type="text"
                  placeholder="搜尋姓名、員工編號或信箱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              

              {/* 科別篩選 */}
              <select 
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">所有科別</option>
                {departments.map(dept => (
                  <option key={dept.code} value={dept.code}>{dept.name}</option>
                ))}
              </select>

              {/* 角色篩選 */}
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">所有職位</option>
                <option value="D">醫師</option>
                <option value="N">護理人員</option>
              </select>

              {/* 狀態篩選 */}
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">所有狀態</option>
                <option value="active">已啟用</option>
                <option value="pending">待註冊</option>
                <option value="inactive">已停用</option>
              </select>
            </div>

            {/* 篩選結果和清除按鈕 */}
            {(searchTerm || statusFilter || departmentFilter || roleFilter) && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  顯示 {filteredEmployees.length} 筆結果，共 {employees.length} 筆員工資料
                </div>
                <button
                  onClick={clearAllFilters}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  清除所有篩選
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">載入員工資料中...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {employees.length === 0 ? '尚無員工資料' : '找不到符合條件的員工'}
              </h3>
              <p className="text-gray-600 mb-6">
                {employees.length === 0 
                  ? '開始新增第一位員工來建立您的團隊' 
                  : '試著調整搜尋條件或清除篩選'}
              </p>
              {employees.length === 0 && (
                <button
                  onClick={handleAddEmployee}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  新增第一位員工
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                      員工資訊
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">
                      電子信箱
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                      科別
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      角色
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      權限
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      狀態
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                              {employee.name.charAt(0)}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-base font-semibold text-gray-900 w-24">{employee.name}</div>
                            <div className="text-sm font-mono text-gray-600 mt-1">{employee.employee_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-900">{employee.email}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(employee.email);
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                            title="複製信箱"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="text-sm font-medium text-gray-900">{getDepartmentName(employee.department_code)} ({employee.department_code})</div>
                        <div className="text-xs text-gray-500 mt-1"></div>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="text-sm text-gray-900">{getRoleText(employee.role)}</div>
                      </td>
                      <td className="px-6 py-4 text-left">
                        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                          employee.permission === '1' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {getPermissionText(employee.permission)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-left">
                        {getStatusBadge(employee.status)}
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex space-x-2">
                          <button 
                            className="text-blue-600 hover:text-blue-900 transition-colors p-1"
                            onClick={() => handleEdit(employee.id)}
                            title="編輯員工"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          
                          {employee.status === 'pending' && (
                            <button 
                              className="text-green-600 hover:text-green-900 transition-colors p-1"
                              onClick={() => handleResendInvite(employee.id, employee.name)}
                              disabled={sendingEmail[employee.id]}
                              title="重發邀請"
                            >
                              {sendingEmail[employee.id] ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                              ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.83 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              )}
                            </button>
                          )}
                          
                          {/* 已啟用/已停用狀態：顯示狀態切換按鈕 */}
                          {(employee.status === 'active' || employee.status === 'inactive') && (
                            <button 
                              className={`transition-colors p-1 ${
                                employee.status === 'active' 
                                  ? 'text-red-600 hover:text-red-900' 
                                  : 'text-green-600 hover:text-green-900'
                              }`}
                              onClick={() => handleStatusChange(employee.id, employee.status, employee.name)}
                              title={employee.status === 'active' ? '停用員工' : '啟用員工'}
                            >
                              {employee.status === 'active' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </button>
                          )}
                          
                          {/* 刪除按鈕：只有待註冊狀態才能刪除 */}
                          {employee.status === 'pending' && (
                            <button 
                              className="text-red-600 hover:text-red-900 transition-colors p-1"
                              onClick={() => handleDelete(employee.id, employee.name, employee.status)}
                              title="刪除員工"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;