import React from 'react';
import logo from './logo.svg';
import './App.css';
import Login from './pages/Login/login';
import Registration from './pages/Register/Register';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RequestForm from './pages/RepairRequest/RepairRequest';
import ProtectedRoute from './pages/Login/ProtectedRoute';
import { UserRole } from './types/auth';
import RequestsAdmin from './pages/Admin/Request/RequestAdmin';
import Dashboard from './pages/Admin/Dashboard/Dashboard';
import AdminLayout from './pages/Layout/AdminLayout';
import DiagnosticActForm from './pages/ServiceIngeneer/DiagnosticActForm';
import EngineerDashboard from './pages/ServiceIngeneer/EngineerDashboard';
import ClientRequests from './pages/Client/ClientRequests';
import ClientLayout from './pages/Client/ClientLayout';
import DiagnosticActView from './pages/Admin/DiagnosticActView';
import ClientDiagnosticActView from './pages/Client/ClientDiagnosticActView';
import GoodsReceiptPage from './pages/Omt/GoodsRecieptPage';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Registration />} />
        <Route path="/login" element={<Login />} />

        <Route path='/act' element={<DiagnosticActForm />} />

        {/* Личный кабинет клиента */}
        <Route path="/client" element={<ClientLayout />}>
          <Route index element={<Navigate to="/client/requests" replace />} />
          <Route path="requests" element={<ClientRequests />} />
          <Route path="repairRequest" element={<RequestForm />} />
          <Route path="/client/acts/:actCode" element={<ClientDiagnosticActView />} />
        </Route>

        {/* другие маршруты */}
        {/* 🔥 Только для диспетчера (админа) - Управление заявками */}
        {/* 🔥 Админ-панель с Layout */}
        <Route path="/admin" element={
          <ProtectedRoute roles={[UserRole.Dispatcher]}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          {/* Вложенные роуты */}
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="requests" element={<RequestsAdmin />} />
        </Route>

        <Route path="/dispatcher/acts/:requestId" element={
          <ProtectedRoute roles={[UserRole.Dispatcher]}>
            <DiagnosticActView />
          </ProtectedRoute>
        } />

        <Route
          path="/omt/requests"
          element={
            <ProtectedRoute roles={[UserRole.OmtEmployee]}>
              <GoodsReceiptPage />
            </ProtectedRoute>
          } />

        <Route path="/engineer" element={<EngineerDashboard />} />
        {/* Форма акта диагностики (по taskId) */}
        <Route path="/engineer/task/:requestId/act" element={<DiagnosticActForm />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
