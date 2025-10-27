import React, { useState, useEffect } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext'; // 引入 AuthContext

const HospitalLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth(); // 取得 login 方法
  
  const [loginStep, setLoginStep] = useState('ready'); // ready, qr-code, authenticating, success, error
  const [authOptions, setAuthOptions] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const startLogin = async () => {
    setIsLoading(true);
    setLoginStep('qr-code');
    
    try {
      console.log('🔐 開始登入流程...');
      
      // 調用後端 API 獲取認證選項
      const response = await fetch('http://localhost:3001/api/fido/authentication/begin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include' // 重要：包含 cookies 以支援 session
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '無法開始登入程序');
      }

      const data = await response.json();
      console.log('✅ 獲取認證選項成功');

      setAuthOptions(data.options);
      setSessionId(data.sessionId);
      setIsLoading(false);

      // 等待一下讓 UI 更新，然後自動開始認證
      setTimeout(async () => {
        await handleAuthentication(data.options, data.sessionId);
      }, 1500);
      
    } catch (error) {
      console.error('❌ 開始登入失敗:', error);
      setErrorMessage(error.message || '無法連接到伺服器，請稍後再試');
      setLoginStep('error');
      setIsLoading(false);
    }
  };

  const handleAuthentication = async (options, sessionId) => {
    setLoginStep('authenticating');
    
    try {
      console.log('📱 啟動手機認證器...');
      
      // 使用 SimpleWebAuthn 啟動認證
      const attResp = await startAuthentication(options);
      
      console.log('📱 手機認證完成，正在驗證...');

      // 驗證認證結果
      const verificationResponse = await fetch('http://localhost:3001/api/fido/authentication/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include', // 重要：包含 cookies 以支援 session
        body: JSON.stringify({
          sessionId,
          attResp
        })
      });

      if (verificationResponse.ok) {
        const result = await verificationResponse.json();
        
        console.log('✅ 登入成功:', result.user.name);
        setUserInfo(result.user);
        setLoginStep('success');
        
        // 🔥 關鍵修改：使用 AuthContext 的 login 方法來設定登入狀態
        login(result.user);
        
        // 登入成功後，根據角色跳轉到對應頁面
        setTimeout(() => {
          if (result.user.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/sss/homepage');
          }
        }, 2000);
        
      } else {
        const errorData = await verificationResponse.json();
        throw new Error(errorData.error || '認證驗證失敗');
      }

    } catch (error) {
      console.error('❌ 手機認證失敗:', error);
      
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
      }
      
      setErrorMessage(friendlyMessage);
      setLoginStep('error');
    }
  };

  const resetLogin = () => {
    setLoginStep('ready');
    setAuthOptions(null);
    setSessionId('');
    setErrorMessage('');
    setUserInfo(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6">
          <div className="text-center">
            <div className="mb-3">
              <svg className="h-12 w-12 text-white mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">醫院手術排程系統</h1>
            <p className="text-blue-100 text-sm mt-1">Surgery Scheduling System</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          
          {/* Ready State */}
          {loginStep === 'ready' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">安全登入</h2>
                <p className="text-gray-600 text-sm">使用您的手機進行生物識別登入</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-3 text-sm">👩‍⚕️ 醫護專用系統</h3>
                <div className="text-xs text-blue-800 space-y-2">
                  <div className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span>安全的手術排程管理</span>
                  </div>
                  <div className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span>即時手術室狀態更新</span>
                  </div>
                  <div className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span>醫師護士協作平台</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={startLogin}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-lg shadow-lg transition duration-200 flex items-center justify-center space-x-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>開始登入</span>
              </button>

              <div className="text-center">
                <p className="text-xs text-gray-500">
                  使用 FIDO2 安全認證標準
                </p>
              </div>
            </div>
          )}

          {/* QR Code / Preparing State */}
          {loginStep === 'qr-code' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">準備手機認證</h2>
                <p className="text-gray-600 text-sm">系統正在準備認證選項...</p>
              </div>

              {/* Loading or Ready Display */}
              <div className="bg-white border-2 border-gray-200 rounded-lg p-6 text-center">
                <div className="bg-gray-100 h-48 w-48 mx-auto rounded-lg flex items-center justify-center mb-4">
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  ) : (
                    <div className="text-center">
                      <div className="bg-blue-600 h-32 w-32 mx-auto mb-3 rounded flex items-center justify-center">
                        <svg className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-500">即將啟動手機認證</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2 text-sm">📱 即將進行的步驟</h3>
                <div className="text-xs text-blue-800 space-y-2">
                  <div className="flex items-start">
                    <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs mr-3 mt-0.5">1</span>
                    <span>系統將自動偵測您的手機</span>
                  </div>
                  <div className="flex items-start">
                    <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs mr-3 mt-0.5">2</span>
                    <span>手機會彈出認證通知</span>
                  </div>
                  <div className="flex items-start">
                    <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs mr-3 mt-0.5">3</span>
                    <span>在手機上完成生物識別驗證</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={resetLogin}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
              >
                取消登入
              </button>
            </div>
          )}

          {/* Authenticating State */}
          {loginStep === 'authenticating' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                  <div className="animate-pulse">
                    <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">正在驗證身份...</h2>
                <p className="text-gray-600 text-sm">請在手機上完成生物識別驗證</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-blue-800 text-sm font-medium">等待手機驗證中...</p>
                <p className="text-blue-700 text-xs mt-2">請確保在手機上完成指紋或臉部辨識</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-800 text-xs">
                  💡 如果手機沒有彈出驗證畫面，請確認手機藍牙已開啟且在電腦附近
                </p>
              </div>
            </div>
          )}

          {/* Success State */}
          {loginStep === 'success' && userInfo && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">登入成功！</h2>
                <p className="text-gray-600 text-sm">正在導向手術排程系統...</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900 mb-3 text-sm">✅ 歡迎回來</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700">員工編號</span>
                    <span className="text-sm font-semibold text-green-900">{userInfo.employee_id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700">姓名</span>
                    <span className="text-sm font-semibold text-green-900">{userInfo.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700">部門</span>
                    <span className="text-sm font-semibold text-green-900">{userInfo.department_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700">職位</span>
                    <span className="text-sm font-semibold text-green-900">{userInfo.role_display}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-blue-800 text-sm">自動跳轉中，請稍候...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {loginStep === 'error' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                  <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">登入失敗</h2>
                <p className="text-red-600 text-sm">{errorMessage}</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-800 mb-2 text-sm">🔧 故障排除</h3>
                <div className="text-xs text-yellow-700 space-y-1">
                  <div>• 確認手機已完成系統註冊</div>
                  <div>• 檢查手機藍牙功能已開啟</div>
                  <div>• 確保手機在電腦附近（1公尺內）</div>
                  <div>• 重新整理頁面再次嘗試</div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button 
                  onClick={resetLogin}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
                >
                  重新登入
                </button>
                <button 
                  onClick={() => window.location.href = '/support'}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
                >
                  技術支援
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default HospitalLogin;