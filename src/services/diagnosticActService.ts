// src/services/diagnosticActService.ts

import { authService } from './authService';
import { DiagnosticAct, SpareOption, WorkItem, SpareItem } from '../types/diagnostic';

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
  requiredWorks: { workCode: number }[];
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

    // 🔥 ПРАВИЛЬНЫЙ URL для вашего контроллера:
    const response = await authService.fetchWithAuth(
      `https://localhost:7053/api/EngineerTask/my/${request.taskId}/diagnostic-act`,  // ✅ ЭТОТ URL!
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
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
  }
};