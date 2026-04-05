
export interface EngineerTask {
  taskId: number;
  requestId: number;
  clientFio: string;
  clientPhone: string;
  svtType: string;
  model: string;
  serialNumber: string;
  description: string;
  status: TaskStatus;
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  workName: string;
  workClassCode: number;
}

export enum TaskStatus {
  Assigned = 'assigned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled'
}

export interface EngineerStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  cancelledTasks: number;
}

export type TaskFilter = 'all' | 'active' | 'completed';

export interface SpareOption {
  spareCode: number;
  spareName: string;
  amount: number;  // Количество на складе
  unit: string;
}

export interface WorkItem {
  workCode: number;
  workName: string;
  description?: string;
  estimatedTime?: string;
  estimatedCost?: number;
}