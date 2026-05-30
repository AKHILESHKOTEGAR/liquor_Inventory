import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '@/utils/constants';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    employeeId: string;
    name: string;
    role: string;
    storeId: string | null;
    ownedStores: { id: string; name: string }[];
  };
}

export async function loginWithPin(employeeId: string, pin: string): Promise<LoginResponse> {
  const res = await apiClient.post('/api/auth/login', { employeeId, pin });
  await SecureStore.setItemAsync('auth_token', res.data.token);
  await SecureStore.setItemAsync('user_data', JSON.stringify(res.data.user));
  return res.data;
}

export async function logout() {
  await SecureStore.deleteItemAsync('auth_token');
  await SecureStore.deleteItemAsync('user_data');
}

export async function getStoredUser() {
  const raw = await SecureStore.getItemAsync('user_data');
  return raw ? JSON.parse(raw) : null;
}

export async function createSession(notes?: string) {
  const res = await apiClient.post('/api/audit/sessions', { notes });
  return res.data.session;
}

export async function getSessions(storeId?: string) {
  const params = storeId ? `?storeId=${storeId}` : '';
  const res = await apiClient.get(`/api/audit/sessions${params}`);
  return res.data.sessions as SessionSummary[];
}

export async function closeSession(sessionId: string) {
  const res = await apiClient.patch(`/api/audit/sessions/${sessionId}/close`);
  return res.data;
}

export interface SessionSummary {
  id: string;
  sessionCode: string;
  status: 'ACTIVE' | 'CLOSED';
  startedAt: string;
  closedAt: string | null;
  storeId: string;
  _count?: { scanLogs: number };
}

export interface ScanEvent {
  localId: string;
  rawValue: string;
  scanType: 'QR_CODE' | 'MANUAL_SERIAL' | 'PHOTO_FALLBACK';
  scannedAt: string;
  boxId?: string;
}

export async function resolveBox(sessionId: string, boxBarcode: string) {
  const res = await apiClient.post('/api/scan/resolve-box', { sessionId, boxBarcode });
  return res.data;
}

export async function batchSync(sessionId: string, deviceId: string, scans: ScanEvent[]) {
  const res = await apiClient.post('/api/scan/batch-sync', { sessionId, deviceId, scans });
  return res.data;
}

export async function uploadCapPhoto(sessionId: string, boxId: string | undefined, photoUri: string) {
  const filename = photoUri.split('/').pop() ?? 'cap.jpg';
  const formData = new FormData();
  formData.append('sessionId', sessionId);
  if (boxId) formData.append('boxId', boxId);
  formData.append('photo', { uri: photoUri, name: filename, type: 'image/jpeg' } as any);
  const res = await apiClient.post('/api/scan/upload-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
