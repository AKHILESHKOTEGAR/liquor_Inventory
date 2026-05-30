export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.100:3001';

export const BATCH_SYNC_INTERVAL_MS = 5_000;
export const DUPLICATE_FLASH_DURATION_MS = 1_500;
export const SUCCESS_HAPTIC_DELAY_MS = 50;

export const SCAN_STEP = {
  BOX: 'BOX',
  BOTTLE: 'BOTTLE',
} as const;

export type ScanStep = typeof SCAN_STEP[keyof typeof SCAN_STEP];
