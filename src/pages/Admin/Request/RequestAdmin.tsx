// src/pages/Admin/Request/RequestAdmin.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { authService } from '../../../services/authService';
import styles from './RequestsAdmin.module.scss';
import { useNavigate, useLocation } from 'react-router-dom';

// Типы
interface RequestDto {
  id: number;
  clientId: number;
  clientFio: string;
  clientPhone: string;

  // ✅ Назначенный специалист
  assignedEngineerTabNumber?: number;
  assignedEngineerFio?: string;
  assignedEngineerLogin?: string;
  assignedAt?: string;  // Дата назначения наряда

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
  DiagnosticCompleted = 'DiagnosticCompleted',
  WaitingForClientApproval = 'WaitingForClientApproval',
  ApprovedByClient = 'ApprovedByClient',
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
  const [generatingContract, setGeneratingContract] = useState<Record<number, boolean>>({});
  const [signedContracts, setSignedContracts] = useState<Record<number, boolean | undefined>>({});
  const [contractIds, setContractIds] = useState<Record<number, number>>({});

  const [spareStatus, setSpareStatus] = useState<{
    hasPendingOrders: boolean;
    pendingOrdersCount: number;
    pendingOrders: Array<{
      spareName: string;
      quantity: number;
      supplierName: string;
    }>;
  } | null>(null);

  // После загрузки заявки проверяем статус ЗИП
  // useEffect(() => {
  //   if (request?.id && request.status === RequestStatus.ApprovedByClient) {
  //     checkSpareStatus(request.id);
  //   }
  // }, [request?.id, request?.status]);

