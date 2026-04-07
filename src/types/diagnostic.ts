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
  works: Work[];
  spares: Spare[];
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