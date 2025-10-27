import React, { useState, useEffect } from 'react';

const EmployeeVerification = () => {
  const token = window.location.pathname.split('/').pop();
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(false); 

  useEffect(() => {
    if (token) {
      verifyRegistrationToken();
    }
  }, [token]);

  const verifyRegistrationToken = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/fido/verify-registration-token/${token}`);
      const data = await response.json();
      
      if (response.ok) {
        setEmployeeData(data.employee);
        // 驗證成功後，檢查是否已註冊 FIDO
        await checkFidoRegistrationStatus(data.employee.employee_id);
      } else {
        setError(data.message || '無效的註冊連結');
      }
    } catch (err) {
      setError('驗證失敗，請重試');
    }
    setLoading(false);
  };

  // 新增：檢查 FIDO 註冊狀態的函數
  const checkFidoRegistrationStatus = async (employeeId) => {
    setCheckingRegistration(true);
    try {
      const response = await fetch(`http://localhost:3001/api/fido/registration/status/${employeeId}`);
      const data = await response.json();
      
      if (response.ok) {
        // 根據後端 API 的回應格式調整
        const isRegistered = data.has_credentials && data.status === 'active';
        setIsRegistered(isRegistered);
        console.log('✅ FIDO 註冊狀態檢查完成:', {
          status: data.status,
          has_credentials: data.has_credentials,
          can_register: data.can_register,
          isRegistered: isRegistered
        });
      } else {
        console.warn('⚠️ 無法檢查註冊狀態，預設為未註冊');
        setIsRegistered(false);
      }
    } catch (err) {
      console.error('❌ 檢查註冊狀態失敗:', err);
      setIsRegistered(false);
    }
    setCheckingRegistration(false);
  };

  const proceedToFidoRegistration = () => {
    // 如果已註冊，不允許繼續
    if (isRegistered) {
      return;
    }
    
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
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl overflow-hidden">
        {/* Header - 根據註冊狀態調整顏色 */}
        <div className={`${isRegistered 
          ? 'bg-gradient-to-r from-green-600 to-emerald-600' 
          : 'bg-gradient-to-r from-blue-600 to-indigo-600'
        } px-6 py-4`}>
          <h2 className="text-xl font-bold text-white text-center">
            {isRegistered ? '註冊狀態確認' : '員工身份確認'}
          </h2>
          <p className="text-blue-100 text-center mt-1 text-sm">
            {isRegistered ? '您已完成安全金鑰設定' : '請確認您的資訊無誤'}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* 員工資訊區 - 精簡版 */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <svg className="h-4 w-4 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              您的員工資訊
            </h3>
            
            {/* 網格布局 - 2x2 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">員工編號</div>
                <div className="text-sm font-bold text-gray-900">{employeeData.employee_id}</div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">姓名</div>
                <div className="text-sm font-semibold text-gray-900">{employeeData.name}</div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">部門</div>
                <div className="text-sm font-semibold text-gray-900">{employeeData.department_name || employeeData.department_code}</div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">職位</div>
                <div className="text-sm font-semibold text-gray-900">
                  {employeeData.role === 'D' ? '醫師' : '護理師'}
                </div>
              </div>
            </div>
          </div>

          {/* 檢查註冊狀態中 */}
          {checkingRegistration && (
            <div className="mb-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600 text-xs">正在檢查註冊狀態...</p>
              </div>
            </div>
          )}

          {/* 已註冊狀態 - 精簡版 */}
          {!checkingRegistration && isRegistered && (
            <div className="mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-center mb-3">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-2">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-green-900 mb-1">
                    🎉 安全金鑰已設定完成
                  </h3>
                  <p className="text-green-700 text-xs leading-relaxed">
                    您已成功完成註冊，可以直接使用手機生物識別登入系統。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 未註冊狀態 - 精簡版 */}
          {!checkingRegistration && !isRegistered && (
            <div className="mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                  <svg className="h-4 w-4 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 2.676-.732 5.175-2.431 7.186-4.785" />
                  </svg>
                  下一步：設定生物識別登入
                </h3>
                <p className="text-blue-700 text-xs leading-relaxed">
                  確認資訊無誤後，我們將為您設定安全的生物識別登入方式，包括指紋辨識、臉部辨識或安全金鑰。
                </p>
              </div>
            </div>
          )}

          {/* 按鈕區域 */}
          {!checkingRegistration && (
            <div className="space-y-3">
              {isRegistered ? (
                // 已註冊：顯示前往登入按鈕
                <>
                  <button 
                    onClick={() => window.location.href = '/login'}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center text-sm"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3V4" />
                    </svg>
                    前往登入頁面
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center">
                    您已完成所有設定，可以開始使用系統
                  </p>
                </>
              ) : (
                // 未註冊：顯示設定按鈕
                <>
                  <button 
                    onClick={proceedToFidoRegistration}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center text-sm"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    確認資訊，開始設定
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center">
                    點擊上方按鈕即表示您確認所有資訊正確無誤
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeVerification;