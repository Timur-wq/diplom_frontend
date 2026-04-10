// src/services/diagnosticActService.ts

import { authService } from './authService';
import { DiagnosticAct, SpareOption, WorkItem, SpareItem, ProcurementResultDto } from '../types/diagnostic';

const API_BASE = 'https://localhost:7053/api';

// 🔥 Типы для запроса создания акта (соответствуют бэкенду)
export interface CreateActRequest {
  taskId: number;
  diagnosticDate: string;
  externalCondition: string;
  identifiedIssues: string;
  testResults: string;
  recommendations: string;
  estimatedCost?: number;
  estimatedTime: string;
  requiredSpares: { spareCode: number; quantity: number }[];
  requiredWorks: ActWorkRequest[];  // 🔥 Используем новый интерфейс
}
export interface ActWorkRequest {
  workCode: number;
  requiredSpares?: WorkSpareLinkRequest[];  // 🔥 Новые ЗИП для работы
}

export interface WorkSpareLinkRequest {
  spareCode: number;
  quantity: number;
  isRequired?: boolean;
}

export interface CreateActResponse {
  success: boolean;
  message: string;
  actCode?: number;
}

export interface CreateActResponse {
  success: boolean;
  message: string;
  actCode?: number;
}

export const diagnosticActService = {
  // 🔥 Получить список ЗИП
  async getSpares(): Promise<SpareOption[]> {
    const response = await authService.fetchWithAuth(`${API_BASE}/Spare`);
    if (!response.ok) throw new Error('Не удалось загрузить список ЗИП');
    return response.json();
  },

  // 🔥 Получить список работ
  async getWorks(): Promise<WorkItem[]> {
    const response = await authService.fetchWithAuth(`${API_BASE}/Work`);
    if (!response.ok) throw new Error('Не удалось загрузить список работ');
    return response.json();
  },

  // 🔥 Создать акт диагностики (инженер) - ПРАВИЛЬНЫЙ URL!
  async createAct(request: CreateActRequest): Promise<CreateActResponse> {
    console.log('📤 Запрос на создание акта:', request);

    const response = await authService.fetchWithAuth(
      `https://localhost:7053/api/EngineerTask/my/${request.taskId}/diagnostic-act`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)  // 🔥 Здесь отправляем request с requiredSpares
      }
    );

    console.log('📥 Ответ сервера:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ошибка создания акта:', errorText);

      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || `Ошибка ${response.status}`);
      } catch {
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
    }

    return response.json();
  },

  // 🔥 Завершить наряд
  async completeTask(taskId: number): Promise<void> {
    const response = await authService.fetchWithAuth(
      `${API_BASE}/EngineerTask/my/${taskId}/complete`,
      { method: 'POST' }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Не удалось завершить наряд: ${errorText}`);
    }
  },

  // 🔥 Запустить жадный алгоритм оптимизации закупок
  async optimizeProcurement(actCode: number): Promise<ProcurementResultDto> {
    console.log('🤖 Запрос оптимизации закупок для акта #', actCode);

    const response = await authService.fetchWithAuth(
      `https://localhost:7053/api/dispatcher/DiagnosticAct/${actCode}/optimize-procurement`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ошибка оптимизации:', errorText);
      throw new Error(errorText || `Ошибка ${response.status}`);
    }

    const result: ProcurementResultDto = await response.json();
    console.log('✅ Результат оптимизации:', result);
    return result;
  }
};