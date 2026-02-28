import {
  LoginCredentials,
  AuthResponse,
  UserInfo,
  UserRole,
  RefreshTokenRequest
} from '../types/auth';

const API_URL = 'https://localhost:7053/api';

// Ключи для localStorage
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ROLE: 'user_role',
  USER_FIO: 'user_fio',
  USER_ID: 'user_id',
  TOKEN_EXPIRES: 'token_expires',
} as const;

class AuthService {
  private refreshPromise: Promise<AuthResponse> | null = null;

  // === Публичные методы ===

  /**
   * Вход в систему
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Ошибка авторизации');
    }

    const data: AuthResponse = await response.json();
    this.storeAuth(data);
    return data;
  }

  /**
   * Выход из системы
   */
  async logout(): Promise<void> {
    const token = this.getAccessToken();

    if (token) {
      // Отправляем запрос на отзыв токена (игнорируем ошибки)
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => { });
    }

    this.clearAuth();
  }

  /**
   * Обновление access token через refresh token
   */
  async refreshToken(): Promise<AuthResponse> {
    // Если уже идёт запрос — ждём его
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      this.clearAuth();
      throw new Error('Нет refresh token');
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken } as RefreshTokenRequest),
        });

        if (!response.ok) {
          throw new Error('Не удалось обновить токен');
        }

        const data: AuthResponse = await response.json();
        this.storeAuth(data);
        return data;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Fetch с автоматической авторизацией и обновлением токена
   */
  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    let token = this.getAccessToken();

    // Если токен истёк — пробуем обновить
    if (token && this.isTokenExpired(token)) {
      try {
        const newTokens = await this.refreshToken();
        token = newTokens.accessToken;
      } catch {
        this.clearAuth();
        window.location.href = '/login?expired=1';
        throw new Error('Сессия истекла');
      }
    }

    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };

    const response = await fetch(url, { ...options, headers });

    // Если получили 401 — пробуем обновить токен и повторить запрос
    if (response.status === 401 && !url.includes('/auth/')) {
      try {
        const newTokens = await this.refreshToken();
        const retryHeaders = {
          ...options.headers,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newTokens.accessToken}`,
        };
        return fetch(url, { ...options, headers: retryHeaders });
      } catch {
        this.clearAuth();
        window.location.href = '/login?expired=1';
        throw new Error('Сессия истекла');
      }
    }

    return response;
  }

  /**
   * Проверка роли пользователя
   */
  hasRole(role: UserRole): boolean {
    return localStorage.getItem(STORAGE_KEYS.USER_ROLE) === role;
  }

  /**
   * Проверка на наличие одной из ролей
   */
  hasAnyRole(roles: UserRole[]): boolean {
    const userRole = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
    return roles.includes(userRole as UserRole);
  }

  /**
   * Получение информации о текущем пользователе
   */
  async getCurrentUser(): Promise<UserInfo | null> {
    try {
      const response = await this.fetchWithAuth(`${API_URL}/auth/me`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  // === Геттеры ===

  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  getUserRole(): UserRole | null {
    const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
    return role as UserRole | null;
  }

  getUserFio(): string | null {
    return localStorage.getItem(STORAGE_KEYS.USER_FIO);
  }

  getUserId(): number | null {
    const id = localStorage.getItem(STORAGE_KEYS.USER_ID);
    return id ? parseInt(id, 10) : null;
  }

  private storeAuth(data: AuthResponse): void {
    console.log('💾 Сохранение токенов:', {
      hasAccessToken: !!data.accessToken,
      accessTokenLength: data.accessToken?.length,
      role: data.role,
      expiresAt: data.accessTokenExpiresAt
    });

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER_ROLE, data.role);
    localStorage.setItem(STORAGE_KEYS.USER_FIO, data.fio);
    localStorage.setItem(STORAGE_KEYS.USER_ID, data.userId.toString());
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES, data.accessTokenExpiresAt);
  }

  private clearAuth(): void {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expTime = payload.exp * 1000; // время истечения в мс
      const now = Date.now();

      // 🔥 УМЕНЬШИТЕ буфер до 0 или 1-2 секунд
      const buffer = 0; // Было 30000 (30 сек)

      console.log('🕐 Проверка токена:', {
        exp: new Date(expTime).toLocaleString(),
        now: new Date(now).toLocaleString(),
        timeLeft: Math.round((expTime - now) / 1000) + ' сек',
        buffer: buffer + ' мс',
        isExpired: expTime < now + buffer
      });

      return expTime < now + buffer;
    } catch {
      return true;
    }
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    if (!token) {
      console.log('❌ Токен отсутствует');
      return false;
    }

    // 🔥 Проверяем по сохранённому времени из response
    const expiresAt = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES);
    if (expiresAt) {
      const expiresTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const buffer = 5000; // 5 секунд

      console.log('🕐 Проверка по token_expires:', {
        expiresAt,
        expiresTime,
        now,
        timeLeft: Math.round((expiresTime - now) / 1000) + ' сек',
        isExpired: expiresTime < now + buffer
      });

      return expiresTime >= now + buffer;
    }

    // Fallback на парсинг JWT
    return !this.isTokenExpired(token);
  }
}

export const authService = new AuthService();