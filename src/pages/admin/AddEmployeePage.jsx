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

function AddEmployeePage({ onBack, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department_code: '',
    role: 'D',
    permission: '1'
  });
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const navigate = useNavigate();

  // 當選項改變時更新預覽
  useEffect(() => {
    if (formData.department_code && formData.role && formData.permission) {
      generatePreview();
    } else {
      setPreview(null);
    }
  }, [formData.department_code, formData.role, formData.permission]);

  const generatePreview = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/generate-employee-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_code: formData.department_code,
          role: formData.role,
          permission: formData.permission
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPreview(data.employee_id);
      } else {
        console.error('生成員工編號失敗:', data.error);
        setPreview('錯誤');
      }
    } catch (error) {
      console.error('生成員工編號失敗:', error);
      setPreview('網路錯誤');
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = '請輸入姓名';
    if (!formData.email.trim()) newErrors.email = '請輸入電子信箱';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = '電子信箱格式不正確';
    if (!formData.department_code) newErrors.department_code = '請選擇科別';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePreSubmit = () => {
    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };

  const handleBack = () => {
    navigate('/admin');
  };

  const handleSuccess = () => {
    navigate('/admin');
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowConfirmModal(false);
        alert(`員工新增成功！\n員工編號：${data.data.employee_id}\n註冊邀請已發送至：${formData.email}`);
        handleSuccess(); 
      } else {
        alert('新增失敗：' + data.error);
      }
    } catch (error) {
      console.error('新增員工失敗:', error);
      alert('新增失敗：無法連接到伺服器');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除該欄位的錯誤
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const ConfirmModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">資料確認</h3>
          <p className="text-gray-600 mt-1">請確認以下資訊是否正確</p>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">姓名：</span>
              <span className="font-medium">{formData.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">電子信箱：</span>
              <span className="font-medium">{formData.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">科別：</span>
              <span className="font-medium">
                {departments.find(d => d.code === formData.department_code)?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">角色：</span>
              <span className="font-medium">{formData.role === 'D' ? '醫師' : '護理人員'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">系統權限：</span>
              <span className="font-medium">
                {formData.permission === '1' ? '可修改手術排程' : '僅可查看手術排程'}
              </span>
            </div>
            <div className="flex justify-between border-t pt-4">
              <span className="text-gray-600">員工編號：</span>
              <span className="font-mono font-bold text-blue-600">{preview}</span>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg mt-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h4 className="font-medium text-yellow-800">重要提醒</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  確認新增後，系統將自動發送註冊邀請信件至指定信箱，員工需完成 FIDO 註冊後方可使用系統。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex justify-end space-x-3">
          <button
            onClick={() => setShowConfirmModal(false)}
            className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={handleConfirmSubmit}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            {loading ? '新增中...' : '確認新增'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* 頂部導航 */}
        <div className="flex items-center mb-8">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            回到員工管理
          </button>
        </div>

        {/* 主要內容 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-8">
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">新增員工</h1>
            
            <div className="max-w-3xl mx-auto space-y-8">
              {/* 基本資料區塊 */}
              <div className="border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mr-3 text-sm font-bold">1</div>
                  基本資料
                </h2>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      姓名 *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="請輸入完整姓名"
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      電子信箱 *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="example@hospital.com"
                    />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </div>
                </div>
              </div>

              {/* 部門設定區塊 */}
              <div className="border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mr-3 text-sm font-bold">2</div>
                  部門設定
                </h2>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      科別 *
                    </label>
                    <select
                      value={formData.department_code}
                      onChange={(e) => handleChange('department_code', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.department_code ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">請選擇科別</option>
                      {departments.map(dept => (
                        <option key={dept.code} value={dept.code}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                    {errors.department_code && <p className="text-red-500 text-sm mt-1">{errors.department_code}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      角色 *
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => handleChange('role', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="D">醫師</option>
                      <option value="N">護理人員</option>
                    </select>
                  </div>
                </div>

                {/* 員工編號預覽 */}
                {preview && (
                  <div className="mt-6 bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium text-green-900">預覽員工編號</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-green-700 bg-white px-3 py-2 rounded border">
                      {preview}
                    </div>
                    <p className="text-sm text-green-600 mt-2">
                      格式：{formData.role === 'D' ? '醫師' : '護理人員'} + {formData.department_code} + 權限等級 + 流水號
                    </p>
                  </div>
                )}
              </div>

              {/* 權限設定區塊 */}
              <div className="border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mr-3 text-sm font-bold">3</div>
                  權限設定
                </h2>
                
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    系統權限 *
                  </label>
                  
                  <div className="space-y-3">
                    <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="permission"
                        value="1"
                        checked={formData.permission === '1'}
                        onChange={(e) => handleChange('permission', e.target.value)}
                        className="mt-1 mr-4"
                      />
                      <div>
                        <div className="font-medium text-gray-900">可修改手術排程</div>
                        <div className="text-sm text-gray-500 mt-1">
                          可以查看、新增、修改和刪除手術排程資料
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="permission"
                        value="0"
                        checked={formData.permission === '0'}
                        onChange={(e) => handleChange('permission', e.target.value)}
                        className="mt-1 mr-4"
                      />
                      <div>
                        <div className="font-medium text-gray-900">僅可查看手術排程</div>
                        <div className="text-sm text-gray-500 mt-1">
                          只能查看手術排程資料，無法進行修改
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* 注意事項 */}
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  注意事項
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 電子信箱將用於發送註冊邀請信件</li>
                  <li>• 請確認信箱地址正確，避免邀請信件無法送達</li>
                  <li>• 員工需要完成 FIDO 生物識別註冊後才能使用系統</li>
                  <li>• 員工編號一旦生成將無法修改</li>
                </ul>
              </div>

              {/* 提交按鈕 */}
              <div className="flex justify-end space-x-3 pt-6">
                <button
                  onClick={onBack}
                  className="px-8 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handlePreSubmit}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  新增員工
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 確認彈窗 */}
        {showConfirmModal && <ConfirmModal />}
      </div>
    </div>
  );
}

export default AddEmployeePage;