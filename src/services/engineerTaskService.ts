
import { authService } from './authService';
import { EngineerTask, EngineerStats } from '../pages/ServiceIngeneer/types';

const API_BASE = 'https://localhost:7053/api/EngineerTask';

export const engineerTaskService = {
  async getAllTasks(): Promise<EngineerTask[]> {
    const response = await authService.fetchWithAuth(`${API_BASE}/my`);
    if (!response.ok) throw new Error('Не удалось загрузить наряды');
    return response.json();
  },

  async getActiveTasks(): Promise<EngineerTask[]> {
    const response = await authService.fetchWithAuth(`${API_BASE}/my/active`);
    if (!response.ok) throw new Error('Не удалось загрузить активные наряды');
    return response.json();
  },

  async getCompletedTasks(): Promise<EngineerTask[]> {
    const response = await authService.fetchWithAuth(`${API_BASE}/my/completed`);
    if (!response.ok) throw new Error('Не удалось загрузить завершённые наряды');
    return response.json();
  },

  async getStats(): Promise<EngineerStats> {
    const response = await authService.fetchWithAuth(`${API_BASE}/my/stats`);
    if (!response.ok) throw new Error('Не удалось загрузить статистику');
    return response.json();
  },

  async getTaskById(taskId: number): Promise<EngineerTask> {
    const response = await authService.fetchWithAuth(`${API_BASE}/my/${taskId}`);
    if (!response.ok) throw new Error('Наряд не найден');
    return response.json();
  },

  async startTask(taskId: number): Promise<void> {
    const response = await authService.fetchWithAuth(
      `${API_BASE}/my/${taskId}/start`,
      { method: 'POST' }
    );
    if (!response.ok) throw new Error('Не удалось начать работу');
  },

  async completeTask(taskId: number, comment?: string): Promise<void> {
    const response = await authService.fetchWithAuth(
      `${API_BASE}/my/${taskId}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment })
      }
    );
    if (!response.ok) throw new Error('Не удалось завершить работу');
  },

  async cancelTask(taskId: number, reason?: string): Promise<void> {
    const response = await authService.fetchWithAuth(
      `${API_BASE}/my/${taskId}/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      }
    );
    if (!response.ok) throw new Error('Не удалось отменить наряд');
  }
};