
import React, { useState, useEffect, useCallback } from 'react';
import { engineerTaskService } from '../../services/engineerTaskService';
import { EngineerTask, EngineerStats, TaskStatus, TaskFilter } from './types';
import styles from './EngineerDashboard.module.scss';

import { useNavigate, useLocation } from 'react-router-dom';

const EngineerDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<EngineerTask[]>([]);
  const [stats, setStats] = useState<EngineerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<EngineerTask | null>(null);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [processingTaskId, setProcessingTaskId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Загрузка данных
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [tasksData, statsData] = await Promise.all([
        engineerTaskService.getAllTasks(),
        engineerTaskService.getStats()
      ]);

      setTasks(tasksData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Фильтрация задач
  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') {
      return task.status === TaskStatus.Assigned || task.status === TaskStatus.InProgress;
    }
    if (filter === 'completed') {
      return task.status === TaskStatus.Completed;
    }
    return true;
  });

  // Начало работы
  const handleStartTask = async (taskId: number) => {
    if (!window.confirm('Начать работу по этому наряду?')) return;

    setProcessingTaskId(taskId);
    try {
      await engineerTaskService.startTask(taskId);
      await loadData();
      alert('✅ Работа начата!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setProcessingTaskId(null);
    }
  };

  // Завершение работы
  const handleCompleteTask = async (taskId: number) => {
    if (!window.confirm('Завершить работу по этому наряду?')) return;

    setProcessingTaskId(taskId);
    try {
      await engineerTaskService.completeTask(taskId);
      await loadData();
      alert('✅ Работа завершена!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setProcessingTaskId(null);
    }
  };

  // Отмена наряда
  const handleCancelTask = async () => {
    if (!selectedTask || !cancelReason.trim()) {
      alert('Укажите причину отмены');
      return;
    }

    setProcessingTaskId(selectedTask.taskId);
    try {
      await engineerTaskService.cancelTask(selectedTask.taskId, cancelReason);
      await loadData();
      setShowCancelModal(false);
      setCancelReason('');
      setSelectedTask(null);
      alert('✅ Наряд отменён');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setProcessingTaskId(null);
    }
  };

  // Форматирование статуса
  const getStatusLabel = (status: TaskStatus): string => {
    const labels: Record<TaskStatus, string> = {
      [TaskStatus.Assigned]: 'Назначен',
      [TaskStatus.InProgress]: 'В работе',
      [TaskStatus.Completed]: 'Завершён',
      [TaskStatus.Cancelled]: 'Отменён'
    };
    return labels[status] || status;
  };

  const getStatusClass = (status: TaskStatus): string => {
    const classes: Record<TaskStatus, string> = {
      [TaskStatus.Assigned]: styles.statusAssigned,
      [TaskStatus.InProgress]: styles.statusInProgress,
      [TaskStatus.Completed]: styles.statusCompleted,
      [TaskStatus.Cancelled]: styles.statusCancelled
    };
    return classes[status] || '';
  };

  // Форматирование даты
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка данных...</div>;
  }

  if (error) {
    return <div className={styles.error}>Ошибка: {error}</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Личный кабинет сервисного инженера</h1>

      {/* Статистика */}
      {stats && (
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalTasks}</span>
            <span className={styles.statLabel}>Всего нарядов</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.activeTasks}</span>
            <span className={styles.statLabel}>Активных</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.completedTasks}</span>
            <span className={styles.statLabel}>Завершённых</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.cancelledTasks}</span>
            <span className={styles.statLabel}>Отменённых</span>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
          onClick={() => setFilter('all')}
        >
          Все наряды
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'active' ? styles.active : ''}`}
          onClick={() => setFilter('active')}
        >
          Активные
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'completed' ? styles.active : ''}`}
          onClick={() => setFilter('completed')}
        >
          Завершённые
        </button>
      </div>

      {/* Список нарядов */}
      <div className={styles.tasksList}>
        {filteredTasks.length === 0 ? (
          <div className={styles.empty}>Нарядов не найдено</div>
        ) : (
          filteredTasks.map(task => (
            <div key={task.taskId} className={styles.taskCard}>
              <div
                className={styles.taskHeader}
                onClick={() => setExpandedTaskId(expandedTaskId === task.taskId ? null : task.taskId)}
              >
                <div className={styles.taskInfo}>
                  <span className={styles.taskId}>#{task.taskId}</span>
                  <span className={styles.taskClient}>{task.clientFio}</span>
                  <span className={styles.taskDevice}>{task.svtType} {task.model}</span>
                </div>
                <div className={styles.taskActions}>
                  <span className={`${styles.statusBadge} ${getStatusClass(task.status)}`}>
                    {getStatusLabel(task.status)}
                  </span>
                  <span className={styles.expandIcon}>
                    {expandedTaskId === task.taskId ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {expandedTaskId === task.taskId && (
                <div className={styles.taskDetails}>
                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}>
                      <label>Клиент:</label>
                      <span>{task.clientFio}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Телефон:</label>
                      <span>{task.clientPhone}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Тип СВТ:</label>
                      <span>{task.svtType}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Модель:</label>
                      <span>{task.model}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Серийный номер:</label>
                      <span>{task.serialNumber}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Работа:</label>
                      <span>{task.workName}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Назначен:</label>
                      <span>{formatDate(task.assignedAt)}</span>
                    </div>
                    {task.startedAt && (
                      <div className={styles.detailItem}>
                        <label>Начат:</label>
                        <span>{formatDate(task.startedAt)}</span>
                      </div>
                    )}
                    {task.completedAt && (
                      <div className={styles.detailItem}>
                        <label>Завершён:</label>
                        <span>{formatDate(task.completedAt)}</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.detailItem}>
                    <label>Описание неисправности:</label>
                    <p className={styles.description}>{task.description}</p>
                  </div>

                  {/* Кнопки действий */}
                  <div className={styles.actionButtons}>
                    {task.status === TaskStatus.Assigned && (
                      <button
                        className={styles.startBtn}
                        onClick={() => handleStartTask(task.taskId)}
                        disabled={processingTaskId === task.taskId}
                      >
                        {processingTaskId === task.taskId ? 'Запуск...' : '▶ Начать работу'}
                      </button>
                    )}

                    {task.status === TaskStatus.InProgress && (
                        <button
                           className={styles.completeBtn}
                           onClick={() => {
                              // 🔥 Перенаправляем на форму акта диагностики
                              navigate(`/engineer/task/${task.taskId}/act`, { replace: true });
                           }}
                           disabled={processingTaskId === task.taskId}
                        >
                           ✓ Завершить с актом
                        </button>
                     )}

                    {(task.status === TaskStatus.Assigned || task.status === TaskStatus.InProgress) && (
                      <button
                        className={styles.cancelBtn}
                        onClick={() => {
                          setSelectedTask(task);
                          setShowCancelModal(true);
                        }}
                        disabled={processingTaskId === task.taskId}
                      >
                        ✕ Отменить
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Модальное окно отмены */}
      {showCancelModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCancelModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Отмена наряда</h3>
            <p>Укажите причину отмены наряда #{selectedTask?.taskId}:</p>
            <textarea
              className={styles.textarea}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Причина отмены..."
              rows={4}
            />
            <div className={styles.modalButtons}>
              <button
                className={styles.cancelModalBtn}
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                  setSelectedTask(null);
                }}
              >
                Отмена
              </button>
              <button
                className={styles.confirmCancelBtn}
                onClick={handleCancelTask}
                disabled={!cancelReason.trim() || processingTaskId !== null}
              >
                {processingTaskId === selectedTask?.taskId ? 'Отмена...' : 'Подтвердить отмену'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EngineerDashboard;