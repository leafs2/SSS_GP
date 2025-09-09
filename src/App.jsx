import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminDashboard from './pages/admin/Dashboard';
import AddEmployeePage from './pages/admin/AddEmployeePage';
import EmployeeVerification from './pages/register/EmployeeVerification';
import FidoRegistration from './pages/register/FidoRegistration';
import HospitalLogin from './pages/login/HospitalLogin';
import Homepage from './pages/sss/Homepage'; 
import NavigationPage from './pages/NavigationPage'; 

import { useState } from 'react'
import './App.css'

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<NavigationPage />} />
        {/* 公開路由 */}
        <Route path="/login" element={<HospitalLogin />} />
        
        {/* 需要登入的路由 */}
        {/* <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} /> */}
        {/* 從註冊信件點擊進入的驗證頁面 */}
        <Route path="/register/:token" element={<EmployeeVerification />} />

        {/* 主系統 */}
        <Route path="/sss/homepage" element={<Homepage />} />
        
        {/* FIDO 註冊頁面 */}
        <Route path="/register/fido" element={<FidoRegistration />} />
        
        {/* 管理員路由 */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/add" element={<AddEmployeePage />} />
      </Routes>
    </Router>
  )
}

export default App
