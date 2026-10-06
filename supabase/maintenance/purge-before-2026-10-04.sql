-- ONE-OFF, IRREVERSIBLE. Deletes the transactions, orders, catalogue orders, shipping requests, quotes and shipments created before
-- 4 October 2026 (UTC), then sets every wallet back to 0 HTG so balances and history agree.
-- Users, products, addresses, settings, notifications and the audit log are kept.
-- Run it in the Supabase SQL editor (the assistant's SQL tool refuses DELETE statements). Everything runs in one transaction:
-- if any step fails nothing is changed. Read the counts returned by the last SELECT before the COMMIT if you run it step by step.
BEGIN;

DELETE FROM public.orders           WHERE created_at < '2026-10-04';      -- also removes their status history, batch links, installments
DELETE FROM public.product_orders   WHERE created_at < '2026-10-04';      -- and their items
DELETE FROM public.product_requests WHERE created_at < '2026-10-04';      -- product requests and shipping requests, with their quotes, photos, scans
DELETE FROM public.quotes           WHERE created_at < '2026-10-04';
DELETE FROM public.shipments        WHERE created_at < '2026-10-04';      -- newer orders / requests that pointed to them simply lose the link
DELETE FROM public.wallet_transactions WHERE created_at < '2026-10-04';

UPDATE public.wallets SET available_balance = 0, blocked_balance = 0, updated_at = now();

SELECT (SELECT count(*) FROM public.orders) AS orders,
       (SELECT count(*) FROM public.product_orders) AS catalog_orders,
       (SELECT count(*) FROM public.product_requests) AS requests,
       (SELECT count(*) FROM public.quotes) AS quotes,
       (SELECT count(*) FROM public.shipments) AS shipments,
       (SELECT count(*) FROM public.wallet_transactions) AS transactions,
       (SELECT coalesce(sum(available_balance + blocked_balance), 0) FROM public.wallets) AS wallets_total;

COMMIT;
-- Files in the storage buckets (payment proofs, package photos) of deleted records are not removed by this script.
