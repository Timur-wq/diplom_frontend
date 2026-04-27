// src/pages/Client/ClientLayout.tsx

import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/authService';
import styles from './ClientLayout.module.scss';

const ClientLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const userName = authService.getUserFio() || 'Клиент';

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.logo}>Ремонт СВТ</h2>
        </div>

        {/* Информация о пользователе */}
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>{userName}</div>
            <div className={styles.userRole}>Клиент</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <NavLink
            to="/client/requests"
            className={({ isActive }) => 
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
            end
            onClick={closeSidebar}
          >
            <span className={styles.navIcon}>📋</span>
            <span className={styles.navLabel}>Мои заявки</span>
            {location.pathname === '/client/requests' && (
              <span className={styles.activeIndicator} />
            )}
          </NavLink>
          <NavLink
            to="/client/repairRequest"
            className={({ isActive }) => 
              `${styles.navLink} ${isActive ? styles.active : ''}`
            }
            onClick={closeSidebar}
          >
            <span className={styles.navIcon}>➕</span>
            <span className={styles.navLabel}>Подать заявку</span>
            {location.pathname === '/client/repairRequest' && (
              <span className={styles.activeIndicator} />
            )}
          </NavLink>
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            🚪 Выйти
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      <main className={styles.main}>
        {/* Мобильный header */}
        <div className={styles.mobileHeader}>
          <button className={styles.hamburger} onClick={toggleSidebar}>
            <span></span>
            <span></span>
            <span></span>
          </button>
          <h1 className={styles.mobileTitle}>Ремонт СВТ</h1>
        </div>
        
        {/* Overlay для закрытия sidebar */}
        {isSidebarOpen && <div className={styles.overlay} onClick={closeSidebar}></div>}
        
        <Outlet />
      </main>
    </div>
  );
};

export default ClientLayout;