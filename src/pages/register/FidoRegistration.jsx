import React, { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

const FidoRegistration = () => {
  const [employeeData, setEmployeeData] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [step, setStep] = useState('ready');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = sessionStorage.getItem('registrationData');
    if (data) {
      try {
        const employee = JSON.parse(data);
        setEmployeeData(employee);
        setLoading(false); 
        console.log('✅ 從 sessionStorage 獲取員工資料:', employee);
      } catch (err) {
        console.error('❌ 解析員工資料失敗:', err);
        setLoading(false);
        redirectToLogin();
      }
    } else {
      console.error('❌ sessionStorage 中沒有找到員工資料');
      setLoading(false);
      redirectToLogin();
    }
  }, []);

  const redirectToLogin = () => {
    alert('無效的註冊流程，請重新開始');
    window.location.href = '/login';
  };

  const handleFidoRegistration = async () => {
    if (!window.PublicKeyCredential) {
      setErrorMessage('您的瀏覽器不支援 FIDO 認證功能，請使用較新版本的瀏覽器');
      setStep('error');
      return;
    }

    setIsRegistering(true);
    setStep('registering');

    try {
      console.log('📱 開始手機認證器註冊流程...');
      
      const optionsResponse = await fetch('http://localhost:3001/api/fido/registration/begin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          employee_id: employeeData.employee_id
        })
      });

      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        console.error('❌ API 錯誤回應:', errorData);
        throw new Error(errorData.error || '無法開始註冊程序');
      }

      const data = await optionsResponse.json();
      
      // 檢查 API 回應結構
      console.log('📋 API 回應結構:', {
        success: data.success,
        hasOptions: !!data.options,
        optionsKeys: data.options ? Object.keys(data.options) : [],
        hasChallenge: data.options ? !!data.options.challenge : false
      });
      
      const options = data.options;
      
      // 驗證 options 結構
      if (!options || !options.challenge) {
        throw new Error('伺服器回應格式錯誤：缺少 challenge');
      }
      
      console.log('✅ 取得手機認證器註冊選項成功');

      // 啟動 WebAuthn 註冊
      console.log('📱 啟動手機認證器配對...');
      const attResp = await startRegistration(options);
      
      console.log('📱 手機認證器註冊完成，正在驗證...');

      // 驗證註冊結果
      const verificationResponse = await fetch('http://localhost:3001/api/fido/registration/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          employee_id: employeeData.employee_id,
          attResp
        })
      });

      if (verificationResponse.ok) {
        setStep('success');
        sessionStorage.removeItem('registrationData');
        
        // 🔧 不再導向其他頁面，直接停留在此頁面顯示成功狀態
        console.log('✅ FIDO 註冊完成，停留在當前頁面');
      } else {
        const errorData = await verificationResponse.json();
        throw new Error(errorData.error || '註冊驗證失敗');
      }

    } catch (error) {
      console.error('❌ 手機認證器註冊錯誤:', error);
      
      let friendlyMessage = error.message;
      
      if (error.name === 'NotAllowedError') {
        friendlyMessage = '使用者取消了認證程序，請重新嘗試';
      } else if (error.name === 'AbortError') {
        friendlyMessage = '認證程序被中斷，請重新嘗試';
      } else if (error.name === 'NotSupportedError') {
        friendlyMessage = '您的裝置不支援此認證方式';
      } else if (error.name === 'SecurityError') {
        friendlyMessage = '安全性錯誤，請確保在安全的網路環境下操作';
      } else if (error.message.includes('timeout')) {
        friendlyMessage = '認證超時，請確保手機藍牙已開啟並靠近電腦';
      } else if (error.message.includes('challenge')) {
        friendlyMessage = '伺服器回應格式錯誤，請重新整理頁面再試';
      }
      
      setErrorMessage(friendlyMessage);
      setStep('error');
    }

    setIsRegistering(false);
  };

  // 🔧 載入狀態
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  // 🔧 如果沒有員工資料，顯示錯誤
  if (!employeeData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-pink-500 px-8 py-6">
            <h2 className="text-2xl font-bold text-white text-center">驗證失敗</h2>
          </div>
          <div className="px-8 py-6 text-center">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6">
              <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">無法載入員工資料</h3>
            <p className="text-red-600 text-sm mb-6">請重新開始註冊流程</p>
            <button 
              onClick={redirectToLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
            >
              返回登入頁面
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🔧 主要註冊流程
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <h2 className="text-2xl font-bold text-white text-center">設定手機安全金鑰</h2>
          <p className="text-blue-100 text-center mt-2">使用您的手機作為安全登入方式</p>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          <div className="mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">員工：</p>
              <p className="text-lg font-semibold text-gray-900">
                {employeeData.name} ({employeeData.employee_id})
              </p>
            </div>
          </div>

          {step === 'ready' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-blue-100 mb-4">
                  <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">手機安全金鑰設定</h3>
                <p className="text-gray-600 text-sm">您的手機將成為登入系統的安全金鑰</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                  <span className="text-2xl mr-3">📱</span>
                  手機安全金鑰優點
                </h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    使用手機的指紋或臉部辨識登入
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    無需記憶複雜密碼
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    比傳統密碼更加安全
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    支援 Android 和 iPhone
                  </li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">⚠️ 設定前請確認</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• 手機藍牙已開啟</li>
                  <li>• 手機在電腦附近 (建議1公尺內)</li>
                  <li>• 手機已設定指紋或臉部辨識</li>
                  <li>• 使用較新版本的瀏覽器</li>
                </ul>
              </div>

              <button 
                onClick={handleFidoRegistration}
                disabled={isRegistering}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-lg transition duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                開始設定手機安全金鑰
              </button>
            </div>
          )}

          {step === 'registering' && (
            <div className="text-center space-y-6">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-blue-100">
                <div className="animate-pulse">
                  <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">正在設定手機安全金鑰...</h3>
              <p className="text-gray-600">請按照瀏覽器提示完成手機配對</p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-3">📱 設定步驟：</p>
                  <div className="space-y-2 text-left">
                    <div className="flex items-start">
                      <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-3 mt-0.5">1</span>
                      <span>瀏覽器會顯示「使用其他裝置」選項</span>
                    </div>
                    <div className="flex items-start">
                      <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-3 mt-0.5">2</span>
                      <span>選擇「使用手機」或類似選項</span>
                    </div>
                    <div className="flex items-start">
                      <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-3 mt-0.5">3</span>
                      <span>手機會自動偵測並顯示配對通知</span>
                    </div>
                    <div className="flex items-start">
                      <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-3 mt-0.5">4</span>
                      <span>在手機上完成指紋或臉部辨識</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  💡 如果手機沒有反應，請確認藍牙已開啟且手機靠近電腦
                </p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center space-y-6">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">手機安全金鑰設定完成！</h3>
              <p className="text-gray-600">您的手機已成功設定為安全登入金鑰</p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm">
                  🎉 恭喜！下次登入時，只需要使用手機的生物識別即可快速且安全地進入系統。
                </p>
              </div>

              {/* 🔧 新增：返回登入頁面的按鈕 */}
              <button 
                onClick={() => window.location.href = '/login'}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-lg transition duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                </svg>
                立即登入系統
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center space-y-6">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100">
                <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">手機安全金鑰設定失敗</h3>
              <p className="text-red-600 text-sm">{errorMessage}</p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
                <h4 className="font-medium text-yellow-800 mb-2">🔧 故障排除：</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• 確認手機藍牙已開啟並靠近電腦</li>
                  <li>• 檢查手機是否支援 FIDO (Android 7+ 或 iOS 14+)</li>
                  <li>• 嘗試重新整理頁面</li>
                  <li>• 使用較新版本的瀏覽器 (Chrome 67+)</li>
                  <li>• 確認手機已設定生物識別功能</li>
                </ul>
              </div>
              
              <div className="flex space-x-4">
                <button 
                  onClick={() => setStep('ready')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
                >
                  重新嘗試
                </button>
                <button 
                  onClick={redirectToLogin}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
                >
                  稍後設定
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FidoRegistration;