import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/authService';
import { UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[]; // Если указано — доступ только для этих ролей
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const location = useLocation();

  // Проверка аутентификации
  if (!authService.isAuthenticated()) {
    console.log("Не авторизован")
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Проверка роли (если указана)
  if (roles && roles.length > 0) {
    if (!authService.hasAnyRole(roles)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;