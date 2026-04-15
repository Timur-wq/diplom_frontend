// src/pages/Client/ClientRequests.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientRequestService } from '../../services/clientRequestService';
import { ClientRequest, RequestStatus, ClientRequestFilters, getRequestStatusLabel } from '../../types/client';
import styles from './ClientRequests.module.scss';
import { authService } from '../../services/authService';
import { DiagnosticActDto } from '../../types/diagnostic';

const ClientRequests: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 🔥 ИСПРАВЛЕНО: Добавлены недостающие поля в тип
  const [invoiceInfo, setInvoiceInfo] = useState<Record<number, {
    contractSigned: boolean;
    invoiceGenerated: boolean;
    invoiceFilePath?: string;
    invoiceAmount?: number;
    paymentReceiptUploaded: boolean;        // ✅ Добавлено
    paymentReceiptPath?: string;            // ✅ Добавлено
    isPrepaymentConfirmed: boolean;         // ✅ Добавлено
  } | null>>({});

  const [diagnosticActs, setDiagnosticActs] = useState<Record<number, boolean>>({});

  // Фильтры
  const [filters, setFilters] = useState<ClientRequestFilters>({
    status: 'All',
    searchQuery: '',
    dateFrom: '',
    dateTo: '',
    svtType: ''
  });

  const [uploadingReceipt, setUploadingReceipt] = useState<Record<number, boolean>>({});

  // 🔥 Загрузка чека об оплате
  const handleUploadReceipt = async (requestId: number, file: File) => {
    setUploadingReceipt(prev => ({ ...prev, [requestId]: true }));

    try {
      // Сначала получаем invoiceId
      const invoiceResponse = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/Document/request/${requestId}/invoice-info`
      );

      if (!invoiceResponse.ok) {
        throw new Error('Не удалось получить информацию о счёте');
      }

      const invoiceData = await invoiceResponse.json();

      if (!invoiceData.invoiceGenerated) {
        throw new Error('Счёт ещё не сформирован');
      }

      // Получаем invoiceId из ответа
      const invoiceId = invoiceData.invoiceId || requestId;

      // 🔥 Загружаем файл
      const formData = new FormData();
      formData.append('receipt', file);

      // 🔥 ИСПРАВЛЕНО: Не устанавливаем Content-Type вручную!
      // Браузер сам установит multipart/form-data с правильным boundary
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/Document/invoice/${invoiceId}/upload-receipt`,
        {
          method: 'POST',
          body: formData
          // ❌ НЕ добавляйте headers: { 'Content-Type': ... } здесь!
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Не удалось загрузить чек');
      }

      const result = await response.json();
      alert('✅ Чек загружен! Ожидайте подтверждения от диспетчера.');

      // 🔥 Перезагружаем информацию о счёте
      await loadInvoiceInfo(requestId);

    } catch (error: any) {
      console.error('Ошибка загрузки чека:', error);
      alert(error.message || 'Ошибка при загрузке чека');
    } finally {
      setUploadingReceipt(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // 🔥 Функция для перехода к просмотру акта
  const handleViewAct = async (requestId: number) => {
    try {
      setSubmitting(true);

      // 🔥 Получаем список актов клиента
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/DiagnosticAct/pending`
      );

      if (!response.ok) {
        throw new Error('Не удалось загрузить акты');
      }

      const acts: DiagnosticActDto[] = await response.json();

      // 🔥 Ищем акт для этой заявки
      const act = acts.find(a => a.requestId === requestId);

      if (!act) {
        alert('Акт диагностики ещё не готов к просмотру');
        return;
      }

      // 🔥 Переходим на страницу акта с actCode
      navigate(`/client/acts/${act.actCode}`);

    } catch (error: any) {
      console.error('Ошибка просмотра акта:', error);
      alert(error.message || 'Не удалось загрузить акт');
    } finally {
      setSubmitting(false);
    }
  };

  const checkDiagnosticAct = async (requestId: number): Promise<boolean> => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/DiagnosticAct/by-request/${requestId}`
      );

      if (response.ok) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const loadInvoiceInfo = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/Document/request/${requestId}/invoice-info`
      );

      if (response.ok) {
        const data = await response.json();
        setInvoiceInfo(prev => ({
          ...prev,
          [requestId]: data
        }));
      }
    } catch (error) {
      console.error(`Ошибка загрузки информации о счёте для заявки ${requestId}:`, error);
    }
  };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clientRequestService.getAllRequests();
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      if (filters.status !== 'All' && request.status !== filters.status) return false;

      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const text = `${request.model} ${request.serialNumber} ${request.svtType} ${request.description}`.toLowerCase();
        if (!text.includes(query)) return false;
      }

      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        const reqDate = new Date(request.createdAt);
        if (reqDate < from) return false;
      }

      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        const reqDate = new Date(request.createdAt);
        if (reqDate > to) return false;
      }

      if (filters.svtType.trim()) {
        if (!request.svtType.toLowerCase().includes(filters.svtType.toLowerCase())) return false;
      }

      return true;
    });
  }, [requests, filters]);

  const getStatusLabel = (status: RequestStatus): string => {
    return getRequestStatusLabel(status);
  };

  const getStatusClass = (status: RequestStatus): string => {
    const classes: Record<RequestStatus, string> = {
      [RequestStatus.New]: styles.statusNew,
      [RequestStatus.Accepted]: styles.statusAccepted,
      [RequestStatus.Rejected]: styles.statusRejected,
      [RequestStatus.InProgress]: styles.statusInProgress,
      [RequestStatus.DiagnosticCompleted]: styles.statusCompleted,
      [RequestStatus.WaitingForClientApproval]: styles.statusInProgress,
      [RequestStatus.ApprovedByClient]: styles.statusCompleted,
      [RequestStatus.Completed]: styles.statusCompleted,
      [RequestStatus.Cancelled]: styles.statusCancelled
    };
    return classes[status] || styles.statusCancelled;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const toggleExpand = (id: number) => {
    const isExpanding = expandedId !== id;
    setExpandedId(isExpanding ? id : null);

    if (isExpanding) {
      checkDiagnosticAct(id).then((hasAct: boolean) => {
        setDiagnosticActs((prev: Record<number, boolean>) => ({ ...prev, [id]: hasAct }));
      });

      loadInvoiceInfo(id);
    }
  };

  if (loading) return <div className={styles.loading}>Загрузка заявок...</div>;
  if (error) return <div className={styles.error}>Ошибка: {error}</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Мои заявки</h1>

      {/* Фильтры */}
      <div className={styles.filtersPanel}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterField}>
            <label>Поиск</label>
            <input
              type="text"
              placeholder="Модель, серийный номер..."
              value={filters.searchQuery}
              onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            />
          </div>

          <div className={styles.filterField}>
            <label>Статус</label>
            <select
              value={filters.status}
              onChange={e => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
            >
              <option value="All">Все статусы</option>
              <option value={RequestStatus.New}>Новые</option>
              <option value={RequestStatus.Accepted}>Принятые</option>
              <option value={RequestStatus.Rejected}>Отклонённые</option>
              <option value={RequestStatus.InProgress}>В работе</option>
              <option value={RequestStatus.Completed}>Завершённые</option>
            </select>
          </div>

          <div className={styles.filterField}>
            <label>Тип СВТ</label>
            <input
              type="text"
              placeholder="Ноутбук, ПК..."
              value={filters.svtType}
              onChange={e => setFilters(prev => ({ ...prev, svtType: e.target.value }))}
            />
          </div>

          <div className={styles.filterField}>
            <label>Дата от</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            />
          </div>

          <div className={styles.filterField}>
            <label>Дата до</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            />
          </div>
        </div>

        {/* Быстрые фильтры */}
        <div className={styles.quickFilters}>
          {['All', RequestStatus.New, RequestStatus.InProgress, RequestStatus.Completed].map(status => (
            <button
              key={status}
              className={`${styles.quickFilterBtn} ${filters.status === status ? styles.active : ''}`}
              onClick={() => setFilters(prev => ({ ...prev, status: status as any }))}
            >
              {status === 'All' ? 'Все' : getStatusLabel(status as RequestStatus)}
              {' ('}
              {status === 'All'
                ? requests.length
                : requests.filter(r => r.status === status).length}
              )
            </button>
          ))}
        </div>
      </div>

      {/* Список заявок */}
      <div className={styles.requestsList}>
        {filteredRequests.length === 0 ? (
          <div className={styles.empty}>
            {requests.length === 0
              ? 'У вас пока нет заявок'
              : 'По вашему фильтру заявок не найдено'}
          </div>
        ) : (
          filteredRequests.map(request => (
            <div key={request.id} className={styles.requestCard}>
              <div
                className={styles.requestHeader}
                onClick={() => toggleExpand(request.id)}
              >
                <div className={styles.requestInfo}>
                  <span className={styles.requestId}>#{request.id}</span>
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
                  <div className={styles.detailsGrid}>
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
                      <label>Телефон:</label>
                      <span>{request.clientPhone}</span>
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

                  {request.staffFio && request.status !== RequestStatus.New && (
                    <div className={styles.assignedInfo}>
                      <label>Назначенный специалист:</label>
                      <span>{request.staffFio}</span>
                    </div>
                  )}

                  {request.statusChangedAt && (
                    <div className={styles.detailItem}>
                      <label>Статус изменён:</label>
                      <span>{formatDate(request.statusChangedAt)}</span>
                    </div>
                  )}

                  {expandedId === request.id && (
                    <div className={styles.requestDetails}>
                      {/* 🔥 Кнопка просмотра акта и счёта */}
                      {(request.status === RequestStatus.DiagnosticCompleted ||
                        request.status === RequestStatus.WaitingForClientApproval ||
                        request.status === RequestStatus.ApprovedByClient) && (
                          <div className={styles.actionSection}>
                            {(() => {
                              const currentInvoiceInfo = invoiceInfo[request.id];

                              return (
                                <>
                                  <div className={styles.actionsRow}>
                                    <button
                                      className={styles.viewActBtn}
                                      onClick={async (e) => {
                                        handleViewAct(request.id);
                                        e.stopPropagation();
                                      }}
                                      disabled={submitting}
                                    >
                                      {submitting ? 'Загрузка...' : '📋 Просмотреть акт диагностики'}
                                    </button>

                                    {currentInvoiceInfo?.invoiceGenerated ? (
                                      <button
                                        className={styles.viewInvoiceBtn}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            const response = await authService.fetchWithAuth(
                                              `https://localhost:7053/api/client/Document/invoice/${request.id}/download`
                                            );

                                            if (!response.ok) throw new Error('Не удалось скачать счёт');

                                            const blob = await response.blob();
                                            const blobUrl = window.URL.createObjectURL(blob);
                                            window.open(blobUrl, '_blank');

                                            setTimeout(() => {
                                              window.URL.revokeObjectURL(blobUrl);
                                            }, 60000);
                                          } catch (error: any) {
                                            console.error('Ошибка скачивания счёта:', error);
                                            alert(error.message || 'Не удалось скачать счёт');
                                          }
                                        }}
                                        title="Скачать счёт на предоплату (только ЗИП)"
                                      >
                                        🧾 Просмотреть счёт на оплату
                                        {currentInvoiceInfo.invoiceAmount && (
                                          <span className={styles.invoiceAmount}>
                                            {' '}{currentInvoiceInfo.invoiceAmount.toLocaleString('ru-RU')} ₽
                                          </span>
                                        )}
                                      </button>
                                    ) : null}
                                  </div>

                                  {/* 🔥 Секция загрузки чека */}
                                  {currentInvoiceInfo?.invoiceGenerated && !currentInvoiceInfo.paymentReceiptUploaded && (
                                    <div className={styles.receiptUploadSection}>
                                      <div className={styles.sectionTitle}>📄 Загрузить чек об оплате</div>
                                      <div className={styles.uploadInfo}>
                                        После оплаты счёта загрузите чек или квитанцию об оплате
                                      </div>

                                      <div className={styles.fileInputWrapper}>
                                        <label className={styles.fileInputLabel}>
                                          Выберите файл
                                          <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                handleUploadReceipt(request.id, file);
                                              }
                                            }}
                                            disabled={uploadingReceipt[request.id]}
                                            className={styles.fileInput}
                                          />
                                        </label>
                                      </div>

                                      {uploadingReceipt[request.id] && (
                                        <div className={styles.uploading}>
                                          <span className={styles.spinner}></span>
                                          Загрузка...
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* 🔥 Чек загружен, ожидает подтверждения */}
                                  {currentInvoiceInfo?.paymentReceiptUploaded && !currentInvoiceInfo.isPrepaymentConfirmed && (
                                    <div className={styles.receiptPendingSection}>
                                      <div className={styles.sectionTitle}>📄 Чек об оплате</div>
                                      <div className={styles.pendingStatus}>✅ Чек загружен</div>
                                      <div className={styles.pendingText}>
                                        Ожидайте подтверждения от диспетчера...
                                      </div>
                                      {currentInvoiceInfo.paymentReceiptPath && (
                                        <a
                                          href={`https://localhost:7053/${currentInvoiceInfo.paymentReceiptPath}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={styles.viewReceiptLink}
                                        >
                                          👁️ Просмотреть чек
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  {/* 🔥 Оплата подтверждена */}
                                  {currentInvoiceInfo?.isPrepaymentConfirmed && (
                                    <div className={styles.paymentConfirmedSection}>
                                      <div className={styles.sectionTitle}>✅ Оплата подтверждена</div>
                                      <div className={styles.confirmedText}>
                                        Предоплата подтверждена диспетчером. Работы начнутся в ближайшее время.
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {filteredRequests.length < requests.length && (
        <div className={styles.filterInfo}>
          Показано {filteredRequests.length} из {requests.length} заявок
        </div>
      )}
    </div>
  );
};

export default ClientRequests;