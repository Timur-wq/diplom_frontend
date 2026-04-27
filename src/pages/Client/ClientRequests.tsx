// src/pages/Client/ClientRequests.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientRequestService } from '../../services/clientRequestService';
import { ClientRequest, RequestStatus, ClientRequestFilters, getRequestStatusLabel } from '../../types/client';
import styles from './ClientRequests.module.scss';
import { authService } from '../../services/authService';
import { DiagnosticActDto } from '../../types/diagnostic';

// Тип для актов
interface TaskActs {
  actId?: number;  // ← 🔥 ДОБАВЬТЕ ЭТО ПОЛЕ!
  repairActPath?: string;
  spareWriteOffPath?: string;
  createdAt?: string;
}

interface RequestAdditionalInfo {
  contractSigned: boolean;
  invoiceGenerated: boolean;
  invoiceFilePath?: string;
  invoiceAmount?: number;
  paymentReceiptUploaded: boolean;
  paymentReceiptPath?: string;
  isPrepaymentConfirmed: boolean;

  // 🔥 Добавьте эти поля:
  warrantyExists?: boolean;
  warrantyFilePath?: string;
  warrantyValidUntil?: string;

  // 🔥 Финальный счёт на оплату работ
  finalInvoiceGenerated?: boolean;
  finalInvoiceFilePath?: string;
  finalInvoiceAmount?: number;
  finalPaymentReceiptUploaded: boolean;
  finalPaymentReceiptPath?: string;
  isFinalPaymentConfirmed: boolean;
}

// Тип для статуса подписи
interface ActSignatureStatus {
  actId: number;
  isSignedByClient: boolean;
  clientSignedAt?: string;
  clientSignatureMethod?: string;
  clientVerificationData?: string;
  isSignedByDispatcher: boolean;
  dispatcherSignedAt?: string;
  dispatcherSignedByTabNumber?: number;
  dispatcherVerificationData?: string;
  isVerifiedByDispatcher: boolean;
  isFullySigned: boolean;
}


