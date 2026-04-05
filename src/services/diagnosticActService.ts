// src/services/diagnosticActService.ts

import { authService } from './authService';
import { DiagnosticAct, SpareOption, WorkItem } from '../types/diagnostic';

const API_BASE = 'https://localhost:7053/api';

export const diagnosticActService = {
  // 🔥 Получить список ЗИП с бэкенда
  async getSpares(): Promise<SpareOption[]> {
    const response = await authService.fetchWithAuth(`${API_BASE}/Spare`);
    if (!response.ok) throw new Error('Не удалось загрузить список ЗИП');
    return response.json();
  },

  // 🔥 Получить список работ с бэкенда
  async getWorks(): Promise<WorkItem[]> {
    const response = await authService.fetchWithAuth(`${API_BASE}/Work`);
    if (!response.ok) throw new Error('Не удалось загрузить список работ');
    return response.json();
  },

  // 🔥 Получить данные заявки по ID
  async getRequestById(requestId: number): Promise<{
    clientFio: string;
    clientPhone: string;
    svtType: string;
    model: string;
    serialNumber: string;
    description: string;
    dateOnly: string;
    timeOnly: string;
  }> {
    const response = await authService.fetchWithAuth(`${API_BASE}/AdminRequest/${requestId}`);
    if (!response.ok) throw new Error('Не удалось загрузить заявку');
    return response.json();
  },

  // 🔥 Создать акт диагностики
  async createAct(act: Omit<DiagnosticAct, 'technicianFio' | 'technicianTabNum'> & {
    externalCondition: string;
    identifiedIssues: string;
    testResults: string;
    recommendations: string;
  }): Promise<{ success: boolean; message: string; actCode?: number }> {
    const response = await authService.fetchWithAuth(`${API_BASE}/DiagnosticAct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(act)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Не удалось создать акт диагностики');
    }
    
    return response.json();
  },

  // 🔥 Завершить наряд после создания акта
  async completeTask(taskId: number): Promise<void> {
    const response = await authService.fetchWithAuth(
      `${API_BASE}/EngineerTask/my/${taskId}/complete`,
      { method: 'POST' }
    );
    if (!response.ok) throw new Error('Не удалось завершить наряд');
  }
};