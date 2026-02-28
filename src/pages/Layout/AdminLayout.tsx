import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import styles from './AdminLayout.module.scss';

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Определение мобильного устройства
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Основной контент */}
      <div className={`${styles.main} ${sidebarOpen && !isMobile ? styles.withSidebar : ''}`}>
        {/* Header для мобильных */}
        <header className={styles.header}>
          <button className={styles.menuBtn} onClick={toggleSidebar}>
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <h1 className={styles.headerTitle}>Админ-панель</h1>
          <div className={styles.headerSpacer} />
        </header>

        {/* Контент страницы */}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;