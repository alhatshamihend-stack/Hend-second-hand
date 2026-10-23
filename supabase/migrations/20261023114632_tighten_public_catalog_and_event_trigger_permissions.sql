-- Keep the public product catalog limited to the explicitly approved columns.
REVOKE SELECT (created_at, has_auth_certificate)
ON TABLE public.products_zzer
FROM anon, authenticated;

-- The function remains attached to the ensure_rls event trigger.
-- Remove direct API execution while preserving the event trigger behavior.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated;
