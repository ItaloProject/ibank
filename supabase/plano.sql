-- Plano de cada pizzaria: 'premium' (completo, padrão) ou 'normal' (cardápio digital).
-- Pizzarias existentes ficam premium, então nada muda para quem já usa o sistema.
ALTER TABLE public.pizzarias ADD COLUMN IF NOT EXISTS plano text NOT NULL DEFAULT 'premium';
ALTER TABLE public.pizzarias DROP CONSTRAINT IF EXISTS pizzarias_plano_check;
ALTER TABLE public.pizzarias ADD CONSTRAINT pizzarias_plano_check CHECK (plano IN ('normal', 'premium'));
