import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { authService } from '../../../services/authService';
import styles from './RequestsAdmin.module.scss';

// Типы
interface RequestDto {
  id: number;
  clientId: number;
  clientFio: string;
  clientPhone: string;
  staffFio?: string;
  status: RequestStatus;
  dateOnly: string;
  timeOnly: string;
  svtType: string;
  model: string;
  serialNumber: string;
  description: string;
  rejectionReason?: string;
  statusChangedAt?: string;
  statusChangedByFio?: string;
  createdAt: string;
}

enum RequestStatus {
  New = 'New',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Cancelled = 'Cancelled'
}

interface Filters {
  status: RequestStatus | 'All';
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  svtType: string;
}

const RequestsAdmin: React.FC = () => {
  const [allRequests, setAllRequests] = useState<RequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState<Record<number, string>>({});
  const [processingId, setProcessingId] = useState<number | null>(null);
  
  // Фильтры (клиентские)
  const [filters, setFilters] = useState<Filters>({
    status: 'All',
    searchQuery: '',
    dateFrom: '',
    dateTo: '',
    svtType: ''
  });

  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean;
    requestId: number | null;
    engineer: {
      fio: string;
      tabNumber: string;
      specialization?: string;
    } | null;
  }>({
    isOpen: false,
    requestId: null,
    engineer: null
  });
  
  const [assigningId, setAssigningId] = useState<number | null>(null);

  // ✅ Открыть модальное окно назначения
  const handleOpenAssignModal = (requestId: number) => {
    setAssignModal({
      isOpen: true,
      requestId,
      engineer: {
        fio: 'Иванов Иван Иванович',
        tabNumber: '12345',
        specialization: 'Ремонт ноутбуков и ПК'
      }
    });
  };

  // ✅ Закрыть модальное окно
  const handleCloseAssignModal = () => {
    setAssignModal({
      isOpen: false,
      requestId: null,
      engineer: null
    });
  };

  // ✅ Подтвердить назначение
  const handleConfirmAssign = async () => {
    if (!assignModal.requestId || !assignModal.engineer) return;
    
    setAssigningId(assignModal.requestId);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Назначение специалиста:', {
        requestId: assignModal.requestId,
        engineer: assignModal.engineer
      });
      
      setAllRequests(prev => prev.map(req => 
        req.id === assignModal.requestId 
          ? { ...req, staffFio: assignModal.engineer!.fio, status: RequestStatus.InProgress }
          : req
      ));
      
      alert('✅ Специалист назначен!');
      handleCloseAssignModal();
      refreshData();
      
    } catch (error: any) {
      console.error('Ошибка назначения:', error);
      alert(error.message || 'Не удалось назначить специалиста');
    } finally {
      setAssigningId(null);
    }
  };

  // Статистика
  const [stats, setStats] = useState<Record<string, number>>({});

  // Загрузка заявок
  const loadRequests = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const response = await authService.fetchWithAuth(
      'https://localhost:7053/api/AdminRequest'
    );

    if (!response.ok) throw new Error('Не удалось загрузить заявки');

    const data: any[] = await response.json();
    
    // ✅ Конвертируем числовые статусы в строки
    const statusMap: Record<number, RequestStatus> = {
      1: RequestStatus.New,
      2: RequestStatus.Accepted,
      3: RequestStatus.Rejected,
      4: RequestStatus.InProgress,
      5: RequestStatus.Completed,
      6: RequestStatus.Cancelled
    };
    
    const normalizedData: RequestDto[] = data.map(item => ({
      ...item,
      status: typeof item.status === 'number' 
        ? statusMap[item.status] || RequestStatus.New
        : item.status
    }));
    
    setAllRequests(normalizedData);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Ошибка загрузки');
  } finally {
    setLoading(false);
  }
}, []);

  // Загрузка статистики
  const loadStats = useCallback(async () => {
    try {
      const response = await authService.fetchWithAuth(
        'https://localhost:7053/api/adminrequests/counts/by-status'
      );
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    }
  }, []);

  // Перезагрузка после изменения статуса
  const refreshData = useCallback(() => {
    loadRequests();
    loadStats();
  }, [loadRequests, loadStats]);

  useEffect(() => {
    loadRequests();
    loadStats();
  }, [loadRequests, loadStats]);

  // 🔥 КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ
  const filteredRequests = useMemo(() => {
    return allRequests.filter(request => {
      if (filters.status !== 'All' && request.status !== filters.status) {
        return false;
      }

      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        const searchableText = `${request.clientFio} ${request.model} ${request.serialNumber} ${request.svtType}`.toLowerCase();
        if (!searchableText.includes(query)) {
          return false;
        }
      }

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        const requestDate = new Date(request.createdAt);
        if (requestDate < fromDate) {
          return false;
        }
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        const requestDate = new Date(request.createdAt);
        if (requestDate > toDate) {
          return false;
        }
      }

      if (filters.svtType.trim()) {
        if (!request.svtType.toLowerCase().includes(filters.svtType.toLowerCase().trim())) {
          return false;
        }
      }

      return true;
    });
  }, [allRequests, filters]);

  // Статистика по отфильтрованным данным
  const filteredStats = useMemo(() => {
    return filteredRequests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredRequests]);

  // Развернуть/свернуть аккордеон
  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Принять заявку
  const handleAccept = async (id: number) => {
    if (!window.confirm('Принять заявку в работу?')) return;

    setProcessingId(id);
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/adminrequests/${id}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status: RequestStatus.Accepted }),
        }
      );

      if (!response.ok) throw new Error('Не удалось принять заявку');

      alert('Заявка принята в работу');
      refreshData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setProcessingId(null);
    }
  };

  // Отклонить заявку
  const handleReject = async (id: number) => {
    const reason = rejectionReason[id]?.trim();
    
    if (!reason || reason.length < 5) {
      alert('Укажите причину отклонения (минимум 5 символов)');
      return;
    }

    if (!window.confirm('Отклонить заявку?')) return;

    setProcessingId(id);
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/adminrequests/${id}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ 
            status: RequestStatus.Rejected,
            rejectionReason: reason 
          }),
        }
      );

      if (!response.ok) throw new Error('Не удалось отклонить заявку');

      alert('Заявка отклонена');
      setRejectionReason(prev => ({ ...prev, [id]: '' }));
      refreshData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setProcessingId(null);
    }
  };

  // Сброс фильтров
  const handleResetFilters = () => {
    setFilters({
      status: 'All',
      searchQuery: '',
      dateFrom: '',
      dateTo: '',
      svtType: ''
    });
  };

  // Форматирование статуса
  const getStatusLabel = (status: RequestStatus): string => {
    const labels: Record<RequestStatus, string> = {
      [RequestStatus.New]: 'Новая',
      [RequestStatus.Accepted]: 'Принята',
      [RequestStatus.Rejected]: 'Отклонена',
      [RequestStatus.InProgress]: 'В работе',
      [RequestStatus.Completed]: 'Завершена',
      [RequestStatus.Cancelled]: 'Отменена'
    };
    return labels[status] || status;
  };

  const getStatusClass = (status: RequestStatus): string => {
    const classes: Record<RequestStatus, string> = {
      [RequestStatus.New]: styles.statusNew,
      [RequestStatus.Accepted]: styles.statusAccepted,
      [RequestStatus.Rejected]: styles.statusRejected,
      [RequestStatus.InProgress]: styles.statusInProgress,
      [RequestStatus.Completed]: styles.statusCompleted,
      [RequestStatus.Cancelled]: styles.statusCancelled
    };
    return classes[status] || '';
  };

  // Функция форматирования телефона
  const formatPhone = (phone: string) => {
    if (!phone) return '';
    
    // Удаляем все нецифровые символы
    const digits = phone.replace(/\D/g, '');
    
    // Проверяем, что есть 11 цифр (российский формат)
    if (digits.length !== 11) {
      return phone; // Возвращаем как есть, если формат не совпадает
    }
    
    // Форматируем: +0 (000) 000-00-00
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка заявок...</div>;
  }

  if (error) {
    return <div className={styles.error}>Ошибка: {error}</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Управление заявками</h1>

      {/* Статистика */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats[RequestStatus.New] || 0}</span>
          <span className={styles.statLabel}>Всего новых</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{filteredStats[RequestStatus.New] || 0}</span>
          <span className={styles.statLabel}>Показано новых</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{filteredRequests.length}</span>
          <span className={styles.statLabel}>Всего показано</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{allRequests.length}</span>
          <span className={styles.statLabel}>Всего заявок</span>
        </div>
      </div>

      {/* Фильтры */}
      <div className={styles.filtersPanel}>
        <div className={styles.filtersHeader}>
          <h2 className={styles.filtersTitle}>Фильтры</h2>
          <button className={styles.resetBtn} onClick={handleResetFilters}>
            Сбросить
          </button>
        </div>

        <div className={styles.filtersGrid}>
          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Поиск</label>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="ФИО, модель, серийный номер..."
              value={filters.searchQuery}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            />
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Статус</label>
            <select
              className={styles.filterSelect}
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                status: e.target.value as RequestStatus | 'All' 
              }))}
            >
              <option value="All">Все статусы</option>
              <option value={RequestStatus.New}>Новые</option>
              <option value={RequestStatus.Accepted}>Принятые</option>
              <option value={RequestStatus.Rejected}>Отклонённые</option>
              <option value={RequestStatus.InProgress}>В работе</option>
              <option value={RequestStatus.Completed}>Завершённые</option>
              <option value={RequestStatus.Cancelled}>Отменённые</option>
            </select>
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Тип СВТ</label>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="Ноутбук, ПК, принтер..."
              value={filters.svtType}
              onChange={(e) => setFilters(prev => ({ ...prev, svtType: e.target.value }))}
            />
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Дата от</label>
            <input
              type="date"
              className={styles.filterInput}
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            />
          </div>

          <div className={styles.filterField}>
            <label className={styles.filterLabel}>Дата до</label>
            <input
              type="date"
              className={styles.filterInput}
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            />
          </div>
        </div>

        <div className={styles.quickFilters}>
          <button
            className={`${styles.quickFilterBtn} ${filters.status === 'All' ? styles.active : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, status: 'All' }))}
          >
            Все ({allRequests.length})
          </button>
          <button
            className={`${styles.quickFilterBtn} ${filters.status === RequestStatus.New ? styles.active : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, status: RequestStatus.New }))}
          >
            Новые ({filteredStats[RequestStatus.New] || 0})
          </button>
          <button
            className={`${styles.quickFilterBtn} ${filters.status === RequestStatus.Accepted ? styles.active : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, status: RequestStatus.Accepted }))}
          >
            Принятые ({filteredStats[RequestStatus.Accepted] || 0})
          </button>
          <button
            className={`${styles.quickFilterBtn} ${filters.status === RequestStatus.Rejected ? styles.active : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, status: RequestStatus.Rejected }))}
          >
            Отклонённые ({filteredStats[RequestStatus.Rejected] || 0})
          </button>
        </div>
      </div>

      {/* Список заявок */}
      <div className={styles.requestsList}>
        {filteredRequests.length === 0 ? (
          <div className={styles.empty}>
            {allRequests.length === 0 
              ? 'Заявок пока нет' 
              : 'По вашему фильтру заявок не найдено'}
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div key={request.id} className={styles.requestCard}>
              <div 
                className={styles.requestHeader}
                onClick={() => toggleExpand(request.id)}
              >
                <div className={styles.requestInfo}>
                  <span className={styles.requestId}>#{request.id}</span>
                  <span className={styles.requestClient}>{request.clientFio}</span>
                  <span className={styles.requestDevice}>{request.svtType} {request.model}</span>

                </div>
                <div className={styles.requestActions}>
                  <span className={`${styles.statusBadge} ${getStatusClass(request.status)}`}>
                    {getStatusLabel(request.status)}
                  </span>
                  <span className={styles.expandIcon}>
                    {expandedId === request.id ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {expandedId === request.id && (
                <div className={styles.requestDetails}>
                  {/* DEBUG: Показываем текущий статус */}
                  
                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}>
                      <label>Клиент:</label>
                      <span>{request.clientFio}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Телефон:</label>
                      <span>{formatPhone(request.clientPhone)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Тип СВТ:</label>
                      <span>{request.svtType}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Модель:</label>
                      <span>{request.model}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Серийный номер:</label>
                      <span>{request.serialNumber}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Дата/время:</label>
                      <span>{request.dateOnly} {request.timeOnly}</span>
                    </div>
                  </div>

                  <div className={styles.detailItem}>
                    <label>Описание неисправности:</label>
                    <p className={styles.description}>{request.description}</p>
                  </div>

                  {request.rejectionReason && (
                    <div className={styles.detailItem}>
                      <label className={styles.rejectLabel}>Причина отклонения:</label>
                      <p className={styles.rejectReason}>{request.rejectionReason}</p>
                    </div>
                  )}

                  {request.statusChangedAt && (
                    <div className={styles.detailItem}>
                      <label>Статус изменён:</label>
                      <span>
                        {new Date(request.statusChangedAt).toLocaleString('ru-RU')}
                        {request.statusChangedByFio && ` (${request.statusChangedByFio})`}
                      </span>
                    </div>
                  )}

                  {/* ✅ Кнопки действий для НОВЫХ заявок */}
                  {request.status === RequestStatus.New && (
                    <div className={styles.actionButtons}>
                      <button
                        className={styles.acceptBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(request.id);
                        }}
                        disabled={processingId === request.id}
                      >
                        {processingId === request.id ? '⏳ Принятие...' : '✓ Принять'}
                      </button>

                      <div className={styles.rejectContainer}>
                        <input
                          type="text"
                          className={styles.rejectInput}
                          placeholder="Причина отклонения (мин. 5 символов)"
                          value={rejectionReason[request.id] || ''}
                          onChange={(e) => setRejectionReason(prev => ({
                            ...prev,
                            [request.id]: e.target.value
                          }))}
                          disabled={processingId === request.id}
                          maxLength={500}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          className={styles.rejectBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReject(request.id);
                          }}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? '⏳ Отклонение...' : '✕ Отклонить'}
                        </button>
                      </div>

                      {/* ✅ Кнопка назначения специалиста */}
                      <button
                        className={styles.assignBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAssignModal(request.id);
                        }}
                        disabled={assigningId === request.id}
                      >
                        {assigningId === request.id ? (
                          <span className={styles.loading}>
                            <span className={styles.spinner}></span>
                            Назначение...
                          </span>
                        ) : (
                          'Назначить наряд на диагностику'
                        )}
                      </button>
                    </div>
                  )}

                  {/* ✅ Отображение назначенного специалиста */}
                  {request.staffFio && request.status !== RequestStatus.New && (
                    <div className={styles.assignedEngineer}>
                      <div className={styles.engineerInfo}>
                        <span className={styles.engineerLabel}>👷 Назначенный специалист:</span>
                        <span className={styles.engineerFio}>{request.staffFio}</span>
                      </div>
                      <span className={styles.engineerTab}>Табельный номер: 12345</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {filteredRequests.length < allRequests.length && (
        <div className={styles.filterInfo}>
          Показано {filteredRequests.length} из {allRequests.length} заявок
        </div>
      )}

      {/* ✅ Модальное окно подтверждения назначения */}
      {assignModal.isOpen && (
        <div className={styles.modalOverlay} onClick={handleCloseAssignModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Назначение наряда на диагностику</h3>
              <button className={styles.modalClose} onClick={handleCloseAssignModal}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                Система автоматически подобрала специалиста для выполнения диагностики:
              </p>

              <div className={styles.engineerCard}>
                <div className={styles.engineerAvatar}>
                  И
                </div>
                <div className={styles.engineerDetails}>
                  <div className={styles.engineerName}>
                    {assignModal.engineer?.fio}
                  </div>
                  <div className={styles.engineerTabNumber}>
                    Табельный номер: <strong>{assignModal.engineer?.tabNumber}</strong>
                  </div>
                  {assignModal.engineer?.specialization && (
                    <div className={styles.engineerSpecialization}>
                      Специализация: {assignModal.engineer.specialization}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.modalWarning}>
                После подтверждения заявка будет переведена в статус "В работе"
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.modalCancelBtn}
                onClick={handleCloseAssignModal}
                disabled={assigningId !== null}
              >
                Отмена
              </button>
              <button
                className={styles.modalConfirmBtn}
                onClick={handleConfirmAssign}
                disabled={assigningId !== null}
              >
                {assigningId !== null ? (
                  <span className={styles.loading}>
                    <span className={styles.spinner}></span>
                    Подтверждение...
                  </span>
                ) : (
                  'Подтвердить назначение наряда'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsAdmin;