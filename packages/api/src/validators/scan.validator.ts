import { z } from 'zod';
import { ScanType } from '@liquor/db';

export const singleScanSchema = z.object({
  sessionId: z.string().cuid(),
  rawValue: z.string().min(1),
  scanType: z.nativeEnum(ScanType),
  scannedAt: z.string().datetime().optional(),
  boxId: z.string().cuid().optional(),
});

export const batchSyncSchema = z.object({
  sessionId: z.string().cuid(),
  deviceId: z.string().min(1),
  scans: z
    .array(
      z.object({
        rawValue: z.string().min(1),
        scanType: z.nativeEnum(ScanType),
        scannedAt: z.string().datetime(),
        boxId: z.string().cuid().optional(),
        localId: z.string(),
      })
    )
    .min(1)
    .max(500),
});

export const boxScanSchema = z.object({
  sessionId: z.string().cuid(),
  boxBarcode: z.string().min(1),
});

export type SingleScanInput = z.infer<typeof singleScanSchema>;
export type BatchSyncInput = z.infer<typeof batchSyncSchema>;
export type BoxScanInput = z.infer<typeof boxScanSchema>;
