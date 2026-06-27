import { UserRole, UserStatus, DeviceType, DeviceStatus } from './enums';

export interface User {
  id: string;
  storeId: string;
  username: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;
}

export interface DeviceRegistration {
  id: string;
  storeId: string;
  deviceName: string;
  deviceType: DeviceType;
  userId?: string;
  deviceToken: string;
  fcmToken?: string;
  status: DeviceStatus;
  lastHeartbeat?: string;
  createdAt: string;
}

export interface JwtPayload {
  sub: string;          // user id
  storeId: string;
  deviceId: string;
  role: UserRole;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface LoginRequest {
  username: string;
  password: string;
  deviceName: string;
  deviceType: DeviceType;
  fcmToken?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  user: Omit<User, 'passwordHash'>;
  permissions: string[];
}

export interface RefreshTokenRequest {
  refreshToken: string;
  deviceId: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface DeviceSession {
  deviceId: string;
  userId: string;
  jwt: string;
  permissions: string[];
  expiresAt: number;
}