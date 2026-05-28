import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { useNavigate } from 'react-router-dom'; // 🔥 Добавлен импорт
import styles from './Reports.module.scss';

interface Report {
  reportCode: number;
  requestId: number;
  clientFio: string;
  generatedAt: string;
  filePath: string;
}

const Reports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Record<number, boolean>>({});
  
  const navigate = useNavigate(); // 🔥 Инициализация хука навигации

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await authService.fetchWithAuth(
        'https://localhost:7053/api/admin/report'
      );
      
      if (!response.ok) throw new Error('Не удалось загрузить отчёты');
      
      const data = await response.json();
      setReports(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки отчётов');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (report: Report) => {
    try {
      setDownloading(prev => ({ ...prev, [report.reportCode]: true }));
      
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/admin/report/${report.reportCode}/file`
      );
      
      if (!response.ok) throw new Error('Не удалось скачать отчёт');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${report.reportCode}_Req${report.requestId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err: any) {
      alert(err.message || 'Ошибка скачивания отчёта');
    } finally {
      setDownloading(prev => ({ ...prev, [report.reportCode]: false }));
    }
  };

  // 🔥 Функция выхода из системы
  const handleLogout = () => {
    // 1. Очищаем токен/данные сессии (зависит от того, как реализован authService)
    // Обычно это выглядит так:
    localStorage.removeItem('token'); 
    sessionStorage.clear(); // Если используете sessionStorage
    
    // 2. Перенаправляем на страницу входа
    navigate('/login');
  };

  if (loading) return <div className={styles.loading}>Загрузка отчётов...</div>;
  if (error) return <div className={styles.error}>Ошибка: {error}</div>;

  return (
    <div className={styles.container}>
      {/* 🔥 Добавлена кнопка выхода */}
      <button 
        className={styles.logoutBtn} 
        onClick={handleLogout}
        style={{ marginBottom: '20px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem' }}
      >
        🚪 Выйти
      </button>

      <h1 className={styles.title}>📊 Отчёты для бухгалтерии</h1>
      
      {reports.length === 0 ? (
        <div className={styles.empty}>
          Отчётов пока нет
        </div>
      ) : (
        <div className={styles.reportsList}>
          {reports.map(report => (
            <div key={report.reportCode} className={styles.reportCard}>
              <div className={styles.reportHeader}>
                <div className={styles.reportInfo}>
                  <span className={styles.reportCode}>Отчёт #{report.reportCode}</span>
                  <span className={styles.requestId}>Заявка #{report.requestId}</span>
                </div>
                <span className={styles.date}>
                  {new Date(report.generatedAt).toLocaleString('ru-RU')}
                </span>
              </div>
              
              <div className={styles.reportBody}>
                <div className={styles.clientFio}>
                  <strong>Клиент:</strong> {report.clientFio}
                </div>
              </div>
              
              <div className={styles.reportActions}>
                <button
                  className={styles.downloadBtn}
                  onClick={() => handleDownloadReport(report)}
                  disabled={downloading[report.reportCode]}
                >
                  {downloading[report.reportCode] ? (
                    <>
                      <span className={styles.spinner}></span>
                      Скачивание...
                    </>
                  ) : (
                    '📥 Скачать PDF'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reports;