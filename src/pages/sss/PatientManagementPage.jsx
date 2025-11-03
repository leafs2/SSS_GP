import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Filter,
  User,
  Calendar,
  Droplet,
  FileText,
  Heart,
  Activity,
  AlertTriangle
} from 'lucide-react';
import Layout from './components/Layout';
import PageHeader from './components/PageHeader';

const PatientManagementPage = () => {
  const navigate = useNavigate();
  
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 搜尋和篩選
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('');
  
  // 分頁
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // 選項資料
  const [options, setOptions] = useState({
    genders: [],
    bloodTypes: []
  });

  // 刪除確認對話框
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    patient: null,
    loading: false
  });

  // 病患詳細資訊對話框
  const [detailDialog, setDetailDialog] = useState({
    open: false,
    patient: null,
    loading: false
  });

  // 載入選項
  useEffect(() => {
    loadOptions();
  }, []);

  // 載入病患列表
  useEffect(() => {
    loadPatients();
  }, [currentPage, searchTerm, genderFilter, bloodTypeFilter]);

  const loadOptions = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/patients/options/all');
      const data = await response.json();
      
      if (data.success) {
        setOptions({
          genders: data.data.genders,
          bloodTypes: data.data.bloodTypes
        });
      }
    } catch (error) {
      console.error('載入選項失敗:', error);
    }
  };

  const loadPatients = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        ...(searchTerm && { search: searchTerm }),
        ...(genderFilter && { gender: genderFilter }),
        ...(bloodTypeFilter && { bloodType: bloodTypeFilter })
      });

      const response = await fetch(`http://localhost:3001/api/patients?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setPatients(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('載入病患列表失敗:', error);
      setError('無法連接到伺服器');
    } finally {
      setLoading(false);
    }
  };

  const loadPatientDetail = async (patientId) => {
    setDetailDialog({ open: true, patient: null, loading: true });

    try {
      const response = await fetch(`http://localhost:3001/api/patients/${patientId}`);
      const data = await response.json();

      if (data.success) {
        setDetailDialog({ open: true, patient: data.data, loading: false });
      } else {
        alert('載入病患詳細資料失敗');
        setDetailDialog({ open: false, patient: null, loading: false });
      }
    } catch (error) {
      console.error('載入病患詳細資料失敗:', error);
      alert('無法連接到伺服器');
      setDetailDialog({ open: false, patient: null, loading: false });
    }
  };

  const handleAddPatient = () => {
    navigate('/sss/patient/add');
  };

  const handleViewPatient = (patientId, e) => {
    e.stopPropagation();
    loadPatientDetail(patientId);
  };

  const handleRowClick = (patientId) => {
    loadPatientDetail(patientId);
  };

  const handleEditPatient = (patientId, e) => {
    e.stopPropagation();
    navigate(`/sss/patient/edit/${patientId}`);
  };

  const handleDeleteClick = (patient, e) => {
    e.stopPropagation();
    setDeleteDialog({
      open: true,
      patient: patient,
      loading: false
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.patient) return;

    setDeleteDialog(prev => ({ ...prev, loading: true }));

    try {
      const response = await fetch(
        `http://localhost:3001/api/patients/${deleteDialog.patient.patient_id}`,
        {
          method: 'DELETE'
        }
      );

      const data = await response.json();

      if (data.success) {
        await loadPatients();
        setDeleteDialog({ open: false, patient: null, loading: false });
        alert('病患資料已成功刪除');
      } else {
        alert(data.error || '刪除失敗');
        setDeleteDialog(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('刪除病患失敗:', error);
      alert('刪除失敗：無法連接到伺服器');
      setDeleteDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, patient: null, loading: false });
  };

  const handleCloseDetail = () => {
    setDetailDialog({ open: false, patient: null, loading: false });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setGenderFilter('');
    setBloodTypeFilter('');
    setCurrentPage(1);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW');
  };

  const calculateAge = (birthDate) => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <Layout>
      <div className="min-h-full bg-gray-50">
        <PageHeader 
          title="病患資訊管理" 
          subtitle="管理所有病患基本資料與病史"
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 統計卡片 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">總病患數</p>
                  <p className="text-2xl font-bold text-gray-900">{total}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 主要內容區 */}
          <div className="bg-white rounded-lg shadow">
            {/* 搜尋和篩選區 */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">病患列表</h2>
                <button
                  onClick={handleAddPatient}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  新增病患
                </button>
              </div>

              {/* 搜尋和篩選 */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜尋姓名 / 身分證 / 病歷號"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <select
                  value={genderFilter}
                  onChange={(e) => {
                    setGenderFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">所有性別</option>
                  {options.genders.map(g => (
                    <option key={g.id} value={g.id}>{g.gender}</option>
                  ))}
                </select>

                <select
                  value={bloodTypeFilter}
                  onChange={(e) => {
                    setBloodTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">所有血型</option>
                  {options.bloodTypes.map(bt => (
                    <option key={bt.id} value={bt.id}>{bt.blood_type}</option>
                  ))}
                </select>
              </div>

              {/* 篩選結果提示 */}
              {(searchTerm || genderFilter || bloodTypeFilter) && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    顯示 {patients.length} 筆結果，共 {total} 筆病患資料
                  </div>
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <X className="w-4 h-4" />
                    清除篩選
                  </button>
                </div>
              )}
            </div>

            {/* 病患列表 */}
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">載入病患資料中...</p>
              </div>
            ) : error ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 font-medium mb-2">載入失敗</p>
                <p className="text-gray-600 text-sm mb-4">{error}</p>
                <button
                  onClick={loadPatients}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  重新載入
                </button>
              </div>
            ) : patients.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || genderFilter || bloodTypeFilter
                    ? '找不到符合條件的病患'
                    : '尚無病患資料'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || genderFilter || bloodTypeFilter
                    ? '請調整搜尋條件'
                    : '開始新增第一位病患'}
                </p>
                {!searchTerm && !genderFilter && !bloodTypeFilter && (
                  <button
                    onClick={handleAddPatient}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    新增第一位病患
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                          病歷號
                        </th>
                        <th className="px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                          姓名
                        </th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          性別
                        </th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          生日 / 年齡
                        </th>
                        <th className="px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                          身分證
                        </th>
                        <th className="px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                          血型
                        </th>
                        <th className="px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                          建檔日期
                        </th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {patients.map((patient) => (
                        <tr 
                          key={patient.patient_id} 
                          onClick={() => handleRowClick(patient.patient_id)}
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {patient.patient_id}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {patient.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {patient.gender_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatDate(patient.birth_date)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {patient.age} 歲
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-mono text-gray-900">
                              {patient.id_number}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              {patient.blood_type_name}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {formatDate(patient.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleViewPatient(patient.patient_id, e)}
                                className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-100"
                                title="查看詳情"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleEditPatient(patient.patient_id, e)}
                                className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-100"
                                title="編輯資料"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(patient, e)}
                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-100"
                                title="刪除病患"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 分頁 */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      顯示第 {(currentPage - 1) * 20 + 1} - {Math.min(currentPage * 20, total)} 筆，共 {total} 筆
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        上一頁
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const page = i + 1;
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 rounded-lg ${
                                currentPage === page
                                  ? 'bg-blue-600 text-white'
                                  : 'border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        下一頁
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* 病患詳細資訊對話框 */}
      {detailDialog.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* 標題列 */}
            <div className="bg-blue-400 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6" />
                <h2 className="text-xl font-semibold">病患詳細資訊</h2>
              </div>
              <button
                onClick={handleCloseDetail}
                className="hover:bg-blue-700 p-1 rounded transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 內容區 */}
            <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
              {detailDialog.loading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">載入病患資料中...</p>
                </div>
              ) : detailDialog.patient ? (
                <div className="p-6 space-y-6">
                  {/* 基本資訊 - 左右條列式 */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <User className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">基本資訊</h3>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-x-12 gap-y-3">
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">病歷號</label>
                          <p className="text-base font-medium text-gray-900">
                            {detailDialog.patient.patient_id}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">姓名</label>
                          <p className="text-base font-medium text-gray-900">
                            {detailDialog.patient.name}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">性別</label>
                          <p className="text-base font-medium text-gray-900">
                            {detailDialog.patient.gender_name}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">血型</label>
                          <p className="text-base font-medium text-gray-900">
                            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">
                              {detailDialog.patient.blood_type_name}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">生日</label>
                          <p className="text-base font-medium text-gray-900">
                            {formatDate(detailDialog.patient.birth_date)}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">年齡</label>
                          <p className="text-base font-medium text-gray-900">
                            {calculateAge(detailDialog.patient.birth_date)} 歲
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">身分證</label>
                          <p className="text-base font-medium font-mono text-gray-900">
                            {detailDialog.patient.id_number}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <label className="text-sm text-gray-600 w-24">建檔日期</label>
                          <p className="text-base font-medium text-gray-900">
                            {formatDate(detailDialog.patient.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 所有主題區 - 橫向排列 */}
                  <div className="grid grid-cols-4 gap-4">
                    {/* 藥物過敏 */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <h3 className="text-sm font-semibold text-gray-900">藥物過敏</h3>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 flex-1 overflow-y-auto max-h-48">
                        {detailDialog.patient.allergies && detailDialog.patient.allergies.length > 0 ? (
                          <div className="space-y-2">
                            {detailDialog.patient.allergies.map((allergy) => (
                              <div
                                key={allergy.allergy_id}
                                className="bg-orange-200 text-orange-800 px-3 py-2 rounded-lg text-sm font-medium"
                              >
                                {allergy.drug_allergy}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">無記錄</p>
                        )}
                      </div>
                    </div>

                    {/* 個人病史 */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <h3 className="text-sm font-semibold text-gray-900">個人病史</h3>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 flex-1 overflow-y-auto max-h-48">
                        {detailDialog.patient.personalHistory && detailDialog.patient.personalHistory.length > 0 ? (
                          <div className="space-y-2">
                            {detailDialog.patient.personalHistory.map((history) => (
                              <div
                                key={history.history_id}
                                className="bg-purple-200 text-purple-800 px-3 py-2 rounded-lg text-sm font-medium"
                              >
                                {history.history_option}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">無記錄</p>
                        )}
                      </div>
                    </div>

                    {/* 家族病史 */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <Heart className="w-4 h-4 text-pink-600" />
                        <h3 className="text-sm font-semibold text-gray-900">家族病史</h3>
                      </div>
                      <div className="bg-pink-50 rounded-lg p-3 flex-1 overflow-y-auto max-h-48">
                        {detailDialog.patient.familyHistory && detailDialog.patient.familyHistory.length > 0 ? (
                          <div className="space-y-2">
                            {detailDialog.patient.familyHistory.map((history, index) => (
                              <div key={index} className="bg-pink-200 text-pink-800 px-3 py-2 rounded-lg text-sm font-medium">
                                <div>{history.history_option}</div>
                                <div className="text-xs text-pink-700 mt-1">({history.kinship})</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">無記錄</p>
                        )}
                      </div>
                    </div>

                    {/* 生活習慣 */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-green-600" />
                        <h3 className="text-sm font-semibold text-gray-900">生活習慣</h3>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 flex-1 overflow-y-auto max-h-48">
                        {detailDialog.patient.lifestyle && detailDialog.patient.lifestyle.length > 0 ? (
                          <div className="space-y-2">
                            {detailDialog.patient.lifestyle.map((item) => (
                              <div
                                key={item.lifestyle_id}
                                className="bg-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-medium"
                              >
                                {item.lifestyle}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">無記錄</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 底部操作區 */}
            {!detailDialog.loading && detailDialog.patient && (
              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    handleCloseDetail();
                    handleEditPatient(detailDialog.patient.patient_id, { stopPropagation: () => {} });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  編輯資料
                </button>
                <button
                  onClick={handleCloseDetail}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  關閉
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 刪除確認對話框 */}
      {deleteDialog.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    確認刪除病患
                  </h3>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-600 mb-3">
                  您確定要刪除以下病患的資料嗎？此操作無法復原。
                </p>
                {deleteDialog.patient && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-600">病歷號：</div>
                      <div className="font-medium">{deleteDialog.patient.patient_id}</div>
                      <div className="text-gray-600">姓名：</div>
                      <div className="font-medium">{deleteDialog.patient.name}</div>
                      <div className="text-gray-600">身分證：</div>
                      <div className="font-medium">{deleteDialog.patient.id_number}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleteDialog.loading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteDialog.loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleteDialog.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      刪除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      確認刪除
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default PatientManagementPage;