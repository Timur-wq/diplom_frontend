// src/types/staff.ts

export interface CreateStaffDto {
  fullName: string;
  hireDate: string; // ISO date string
  login: string;
  password: string;
  role: string; // Dispatcher, ServiceEngineer, Accountant, OmtEmployee
}

export interface StaffDto {
  userId: number;
  fullName: string;
  login: string;
  role: string;
  tabNumber: number;
  hireDate: string; // ISO date string
  isActive: boolean;
}