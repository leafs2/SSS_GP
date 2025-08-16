import React, { useState, useEffect } from 'react';

const EmployeeVerification = () => {
  const token = window.location.pathname.split('/').pop();
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      verifyRegistrationToken();
    }
  }, [token]);

  const verifyRegistrationToken = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/verify-registration-token/${token}`);
      const data = await response.json();
      
      if (response.ok) {
        setEmployeeData(data.employee);
      } else {
        setError(data.message || '無效的註冊連結');
      }
    } catch (err) {
      setError('驗證失敗，請重試');
    }
    setLoading(false);
  };

  const proceedToFidoRegistration = () => {
    // 將員工資訊存到 sessionStorage
    sessionStorage.setItem('registrationData', JSON.stringify(employeeData));
    window.location.href = '/register/fido';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">驗證中...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">驗證失敗</h2>
            <p className="text-gray-600 mb-6">{error}</p>
          </div>
          
          <button 
            onClick={() => window.location.href = '/login'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
          >
            返回登入頁面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <h2 className="text-2xl font-bold text-white text-center">員工身份確認</h2>
          <p className="text-blue-100 text-center mt-2">請確認您的資訊無誤</p>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              您的員工資訊
            </h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">員工編號</span>
                  <span className="text-lg font-bold text-gray-900">{employeeData.employee_id}</span>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">姓名</span>
                  <span className="text-lg font-semibold text-gray-900">{employeeData.name}</span>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">部門</span>
                  <span className="text-lg font-semibold text-gray-900">{employeeData.department_name || employeeData.department_code}</span>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">職位</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {employeeData.role === 'D' ? '醫師' : '護理師'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center">
                <svg className="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 2.676-.732 5.175-2.431 7.186-4.785" />
                </svg>
                下一步：設定生物識別登入
              </h3>
              <p className="text-blue-700 text-sm leading-relaxed">
                確認資訊無誤後，我們將為您設定安全的生物識別登入方式，包括指紋辨識、臉部辨識或安全金鑰。
              </p>
            </div>
          </div>

          <button 
            onClick={proceedToFidoRegistration}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-lg transition duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            確認資訊，開始設定
          </button>
          
          <p className="text-xs text-gray-500 text-center mt-4">
            點擊上方按鈕即表示您確認所有資訊正確無誤
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmployeeVerification;