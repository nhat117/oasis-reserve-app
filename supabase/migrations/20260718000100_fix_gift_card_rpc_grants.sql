-- Supabase's default privileges on the public schema grant EXECUTE to anon
-- and authenticated on every newly created function, regardless of an
-- explicit REVOKE ALL ... FROM PUBLIC in the same migration (that revoke
-- only strips the PUBLIC pseudo-role grant, not the anon-specific one
-- applied at creation time via ALTER DEFAULT PRIVILEGES). These RPCs mutate
-- real money — anon must never be able to call them, even though the
-- function's own no_tenant check makes an anon call a no-op today.
REVOKE EXECUTE ON FUNCTION public.redeem_gift_card(text, numeric, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.adjust_gift_card_balance(uuid, numeric, text) FROM anon;
