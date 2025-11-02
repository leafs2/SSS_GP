import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Calendar,
  CreditCard,
  Droplet,
  AlertCircle,
  Save,
  X,
  Loader2,
  CheckCircle,
  Plus,
  Trash2,
  Pill,
  Heart,
  Users as UsersIcon,
  ActivitySquare,
  Eye
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';

const AddPatientPage = () => {
  const navigate = useNavigate();
  
  // 表單資料
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    bloodType: '',
    birthDate: '',
    idNumber: ''
  });

  // 多選資料
  const [selectedAllergies, setSelectedAllergies] = useState([]);
  const [selectedPersonalHistory, setSelectedPersonalHistory] = useState([]);
  const [selectedLifestyle, setSelectedLifestyle] = useState([]);
  const [familyHistory, setFamilyHistory] = useState([]);

  // 選項資料
  const [options, setOptions] = useState({
    genders: [],
    bloodTypes: [],
    allergies: [],
    histories: [],
    lifestyles: []
  });

  // UI 狀態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // 🔥 預覽相關狀態
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  // 載入選項資料
  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/patients/options/all');
      const data = await response.json();
      
      if (data.success) {
        setOptions(data.data);
      } else {
        setError('載入選項失敗');
      }
    } catch (error) {
      console.error('載入選項失敗:', error);
      setError('無法連接到伺服器');
    } finally {
      setLoading(false);
    }
  };

  // 處理基本資料變更
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 處理藥物過敏選擇
  const handleAllergyToggle = (allergyId) => {
    setSelectedAllergies(prev => {
      if (prev.includes(allergyId)) {
        return prev.filter(id => id !== allergyId);
      } else {
        return [...prev, allergyId];
      }
    });
  };

  // 處理個人病史選擇
  const handlePersonalHistoryToggle = (historyId) => {
    setSelectedPersonalHistory(prev => {
      if (prev.includes(historyId)) {
        return prev.filter(id => id !== historyId);
      } else {
        return [...prev, historyId];
      }
    });
  };

  // 處理生活習慣選擇
  const handleLifestyleToggle = (lifestyleId) => {
    setSelectedLifestyle(prev => {
      if (prev.includes(lifestyleId)) {
        return prev.filter(id => id !== lifestyleId);
      } else {
        return [...prev, lifestyleId];
      }
    });
  };

  // 新增家族病史項目
  const addFamilyHistory = () => {
    setFamilyHistory(prev => [...prev, { historyId: '', kinship: '' }]);
  };

  // 移除家族病史項目
  const removeFamilyHistory = (index) => {
    setFamilyHistory(prev => prev.filter((_, i) => i !== index));
  };

  // 更新家族病史項目
  const updateFamilyHistory = (index, field, value) => {
    setFamilyHistory(prev => {
      const newHistory = [...prev];
      newHistory[index] = {
        ...newHistory[index],
        [field]: field === 'historyId' ? parseInt(value) : value
      };
      return newHistory;
    });
  };

  // 🔥 預覽病患資料
  const handlePreview = async () => {
    setError(null);

    // 驗證基本資料
    if (!formData.name.trim()) {
      setError('請輸入姓名');
      return;
    }
    if (!formData.gender) {
      setError('請選擇性別');
      return;
    }
    if (!formData.bloodType) {
      setError('請選擇血型');
      return;
    }
    if (!formData.birthDate) {
      setError('請輸入生日');
      return;
    }
    if (!formData.idNumber.trim()) {
      setError('請輸入身分證號碼');
      return;
    }

    const idPattern = /^[A-Z][12]\d{8}$/;
    if (!idPattern.test(formData.idNumber)) {
      setError('身分證號碼格式不正確');
      return;
    }

    setPreviewing(true);

    try {
      const response = await fetch('http://localhost:3001/api/patients/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          gender: parseInt(formData.gender),
          bloodType: parseInt(formData.bloodType),
          birthDate: formData.birthDate,
          idNumber: formData.idNumber.trim().toUpperCase(),
        })
      });

      const data = await response.json();

      if (data.success) {
        setPreviewData(data.data);
        setShowPreview(true);
      } else {
        setError(data.error || '預覽失敗');
      }
    } catch (error) {
      console.error('預覽失敗:', error);
      setError('無法連接到伺服器');
    } finally {
      setPreviewing(false);
    }
  };

  // 🔥 確認後儲存
  const handleConfirmSave = async () => {
    setError(null);

    // 驗證家族病史
    for (let i = 0; i < familyHistory.length; i++) {
      if (!familyHistory[i].historyId || !familyHistory[i].kinship.trim()) {
        setError(`請完整填寫第 ${i + 1} 項家族病史`);
        setShowPreview(false);
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        gender: parseInt(formData.gender),
        bloodType: parseInt(formData.bloodType),
        birthDate: formData.birthDate,
        idNumber: formData.idNumber.trim().toUpperCase(),
        allergies: selectedAllergies,
        personalHistory: selectedPersonalHistory,
        familyHistory: familyHistory.filter(item => item.historyId && item.kinship),
        lifestyle: selectedLifestyle
      };

      const response = await fetch('http://localhost:3001/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setShowPreview(false);
        // 2 秒後跳轉回列表
        setTimeout(() => {
          navigate('/sss/patient/management');
        }, 2000);
      } else {
        setError(data.error || '新增失敗');
        setShowPreview(false);
      }
    } catch (error) {
      console.error('新增病患失敗:', error);
      setError('無法連接到伺服器');
      setShowPreview(false);
    } finally {
      setSaving(false);
    }
  };

  // 取消並返回
  const handleCancel = () => {
    if (confirm('確定要取消嗎？未儲存的資料將會遺失。')) {
      navigate('/sss/patient/management');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-full bg-gray-50">
          <PageHeader title="新增病患" subtitle="建立新的病患資料" />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-600">載入表單中...</span>
            </div>
          </main>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        <PageHeader 
          title="新增病患" 
          subtitle="建立新的病患資料"
        />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 成功訊息 */}
          {success && (
            <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-800 mb-1">新增成功！</h3>
                <p className="text-green-700 text-sm">病患資料已成功建立，正在返回列表...</p>
              </div>
            </div>
          )}

          {/* 錯誤訊息 */}
          {error && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 mb-1">發生錯誤</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

            {/* 🔥 預覽確認對話框 - 重新設計版本 */}
            {showPreview && previewData && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full">
                {/* 標題 */}
                <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-lg">
                    <h3 className="text-xl font-bold text-gray-900">資料確認</h3>
                    <p className="text-sm text-gray-600 mt-1">請確認以下資訊是否正確</p>
                </div>

                {/* 內容區 - 左右兩欄布局 */}
                <div className="p-6">
                    <div className="grid grid-cols-2 gap-8">
                    {/* 左欄：基本資料 */}
                    <div className="space-y-2.5">
                        <h4 className="text-base font-semibold text-gray-900 mb-3 pb-2 border-b">基本資料</h4>
                        
                        <div className="flex items-center py-1.5 border-b">
                        <span className="text-sm text-gray-600 w-44">病歷號：</span>
                        <span className="text-base font-bold text-blue-600 font-mono">{previewData.patientId}</span>
                        </div>
                        
                        <div className="flex items-center py-1.5 border-b">
                        <span className="text-sm text-gray-600 w-44">姓名：</span>
                        <span className="text-base font-medium text-gray-900">{previewData.name}</span>
                        </div>
                        
                        <div className="flex items-center py-1.5 border-b">
                        <span className="text-sm text-gray-600 w-44">身分證號碼：</span>
                        <span className="text-base font-medium text-gray-900 font-mono">{previewData.idNumber}</span>
                        </div>
                        
                        <div className="flex items-center py-1.5 border-b">
                        <span className="text-sm text-gray-600 w-44">生日：</span>
                        <span className="text-base font-medium text-gray-900">{previewData.birthDate}</span>
                        </div>
                        
                        <div className="flex items-center py-1.5 border-b">
                        <span className="text-sm text-gray-600 w-44">年齡：</span>
                        <span className="text-base font-medium text-gray-900">{previewData.age} 歲</span>
                        </div>
                        
                        <div className="flex items-center py-1.5 border-b">
                        <span className="text-sm text-gray-600 w-44">性別：</span>
                        <span className="text-base font-medium text-gray-900">{previewData.gender}</span>
                        </div>
                        
                        <div className="flex items-center py-1.5 border-b">
                        <span className="text-sm text-gray-600 w-44">血型：</span>
                        <span className="text-base font-medium text-gray-900">{previewData.bloodType}</span>
                        </div>
                    </div>

                    {/* 右欄：病史資料 + 按鈕區 */}
                    <div className="flex flex-col">
                        <div className="space-y-2.5 flex-1">
                        <h4 className="text-base font-semibold text-gray-900 mb-3 pb-2 border-b">病史資料</h4>
                        
                        {/* 藥物過敏 */}
                        <div className="flex items-center py-1.5 border-b">
                            <span className="text-sm text-gray-600 w-28 flex-shrink-0">藥物過敏：</span>
                            <span className="text-base">
                            {selectedAllergies.length === 0 ? (
                                <span className="text-gray-500">無</span>
                            ) : (
                                <span className="text-gray-900">
                                {selectedAllergies.map((allergyId, index) => {
                                    const allergy = options.allergies.find(a => a.id === allergyId);
                                    return (
                                    <span key={allergyId}>
                                        {allergy?.drug_allergy}
                                        {index < selectedAllergies.length - 1 && '、'}
                                    </span>
                                    );
                                })}
                                </span>
                            )}
                            </span>
                        </div>
                        
                        {/* 個人病史 */}
                        <div className="flex items-center py-1.5 border-b">
                            <span className="text-sm text-gray-600 w-28 flex-shrink-0">個人病史：</span>
                            <span className="text-base ">
                            {selectedPersonalHistory.length === 0 ? (
                                <span className="text-gray-500">無</span>
                            ) : (
                                <span className="text-gray-900">
                                {selectedPersonalHistory.map((historyId, index) => {
                                    const history = options.histories.find(h => h.id === historyId);
                                    return (
                                    <span key={historyId}>
                                        {history?.history_option}
                                        {index < selectedPersonalHistory.length - 1 && '、'}
                                    </span>
                                    );
                                })}
                                </span>
                            )}
                            </span>
                        </div>
                        
                        {/* 家族病史 */}
                        <div className="flex items-center py-1.5 border-b">
                            <span className="text-sm text-gray-600 w-28 flex-shrink-0">家族病史：</span>
                            <span className="text-base">
                            {familyHistory.filter(f => f.historyId && f.kinship).length === 0 ? (
                                <span className="text-gray-500">無</span>
                            ) : (
                                <span className="text-gray-900">
                                {familyHistory
                                    .filter(f => f.historyId && f.kinship)
                                    .map((item, index) => {
                                    const history = options.histories.find(h => h.id === item.historyId);
                                    return (
                                        <span key={index}>
                                        {history?.history_option}（{item.kinship}）
                                        {index < familyHistory.filter(f => f.historyId && f.kinship).length - 1 && '、'}
                                        </span>
                                    );
                                    })}
                                </span>
                            )}
                            </span>
                        </div>
                        
                        {/* 生活習慣 */}
                        <div className="flex items-center py-1.5 border-b">
                            <span className="text-sm text-gray-600 w-28 flex-shrink-0">生活習慣：</span>
                            <span className="text-base">
                            {selectedLifestyle.length === 0 ? (
                                <span className="text-gray-500">無</span>
                            ) : (
                                <span className="text-gray-900">
                                {selectedLifestyle.map((lifestyleId, index) => {
                                    const lifestyle = options.lifestyles.find(l => l.id === lifestyleId);
                                    return (
                                    <span key={lifestyleId}>
                                        {lifestyle?.lifestyle}
                                        {index < selectedLifestyle.length - 1 && '、'}
                                    </span>
                                    );
                                })}
                                </span>
                            )}
                            </span>
                        </div>
                        </div>

                        {/* 警告提示 + 按鈕區（整合在右下方） */}
                        <div className="mt-4 space-y-4">
                        {/* 警告提示 */}
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                            <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-xs font-medium text-yellow-800 text-left">重要提醒</p>
                                <p className="text-xs text-yellow-700 mt-2 text-left">
                                點擊「確認新增」後，系統將建立病歷號為 <span className="font-bold">{previewData.patientId}</span> 的病患資料。此操作無法復原。
                                </p>
                            </div>
                            </div>
                        </div>

                        {/* 按鈕 */}
                        <div className="flex justify-end gap-3">
                            <button
                            type="button"
                            onClick={() => setShowPreview(false)}
                            disabled={saving}
                            className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
                            >
                            取消
                            </button>
                            <button
                            type="button"
                            onClick={handleConfirmSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                            >
                            {saving ? (
                                <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                儲存中...
                                </>
                            ) : (
                                <>
                                <CheckCircle className="w-5 h-5" />
                                確認新增
                                </>
                            )}
                            </button>
                        </div>
                        </div>
                    </div>
                    </div>
                </div>
                </div>
            </div>
            )}
          <form onSubmit={(e) => { e.preventDefault(); handlePreview(); }} className="space-y-6">
            {/* 基本資料 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                基本資料
              </h2>

              <div className="space-y-4">
                {/* 第一行：姓名 + 身分證 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 姓名 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      姓名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="請輸入姓名"
                      required
                    />
                  </div>

                  {/* 身分證 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      身分證號碼 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="idNumber"
                        value={formData.idNumber}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                        placeholder="A123456789"
                        maxLength="10"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 第二行：生日 + 性別 + 血型 */}
                <div className="grid grid-cols-3 gap-4">
                  {/* 生日 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      生日 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        name="birthDate"
                        value={formData.birthDate}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* 性別 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      性別 <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">請選擇</option>
                      {options.genders.map(g => (
                        <option key={g.id} value={g.id}>{g.gender}</option>
                      ))}
                    </select>
                  </div>

                  {/* 血型 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      血型 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Droplet className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        name="bloodType"
                        value={formData.bloodType}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">請選擇</option>
                        {options.bloodTypes.map(bt => (
                          <option key={bt.id} value={bt.id}>{bt.blood_type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 藥物過敏 + 生活習慣 (左右並排) */}
            <div className="grid grid-cols-2 gap-6">
              {/* 藥物過敏 (左側) */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-red-600" />
                  藥物過敏
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {options.allergies.map(allergy => (
                    <label
                      key={allergy.id}
                      className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedAllergies.includes(allergy.id)
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAllergies.includes(allergy.id)}
                        onChange={() => handleAllergyToggle(allergy.id)}
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                      />
                      <span className="text-sm">{allergy.drug_allergy}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 生活習慣 (右側) */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ActivitySquare className="w-5 h-5 text-purple-600" />
                  生活習慣
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {options.lifestyles.map(lifestyle => (
                    <label
                      key={lifestyle.id}
                      className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedLifestyle.includes(lifestyle.id)
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLifestyle.includes(lifestyle.id)}
                        onChange={() => handleLifestyleToggle(lifestyle.id)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm">{lifestyle.lifestyle}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 個人病史 + 家族病史 (左右並排) */}
            <div className="grid grid-cols-2 gap-6">
              {/* 個人病史 (左側) */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-blue-600" />
                  個人病史
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {options.histories.map(history => (
                    <label
                      key={history.id}
                      className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedPersonalHistory.includes(history.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPersonalHistory.includes(history.id)}
                        onChange={() => handlePersonalHistoryToggle(history.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm">{history.history_option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 家族病史 (右側) */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <UsersIcon className="w-5 h-5 text-green-600" />
                    家族病史
                  </h2>
                  <button
                    type="button"
                    onClick={addFamilyHistory}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    新增
                  </button>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {familyHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-8">
                      尚未新增家族病史
                    </p>
                  ) : (
                    familyHistory.map((item, index) => (
                      <div key={index} className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600">項目 {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeFamilyHistory(index)}
                            className="text-red-600 hover:bg-red-50 rounded p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <select
                          value={item.historyId}
                          onChange={(e) => updateFamilyHistory(index, 'historyId', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">選擇病史</option>
                          {options.histories.map(h => (
                            <option key={h.id} value={h.id}>{h.history_option}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={item.kinship}
                          onChange={(e) => updateFamilyHistory(index, 'kinship', e.target.value)}
                          placeholder="親屬關係 (例：父親、母親)"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 🔥 操作按鈕 - 改為預覽 */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving || previewing}
                className="flex items-center gap-2 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
                取消
              </button>
              <button
                type="submit"
                disabled={saving || previewing || success}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {previewing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5" />
                    預覽並確認
                  </>
                )}
              </button>
            </div>
          </form>
        </main>
      </div>
    </Layout>
  );
};

export default AddPatientPage;