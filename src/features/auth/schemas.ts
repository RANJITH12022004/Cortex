import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const setPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const inviteSchema = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['manager', 'senior_manager', 'employee', 'procurement']),
});

export const adminInviteSchema = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['manager', 'senior_manager', 'procurement', 'employee']),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;
export type InviteFormValues = z.infer<typeof inviteSchema>;
export type AdminInviteFormValues = z.infer<typeof adminInviteSchema>;
