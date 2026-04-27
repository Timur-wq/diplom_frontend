import { authService } from './authService';
import { CreateStaffDto, StaffDto } from '../types/staff';

// 🔥 ИСПРАВЛЕНО: добавлен префикс /dispatcher
const API_BASE = 'https://localhost:7053/api/dispatcher/Staff';

export const staffService = {
  async getAllStaff(): Promise<StaffDto[]> {
    const response = await authService.fetchWithAuth(`${API_BASE}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ошибка загрузки сотрудников:', response.status, errorText);
      throw new Error(`Не удалось загрузить сотрудников (${response.status})`);
    }
    return response.json();
  },

  async createStaff(data: CreateStaffDto): Promise<StaffDto> {
    const response = await authService.fetchWithAuth(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Неизвестная ошибка' }));
      throw new Error(error.message || 'Не удалось создать сотрудника');
    }
    return response.json();
  },

  async deleteStaff(userId: number): Promise<void> {
    const response = await authService.fetchWithAuth(`${API_BASE}/${userId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Не удалось удалить сотрудника');
  }
};