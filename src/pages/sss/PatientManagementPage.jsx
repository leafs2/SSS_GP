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
  Filter
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

  const handleAddPatient = () => {
    navigate('/sss/patient/add');
  };

  const handleViewPatient = (patientId) => {
    navigate(`/sss/patient/${patientId}`);
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
                    placeholder="搜尋姓名或身分證..."
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          病歷號
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          姓名
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          性別
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          生日 / 年齡
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          身分證
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          血型
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          建檔日期
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {patients.map((patient) => (
                        <tr key={patient.patient_id} className="hover:bg-gray-50">
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
                            <button
                              onClick={() => handleViewPatient(patient.patient_id)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                              title="查看詳情"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
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
    </Layout>
  );
};

export default PatientManagementPage;