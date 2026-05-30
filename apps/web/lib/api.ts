import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove('auth_token');
      Cookies.remove('user_role');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

function getSelectedStoreId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem('selected_store_id') ?? undefined;
}

// Auth
export const login = (employeeId: string, pin: string) =>
  apiClient.post('/api/auth/login', { employeeId, pin });

export const logout = () =>
  apiClient.delete('/api/auth/logout').catch(() => {});

// Sessions
export const getSessions = (params?: { status?: string; page?: number; limit?: number; storeId?: string }) => {
  const storeId = params?.storeId ?? getSelectedStoreId();
  return apiClient.get('/api/audit/sessions', { params: { ...params, storeId } });
};

export const getSession = (id: string) =>
  apiClient.get(`/api/audit/sessions/${id}`);

export const createSession = (notes?: string, storeId?: string) => {
  const sid = storeId ?? getSelectedStoreId();
  return apiClient.post('/api/audit/sessions', { notes, ...(sid ? { storeId: sid } : {}) });
};

export const closeSession = (id: string, surplusNotes?: string) =>
  apiClient.patch(`/api/audit/sessions/${id}/close`, surplusNotes ? { surplusNotes } : {});

export const verifySession = (id: string, surplusNotes?: string) =>
  apiClient.patch(`/api/audit/sessions/${id}/verify`, surplusNotes ? { surplusNotes } : {});

export const getDiscrepancy = (sessionId: string) =>
  apiClient.get(`/api/audit/sessions/${sessionId}/discrepancy`);

export const getStoreSummary = () =>
  apiClient.get('/api/audit/stores/summary');

// Brands
export const getBrands = () => apiClient.get('/api/brands');

// Export
export const exportPdf = (sessionId: string) =>
  apiClient.get(`/api/export/${sessionId}/pdf`, { responseType: 'blob' });

export const downloadMonthlyReport = (year: number, month: number, storeId?: string) =>
  apiClient.get('/api/export/monthly', {
    params: { year, month, ...(storeId ? { storeId } : {}) },
    responseType: 'blob',
  });

// Workers
export const getWorkers = () => apiClient.get('/api/workers');

export const getWorkerStores = () => apiClient.get('/api/workers/stores');

export const createWorker = (data: { name: string; pin: string; storeId?: string }) =>
  apiClient.post('/api/workers', data);

export const updateWorker = (id: string, data: { name?: string; pin?: string; isActive?: boolean }) =>
  apiClient.patch(`/api/workers/${id}`, data);

export const reassignWorker = (workerId: string, storeId: string) =>
  apiClient.patch(`/api/workers/${workerId}/assign`, { storeId });

export const setWorkerPin = (workerId: string, pin: string) =>
  apiClient.patch(`/api/workers/${workerId}`, { pin });

// Stores
export const getStores = () => apiClient.get('/api/stores');

export const createStore = (data: { name: string; address?: string; gstin?: string; licenseNo?: string }) =>
  apiClient.post('/api/stores', data);

export const updateStore = (id: string, data: { name?: string; address?: string; gstin?: string; licenseNo?: string; isActive?: boolean }) =>
  apiClient.patch(`/api/stores/${id}`, data);
