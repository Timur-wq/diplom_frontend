// src/services/clientRequestService.ts

import { authService } from './authService';
import { ClientRequest, ClientRequestFilters, CreateClientRequestDto } from '../types/client';

const API_BASE = 'https://localhost:7053/api/Request';

export const clientRequestService = {
  // Получить все заявки клиента
  async getAllRequests(): Promise<ClientRequest[]> {
    const response = await authService.fetchWithAuth(`${API_BASE}/my`);
    if (!response.ok) throw new Error('Не удалось загрузить заявки');
    return response.json();
  },

  // Получить заявку по ID
  async getRequestById(id: number): Promise<ClientRequest> {
    const response = await authService.fetchWithAuth(`${API_BASE}/my/${id}`);
    if (!response.ok) throw new Error('Заявка не найдена');
    return response.json();
  },

  // Создать новую заявку
  async createRequest(data: CreateClientRequestDto): Promise<ClientRequest> {
    const response = await authService.fetchWithAuth(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Не удалось создать заявку');
    }
    return response.json();
  },

  // Отменить заявку
  async cancelRequest(id: number, reason: string): Promise<void> {
    const response = await authService.fetchWithAuth(
      `${API_BASE}/my/${id}/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      }
    );
    if (!response.ok) throw new Error('Не удалось отменить заявку');
  }
};