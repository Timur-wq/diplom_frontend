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