  const checkSpareStatus = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/request/${requestId}/spare-status`
      );

      if (response.ok) {
        const data = await response.json();
        setSpareStatus(data);
      }
    } catch (error) {
      console.error('Ошибка проверки статуса ЗИП:', error);
    }
  };

  const handleConfirmSpareOrders = async () => {
    if (!spareStatus) return;  // ✅ Добавлена проверка

    if (!window.confirm(`Подтвердить ${spareStatus?.pendingOrdersCount} заявок на ЗИП?`))
      return;

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/request/${expandedId}/confirm-spare-orders`,
        { method: 'POST' }
      );

      if (!response.ok) throw new Error('Ошибка при подтверждении');

      alert('✅ Заявки на ЗИП отправлены в ОМТС. Ожидайте поступления.');
      setSpareStatus(null);
      loadRequests();  // ✅ Исправлено: было loadRequest
    } catch (error: any) {
      alert(error.message || 'Ошибка при подтверждении заявок');
    }
  };

  // 🔥 ИСПРАВЛЕНО: Добавлено поле receiptPath
  const [invoiceInfo, setInvoiceInfo] = useState<Record<number, {
    invoiceId?: number;
    generated: boolean;
    amount?: number;
    filePath?: string;
    receiptUploaded: boolean;
    receiptPath?: string;  // ✅ Добавлено
    isPaid: boolean;
  } | null>>({});

  const [generatingInvoice, setGeneratingInvoice] = useState<Record<number, boolean>>({});
  const [confirmingPayment, setConfirmingPayment] = useState<Record<number, boolean>>({});

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
      fio?: string;
      tabNumber?: string;
      specialization?: string;
    } | null;
  }>({
    isOpen: false,
    requestId: null,
    engineer: null
  });

  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [diagnosticActs, setDiagnosticActs] = useState<Record<number, boolean>>({});
  const navigate = useNavigate();

  // Функция для проверки статуса подписания при загрузке:
  const checkContractSigned = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/Document/request/${requestId}/contract`
      );

      if (response.ok) {
        const contract = await response.json();
        setSignedContracts(prev => ({
          ...prev,
          [requestId]: contract.isSignedByClient
        }));
        if (contract.contractId) {
          setContractIds(prev => ({
            ...prev,
            [requestId]: contract.contractId
          }));
        }
      }
    } catch (error) {
      console.log(`Договор для заявки ${requestId} ещё не создан`);
      setSignedContracts(prev => ({
        ...prev,
        [requestId]: undefined
      }));
    }
  };

  // Функция для отметки договора как подписанного:
  const handleMarkContractSigned = async (requestId: number) => {
    const contractId = contractIds[requestId];
    if (!contractId) {
      alert('Не удалось найти договор');
      return;
    }

    if (!window.confirm('Отметить договор как подписанный клиентом?')) return;

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/Document/contract/${contractId}/mark-signed`,
        { method: 'POST' }
      );

      if (response.ok) {
        setSignedContracts(prev => ({
          ...prev,
          [requestId]: true
        }));
        alert('✅ Договор отмечен как подписанный');
      } else {
        throw new Error('Не удалось отметить договор');
      }
    } catch (error: any) {
      alert(error.message || 'Ошибка при отметке договора');
    }
  };

  const handleGenerateContract = async (requestId: number) => {
    if (!window.confirm('Сформировать договор для заявки #' + requestId + '?')) return;

    setGeneratingContract(prev => ({ ...prev, [requestId]: true }));

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/Document/request/${requestId}/generate-contract`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Не удалось сформировать договор');
      }

      const result = await response.json();

      const contractUrl = `https://localhost:7053/${result.contract.filePath}`;
      window.open(contractUrl, '_blank', 'noopener,noreferrer');

      alert('✅ Договор сформирован и открыт в новой вкладке');

      setSignedContracts(prev => ({
        ...prev,
        [requestId]: false
      }));

      if (result.contract.contractId) {
        setContractIds(prev => ({
          ...prev,
          [requestId]: result.contract.contractId
        }));
      }

      refreshData();

    } catch (error: any) {
      console.error('❌ Ошибка генерации договора:', error);
      alert(error.message || 'Не удалось сформировать договор');
    } finally {
      setGeneratingContract(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleOpenAssignModal = async (requestId: number, workId: number = 1) => {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;

    setAssignModal({
      isOpen: true,
      requestId,
      engineer: null
    });

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/Task/candidates/${workId}?svtModel=${encodeURIComponent(request.model)}`
      );

      if (response.ok) {
        const candidates = await response.json();

        if (candidates.length > 0) {
          const bestCandidate = candidates[0];

          setAssignModal(prev => ({
            ...prev,
            engineer: {
              fio: bestCandidate.fio,
              tabNumber: bestCandidate.tabNumber.toString(),
              specialization: ''
            }
          }));
        } else {
          alert('⚠️ Нет доступных специалистов с нужной квалификацией');
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки кандидатов:', error);
      alert('Не удалось загрузить список специалистов');
    }
  };

  const handleCloseAssignModal = () => {
    setAssignModal({
      isOpen: false,
      requestId: null,
      engineer: null
    });
  };

  const handleConfirmAssign = async () => {
    if (!assignModal.requestId || !assignModal.engineer) return;

    setAssigningId(assignModal.requestId);

    try {
      const response = await authService.fetchWithAuth(
        'https://localhost:7053/api/Task/assign',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workId: 1,
            requestId: assignModal.requestId,
            maxActiveOrders: 2
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Не удалось назначить наряд');
      }

      const result = await response.json();

      console.log('✅ Наряд назначен:', result);

      setAllRequests(prev => prev.map(req =>
        req.id === assignModal.requestId
          ? {
            ...req,
            assignedEngineerFio: result.engineerName || assignModal.engineer!.fio,
            assignedEngineerTabNumber: result.assignedEngineerId,
            assignedAt: result.assignedAt || new Date().toISOString(),
            status: RequestStatus.InProgress
          }
          : req
      ));

      alert('✅ Специалист назначен!');
      handleCloseAssignModal();
      refreshData();

    } catch (error: any) {
      console.error('❌ Ошибка назначения:', error);
      alert(error.message || 'Не удалось назначить специалиста');
    } finally {
      setAssigningId(null);
    }
  };

  const [stats, setStats] = useState<Record<string, number>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.fetchWithAuth(
        'https://localhost:7053/api/AdminRequest'
      );

      if (!response.ok) throw new Error('Не удалось загрузить заявки');

      const data: any[] = await response.json();

      const statusMap: Record<number, RequestStatus> = {
        0: RequestStatus.New,
        1: RequestStatus.Accepted,
        2: RequestStatus.Rejected,
        3: RequestStatus.InProgress,
        4: RequestStatus.DiagnosticCompleted,
        5: RequestStatus.WaitingForClientApproval,
        6: RequestStatus.ApprovedByClient,
        7: RequestStatus.Completed,
        8: RequestStatus.Cancelled
      };

      const normalizedData: RequestDto[] = data.map(item => ({
        ...item,
        status: typeof item.status === 'number'
          ? statusMap[item.status] || RequestStatus.New
          : item.status,
        assignedEngineerTabNumber: item.assignedEngineerTabNumber || item.serviceEngineerTabNumber,
        assignedEngineerFio: item.assignedEngineerFio || item.assignedEngineerName,
        assignedAt: item.assignedAt || item.taskAssignedAt
      }));

      setAllRequests(normalizedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const refreshData = useCallback(() => {
    loadRequests();
    loadStats();
  }, [loadRequests, loadStats]);

  useEffect(() => {
    loadRequests();
    loadStats();
  }, [loadRequests, loadStats]);

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

  const filteredStats = useMemo(() => {
    return filteredRequests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredRequests]);

  const toggleExpand = (id: number) => {
    const isExpanding = expandedId !== id;
    setExpandedId(isExpanding ? id : null);
    setSpareStatus(null);  // ✅ Сбрасываем статус при сворачивании

    if (isExpanding) {
      checkDiagnosticAct(id).then(hasAct => {
        setDiagnosticActs(prev => ({ ...prev, [id]: hasAct }));
      });
      checkContractSigned(id);
      loadInvoiceInfo(id);

      // ✅ Проверяем статус ЗИП только если заявка в статусе ApprovedByClient
      const request = allRequests.find(r => r.id === id);
      if (request?.status === RequestStatus.ApprovedByClient) {
        checkSpareStatus(id);
      }
    }
  };



  const loadInvoiceInfo = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/Document/request/${requestId}/invoice-info`
      );

      if (response.ok) {
        const data = await response.json();
        setInvoiceInfo(prev => ({
          ...prev,
          [requestId]: {
            invoiceId: data.invoiceId,
            generated: data.generated,
            amount: data.amount,
            filePath: data.filePath,
            receiptUploaded: data.receiptUploaded,
            receiptPath: data.receiptPath,  // ✅ Добавлено
            isPaid: data.isPaid
          }
        }));
      }
    } catch (error) {
      console.error(`Ошибка загрузки информации о счёте для заявки ${requestId}:`, error);
    }
  };

  const handleGenerateInvoice = async (requestId: number) => {
    if (!window.confirm('Сформировать счёт на предоплату для заявки #' + requestId + '?')) return;

    setGeneratingInvoice(prev => ({ ...prev, [requestId]: true }));

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/Document/request/${requestId}/generate-invoice`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Не удалось сформировать счёт');
      }

      const result = await response.json();

      const invoiceUrl = `https://localhost:7053/${result.invoice.filePath}`;
      window.open(invoiceUrl, '_blank', 'noopener,noreferrer');

      alert('✅ Счёт сформирован и открыт в новой вкладке');

      setInvoiceInfo(prev => ({
        ...prev,
        [requestId]: {
          invoiceId: result.invoice.invoiceId,
          generated: true,
          amount: result.invoice.amount,
          filePath: result.invoice.filePath,
          receiptUploaded: false,
          receiptPath: undefined,
          isPaid: false
        }
      }));

    } catch (error: any) {
      console.error('❌ Ошибка генерации счёта:', error);
      alert(error.message || 'Не удалось сформировать счёт');
    } finally {
      setGeneratingInvoice(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleConfirmPrepayment = async (requestId: number) => {
    const invoice = invoiceInfo[requestId];
    if (!invoice?.invoiceId) {
      alert('Не удалось найти счёт');
      return;
    }

    if (!window.confirm('Подтвердить получение предоплаты по счёту #' + invoice.invoiceId + '?')) return;

    setConfirmingPayment(prev => ({ ...prev, [requestId]: true }));

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/Document/invoice/${invoice.invoiceId}/confirm-paid`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Не удалось подтвердить предоплату');
      }

      setInvoiceInfo(prev => ({
        ...prev,
        [requestId]: prev[requestId] ? { ...prev[requestId]!, isPaid: true } : null
      }));

      alert('✅ Предоплата подтверждена! Работы могут начинаться.');

      refreshData();

    } catch (error: any) {
      console.error('❌ Ошибка подтверждения предоплаты:', error);
      alert(error.message || 'Не удалось подтвердить предоплату');
    } finally {
      setConfirmingPayment(prev => ({ ...prev, [requestId]: false }));
    }
  };

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

  const handleResetFilters = () => {
    setFilters({
      status: 'All',
      searchQuery: '',
      dateFrom: '',
      dateTo: '',
      svtType: ''
    });
  };

  const getStatusLabel = (status: RequestStatus): string => {
    const labels: Record<RequestStatus, string> = {
      [RequestStatus.New]: 'Новая',
      [RequestStatus.Accepted]: 'Принята',
      [RequestStatus.Rejected]: 'Отклонена',
      [RequestStatus.InProgress]: 'В работе',
      [RequestStatus.DiagnosticCompleted]: 'Диагностика завершена',
      [RequestStatus.WaitingForClientApproval]: 'Ожидание согласования с клиентом',
      [RequestStatus.ApprovedByClient]: 'Согласовано с клиентом',
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
      [RequestStatus.DiagnosticCompleted]: styles.statusDiagnosticCompleted,
      [RequestStatus.WaitingForClientApproval]: styles.statusWaitingForClientApproval,
      [RequestStatus.ApprovedByClient]: styles.statusApprovedByClient,
      [RequestStatus.Completed]: styles.statusCompleted,
      [RequestStatus.Cancelled]: styles.statusCancelled
    };
    return classes[status] || '';
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';

    const digits = phone.replace(/\D/g, '');

    if (digits.length !== 11) {
      return phone;
    }

    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка заявок...</div>;
  }

  if (error) {
    return <div className={styles.error}>Ошибка: {error}</div>;
  }

  const checkDiagnosticAct = async (requestId: number) => {
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
              <option value={RequestStatus.DiagnosticCompleted}>Диагностика завершена</option>
              <option value={RequestStatus.WaitingForClientApproval}>Ожидание согласования с клиентом</option>
              <option value={RequestStatus.ApprovedByClient}>Согласовано с клиентом</option>
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
                        {processingId === request.id ? ' Принятие...' : 'Принять'}
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
                          {processingId === request.id ? ' Отклонение...' : 'Отклонить'}
                        </button>
                      </div>

                      <button
                        className={styles.assignBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAssignModal(request.id, 1);
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

                  {diagnosticActs[request.id] && (
                    <div className={styles.actionButtons}>
                      <button
                        className={styles.viewActBtn}
                        onClick={() => {
                          navigate(`/dispatcher/acts/${request.id}`, { replace: true });
                        }}
                        title="Просмотреть акт диагностики"
                      >
                        📋 Акт диагностики
                      </button>

                      {!signedContracts[request.id] && (
                        <button
                          className={styles.contractBtn}
                          onClick={async () => {
                            await handleGenerateContract(request.id);
                          }}
                          disabled={generatingContract[request.id]}
                        >
                          {generatingContract[request.id] ? '📄 Формирование...' : '📄 Сформировать договор'}
                        </button>
                      )}

                      {signedContracts[request.id] !== undefined && (
                        <label className={styles.signedCheckbox}>
                          <input
                            type="checkbox"
                            checked={signedContracts[request.id] || false}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleMarkContractSigned(request.id);
                              }
                            }}
                            disabled={signedContracts[request.id]}
                          />
                          <span>
                            {signedContracts[request.id] ? '✅ Договор подписан' : '☑️ Отметить как подписанный'}
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                  {signedContracts[request.id] === true && (
                    <div className={styles.invoiceSection}>
                      <div className={styles.sectionTitle}>🧾 Счёт на предоплату</div>

                      {!invoiceInfo[request.id]?.generated && (
                        <button
                          className={styles.generateInvoiceBtn}
                          onClick={() => handleGenerateInvoice(request.id)}
                          disabled={generatingInvoice[request.id]}
                        >
                          {generatingInvoice[request.id] ? (
                            <span className={styles.loading}>
                              <span className={styles.spinner}></span>
                              Формирование...
                            </span>
                          ) : (
                            '🧾 Сформировать счёт на предоплату'
                          )}
                        </button>
                      )}

                      {invoiceInfo[request.id]?.generated && (
                        <div className={styles.invoiceDetails}>
                          <div className={styles.invoiceRow}>
                            <span>Сумма к оплате (только ЗИП):</span>
                            <span className={styles.invoiceAmount}>
                              {invoiceInfo[request.id]?.amount?.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>

                          {invoiceInfo[request.id]?.filePath && (
                            <a
                              href={`https://localhost:7053/${invoiceInfo[request.id]?.filePath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.viewInvoiceLink}
                            >
                              📄 Просмотреть счёт (PDF)
                            </a>
                          )}

                          <div className={styles.receiptStatus}>
                            {invoiceInfo[request.id]?.receiptUploaded ? (
                              <>
                                <span className={styles.receiptUploaded}>
                                  ✅ Чек загружен клиентом
                                </span>
                                {invoiceInfo[request.id]?.receiptUploaded && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        // 🔥 Скачиваем файл с токеном авторизации
                                        const response = await authService.fetchWithAuth(
                                          `https://localhost:7053/api/dispatcher/Document/invoice/${request.id}/receipt/download`
                                        );

                                        if (!response.ok) {
                                          throw new Error('Не удалось скачать чек');
                                        }

                                        // 🔥 Получаем blob
                                        const blob = await response.blob();

                                        // 🔥 Создаём URL для blob
                                        const blobUrl = window.URL.createObjectURL(blob);

                                        // 🔥 Открываем в новой вкладке
                                        window.open(blobUrl, '_blank');

                                        // 🔥 Очищаем URL через некоторое время
                                        setTimeout(() => {
                                          window.URL.revokeObjectURL(blobUrl);
                                        }, 60000);

                                      } catch (error: any) {
                                        console.error('Ошибка скачивания чека:', error);
                                        alert(error.message || 'Не удалось скачать чек');
                                      }
                                    }}
                                    className={styles.viewReceiptLink}
                                  >
                                    👁️ Просмотреть чек
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className={styles.receiptPending}>
                                ⏳ Ожидается загрузка чека от клиента
                              </span>
                            )}
                          </div>

                          {!invoiceInfo[request.id]?.isPaid && invoiceInfo[request.id]?.receiptUploaded && (
                            <button
                              className={styles.confirmPaymentBtn}
                              onClick={() => handleConfirmPrepayment(request.id)}
                              disabled={confirmingPayment[request.id]}
                            >
                              {confirmingPayment[request.id] ? (
                                <span className={styles.loading}>
                                  <span className={styles.spinner}></span>
                                  Подтверждение...
                                </span>
                              ) : (
                                '✅ Подтвердить предоплату'
                              )}
                            </button>
                          )}

                          {invoiceInfo[request.id]?.isPaid && (
                            <div className={styles.paymentConfirmed}>
                              ✅ Предоплата подтверждена — работы могут начинаться
                            </div>
                          )}
                        </div>
                      )}

                      {request?.status === RequestStatus.ApprovedByClient && (
                        <div className={styles.actionSection}>
                          {spareStatus?.hasPendingOrders ? (
                            // 🔥 ЕСТЬ неподтверждённые заявки → показываем кнопку отправки в ОМТС
                            <div className={styles.pendingSparesAlert}>
                              <h3>⚠️ Требуется закупка ЗИП:</h3>
                              <ul>
                                {spareStatus.pendingOrders.map((order, idx) => (
                                  <li key={idx}>
                                    {order.spareName} × {order.quantity} шт.
                                    ({order.supplierName})
                                  </li>
                                ))}
                              </ul>

                              <button
                                className={styles.confirmOrdersBtn}
                                onClick={handleConfirmSpareOrders}
                              >
                                📦 Отправить заявку на ЗИП в ОМТС
                              </button>

                              <p className={styles.hint}>
                                После поступления ЗИП на склад станет доступна кнопка
                                "Назначить наряд"
                              </p>
                            </div>
                          ) : (
                            // 🔥 НЕТ неподтверждённых заявок → все ЗИП на складе
                            <button
                              className={styles.assignWorkOrderBtn}
                            >
                              🔧 Назначить наряд на ремонт
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {(request.assignedEngineerFio) &&
                    request.status !== RequestStatus.New && (
                      <div className={styles.assignedEngineer}>
                        <div className={styles.engineerHeader}>
                          <span className={styles.engineerIcon}>👷</span>
                          <span className={styles.engineerLabel}>Назначенный специалист:</span>
                        </div>

                        <div className={styles.engineerCard}>
                          <div className={styles.engineerAvatar}>
                            {request.assignedEngineerFio?.charAt(0)}
                          </div>

                          <div className={styles.engineerInfo}>
                            <div className={styles.engineerName}>
                              {request.assignedEngineerFio}
                            </div>

                            {request.assignedEngineerTabNumber && (
                              <div className={styles.engineerDetail}>
                                <span className={styles.detailLabel}>Табельный номер:</span>
                                <span className={styles.detailValue}>{request.assignedEngineerTabNumber}</span>
                              </div>
                            )}

                            {request.assignedEngineerLogin && (
                              <div className={styles.engineerDetail}>
                                <span className={styles.detailLabel}>Логин:</span>
                                <span className={styles.detailValue}>{request.assignedEngineerLogin}</span>
                              </div>
                            )}

                            {request.assignedAt && (
                              <div className={styles.engineerDetail}>
                                <span className={styles.detailLabel}>Назначен:</span>
                                <span className={styles.detailValue}>
                                  {new Date(request.assignedAt).toLocaleString('ru-RU', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          className={styles.contactEngineerBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            alert(`Связь с ${request.assignedEngineerFio}`);
                          }}
                        >
                          📞 Связаться
                        </button>
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
              {!assignModal.engineer ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}></div>
                  <p>Загрузка доступных специалистов...</p>
                </div>
              ) : (
                <>
                  <p className={styles.modalText}>
                    Система автоматически подобрала специалиста для выполнения диагностики:
                  </p>

                  <div className={styles.engineerCard}>
                    <div className={styles.engineerAvatar}>
                      {assignModal.engineer.fio?.charAt(0) || 'С'}
                    </div>
                    <div className={styles.engineerDetails}>
                      <div className={styles.engineerName}>
                        {assignModal.engineer.fio}
                      </div>
                      <div className={styles.engineerTabNumber}>
                        Табельный номер: <strong>{assignModal.engineer.tabNumber}</strong>
                      </div>
                      {assignModal.engineer.specialization && (
                        <div className={styles.engineerSpecialization}>
                          Специализация: {assignModal.engineer.specialization}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.modalWarning}>
                    После подтверждения заявка будет переведена в статус "В работе"
                  </div>
                </>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.modalCancelBtn}
                onClick={handleCloseAssignModal}
                disabled={assigningId !== null || !assignModal.engineer}
              >
                Отмена
              </button>
              <button
                className={styles.modalConfirmBtn}
                onClick={handleConfirmAssign}
                disabled={assigningId !== null || !assignModal.engineer}
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