export interface SpareItem {
  id?: number;
  spareCode: number;
  spareName: string;
  quantity: number;
  unit: string;
}

// ✅ Добавьте этот интерфейс
export interface WorkItem {
  id?: number;
  workCode: number;
  workName: string;
  description?: string;
  estimatedTime?: string;
  estimatedCost?: number;
  // 🔥 Добавьте это поле:
  requiredSpares?: WorkSpareLink[];  // Опциональное поле
}

export interface WorkSpareLink {
  spareCode: number;
  spareName: string;
  quantity: number;
  isRequired: boolean;
  unit: string;
}

export interface DiagnosticAct {
  requestId: number;
  diagnosticDate: string;
  diagnosticTime: string;
  technicianFio: string;
  technicianTabNum: string;
  
  // Результаты диагностики
  externalCondition: string;
  identifiedIssues: string;
  testResults: string;
  
  // Требуемые ЗИП
  requiredSpares: SpareItem[];
  
  // ✅ Требуемые работы (ДОБАВЛЕНО)
  requiredWorks: WorkItem[];
  
  // Рекомендации
  recommendations: string;
  estimatedCost?: number;
  estimatedTime?: string;
  
  // Статус
  status: 'accepted' | 'rejected' | 'pending';
  rejectionReason?: string;
  
  // Подписи
  technicianSignature?: string;
  clientSignature?: string;
}

export interface SpareOption {
  spareCode: number;
  spareName: string;
  amount: number;
  unit: string;
}

export interface DiagnosticErrors {
  diagnosticDate?: string;
  diagnosticTime?: string;
  technicianFio?: string;
  technicianTabNum?: string;
  externalCondition?: string;
  identifiedIssues?: string;
  testResults?: string;
  recommendations?: string;
  requiredSpares?: string;
  requiredWorks?: string;  // ✅ ДОБАВЛЕНО
  status?: string;
}

// Для отображения акта от бэкенда
export interface DiagnosticActDto {
  actCode: string | number;
  requestId: number;
  clientFio: string;
  clientPhone: string;
  engineerFio: string;
  engineerTabNum: string;
  diagnosticDate: string;
  diagnosticTime: string;
  externalCondition: string;
  identifiedIssues: string;
  testResults: string;
  recommendations: string;
  estimatedCost?: number;
  estimatedTime?: string;
  works: DiagnosticActWorkItemDto[];
  spares: DiagnosticActSpareItemDto[];
  status: string | number;
  dispatcherComment?: string;
  sentToClientAt?: string;
  approvedByClientAt?: string;
  clientComment?: string;
}

export interface Work {
  workName: string;
  description?: string;
  estimatedCost?: number;
}

export interface Spare {
  spareName: string;
  quantity: number;
  unit: string;
}

export interface DiagnosticActWorkItemDto {
  recordId: number;
  workCode: number;
  workName: string;
  description?: string;
  quantity: number;
  estimatedCost?: number;
  isApprovedByClient?: boolean;
  // 🔥 Добавьте это поле:
  requiredSpares?: DiagnosticActSpareItemDto[];
}

export interface DiagnosticActSpareItemDto {
  recordId: number;
  spareCode: number;
  spareName: string;
  quantity: number;
  unit: string;
  isApprovedByClient?: boolean;
  unitPrice?: number;  // Цена за единицу
}

// Добавьте в конец файла:

// 🔥 Типы для результата оптимизации закупок
export interface ProcurementResultDto {
  actCode: number;
  calculatedAt: string;
  procurementItems: ProcurementItemDto[];
  supplierSummaries: SupplierSummaryDto[];
  totalCost: number;
  isFullySatisfied: boolean;
  unmetDemands: UnmetDemandDto[];
  message: string;
}

export interface ProcurementItemDto {
  spareCode: number;
  spareName: string;
  requiredQuantity: number;
  procuredQuantity: number;
  supplierAllocations: SupplierProcurementDto[];
}

export interface SupplierProcurementDto {
  supplierId: number;
  supplierName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  deliveryDays: number;
}

export interface SupplierSummaryDto {
  supplierId: number;
  supplierName: string;
  totalItems: number;
  totalQuantity: number;
  totalCost: number;
  maxDeliveryDays: number;
}

export interface UnmetDemandDto {
  spareCode: number;
  spareName: string;
  required: number;
  procured: number;
  shortage: number;
}