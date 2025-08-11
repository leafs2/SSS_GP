import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminDashboard from './pages/admin/Dashboard';
import AddEmployeePage from './pages/admin/AddEmployeePage';
import { useState } from 'react'
import './App.css'

function App() {

  return (
    <Router>
      <Routes>
        {/* 公開路由 */}
        {/* <Route path="/login" element={<Login />} />
        <Route path="/mobile-auth" element={<MobileAuth />} /> */}
        
        {/* 需要登入的路由 */}
        {/* <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} /> */}
        
        {/* 管理員路由 */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/add" element={<AddEmployeePage />} />
      </Routes>
    </Router>
  )
}

export default App
