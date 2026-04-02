-- Pricing 3.0 — run once in Supabase SQL Editor after deploying app changes.
-- Allowed plan values: esencial, operaciones, logistica, todo_incluido, trial
--
-- If existing rows still use legacy plan names, migrate before adding the CHECK, e.g.:
-- UPDATE subscriptions SET plan = 'esencial' WHERE plan IN ('foundation', 'starter', 'horarios');
-- UPDATE subscriptions SET plan = 'operaciones' WHERE plan IN ('obras', 'pro', 'professional');
-- UPDATE subscriptions SET plan = 'todo_incluido' WHERE plan IN ('enterprise');

ALTER TABLE subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_plan_check
CHECK (plan IN ('esencial', 'operaciones', 'logistica', 'todo_incluido', 'trial'));
