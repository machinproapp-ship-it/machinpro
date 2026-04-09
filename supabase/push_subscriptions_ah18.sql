-- Web Push subscriptions (AH-18). Run in Supabase SQL editor if the table does not exist yet.
-- If you already have a legacy `push_subscriptions` table with only a `subscription` jsonb column,
-- add: endpoint, p256dh, auth (text) and backfill from subscription->>'endpoint', keys, etc.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_company" ON push_subscriptions
  FOR ALL USING (company_id = get_my_company_id());
