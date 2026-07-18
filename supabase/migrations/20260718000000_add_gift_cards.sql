-- Stored-value gift cards: admin creates a card with a balance, customers
-- redeem it (partially, across multiple visits) at checkout. Deliberately
-- separate from discount_codes (one-time percent/amount vouchers) — a gift
-- card carries real prepaid value and needs a balance + an auditable ledger,
-- not a use-counter.
CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  initial_value numeric(10,2) NOT NULL CHECK (initial_value > 0),
  balance numeric(10,2) NOT NULL CHECK (balance >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','redeemed','expired')),
  purchaser_name text,
  purchaser_note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  activation_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gift_cards_balance_le_initial CHECK (balance <= initial_value),
  -- Australian Consumer Law: purchased gift cards must be valid for a
  -- minimum of 3 years from creation. Enforced here as a backstop even
  -- though the admin UI never exposes an editable expiry field.
  CONSTRAINT gift_cards_min_expiry CHECK (expiry_date >= (activation_date + interval '3 years')::date)
);

CREATE UNIQUE INDEX idx_gift_cards_code ON public.gift_cards(code);
CREATE INDEX idx_gift_cards_tenant ON public.gift_cards(tenant_id);
CREATE INDEX idx_gift_cards_tenant_status ON public.gift_cards(tenant_id, status);

CREATE TRIGGER update_gift_cards_updated_at BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Append-only ledger. Invariant: balance == SUM(amount) over all of a card's
-- rows, including its own 'issue' row (amount = initial_value) — so
-- reconciliation is one formula, not a special case for the creation event.
CREATE TABLE public.gift_card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('issue','redemption','manual_adjustment')),
  balance_after numeric(10,2) NOT NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  reason text,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_by_email text,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reason_required_for_adjustment
    CHECK (type <> 'manual_adjustment' OR (reason IS NOT NULL AND length(trim(reason)) > 0))
);

CREATE INDEX idx_gift_card_tx_card ON public.gift_card_transactions(gift_card_id, created_at DESC);
CREATE INDEX idx_gift_card_tx_sale ON public.gift_card_transactions(sale_id);
CREATE INDEX idx_gift_card_tx_tenant ON public.gift_card_transactions(tenant_id);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;

-- Money-bearing internal records — authenticated-only, no anon policy at
-- all, same posture as sales/sale_items. This is what actually enforces
-- "no public endpoint that creates gift cards," not just the lack of a UI
-- button for it.
CREATE POLICY "auth_manage_tenant_gift_cards" ON public.gift_cards
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY "auth_manage_tenant_gift_card_tx" ON public.gift_card_transactions
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Atomic redemption: locks the card row, validates status/expiry/balance,
-- deducts min(p_amount, balance), and inserts the ledger row in one
-- transaction. Returning {success:false, error:...} for expected validation
-- failures (matches check_rate_limit's jsonb convention) rather than raising
-- exceptions — callers branch on `error` to show a specific message.
--
-- tenant_id is derived from the caller's own session (get_my_tenant_id()),
-- never trusted from an argument — this function is SECURITY DEFINER and
-- therefore bypasses RLS, so it must do its own tenant check rather than
-- relying on a client-supplied value.
CREATE OR REPLACE FUNCTION public.redeem_gift_card(
  p_code text,
  p_amount numeric,
  p_sale_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.get_my_tenant_id();
  v_card public.gift_cards%ROWTYPE;
  v_applied numeric(10,2);
  v_new_balance numeric(10,2);
  v_new_status text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_tenant');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  SELECT * INTO v_card
  FROM public.gift_cards
  WHERE code = upper(trim(p_code)) AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF v_card IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_card.status = 'disabled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'disabled');
  END IF;

  IF v_card.status = 'redeemed' OR v_card.balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'empty');
  END IF;

  IF v_card.expiry_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  v_applied := LEAST(p_amount, v_card.balance);
  v_new_balance := v_card.balance - v_applied;
  v_new_status := CASE WHEN v_new_balance <= 0 THEN 'redeemed' ELSE v_card.status END;

  UPDATE public.gift_cards
  SET balance = v_new_balance, status = v_new_status, updated_at = now()
  WHERE id = v_card.id;

  INSERT INTO public.gift_card_transactions
    (gift_card_id, amount, type, balance_after, sale_id, processed_by, tenant_id)
  VALUES
    (v_card.id, -v_applied, 'redemption', v_new_balance, p_sale_id, auth.uid(), v_tenant_id);

  RETURN jsonb_build_object(
    'success', true,
    'applied_amount', v_applied,
    'new_balance', v_new_balance,
    'gift_card_id', v_card.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_gift_card(text, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card(text, numeric, uuid) TO authenticated;

-- Manual balance adjustment (goodwill credit or correction). Requires a
-- non-empty reason (also enforced by the ledger's CHECK constraint), same
-- locking pattern as redemption, capped to [0, initial_value].
CREATE OR REPLACE FUNCTION public.adjust_gift_card_balance(
  p_gift_card_id uuid,
  p_delta numeric,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.get_my_tenant_id();
  v_card public.gift_cards%ROWTYPE;
  v_new_balance numeric(10,2);
  v_new_status text;
BEGIN
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_tenant');
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'reason_required');
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  SELECT * INTO v_card FROM public.gift_cards
  WHERE id = p_gift_card_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF v_card IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  v_new_balance := v_card.balance + p_delta;

  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;
  IF v_new_balance > v_card.initial_value THEN
    RETURN jsonb_build_object('success', false, 'error', 'exceeds_initial_value');
  END IF;

  v_new_status := CASE
    WHEN v_new_balance <= 0 THEN 'redeemed'
    WHEN v_card.status = 'redeemed' AND v_new_balance > 0 THEN 'active'
    ELSE v_card.status
  END;

  UPDATE public.gift_cards
  SET balance = v_new_balance, status = v_new_status, updated_at = now()
  WHERE id = v_card.id;

  INSERT INTO public.gift_card_transactions
    (gift_card_id, amount, type, balance_after, reason, processed_by, tenant_id)
  VALUES
    (v_card.id, p_delta, 'manual_adjustment', v_new_balance, p_reason, auth.uid(), v_tenant_id);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_gift_card_balance(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_gift_card_balance(uuid, numeric, text) TO authenticated;

-- Sales: link a redemption to the sale it paid down. gift_card_code is a
-- snapshot (same rationale as tax_label/tax_rate_percent elsewhere on this
-- table) so a receipt/report still shows the code even if the card is later
-- disabled. Split-tender convention: when a gift card fully covers the
-- total, payment_method='gift_card'; when it covers only part, payment_method
-- stays whatever cash/card tender was selected and gift_card_amount > 0
-- marks the split — avoids a 'split' enum value or a second amount column.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS gift_card_id uuid REFERENCES public.gift_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gift_card_code text,
  ADD COLUMN IF NOT EXISTS gift_card_amount numeric(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sales_gift_card ON public.sales(gift_card_id) WHERE gift_card_id IS NOT NULL;

-- payment_method previously had no CHECK constraint at all. Document the
-- values the app actually writes now that gift_card is one of them.
ALTER TABLE public.sales
  ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'square', 'stripe', 'gift_card'));
