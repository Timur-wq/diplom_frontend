import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { authService } from '../../services/authService';
import styles from './AdminSidebar.module.scss';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles?: string[];
}

const navItems: NavItem[] = [

  {
    path: '/admin/requests',
    label: 'Заявки',
    icon: '',
  },

];

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const userRole = authService.getUserRole();
  const userFio = authService.getUserFio();

  // Фильтрация пунктов по роли
  const filteredNavItems = navItems.filter(
    item => !item.roles || item.roles.includes(userRole || '')
  );

  return (
    <>
      {/* Затемнение фона для мобильной версии */}
      {isOpen && (
        <div className={styles.overlay} onClick={onClose} />
      )}

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        {/* Логотип */}
        <div className={styles.logo}>
          {/* <span className={styles.logoIcon}>🛠️</span> */}
          <span className={styles.logoText}>Ремонт СВТ</span>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Информация о пользователе */}
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            {userFio?.charAt(0).toUpperCase() || '👤'}
          </div>
          <div className={styles.userDetails}>
            <div className={styles.userName}>{userFio || 'Пользователь'}</div>
            <div className={styles.userRole}>Диспетчер</div>
          </div>
        </div>

        {/* Навигация */}
        <nav className={styles.nav}>
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
              onClick={() => {
                // Закрываем sidebar на мобильных после клика
                if (window.innerWidth < 768) {
                  onClose();
                }
              }}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {location.pathname === item.path && (
                <span className={styles.activeIndicator} />
              )}
            </NavLink>
          ))}
        </nav>

        {/* Кнопка выхода */}
        <div className={styles.footer}>
          <button
            className={styles.logoutBtn}
            onClick={async () => {
              await authService.logout();
              window.location.href = '/login';
            }}
          >
            {/* <span className={styles.logoutIcon}>🚪</span> */}
            <span className={styles.logoutLabel}>Выйти</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;