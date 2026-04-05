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
}

export enum RequestStatus {
  New = 'New',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Cancelled = 'Cancelled'
}

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