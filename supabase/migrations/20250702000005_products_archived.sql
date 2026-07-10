-- Soft-archive products (Prompt 2 — manager catalog)

ALTER TABLE public.products
  ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX products_archived_idx ON public.products (archived);
