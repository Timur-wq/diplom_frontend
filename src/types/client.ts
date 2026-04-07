// src/types/client.ts

export interface ClientRequest {
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
  hasDiagnosticAct?: boolean; 
}

export enum RequestStatus {
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

// Функция для отображения статуса
export const getRequestStatusLabel = (status: RequestStatus): string => {
  const labels: Record<RequestStatus, string> = {
    [RequestStatus.New]: 'Новая',
    [RequestStatus.Accepted]: 'Принята',
    [RequestStatus.Rejected]: 'Отклонена',
    [RequestStatus.InProgress]: 'В работе',
    [RequestStatus.DiagnosticCompleted]: 'Диагностика завершена',  
    [RequestStatus.WaitingForClientApproval]: 'Ожидание согласования',  
    [RequestStatus.ApprovedByClient]: 'Согласована клиентом', 
    [RequestStatus.Completed]: 'Завершена',
    [RequestStatus.Cancelled]: 'Отменена'
  };
  return labels[status] || status;
};

export interface ClientRequestFilters {
  status: RequestStatus | 'All';
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  svtType: string;
}

export interface CreateClientRequestDto {
  clientFio: string;
  clientPhone: string;
  svtType: string;
  model: string;
  serialNumber: string;
  description: string;
}