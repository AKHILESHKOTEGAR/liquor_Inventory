import { z } from 'zod';

export const loginSchema = z.object({
  employeeId: z
    .string()
    .regex(/^EMP-\d{4}$/, 'Employee ID must be in format EMP-XXXX'),
  pin: z
    .string()
    .length(4, 'PIN must be exactly 4 digits')
    .regex(/^\d{4}$/, 'PIN must contain only digits'),
});

export type LoginInput = z.infer<typeof loginSchema>;
