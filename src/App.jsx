import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './pages/login/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/admin/Dashboard';
import AddEmployeePage from './pages/admin/AddEmployeePage';
import EmployeeVerification from './pages/register/EmployeeVerification';
import FidoRegistration from './pages/register/FidoRegistration';
import HospitalLogin from './pages/login/HospitalLogin';
import Homepage from './pages/sss/Homepage'; 
import AddSchedulePage from './pages/sss/AddSchedulePage'; 
import ShiftPlanningPage from './pages/sss/ShiftPlanningPage'; 
import OperatingRoomStatus from './pages/sss/OperatingRoomStatus'; 
import NavigationPage from './pages/NavigationPage';
import QuickLogin from './pages/login/QuickLogin';
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* 公開路由 */}
          <Route path="/" element={<NavigationPage />} />
          <Route path="/login" element={<HospitalLogin />} />
          
          {/* 註冊相關（公開） */}
          <Route path="/register/:token" element={<EmployeeVerification />} />
          <Route path="/register/fido" element={<FidoRegistration />} />
          
          {/* 開發模式路由（公開，但內部會檢查開發環境） */}
          <Route path="/dev/quick-login" element={<QuickLogin />} />
          
          {/* 需要登入的主系統路由 */}
          <Route 
            path="/sss/homepage" 
            element={
              <ProtectedRoute>
                <Homepage />
              </ProtectedRoute>
            } 
          />
          
          {/* 需要修改權限的路由 */}
          <Route 
            path="/sss/add/schedule" 
            element={
              <ProtectedRoute requirePermission="1">
                <AddSchedulePage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/sss/shift/planning" 
            element={
              <ProtectedRoute requirePermission="1">
                <ShiftPlanningPage />
              </ProtectedRoute>
            } 
          />
          
          {/* 僅需要登入的路由 */}
          <Route 
            path="/sss/operation/rooms" 
            element={
              <ProtectedRoute>
                <OperatingRoomStatus />
              </ProtectedRoute>
            } 
          />
          
          {/* 管理員路由（不需要驗證，根據你的需求） */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/add" element={<AddEmployeePage />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App