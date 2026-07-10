-- Add senior_manager role (must be committed before functions reference it).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'senior_manager';
