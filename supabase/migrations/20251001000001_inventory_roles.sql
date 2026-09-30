-- New login roles. This file only adds enum values.
-- PostgreSQL cannot use a new enum value until this migration commits.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'inventory';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'user';
