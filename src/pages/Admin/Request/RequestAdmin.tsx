// src/pages/Admin/Request/RequestAdmin.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { authService } from '../../../services/authService';
import styles from './RequestsAdmin.module.scss';
import { useNavigate, useLocation } from 'react-router-dom';

// Типы
// Тип для статуса финализации
interface FinalizationStatus {
  actExists: boolean;
  actSigned: boolean;
  actSignedAt?: string;
  paymentReceived: boolean;
  warrantyExists: boolean;
  warrantyPath?: string;
  warrantyValidUntil?: string;
  sentToClient: boolean;

  // 🔥 НОВЫЕ ПОЛЯ для подписания акта:
  actSignedByClient?: boolean;
  clientSignedAt?: string;
  actSignedByDispatcher?: boolean;
  dispatcherSignedAt?: string;
  isFullySigned?: boolean;
}


interface TaskActs {
  repairActPath?: string;
  spareWriteOffPath?: string;
  createdAt?: string;
}
// 🔥 Типы для назначения нарядов на ремонт
interface RepairWorkItem {
  taskId: number;
  workCode: number;
  workName: string;
  estimatedCost: number;
}

interface AssignRepairWorkOrdersResponse {
  success: boolean;
  message: string;
  taskIds: number[];
  assignedEngineerId: number;
  engineerName: string;
  worksCount: number;
  works: RepairWorkItem[];
  assignedAt: string;
}
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
  const [creatingWorkOrder, setCreatingWorkOrder] = useState<Record<number, boolean>>({});
  const [taskActs, setTaskActs] = useState<Record<number, TaskActs>>({});
  // Состояние
  const [finalizationStatus, setFinalizationStatus] = useState<Record<number, FinalizationStatus>>({});


  const [spareStatus, setSpareStatus] = useState<{
    hasPendingOrders: boolean;
    pendingOrdersCount: number;
    pendingOrders: Array<{
      spareName: string;
      quantity: number;
      supplierName: string;
    }>;
  } | null>(null);



  // Перегенерация акта с подписями
  const handleRegenerateRepairAct = async (requestId: number) => {
    if (!window.confirm('Перегенерировать акт выполненных работ с электронными подписями?')) return;

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/acts/regenerate-with-signatures`,
        { method: 'POST' }
      );

      if (!response.ok) throw new Error('Не удалось перегенерировать акт');

      const result = await response.json();
      alert('✅ Акт перегенерирован с подписями!');

      // Обновляем акты
      loadTaskActs(requestId);

    } catch (e: any) {
      alert(e.message || 'Ошибка при перегенерации акта');
    }
  };

  // Отметить подписание клиентом
  const handleMarkClientSigned = async (requestId: number, method: string = 'office_handwritten') => {
    if (!window.confirm('Подтвердить подписание акта клиентом?')) return;

    try {
      await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/acts/mark-client-signed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signatureMethod: method })
        }
      );
      alert('✅ Подписание клиента отмечено');
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    }
  };



  // Подписать акт диспетчером
  const handleDispatcherSignAct = async (requestId: number) => {
    if (!window.confirm('Подписать акт от имени сервисного центра?')) return;

    try {
      await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/acts/dispatcher-sign`,
        { method: 'POST' }
      );
      alert('✅ Акт подписан диспетчером');
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    }
  };

  const loadFinalizationStatus = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/finalization-status`
      );
      if (response.ok) {
        const status: FinalizationStatus = await response.json();
        setFinalizationStatus(prev => ({ ...prev, [requestId]: status }));
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса финализации:', error);
    }
  };

  // Подписание акта (клиент в офисе)
  const handleSignActOffice = async (requestId: number) => {
    if (!window.confirm('Подтвердить, что клиент подписал акт в офисе?')) return;
    try {
      await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/acts/sign-office`,
        { method: 'POST' }
      );
      alert('✅ Акт подписан!');
      loadFinalizationStatus(requestId);
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    }
  };

  // Отметка оплаты
  const handleMarkPaymentReceived = async (requestId: number) => {
    if (!window.confirm('Подтвердить получение оплаты?')) return;
    try {
      await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/payment/received`,
        { method: 'POST' }
      );
      alert('✅ Оплата подтверждена!');
      loadFinalizationStatus(requestId);
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    }
  };

  // Генерация гарантийного талона
  const handleGenerateWarranty = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/warranty/generate`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Не удалось сформировать талон');

      const result = await response.json();
      alert(`✅ Гарантийный талон сформирован!\nДействителен до: ${new Date(result.validUntil).toLocaleDateString('ru-RU')}`);

      // Открываем талон в новой вкладке
      if (result.warrantyPath) {
        window.open(`https://localhost:7053/${result.warrantyPath}`, '_blank');
      }

      loadFinalizationStatus(requestId);
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    }
  };

  // После загрузки заявки проверяем статус ЗИП
  // useEffect(() => {
  //   if (request?.id && request.status === RequestStatus.ApprovedByClient) {
  //     checkSpareStatus(request.id);
  //   }
  // }, [request?.id, request?.status]);
  // 🔥 Обработчик создания наряда на ремонт
  // 🔥 Обработчик создания наряда на ремонт (обновлённый)
  // src/pages/Admin/Request/RequestAdmin.tsx

  // Функция загрузки
  // Функция загрузки актов
  const loadTaskActs = async (requestId: number) => {
    console.log('🔍 [Акты] Загрузка для requestId:', requestId);

    try {
      // 🔥 Новый URL в AdminRequestController
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/acts`
      );

      console.log('📡 [Акты] Ответ сервера:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });

      if (response.ok) {
        const acts: TaskActs = await response.json();
        console.log('✅ [Акты] Получены данные:', acts);

        setTaskActs(prev => {
          const newActs = { ...prev, [requestId]: acts };
          console.log('💾 [Акты] Обновлён state:', newActs[requestId]);
          return newActs;
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [Акты] Ошибка:', response.status, errorData);
      }
    } catch (error) {
      console.error('💥 [Акты] Исключение:', error);
    }
  };


  const handleCreateWorkOrder = async (requestId: number) => {
    if (!window.confirm('Назначить наряд на ремонт для заявки #' + requestId + '?'))
      return;

    setCreatingWorkOrder(prev => ({ ...prev, [requestId]: true }));

    try {
      // 🔥 Вызываем НОВЫЙ эндпоинт для ремонта
      const response = await authService.fetchWithAuth(
        'https://localhost:7053/api/Task/assign-repair',  // ← Новый URL!
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: requestId,      // ← Только заявка
            maxActiveOrders: 2
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Не удалось назначить наряд');
      }

      const result: AssignRepairWorkOrdersResponse = await response.json();

      console.log('✅ Наряды на ремонт назначены:', result);

      const engineerFio = result.engineerName || `Сотрудник #${result.assignedEngineerId}`;

      // Обновляем заявку
      setAllRequests(prev => prev.map(req =>
        req.id === requestId
          ? {
            ...req,
            assignedEngineerFio: engineerFio,
            assignedEngineerTabNumber: result.assignedEngineerId,
            assignedAt: result.assignedAt || new Date().toISOString(),
            status: RequestStatus.InProgress
          }
          : req
      ));

      // Показываем модальное окно со списком работ
      setAssignModal({
        isOpen: true,
        requestId: requestId,
        engineer: {
          fio: engineerFio,
          tabNumber: result.assignedEngineerId?.toString() || '',
          specialization: ''
        },
        works: result.works  // ← Список работ для отображения
      });

    } catch (error: any) {
      console.error('❌ Ошибка назначения нарядов на ремонт:', error);
      alert(error.message || 'Не удалось назначить наряд');
    } finally {
      setCreatingWorkOrder(prev => ({ ...prev, [requestId]: false }));
    }
  };

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


  // 🔥 НОВОЕ: Состояние для финального счёта на работы
  const [finalInvoiceInfo, setFinalInvoiceInfo] = useState<Record<number, {
    invoiceId?: number;
    generated: boolean;
    amount?: number;
    filePath?: string;
    receiptUploaded: boolean;
    receiptPath?: string;
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
    works?: RepairWorkItem[];  // ← Добавлено!
  }>({
    isOpen: false,
    requestId: null,
    engineer: null,
    works: []  // ← Инициализация пустым массивом
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
      console.log('📦 [loadRequests] Получено заявок:', data.length);

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

      // 🔥 Логирование завершённых заявок
      const completed = normalizedData.filter(r => r.status === RequestStatus.Completed);
      console.log('✅ [loadRequests] Завершённых заявок:', completed.map(r => ({
        id: r.id,
        assignedEngineerTabNumber: r.assignedEngineerTabNumber
      })));

      setAllRequests(normalizedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      console.error('💥 [loadRequests] Ошибка:', err);
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
    setSpareStatus(null);

    if (isExpanding) {
      checkDiagnosticAct(id).then(hasAct => {
        setDiagnosticActs(prev => ({ ...prev, [id]: hasAct }));
      });
      checkContractSigned(id);
      loadInvoiceInfo(id);  // Предоплата ЗИП
      loadFinalInvoiceInfo(id);  // 🔥 НОВОЕ: Финальный счёт на работы

      const request = allRequests.find(r => r.id === id);

      if (request?.status === RequestStatus.ApprovedByClient) {
        checkSpareStatus(id);
      }

      if (request?.status === RequestStatus.Completed) {
        console.log('✅ [toggleExpand] Загружаем акты для requestId:', request.id);
        loadTaskActs(request.id);
        loadFinalizationStatus(request.id);
        loadActSignatureStatus(request.id);
      }
    }
  };

  // Загрузка статуса подписания акта
  const loadActSignatureStatus = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/acts/signature-status`
      );

      if (response.ok) {
        const status = await response.json();
        console.log('✅ [SignatureStatus] Получен статус:', status);

        // Обновляем finalizationStatus с данными о подписании
        setFinalizationStatus(prev => ({
          ...prev,
          [requestId]: {
            ...prev[requestId],
            actSignedByClient: status.isSignedByClient,
            clientSignedAt: status.clientSignedAt,
            actSignedByDispatcher: status.isSignedByDispatcher,
            dispatcherSignedAt: status.dispatcherSignedAt,
            isFullySigned: status.isFullySigned
          }
        }));
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки статуса подписания:', error);
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

  // 🔥 Загружаем информацию о финальном счёте при изменении заявок
  useEffect(() => {
    allRequests.forEach(request => {
      if (request.status === RequestStatus.Completed && expandedId === request.id) {
        loadFinalInvoiceInfo(request.id);
      }
    });
  }, [allRequests, expandedId]);

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

  const handleSendActsToClient = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/acts/signature-status`
      );

      if (!response.ok) throw new Error('Не удалось получить статус');

      const status = await response.json();

      // Просто показываем текущий статус
      alert(`Статус акта:
      • Подписан клиентом: ${status.isSignedByClient ? '✅' : '❌'}
      • Подписан диспетчером: ${status.isSignedByDispatcher ? '✅' : '❌'}
      • Полностью подписан: ${status.isFullySigned ? '✅' : '❌'}
      
      Файл: ${status.filePath || 'Не сгенерирован'}`);

    } catch (e: any) {
      alert(e.message || 'Ошибка');
    }
  };



  const handleSendWarrantyToClient = async (requestId: number) => {
    if (!window.confirm('Отправить гарантийный талон клиенту?')) return;

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/warranty/send-to-client`,
        { method: 'POST' }
      );

      if (!response.ok) throw new Error('Не удалось отправить');

      alert('✅ Гарантийный талон отправлен клиенту!\nТеперь он доступен в личном кабинете.');
      loadFinalizationStatus(requestId);
      refreshData();
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    }
  };

  // 🔥 Генерация счёта на оплату работ (финальный платёж)
  // 🔥 Генерация счёта на оплату работ (финальный платёж)
  const handleGenerateFinalInvoice = async (requestId: number) => {
    if (!window.confirm('Сформировать счёт на оплату работ для заявки #' + requestId + '?')) return;

    setGeneratingInvoice(prev => ({ ...prev, [requestId]: true }));

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/invoice/generate`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Не удалось сформировать счёт');
      }

      const result = await response.json();

      // Открываем счёт в новой вкладке
      if (result.filePath) {
        window.open(`https://localhost:7053/${result.filePath}`, '_blank');
      }

      alert('✅ Счёт на оплату работ сформирован!\nСумма: ' + result.amount?.toLocaleString('ru-RU') + ' ₽');

      // 🔥 ИСПРАВЛЕНО: Обновляем finalInvoiceInfo, а не invoiceInfo
      setFinalInvoiceInfo(prev => ({
        ...prev,
        [requestId]: {
          invoiceId: result.invoiceId,
          generated: true,
          amount: result.amount,
          filePath: result.filePath,
          receiptUploaded: false,
          receiptPath: undefined,
          isPaid: false
        }
      }));

      loadFinalizationStatus(requestId);

    } catch (error: any) {
      console.error('❌ Ошибка генерации счёта:', error);
      alert(error.message || 'Не удалось сформировать счёт');
    } finally {
      setGeneratingInvoice(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // 🔥 Подтверждение оплаты диспетчером
  // 🔥 Подтверждение оплаты диспетчером
  const handleConfirmFinalPayment = async (requestId: number) => {
    // 🔥 ИСПРАВЛЕНО: Берём данные из finalInvoiceInfo
    const invoice = finalInvoiceInfo[requestId];
    if (!invoice?.invoiceId) {
      alert('Не удалось найти счёт');
      return;
    }

    if (!window.confirm('Подтвердить получение оплаты по счёту #' + invoice.invoiceId + '?')) return;

    setConfirmingPayment(prev => ({ ...prev, [requestId]: true }));

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/invoice/${invoice.invoiceId}/confirm-paid`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Не удалось подтвердить оплату');
      }

      // 🔥 ИСПРАВЛЕНО: Обновляем finalInvoiceInfo
      setFinalInvoiceInfo(prev => ({
        ...prev,
        [requestId]: prev[requestId] ? { ...prev[requestId]!, isPaid: true } : null
      }));

      alert('✅ Оплата подтверждена! Заявка завершена.');
      loadFinalizationStatus(requestId);
      refreshData();

    } catch (error: any) {
      console.error('❌ Ошибка подтверждения оплаты:', error);
      alert(error.message || 'Не удалось подтвердить оплату');
    } finally {
      setConfirmingPayment(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // 🔥 Загрузка информации о финальном счёте
  const loadFinalInvoiceInfo = async (requestId: number) => {
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/AdminRequest/${requestId}/invoice`
      );

      if (response.ok) {
        const data = await response.json();
        setFinalInvoiceInfo(prev => ({
          ...prev,
          [requestId]: {
            invoiceId: data.invoiceId,
            generated: true,
            amount: data.amount,
            filePath: data.filePath,
            receiptUploaded: data.receiptUploaded ?? false,  // 🔥 Добавлено ?? false
            receiptPath: data.receiptPath,
            isPaid: data.isPaid ?? false  // 🔥 Добавлено ?? false
          }
        }));
      }
    } catch (error) {
      console.error(`Ошибка загрузки информации о финальном счёте для заявки ${requestId}:`, error);
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

                  {signedContracts[request.id] === true && !invoiceInfo[request.id]?.isPaid && (
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
                          {/* 🔥 СЕКЦИЯ С АКТАМИ (только для завершённых заявок) */}

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
                              onClick={() => handleCreateWorkOrder(request.id)}  // ← Добавлено!
                              disabled={creatingWorkOrder[request.id]}           // ← Добавлено!
                            >
                              {creatingWorkOrder[request.id] ? (                 // ← Добавлено!
                                <span className={styles.loading}>
                                  <span className={styles.spinner}></span>
                                  Назначение...
                                </span>
                              ) : (
                                '🔧 Назначить наряд на ремонт'
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ✅ СЕКЦИЯ С АКТАМИ */}
                  {request.status === RequestStatus.Completed && taskActs[request.id] && (
                    <div className={styles.documentsSection}>
                      <h4 className={styles.sectionTitle}>📄 Акты по завершённым работам:</h4>

                      <div className={styles.documentsList}>
                        {/* Акт выполненных работ */}
                        {taskActs[request.id]?.repairActPath && (
                          <div className={styles.documentItem}>
                            <a
                              href={`https://localhost:7053/${taskActs[request.id]!.repairActPath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.documentLink}
                            >
                              📋 Акт выполненных работ (PDF)
                            </a>

                            {/* 🔥 Кнопка перегенерации с подписями - показывается только когда обе стороны подписали */}
                            {/* 🔥 Кнопка перегенерации с подписями */}
                            {(finalizationStatus[request.id]?.isFullySigned ||
                              (finalizationStatus[request.id]?.actSignedByClient &&
                                finalizationStatus[request.id]?.actSignedByDispatcher)) && (
                                <button
                                  className={styles.regenerateActBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRegenerateRepairAct(request.id);
                                  }}
                                  title="Перегенерировать акт с электронными подписями"
                                >
                                  🔄 С подписями
                                </button>
                              )}
                          </div>
                        )}

                        {/* Акт списания ЗИП */}
                        {taskActs[request.id]?.spareWriteOffPath && (
                          <div className={styles.documentItem}>
                            <a
                              href={`https://localhost:7053/${taskActs[request.id]!.spareWriteOffPath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.documentLink}
                            >
                              📦 Акт списания ЗИП (PDF)
                            </a>
                          </div>
                        )}

                        {/* Если актов нет */}
                        {!taskActs[request.id]?.repairActPath && !taskActs[request.id]?.spareWriteOffPath && (
                          <p className={styles.noDocuments}>Акты ещё не сформированы</p>
                        )}
                      </div>

                      {/* Дата формирования */}
                      {taskActs[request.id]?.createdAt && (
                        <p className={styles.documentDate}>
                          Сформировано: {new Date(taskActs[request.id]!.createdAt!).toLocaleString('ru-RU')}
                        </p>
                      )}

                      {/* Подсказка */}
                      {finalizationStatus[request.id]?.isFullySigned && !taskActs[request.id]?.repairActPath?.includes('signed') && (
                        <p className={styles.hintText}>
                          💡 Нажмите "🔄 С подписями", чтобы перегенерировать акт с электронными подписями
                        </p>
                      )}
                    </div>
                  )}

                  {/* 🔥 СЕКЦИЯ ФИНАЛИЗАЦИИ */}
                  {request.status === RequestStatus.Completed && (
                    <div className={styles.finalizationSection}>
                      <h4 className={styles.sectionTitle}>📝 Финализация заявки</h4>
                      {/* 🔥 Кнопка обновления статуса */}
                      <button
                        className={styles.refreshStatusBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          loadActSignatureStatus(request.id);
                        }}
                      >
                        🔄 Обновить статус подписания
                      </button>

                      {/* 🔥 ВСТАВЬТЕ СЮДА: Секция статуса подписания акта */}
                      {/* Кнопка отправки акта клиенту */}
                      {finalizationStatus[request.id]?.actExists && (
                        <div className={styles.signatureSection}>
                          <h4 className={styles.sectionTitle}>📝 Статус подписания акта</h4>

                          <div className={styles.signatureStatus}>
                            <div className={styles.statusItem}>
                              <span className={styles.statusIcon}>
                                {finalizationStatus[request.id]?.actSignedByClient ? '✅' : '⏳'}
                              </span>
                              <span>
                                {finalizationStatus[request.id]?.actSignedByClient
                                  ? `Подписан клиентом ${new Date(finalizationStatus[request.id]!.clientSignedAt!).toLocaleString('ru-RU')}`
                                  : 'Ожидает подписи клиента'}
                              </span>
                            </div>

                            <div className={styles.statusItem}>
                              <span className={styles.statusIcon}>
                                {finalizationStatus[request.id]?.actSignedByDispatcher ? '✅' : '⏳'}
                              </span>
                              <span>
                                {finalizationStatus[request.id]?.actSignedByDispatcher
                                  ? `Подписан диспетчером ${new Date(finalizationStatus[request.id]!.dispatcherSignedAt!).toLocaleString('ru-RU')}`
                                  : 'Ожидает подписи диспетчера'}
                              </span>
                            </div>

                            {finalizationStatus[request.id]?.isFullySigned && (
                              <div className={styles.fullySignedBadge}>
                                ✅ Акт полностью подписан обеими сторонами
                              </div>
                            )}

                            {/* Кнопка подписания диспетчером (если клиент уже подписал) */}
                            {finalizationStatus[request.id]?.actSignedByClient &&
                              !finalizationStatus[request.id]?.actSignedByDispatcher && (
                                <button
                                  className={styles.signBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDispatcherSignAct(request.id);
                                  }}
                                >
                                  ✍️ Подписать акт диспетчером
                                </button>
                              )}
                          </div>
                        </div>
                      )}


                      <div className={styles.checklist}>
                        {/* Шаг 1: Акт подписан */}
                        <label className={styles.checkItem}>
                          <input
                            type="checkbox"
                            checked={finalizationStatus[request.id]?.actSigned || false}
                            onChange={() => !finalizationStatus[request.id]?.actSigned && handleSignActOffice(request.id)}
                            disabled={finalizationStatus[request.id]?.actSigned}
                          />
                          <span>✅ Акт подписан клиентом</span>
                          {finalizationStatus[request.id]?.actSignedAt && (
                            <small>{new Date(finalizationStatus[request.id]!.actSignedAt!).toLocaleString('ru-RU')}</small>
                          )}
                        </label>

                        {/* Шаг 2: Оплата получена */}
                        <label className={styles.checkItem}>
                          <input
                            type="checkbox"
                            checked={finalizationStatus[request.id]?.paymentReceived || false}
                            onChange={() => finalizationStatus[request.id]?.actSigned && !finalizationStatus[request.id]?.paymentReceived && handleMarkPaymentReceived(request.id)}
                            disabled={!finalizationStatus[request.id]?.actSigned || finalizationStatus[request.id]?.paymentReceived}
                          />
                          <span>💰 Оплата получена</span>
                        </label>
                      </div>

                      {/* 🔥 СЕКЦИЯ ФИНАЛЬНОЙ ОПЛАТЫ (после завершения работ) */}
                      {/* 🔥 СЕКЦИЯ ФИНАЛЬНОЙ ОПЛАТЫ (после завершения работ) */}
                      {(request.status === RequestStatus.Completed || finalInvoiceInfo[request.id]?.generated) && (
                        <div className={styles.finalPaymentSection}>
                          <h4 className={styles.sectionTitle}>💰 Оплата работ</h4>
                          <p className={styles.sectionHint}>
                            ЗИП оплачен отдельно. Данный счёт — только за выполненные работы.
                          </p>

                          {/* 🔥 ИСПРАВЛЕНО: finalInvoiceInfo вместо invoiceInfo */}
                          {!finalInvoiceInfo[request.id]?.generated ? (
                            <button
                              className={styles.generateFinalInvoiceBtn}
                              onClick={() => handleGenerateFinalInvoice(request.id)}
                              disabled={generatingInvoice[request.id]}
                            >
                              {generatingInvoice[request.id] ? (
                                <span className={styles.loading}>
                                  <span className={styles.spinner}></span>
                                  Формирование...
                                </span>
                              ) : (
                                '🧾 Сформировать счёт на оплату работ'
                              )}
                            </button>
                          ) : (
                            <div className={styles.invoiceDetails}>
                              <div className={styles.invoiceRow}>
                                <span>Сумма к оплате (работы):</span>
                                <span className={styles.invoiceAmount}>
                                  {/* 🔥 ИСПРАВЛЕНО: finalInvoiceInfo */}
                                  {finalInvoiceInfo[request.id]?.amount?.toLocaleString('ru-RU')} ₽
                                </span>
                              </div>

                              {/* 🔥 ИСПРАВЛЕНО: finalInvoiceInfo */}
                              {finalInvoiceInfo[request.id]?.filePath && (
                                <a
                                  href={`https://localhost:7053/${finalInvoiceInfo[request.id]?.filePath}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.viewInvoiceLink}
                                >
                                  📄 Просмотреть счёт (PDF)
                                </a>
                              )}

                              {/* Статус чека */}
                              <div className={styles.receiptStatus}>
                                {/* 🔥 ИСПРАВЛЕНО: finalInvoiceInfo */}
                                {finalInvoiceInfo[request.id]?.receiptUploaded ? (
                                  <>
                                    <span className={styles.receiptUploaded}>
                                      ✅ Чек загружен клиентом
                                    </span>
                                    {/* 🔥 ИСПРАВЛЕНО: finalInvoiceInfo */}
                                    {finalInvoiceInfo[request.id]?.receiptPath && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(`https://localhost:7053/${finalInvoiceInfo[request.id]?.receiptPath}`, '_blank');
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

                              {/* Кнопка подтверждения оплаты */}
                              {/* 🔥 ИСПРАВЛЕНО: finalInvoiceInfo */}
                              {!finalInvoiceInfo[request.id]?.isPaid && finalInvoiceInfo[request.id]?.receiptUploaded && (
                                <button
                                  className={styles.confirmPaymentBtn}
                                  onClick={() => handleConfirmFinalPayment(request.id)}
                                  disabled={confirmingPayment[request.id]}
                                >
                                  {confirmingPayment[request.id] ? (
                                    <span className={styles.loading}>
                                      <span className={styles.spinner}></span>
                                      Подтверждение...
                                    </span>
                                  ) : (
                                    '✅ Подтвердить оплату работ'
                                  )}
                                </button>
                              )}

                              {/* Оплата подтверждена */}
                              {/* 🔥 ИСПРАВЛЕНО: finalInvoiceInfo */}
                              {finalInvoiceInfo[request.id]?.isPaid && (
                                <div className={styles.paymentConfirmed}>
                                  ✅ Оплата работ подтверждена — заявка полностью завершена
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Кнопка генерации гарантии */}
                      {(finalizationStatus[request.id]?.paymentReceived || finalInvoiceInfo[request.id]?.isPaid) &&
                        !finalizationStatus[request.id]?.warrantyExists && (
                          <button
                            className={styles.warrantyBtn}
                            onClick={() => handleGenerateWarranty(request.id)}
                          >
                            📄 Сформировать гарантийный талон
                          </button>
                        )}

                      {/* Ссылка на готовый талон */}
                      {finalizationStatus[request.id]?.warrantyExists && (
                        <div className={styles.warrantyReady}>
                          <p>✅ Гарантийный талон готов</p>

                          {!finalizationStatus[request.id]?.sentToClient ? (
                            <button
                              className={styles.sendToClientBtn}
                              onClick={() => handleSendWarrantyToClient(request.id)}
                            >
                              📤 Отправить клиенту
                            </button>
                          ) : (
                            <div className={styles.sentBadge}>
                              <span>✅ Отправлен клиенту</span>
                            </div>
                          )}

                          <a
                            href={`https://localhost:7053/${finalizationStatus[request.id]!.warrantyPath!}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.downloadLink}
                          >
                            📥 Скачать
                          </a>
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
              <h3 className={styles.modalTitle}>
                {/* 🔥 Динамический заголовок */}
                {assignModal.requestId && allRequests.find(r => r.id === assignModal.requestId)?.assignedEngineerFio
                  ? '✅ Наряд назначен'
                  : 'Назначение наряда на диагностику'}
              </h3>
              <button className={styles.modalClose} onClick={handleCloseAssignModal}>✕</button>
            </div>

            <div className={styles.modalBody}>
              {!assignModal.engineer ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}></div>
                  <p>Загрузка доступных специалистов...</p>
                </div>
              ) : (
                <>
                  {/* 🔥 Сообщение о результате */}
                  {allRequests.find(r => r.id === assignModal.requestId)?.assignedEngineerFio && (
                    <p className={styles.modalSuccess}>
                      ✅ Наряд на ремонт успешно назначен!
                    </p>
                  )}

                  <p className={styles.modalText}>
                    {allRequests.find(r => r.id === assignModal.requestId)?.assignedEngineerFio
                      ? 'Для выполнения работ назначен специалист:'
                      : 'Система автоматически подобрала специалиста для выполнения диагностики:'}
                  </p>

                  <div className={styles.engineerCard}>
                    <div className={styles.engineerAvatar}>
                      {assignModal.engineer.fio?.charAt(0) || 'С'}
                    </div>
                    <div className={styles.engineerDetails}>
                      <div className={styles.engineerName}>
                        {assignModal.engineer.fio}
                      </div>
                      {assignModal.engineer.tabNumber && (
                        <div className={styles.engineerTabNumber}>
                          Табельный номер: <strong>{assignModal.engineer.tabNumber}</strong>
                        </div>
                      )}
                      {assignModal.engineer.specialization && (
                        <div className={styles.engineerSpecialization}>
                          Специализация: {assignModal.engineer.specialization}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 🔥 Кнопка связи с инженером */}
                  {allRequests.find(r => r.id === assignModal.requestId)?.assignedEngineerFio && (
                    <button
                      className={styles.contactEngineerBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      📞 Связаться с инженером
                    </button>
                  )}

                  <div className={styles.modalWarning}>
                    {allRequests.find(r => r.id === assignModal.requestId)?.assignedEngineerFio
                      ? 'Заявка переведена в статус "В работе". Инженер получит уведомление.'
                      : 'После подтверждения заявка будет переведена в статус "В работе"'}
                  </div>
                </>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.modalCancelBtn}
                onClick={handleCloseAssignModal}
              >
                Закрыть
              </button>
              {/* 🔥 Кнопка подтверждения только для диагностики */}
              {!allRequests.find(r => r.id === assignModal.requestId)?.assignedEngineerFio && (
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsAdmin;