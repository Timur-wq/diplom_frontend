
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

  // 🔥 Завершение работы (разное для диагностики и ремонта)
  const handleCompleteTask = async (taskId: number, isRepair: boolean = false) => {
    if (isRepair) {
      if (!window.confirm('Завершить наряд на ремонт? Будут сформированы акты.')) return;
    } else {
      if (!window.confirm('Завершить диагностику?')) return;
    }

    setProcessingTaskId(taskId);
    try {
      if (isRepair) {
        // 🔥 Для ремонта — завершаем с формированием PDF
        await engineerTaskService.completeRepairTask(taskId);
        alert('✅ Работа завершена! Сформированы акты выполненных работ и списания ЗИП.');
      } else {
        // 🔥 Для диагностики — переходим на форму акта
        navigate(`/engineer/task/${taskId}/act`, { replace: true });
        return;  // Не загружаем данные, т.к. переходим на другую страницу
      }

      await loadData();
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

  // 🔥 Группировка задач по заявке
  const tasksByRequest = useMemo(() => {
    return filteredTasks.reduce((groups, task) => {
      const requestId = task.requestId;
      if (!groups[requestId]) {
        groups[requestId] = [];
      }
      groups[requestId].push(task);
      return groups;
    }, {} as Record<number, EngineerTask[]>);
  }, [filteredTasks]);

  // 🔥 Начало всех работ по заявке
  const handleStartAllTasks = async (requestId: number) => {
    if (!window.confirm('Начать все работы по этой заявке?')) return;

    try {
      await engineerTaskService.startAllTasksForRequest(requestId);
      await loadData();
      alert('✅ Все работы начаты!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  // 🔥 Завершение всех работ по заявке
  const handleCompleteAllTasks = async (requestId: number) => {
    if (!window.confirm('Завершить все работы по заявке? Будут сформированы акты.')) return;

    try {
      await engineerTaskService.completeAllTasksForRequest(requestId);
      await loadData();
      alert('✅ Все работы завершены! Акты сформированы.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    }
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
      {/* Список нарядов */}
      <div className={styles.tasksList}>
        {Object.keys(tasksByRequest).length === 0 ? (
          <div className={styles.empty}>Нарядов не найдено</div>
        ) : (
          Object.entries(tasksByRequest).map(([requestId, requestTasks]) => {
            // 🔥 Разделяем на диагностики и ремонты
            const diagnostics = requestTasks.filter(t =>
              t.workName?.toLowerCase().includes('диагност')
            );

            const repairs = requestTasks.filter(t =>
              !t.workName?.toLowerCase().includes('диагност')
            );

            // 🔥 Проверяем статусы для ремонтов
            const allRepairsAssigned = repairs.length > 0 && repairs.every(t => t.status === TaskStatus.Assigned);
            const allRepairsInProgress = repairs.every(t => t.status === TaskStatus.InProgress);
            const allRepairsCompleted = repairs.every(t => t.status === TaskStatus.Completed);

            return (
              <div key={requestId} className={styles.requestGroup}>
                {/* Заголовок группы */}
                <div className={styles.requestHeader}>
                  <h3 className={styles.requestTitle}>
                    Заявка #{requestId}
                  </h3>
                  <div className={styles.requestInfo}>
                    <span>{requestTasks[0]?.clientFio}</span>
                    <span>{requestTasks[0]?.svtType} {requestTasks[0]?.model}</span>
                  </div>
                  <div className={styles.tasksCount}>
                    🔧 {repairs.length} работ{repairs.length !== 1 ? 'и' : ''}
                    {diagnostics.length > 0 && ` + 📋 ${diagnostics.length} диагностик`}
                  </div>
                </div>

                {/* 🔥 Наряды на диагностику (отдельно) */}
                {diagnostics.length > 0 && (
                  <div className={styles.diagnosticsSection}>
                    <h4 className={styles.sectionTitle}>📋 Диагностика:</h4>
                    {diagnostics.map(task => (
                      <div key={task.taskId} className={styles.taskCard}>
                        <div className={styles.taskWorkName}>
                          🔍 {task.workName}
                        </div>
                        <span className={`${styles.statusBadge} ${getStatusClass(task.status)}`}>
                          {getStatusLabel(task.status)}
                        </span>

                        {/* Кнопки для диагностики */}
                        {task.status === TaskStatus.Assigned && (
                          <button
                            className={styles.smallBtn}
                            onClick={() => handleStartTask(task.taskId)}
                            disabled={processingTaskId === task.taskId}
                          >
                            ▶ Начать
                          </button>
                        )}

                        {task.status === TaskStatus.InProgress && (
                          <button
                            className={styles.smallBtn}
                            onClick={() => handleCompleteTask(task.taskId, false)}
                            disabled={processingTaskId === task.taskId}
                          >
                            📋 Завершить
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 🔥 Наряды на ремонт (группой) */}
                {repairs.length > 0 && (
                  <>
                    <div className={styles.repairsSection}>
                      <h4 className={styles.sectionTitle}>🔧 Ремонтные работы:</h4>
                      <div className={styles.tasksInRequest}>
                        {repairs.map(task => (
                          <div key={task.taskId} className={styles.taskCard}>
                            <div className={styles.taskWorkName}>
                              🔧 {task.workName}
                            </div>
                            <span className={`${styles.statusBadge} ${getStatusClass(task.status)}`}>
                              {getStatusLabel(task.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Кнопки действий для всех ремонтов */}
                    <div className={styles.groupActions}>
                      {allRepairsAssigned && (
                        <button
                          className={styles.startAllBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartAllTasks(Number(requestId));
                          }}
                        >
                          ▶ Начать все работы
                        </button>
                      )}

                      {allRepairsInProgress && (
                        <button
                          className={styles.completeAllBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompleteAllTasks(Number(requestId));
                          }}
                        >
                          ✅ Завершить все работы
                        </button>
                      )}

                      {allRepairsCompleted && (
                        <div className={styles.completedBadge}>
                          ✅ Все работы завершены
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
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