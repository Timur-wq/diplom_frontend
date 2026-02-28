import React from 'react';
import logo from './logo.svg';
import './App.css';
import Login from './pages/Login/login';
import Registration from './pages/Register/Registration';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RequestForm from './pages/RepairRequest/RepairRequest';
import ProtectedRoute from './pages/Login/ProtectedRoute';
import { UserRole } from './types/auth';
import RequestsAdmin from './pages/Admin/Request/RequestAdmin';
import Dashboard from './pages/Admin/Dashboard/Dashboard';
import AdminLayout from './pages/Layout/AdminLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Registration />} />
        <Route path="/login" element={<Login />} />
        <Route path="/repairRequest" element={<RequestForm/>}/>
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
        

      </Routes>
    </BrowserRouter>
  );
}

export default App;
