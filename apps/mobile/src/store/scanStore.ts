import { create } from 'zustand';
import { ScanEvent } from '@/services/api';
import { ScanStep } from '@/utils/constants';

export interface BoxInfo {
  id: string;
  virtualBoxId: string;
  boxBarcode: string;
  brand: { name: string; size: string };
  _count: { bottles: number };
}

interface ScanState {
  // Auth
  userId: string | null;
  employeeId: string | null;
  userName: string | null;
  role: string | null;
  storeId: string | null;
  storeName: string | null;

  // Session
  sessionId: string | null;
  sessionCode: string | null;

  // Scanner step
  currentStep: ScanStep;
  activeBox: BoxInfo | null;

  // Scan tracking — scannedItems persists after sync for display
  scannedItems: ScanEvent[];
  scannedQrSet: Set<string>;
  pendingSyncs: ScanEvent[];
  bottleCount: number;
  lastDuplicateValue: string | null;
  isDuplicateOverlayVisible: boolean;

  // Actions
  setAuth: (userId: string, employeeId: string, name: string, role: string, storeId?: string, storeName?: string) => void;
  clearAuth: () => void;
  setSession: (id: string, code: string) => void;
  clearSession: () => void;
  setActiveBox: (box: BoxInfo | null) => void;
  setStep: (step: ScanStep) => void;
  recordScan: (event: ScanEvent) => 'ok' | 'duplicate';
  deleteScan: (localId: string) => void;
  clearPendingSyncs: (localIds: string[]) => void;
  showDuplicateOverlay: (value: string) => void;
  hideDuplicateOverlay: () => void;
}

export const useScanStore = create<ScanState>((set, get) => ({
  userId: null,
  employeeId: null,
  userName: null,
  role: null,
  storeId: null,
  storeName: null,
  sessionId: null,
  sessionCode: null,
  currentStep: 'BOX',
  activeBox: null,
  scannedItems: [],
  scannedQrSet: new Set(),
  pendingSyncs: [],
  bottleCount: 0,
  lastDuplicateValue: null,
  isDuplicateOverlayVisible: false,

  setAuth: (userId, employeeId, userName, role, storeId, storeName) =>
    set({ userId, employeeId, userName, role, storeId: storeId ?? null, storeName: storeName ?? null }),

  clearAuth: () =>
    set({ userId: null, employeeId: null, userName: null, role: null, storeId: null, storeName: null }),

  setSession: (id, code) =>
    set({ sessionId: id, sessionCode: code }),

  clearSession: () =>
    set({
      sessionId: null,
      sessionCode: null,
      currentStep: 'BOX',
      activeBox: null,
      scannedItems: [],
      scannedQrSet: new Set(),
      pendingSyncs: [],
      bottleCount: 0,
    }),

  setActiveBox: (box) =>
    set({ activeBox: box, currentStep: box ? 'BOTTLE' : 'BOX' }),

  setStep: (step) => set({ currentStep: step }),

  recordScan: (event) => {
    const { scannedQrSet } = get();
    if (event.scanType === 'QR_CODE' && scannedQrSet.has(event.rawValue)) {
      return 'duplicate';
    }
    set((state) => {
      const newSet = new Set(state.scannedQrSet);
      if (event.scanType === 'QR_CODE') newSet.add(event.rawValue);
      return {
        scannedQrSet: newSet,
        scannedItems: [...state.scannedItems, event],
        pendingSyncs: [...state.pendingSyncs, event],
        bottleCount: state.bottleCount + 1,
      };
    });
    return 'ok';
  },

  deleteScan: (localId) => {
    set((state) => {
      const item = state.scannedItems.find((e) => e.localId === localId);
      if (!item) return state;
      const newSet = new Set(state.scannedQrSet);
      if (item.scanType === 'QR_CODE') newSet.delete(item.rawValue);
      return {
        scannedItems: state.scannedItems.filter((e) => e.localId !== localId),
        pendingSyncs: state.pendingSyncs.filter((e) => e.localId !== localId),
        scannedQrSet: newSet,
        bottleCount: Math.max(0, state.bottleCount - 1),
      };
    });
  },

  clearPendingSyncs: (localIds) =>
    set((state) => ({
      pendingSyncs: state.pendingSyncs.filter((e) => !localIds.includes(e.localId)),
    })),

  showDuplicateOverlay: (value) =>
    set({ lastDuplicateValue: value, isDuplicateOverlayVisible: true }),

  hideDuplicateOverlay: () =>
    set({ isDuplicateOverlayVisible: false, lastDuplicateValue: null }),
}));
