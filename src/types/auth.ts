export interface LoginCredentials {
  login: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  fio: string;
  userId: number;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export enum UserRole {
  Dispatcher = 'Dispatcher',
  Accountant = 'Accountant',
  OmtEmployee = 'OmtEmployee',
  ServiceEngineer = 'ServiceEngineer',
  Client = 'Client'
}

export interface UserInfo {
  login: string;
  fio: string;
  role: UserRole;
  isAuthenticated: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// src/types/auth.ts

export interface RegisterRequest {
  fio: string;
  login: string;
  password: string;
  phone: string;
  email?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  clientId?: number;
  login?: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role: string;
  userId: number;
  fio: string;
}

