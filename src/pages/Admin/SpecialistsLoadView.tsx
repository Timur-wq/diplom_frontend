import React, { useState, useEffect } from 'react';
import styles from './SpecialistsLoadView.module.scss';

// 🔹 Типы
interface Task {
  id: number;
  requestId: number;
  device: string;
  client: string;
  status: 'В ремонте' | 'В диагностике'; // ✅ Только два разрешённых статуса
  progress: number;
  assignedAt: string;
}

interface Specialist {
  id: number;
  tabNumber: number;
  fullName: string;
  role: string;
  specialization: string;
  activeTasks: Task[];
  status: 'Free' | 'Busy'; // ✅ Удалён статус Overloaded
}

// 🔹 Моковые данные (строго ≤2 наряда, только допустимые статусы)
const MOCK_SPECIALISTS: Specialist[] = [
  {
    id: 1,
    tabNumber: 1042,
    fullName: 'Петров Алексей Иванович',
    role: 'Старший инженер',
    specialization: 'Ноутбуки, материнские платы',
    status: 'Busy',
    activeTasks: [
      { id: 101, requestId: 9, device: 'MacBook Pro 13" 2020', client: 'Иванов И.И.', status: 'В ремонте', progress: 65, assignedAt: '2026-04-29T10:30:00Z' },
      { id: 102, requestId: 12, device: 'ASUS X515', client: 'Сидорова М.А.', status: 'В диагностике', progress: 30, assignedAt: '2026-04-30T08:15:00Z' }
    ]
  },
  {
    id: 2,
    tabNumber: 1078,
    fullName: 'Смирнова Елена Викторовна',
    role: 'Инженер-диагност',
    specialization: 'Мобильные устройства, планшеты',
    status: 'Busy',
    activeTasks: [
      { id: 201, requestId: 14, device: 'iPhone 13 Pro', client: 'Козлов Д.С.', status: 'В диагностике', progress: 40, assignedAt: '2026-04-30T09:00:00Z' },
      { id: 202, requestId: 11, device: 'Samsung Galaxy Tab S8', client: 'ООО "МедиаГрупп"', status: 'В ремонте', progress: 55, assignedAt: '2026-04-29T11:20:00Z' }
    ]
  },
  {
    id: 3,
    tabNumber: 1105,
    fullName: 'Козлов Дмитрий Сергеевич',
    role: 'Инженер',
    specialization: 'ПК, серверное оборудование',
    status: 'Free',
    activeTasks: []
  },
  {
    id: 4,
    tabNumber: 1132,
    fullName: 'Волкова Анна Петровна',
    role: 'Старший инженер',
    specialization: 'Принтеры, МФУ, копировальное оборудование',
    status: 'Busy',
    activeTasks: [
      { id: 401, requestId: 16, device: 'HP LaserJet Pro M404dn', client: 'ИП Белов А.А.', status: 'В ремонте', progress: 70, assignedAt: '2026-04-29T16:45:00Z' }
    ]
  }
];

const SpecialistsLoadView: React.FC = () => {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Free' | 'Busy'>('All'); // ✅ Убран Overloaded

  // Имитация загрузки данных
  useEffect(() => {
    const timer = setTimeout(() => {
      setSpecialists(MOCK_SPECIALISTS);
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Статистика
  const totalEngineers = specialists.length;
  const freeCount = specialists.filter(s => s.status === 'Free').length;
  const busyCount = specialists.filter(s => s.status === 'Busy').length;

  // Фильтрация
  const filteredSpecialists = filter === 'All' 
    ? specialists 
    : specialists.filter(s => s.status === filter);

  // Вспомогательные функции
  const getLoadColor = (status: Specialist['status']) => {
    return status === 'Free' ? 'var(--color-success)' : 'var(--color-warning)';
  };

  const getStatusLabel = (status: Specialist['status']) => {
    return status === 'Free' ? 'Свободен' : 'Загружен';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) return <div className={styles.loading}>Загрузка данных о специалистах...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>👷 Загрузка специалистов</h1>
        
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{totalEngineers}</span>
            <span className={styles.statLabel}>Всего инженеров</span>
          </div>
          <div className={`${styles.statCard} ${styles.free}`}>
            <span className={styles.statValue}>{freeCount}</span>
            <span className={styles.statLabel}>Свободны</span>
          </div>
          <div className={`${styles.statCard} ${styles.busy}`}>
            <span className={styles.statValue}>{busyCount}</span>
            <span className={styles.statLabel}>Загружены</span>
          </div>
          {/* ✅ Удалён блок перегруженных специалистов */}
        </div>

        <div className={styles.filters}>
          {(['All', 'Free', 'Busy'] as const).map(status => (
            <button
              key={status}
              className={`${styles.filterBtn} ${filter === status ? styles.active : ''}`}
              onClick={() => setFilter(status)}
            >
              {status === 'All' ? 'Все' : getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        {filteredSpecialists.map(specialist => (
          <div key={specialist.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.avatar}>
                {specialist.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className={styles.info}>
                <h3 className={styles.name}>{specialist.fullName}</h3>
                <p className={styles.role}>{specialist.role} • Таб. № {specialist.tabNumber}</p>
                <p className={styles.specialization}>{specialist.specialization}</p>
              </div>
              <span 
                className={styles.statusBadge}
                style={{ background: getLoadColor(specialist.status) }}
              >
                {getStatusLabel(specialist.status)}
              </span>
            </div>

            <div className={styles.loadSection}>
              <div className={styles.loadHeader}>
                <span>Текущая загрузка</span>
                <span>{specialist.activeTasks.length} из 2 наряд(ов)</span>
              </div>
              <div className={styles.progressBar}>
                {/* ✅ Максимум 2 наряда → делитель 2 */}
                <div 
                  className={styles.progressFill} 
                  style={{ 
                    width: `${(specialist.activeTasks.length / 2) * 100}%`,
                    background: getLoadColor(specialist.status)
                  }}
                />
              </div>
            </div>

            {specialist.activeTasks.length > 0 ? (
              <div className={styles.tasksList}>
                <h4 className={styles.tasksTitle}>Активные наряды:</h4>
                <ul>
                  {specialist.activeTasks.map(task => (
                    <li key={task.id} className={styles.taskItem}>
                      <div className={styles.taskHeader}>
                        <span className={styles.taskId}>#{task.requestId}</span>
                        <span className={styles.taskDevice}>{task.device}</span>
                      </div>
                      <div className={styles.taskMeta}>
                        <span>👤 {task.client}</span>
                        <span className={`${styles.taskStatus} ${styles[task.status.toLowerCase().replace(/ /g, '-')]}`}>
                          {task.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className={styles.emptyTasks}>
                ✅ Нет активных нарядов. Готов к новым задачам.
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredSpecialists.length === 0 && (
        <div className={styles.empty}>
          По выбранному фильтру специалистов не найдено
        </div>
      )}
    </div>
  );
};

export default SpecialistsLoadView;