const ClientRequests: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Состояние
  const [actSignatureStatus, setActSignatureStatus] = useState<Record<number, ActSignatureStatus>>({});

  // 🔥 НОВОЕ: Состояние для актов
  const [taskActs, setTaskActs] = useState<Record<number, TaskActs>>({});

  // Функция загрузки статуса
  const loadActSignatureStatus = async (actId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${actId}/acts/signature-status`
      );
      if (response.ok) {
        const status: ActSignatureStatus = await response.json();
        setActSignatureStatus(prev => ({ ...prev, [actId]: status }));
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса подписи:', error);
    }
  };

  const loadFinalInvoiceInfo = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/Document/request/${requestId}/final-invoice-info`
      );

      if (response.ok) {
        const data = await response.json();

        setInvoiceInfo(prev => {
          const current = prev[requestId];

          const baseInfo = current ?? {
            contractSigned: false,
            invoiceGenerated: false,
            paymentReceiptUploaded: false,
            isPrepaymentConfirmed: false,
            warrantyExists: false
          };

          return {
            ...prev,
            [requestId]: {
              ...baseInfo,
              finalInvoiceGenerated: data.invoiceGenerated,
              finalInvoiceFilePath: data.invoiceFilePath,
              finalInvoiceAmount: data.invoiceAmount,
              finalPaymentReceiptUploaded: data.paymentReceiptUploaded,
              finalPaymentReceiptPath: data.paymentReceiptPath,
              isFinalPaymentConfirmed: data.isPaymentConfirmed
            }
          };
        });
      }
    } catch (error) {
      console.error(`Ошибка загрузки информации о финальном счёте для заявки ${requestId}:`, error);
    }
  };

  const handleUploadFinalInvoiceReceipt = async (requestId: number, file: File) => {
    setUploadingReceipt(prev => ({ ...prev, [requestId]: true }));

    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/Document/request/${requestId}/final-invoice/upload-receipt`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Не удалось загрузить чек');
      }

      alert('✅ Чек загружен! Ожидайте подтверждения от диспетчера.');
      await loadFinalInvoiceInfo(requestId);

    } catch (error: any) {
      console.error('Ошибка загрузки чека:', error);
      alert(error.message || 'Ошибка при загрузке чека');
    } finally {
      setUploadingReceipt(prev => ({ ...prev, [requestId]: false }));
    }
  };



  const handleClientSignAct = async (requestId: number) => {
    if (!window.confirm('Подписать Акт выполненных работ простой электронной подписью?')) return;

    try {
      // Получаем actId через запрос статуса
      const statusResponse = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/acts/signature-status`
      );

      if (!statusResponse.ok) throw new Error('Не удалось получить статус акта');

      const status = await statusResponse.json();

      // Подписываем
      await authService.fetchWithAuth(
        `https://localhost:7053/api/client/acts/${status.actId}/client-sign`,
        { method: 'POST' }
      );

      alert('✅ Акт подписан!');
      loadActSignatureStatus(status.actId);
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    }
  };

  // Функция подписания акта клиентом
  // Функция подписания акта клиентом
  // Функция подписания акта клиентом
  const handleSignAct = async (requestId: number) => {
    if (!window.confirm('Подписать Акт выполненных работ?')) return;
    try {
      // 🔥 Получаем actId из taskActs
      const actId = taskActs[requestId]?.actId;
      if (!actId) {
        throw new Error('Не удалось найти ID акта');
      }
      console.log('📝 [Подписание] requestId:', requestId, 'actId:', actId);

      // 🔥 ИСПРАВЛЕНО: используем правильный эндпоинт
      await authService.fetchWithAuth(
        `https://localhost:7053/api/client/acts/${actId}/sign`,
        { method: 'POST' }
      );
      alert('✅ Акт подписан!');
      // Обновляем статус
      await loadActSignatureStatus(actId);
    } catch (e: any) {
      console.error('Ошибка подписания:', e);
      alert(e.message || 'Не удалось подписать акт');
    }
  };

  // Состояние для статуса договора
  const [contractSignatureStatus, setContractSignatureStatus] = useState<Record<number, {
    isSignedByClient: boolean;
    clientSignedAt?: string;
    isFullySigned: boolean;
  } | null>>({});

  // Загрузка статуса подписания договора
  const loadContractSignatureStatus = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/contract/request/${requestId}`
      );

      if (response.ok) {
        const contract = await response.json();
        setContractSignatureStatus(prev => ({
          ...prev,
          [requestId]: {
            isSignedByClient: contract.isSignedByClient,
            clientSignedAt: contract.signedAt,
            isFullySigned: contract.isFullySigned
          }
        }));
      }
    } catch (error) {
      console.error(`Ошибка загрузки статуса договора для заявки ${requestId}:`, error);
    }
  };

  // Подписание договора клиентом
  const handleSignContract = async (requestId: number) => {
    if (!window.confirm('Подписать договор простой электронной подписью?\n\nПосле подписания договор получит юридическую силу.')) return;

    try {
      // Сначала получаем ID договора
      const contractResponse = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/contract/request/${requestId}`
      );

      if (!contractResponse.ok) {
        throw new Error('Договор не найден');
      }

      const contract = await contractResponse.json();

      if (!contract.contractId) {
        throw new Error('ID договора не найден');
      }

      // Подписываем договор
      const signResponse = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/contract/${contract.contractId}/sign`,
        { method: 'POST' }
      );

      if (!signResponse.ok) {
        throw new Error('Не удалось подписать договор');
      }

      alert('✅ Договор успешно подписан!');

      // Обновляем статус
      await loadContractSignatureStatus(requestId);

    } catch (error: any) {
      console.error('Ошибка подписания договора:', error);
      alert(error.message || 'Не удалось подписать договор');
    }
  };

  const [invoiceInfo, setInvoiceInfo] = useState<Record<number, {
    contractSigned: boolean;
    invoiceGenerated: boolean;
    invoiceFilePath?: string;
    invoiceAmount?: number;
    paymentReceiptUploaded: boolean;
    paymentReceiptPath?: string;
    isPrepaymentConfirmed: boolean;

    // 🔥 НОВОЕ: Гарантийный талон
    warrantyExists: boolean;
    warrantyFilePath?: string;
    warrantyValidUntil?: string;

    // 🔥 Финальный счёт на оплату работ
    finalInvoiceGenerated?: boolean;
    finalInvoiceFilePath?: string;
    finalInvoiceAmount?: number;
    finalPaymentReceiptUploaded: boolean;
    finalPaymentReceiptPath?: string;
    isFinalPaymentConfirmed: boolean;
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

  const loadWarrantyInfo = async (requestId: number) => {
    try {
      console.log('🔍 Загрузка информации о гарантии для заявки:', requestId);

      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/Document/request/${requestId}/warranty-info`
      );

      console.log('📡 Ответ сервера:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Получены данные о гарантии:', data);

        setInvoiceInfo(prev => {
          const current = prev[requestId];

          const baseInfo = current ?? {
            contractSigned: false,
            invoiceGenerated: false,
            invoiceFilePath: undefined,
            invoiceAmount: undefined,
            paymentReceiptUploaded: false,
            paymentReceiptPath: undefined,
            isPrepaymentConfirmed: false,
            warrantyExists: false,
            warrantyFilePath: undefined,
            warrantyValidUntil: undefined,
            finalInvoiceGenerated: false,
            finalInvoiceFilePath: undefined,
            finalInvoiceAmount: undefined,
            finalPaymentReceiptUploaded: false,
            finalPaymentReceiptPath: undefined,
            isFinalPaymentConfirmed: false
          };

          const newInfo = {
            ...baseInfo,
            warrantyExists: data.warrantyExists,
            warrantyFilePath: data.warrantyFilePath,
            warrantyValidUntil: data.warrantyValidUntil
          };

          console.log('💾 Обновлённое состояние:', newInfo);

          return {
            ...prev,
            [requestId]: newInfo
          };
        });
      } else {
        const errorText = await response.text().catch(() => 'N/A');
        console.error('❌ Ошибка загрузки гарантии:', response.status, errorText);
      }
    } catch (error) {
      console.error('💥 Исключение при загрузке гарантии:', error);
    }
  };

  const handleDownloadWarranty = async (requestId: number, warrantyPath: string) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/Document/warranty/download?path=${encodeURIComponent(warrantyPath)}`
      );

      if (!response.ok) throw new Error('Не удалось скачать гарантийный талон');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');

      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (error: any) {
      console.error('Ошибка скачивания гарантийного талона:', error);
      alert(error.message || 'Не удалось скачать гарантийный талон');
    }
  };

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
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/Document/invoice/${invoiceId}/upload-receipt`,
        {
          method: 'POST',
          body: formData
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

        setInvoiceInfo(prev => {
          const current = prev[requestId];

          const baseInfo = current ?? {
            contractSigned: false,
            invoiceGenerated: false,
            paymentReceiptUploaded: false,
            isPrepaymentConfirmed: false
          };

          return {
            ...prev,
            [requestId]: {
              ...baseInfo,
              ...data
            }
          };
        });
      }
    } catch (error) {
      console.error(`Ошибка загрузки информации о счёте для заявки ${requestId}:`, error);
    }
  };

  // 🔥 НОВАЯ ФУНКЦИЯ: Загрузка актов для заявки
  // 🔥 НОВАЯ ФУНКЦИЯ: Загрузка актов для заявки
  const loadTaskActs = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/acts`
      );

      if (response.ok) {
        const acts = await response.json();

        console.log('✅ [Акты] Получены:', acts);

        setTaskActs(prev => ({
          ...prev,
          [requestId]: acts  // ← Просто сохраняем ответ, actId уже там есть
        }));
      }
    } catch (error) {
      console.error(`Ошибка загрузки актов для заявки ${requestId}:`, error);
    }
  };

  // 🔥 НОВАЯ ФУНКЦИЯ: Загрузка статуса финализации
  const loadFinalizationStatus = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/finalization-status`
      );
      if (response.ok) {
        const status = await response.json();
        console.log('Статус финализации:', status);
      }
    } catch (error) {
      console.error(`Ошибка загрузки статуса финализации для заявки ${requestId}:`, error);
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
  useEffect(() => {
    if (expandedId && taskActs[expandedId]?.actId) {
      const actId = taskActs[expandedId].actId;
      console.log('📝 [useEffect] Загрузка статуса для actId:', actId);
      loadActSignatureStatus(actId);
    }
  }, [taskActs, expandedId]);

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
      loadFinalInvoiceInfo(id);
      loadWarrantyInfo(id);
      loadContractSignatureStatus(id);  // 🔥 НОВОЕ: Загружаем статус договора

      const request = requests.find(r => r.id === id);
      if (request?.status === RequestStatus.Completed) {
        loadTaskActs(id);
      }
    }
  };

  // 🔥 НОВАЯ ФУНКЦИЯ: Загрузка статуса подписания для заявки
  // 🔥 НОВАЯ ФУНКЦИЯ: Загрузка статуса подписания для заявки
  // 🔥 НОВАЯ ФУНКЦИЯ: Загрузка статуса подписания для заявки
  const loadActSignatureStatusForRequest = async (requestId: number) => {
    try {
      // 🔥 Получаем actId из taskActs
      const actId = taskActs[requestId]?.actId;

      console.log('🔍 [loadActSignatureStatusForRequest] requestId:', requestId, 'actId:', actId, 'taskActs:', taskActs[requestId]);

      if (!actId) {
        console.warn('⚠️ actId не найден для requestId:', requestId);
        return;
      }

      console.log('📝 [Загрузка статуса] requestId:', requestId, 'actId:', actId);

      // 🔥 Загружаем статус с правильным actId
      await loadActSignatureStatus(actId);

    } catch (error) {
      console.error('Ошибка загрузки статуса подписания:', error);
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
                        request.status === RequestStatus.ApprovedByClient ||
                        request.status === RequestStatus.Completed) && (
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

                                    {/* 🔥 НОВАЯ КНОПКА: Просмотреть договор */}
                                    <button
                                      className={styles.viewContractBtn}  // ← Добавьте стиль ниже
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          const response = await authService.fetchWithAuth(
                                            `https://localhost:7053/api/client/contract/request/${request.id}`
                                          );

                                          if (!response.ok) {
                                            throw new Error('Договор ещё не сформирован диспетчером');
                                          }

                                          const contract = await response.json();

                                          if (contract.filePath) {
                                            window.open(`https://localhost:7053/${contract.filePath}`, '_blank');
                                          } else {
                                            alert('Договор ещё не сформирован');
                                          }
                                        } catch (error: any) {
                                          console.error('Ошибка просмотра договора:', error);
                                          alert(error.message || 'Договор ещё не сформирован диспетчером');
                                        }
                                      }}
                                      title="Просмотреть договор"
                                    >
                                      📄 Просмотреть договор
                                    </button>
                                    {/* 🔥 Секция подписания договора */}
                                    {/* 🔥 Секция подписания договора */}
                                    {(() => {
                                      const status = contractSignatureStatus[request.id];

                                      return (
                                        <>
                                          {/* Если договор ещё не подписан клиентом */}
                                          {!status?.isSignedByClient && (
                                            <div className={styles.contractSignatureSection}>
                                              <div className={styles.signatureInfo}>
                                                <p className={styles.signatureText}>
                                                  📝 Для начала работ необходимо подписать договор
                                                </p>
                                                <button
                                                  className={styles.signContractBtn}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSignContract(request.id);
                                                  }}
                                                >
                                                  ✍️ Подписать договор
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Если договор подписан клиентом, но НЕ подписан диспетчером */}
                                          {status?.isSignedByClient && !status.isFullySigned && (
                                            <div className={styles.contractPendingSection}>
                                              <div className={styles.pendingInfo}>
                                                <p className={styles.pendingText}>
                                                  ✅ Вы подписали договор {status.clientSignedAt &&
                                                    new Date(status.clientSignedAt).toLocaleString('ru-RU')
                                                  }
                                                </p>
                                                <p className={styles.pendingHint}>
                                                  ⏳ Ожидается подпись диспетчера...
                                                </p>
                                              </div>
                                            </div>
                                          )}

                                          {/* Если договор подписан обеими сторонами */}
                                          {status?.isFullySigned && (
                                            <div className={styles.contractFullySignedSection}>
                                              <div className={styles.fullySignedInfo}>
                                                <p className={styles.fullySignedText}>
                                                  ✅ Договор полностью подписан обеими сторонами
                                                </p>

                                                {/* <div className={styles.signatureDetails}>
                                                  <div className={styles.signatureDetail}>
                                                    <strong>📝 Ваша подпись:</strong>
                                                    <span>{status.clientSignedAt &&
                                                      new Date(status.clientSignedAt).toLocaleString('ru-RU')
                                                    }</span>
                                                  </div>

                                                  <div className={styles.signatureDetail}>
                                                    <strong>🏢 Подпись диспетчера:</strong>
                                                    <span>{status.dispatcherSignedAt &&
                                                      new Date(status.dispatcherSignedAt).toLocaleString('ru-RU')
                                                    }</span>
                                                  </div>
                                                </div> */}

                                                {/* 🔥 Кнопка для скачивания договора с подписями */}
                                                <button
                                                  className={styles.downloadSignedContractBtn}
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    try {
                                                      const response = await authService.fetchWithAuth(
                                                        `https://localhost:7053/api/client/contract/request/${request.id}`
                                                      );

                                                      if (!response.ok) {
                                                        throw new Error('Не удалось получить информацию о договоре');
                                                      }

                                                      const contract = await response.json();

                                                      if (contract.filePath) {
                                                        window.open(`https://localhost:7053/${contract.filePath}`, '_blank');
                                                      } else {
                                                        alert('Договор с подписями ещё не сформирован');
                                                      }
                                                    } catch (error: any) {
                                                      console.error('Ошибка скачивания договора:', error);
                                                      alert(error.message || 'Не удалось скачать договор');
                                                    }
                                                  }}
                                                >
                                                  📥 Скачать договор с подписями (PDF)
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}

                                    {/* 🔥 Показываем счёт ТОЛЬКО если гарантия ещё не выдана */}
                                    {currentInvoiceInfo?.invoiceGenerated && !currentInvoiceInfo?.warrantyExists ? (
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

                                  {/* 🔥 Секция гарантийного талона */}
                                  {currentInvoiceInfo?.warrantyExists && currentInvoiceInfo.warrantyFilePath && (
                                    <div className={styles.warrantySection}>
                                      <div className={styles.sectionTitle}>📄 Гарантийный талон</div>

                                      <div className={styles.warrantyInfo}>
                                        <p>
                                          <strong>Действителен до:</strong>{' '}
                                          {currentInvoiceInfo.warrantyValidUntil
                                            ? new Date(currentInvoiceInfo.warrantyValidUntil).toLocaleDateString('ru-RU')
                                            : '—'}
                                        </p>
                                      </div>

                                      <button
                                        className={styles.downloadWarrantyBtn}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadWarranty(request.id, currentInvoiceInfo.warrantyFilePath!);
                                        }}
                                      >
                                        📥 Скачать гарантийный талон (PDF)
                                      </button>
                                    </div>
                                  )}

                                  {/* 🔥 Секция гарантийного талона */}
                                  {/* {currentInvoiceInfo?.warrantyExists && currentInvoiceInfo.warrantyFilePath && (
                                    <div className={styles.warrantySection}>
                                      <div className={styles.sectionTitle}>📄 Гарантийный талон</div>

                                      <div className={styles.warrantyInfo}>
                                        <p>
                                          <strong>Действителен до:</strong>{' '}
                                          {currentInvoiceInfo.warrantyValidUntil
                                            ? new Date(currentInvoiceInfo.warrantyValidUntil).toLocaleDateString('ru-RU')
                                            : '—'}
                                        </p>
                                      </div>

                                      <button
                                        className={styles.downloadWarrantyBtn}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadWarranty(request.id, currentInvoiceInfo.warrantyFilePath!);
                                        }}
                                      >
                                        📥 Скачать гарантийный талон (PDF)
                                      </button>
                                    </div>
                                  )} */}

                                  {/* 🔥 СЕКЦИЯ ФИНАЛЬНОГО СЧЁТА НА ОПЛАТУ РАБОТ */}
                                  {request.status === RequestStatus.Completed && currentInvoiceInfo?.finalInvoiceGenerated && (
                                    <div className={styles.finalInvoiceSection}>
                                      <div className={styles.sectionTitle}>💰 Счёт на оплату работ</div>
                                      <p className={styles.sectionHint}>
                                        ЗИП оплачен отдельно. Данный счёт — только за выполненные работы.
                                      </p>

                                      {/* Кнопка просмотра счёта */}
                                      {currentInvoiceInfo.finalInvoiceFilePath && (
                                        <button
                                          className={styles.viewFinalInvoiceBtn}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                              const response = await authService.fetchWithAuth(
                                                `https://localhost:7053/api/client/Document/request/${request.id}/final-invoice/download`
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
                                        >
                                          🧾 Просмотреть счёт на оплату работ
                                          {currentInvoiceInfo.finalInvoiceAmount && (
                                            <span className={styles.invoiceAmount}>
                                              {' '}{currentInvoiceInfo.finalInvoiceAmount.toLocaleString('ru-RU')} ₽
                                            </span>
                                          )}
                                        </button>
                                      )}

                                      {/* Загрузка чека */}
                                      {!currentInvoiceInfo.finalPaymentReceiptUploaded && (
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
                                                    handleUploadFinalInvoiceReceipt(request.id, file);
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

                                      {/* Чек загружен, ожидает подтверждения */}
                                      {currentInvoiceInfo.finalPaymentReceiptUploaded && !currentInvoiceInfo.isFinalPaymentConfirmed && (
                                        <div className={styles.receiptPendingSection}>
                                          <div className={styles.sectionTitle}>📄 Чек об оплате работ</div>
                                          <div className={styles.pendingStatus}>✅ Чек загружен</div>
                                          <div className={styles.pendingText}>
                                            Ожидайте подтверждения от диспетчера...
                                          </div>
                                          {currentInvoiceInfo.finalPaymentReceiptPath && (
                                            <a
                                              href={`https://localhost:7053/${currentInvoiceInfo.finalPaymentReceiptPath}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={styles.viewReceiptLink}
                                            >
                                              👁️ Просмотреть чек
                                            </a>
                                          )}
                                        </div>
                                      )}

                                      {/* Оплата подтверждена */}
                                      {currentInvoiceInfo.isFinalPaymentConfirmed && (
                                        <div className={styles.paymentConfirmedSection}>
                                          <div className={styles.sectionTitle}>✅ Оплата работ подтверждена</div>
                                          <div className={styles.confirmedText}>
                                            Оплата подтверждена диспетчером. Заявка полностью завершена.
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}


                                  {/* 🔥 Кнопка просмотра акта выполненных работ (перед подписанием) */}
                                  {request.status === RequestStatus.Completed && taskActs[request.id] && (
                                    <div className={styles.viewActSection}>
                                      <h4 className={styles.sectionTitle}>📄 Акт выполненных работ</h4>

                                      {taskActs[request.id]?.repairActPath && (
                                        <a
                                          href={`https://localhost:7053/${taskActs[request.id]!.repairActPath}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={styles.viewActLink}
                                        >
                                          👁️ Просмотреть акт выполненных работ (PDF)
                                        </a>
                                      )}

                                      <p className={styles.hintText}>
                                        Ознакомьтесь с актом и подпишите его ниже
                                      </p>
                                    </div>
                                  )}

                                  {/* 🔥 Секция подписания акта (для клиента) */}
                                  {/* 🔥 Секция подписания акта (для клиента) */}
                                  {request.status === RequestStatus.Completed && taskActs[request.id] && (
                                    <div className={styles.signatureSection}>
                                      <h4 className={styles.sectionTitle}>✍️ Подписание акта</h4>

                                      <div className={styles.signatureGrid}>
                                        {/* Подпись клиента */}
                                        <div className={styles.signatureCard}>
                                          <div className={styles.signatureHeader}>
                                            <span className={styles.signatureIcon}>👤</span>
                                            <span className={styles.signatureTitle}>Ваша подпись</span>
                                          </div>

                                          {/* 🔥 ИСПРАВЛЕНО: используем actId из taskActs */}
                                          {(() => {
                                            const actId = taskActs[request.id]?.actId;
                                            const signatureStatus = actId ? actSignatureStatus[actId] : null;

                                            return signatureStatus?.isSignedByClient ? (
                                              <div className={styles.signedBadge}>
                                                ✅ Подписано {signatureStatus.clientSignedAt &&
                                                  new Date(signatureStatus.clientSignedAt!).toLocaleString('ru-RU')}
                                              </div>
                                            ) : (
                                              <button
                                                className={styles.signBtn}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleSignAct(request.id);
                                                }}
                                              >
                                                ✍️ Подписать акт
                                              </button>
                                            );
                                          })()}
                                        </div>

                                        {/* Подпись диспетчера */}
                                        <div className={styles.signatureCard}>
                                          <div className={styles.signatureHeader}>
                                            <span className={styles.signatureIcon}>🏢</span>
                                            <span className={styles.signatureTitle}>Подпись сервисного центра</span>
                                          </div>

                                          {/* 🔥 ИСПРАВЛЕНО: используем actId из taskActs */}
                                          {(() => {
                                            const actId = taskActs[request.id]?.actId;
                                            const signatureStatus = actId ? actSignatureStatus[actId] : null;

                                            return signatureStatus?.isSignedByDispatcher ? (
                                              <div className={styles.signedBadge}>
                                                ✅ Подписано диспетчером {signatureStatus.dispatcherSignedAt &&
                                                  new Date(signatureStatus.dispatcherSignedAt!).toLocaleString('ru-RU')}
                                              </div>
                                            ) : (
                                              <div className={styles.pendingBadge}>
                                                ⏳ Ожидает подписи
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>

                                      {/* Общий статус */}
                                      {(() => {
                                        const actId = taskActs[request.id]?.actId;
                                        const signatureStatus = actId ? actSignatureStatus[actId] : null;

                                        return signatureStatus?.isFullySigned && (
                                          <div className={styles.fullySigned}>
                                            ✅ Акт полностью подписан обеими сторонами
                                          </div>
                                        );
                                      })()}
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