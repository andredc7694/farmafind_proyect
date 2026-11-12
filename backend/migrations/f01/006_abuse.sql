-- No raw email or IP is stored; the application sends purpose-separated HMAC digests.
CREATE TABLE f01.abuse_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('LOGIN_ACCOUNT','LOGIN_IP','REGISTER_IP')),
  key_digest bytea NOT NULL CHECK (octet_length(key_digest)=32),
  occurred_at timestamptz NOT NULL
);
CREATE INDEX abuse_attempt_window_idx ON f01.abuse_attempt(scope,key_digest,occurred_at DESC);
ALTER TABLE f01.abuse_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE f01.abuse_attempt FORCE ROW LEVEL SECURITY;
GRANT SELECT (scope,key_digest,occurred_at), INSERT (scope,key_digest,occurred_at)
  ON f01.abuse_attempt TO f01_auth;
CREATE POLICY abuse_auth_lectura ON f01.abuse_attempt FOR SELECT TO f01_auth USING (true);
CREATE POLICY abuse_auth_alta ON f01.abuse_attempt FOR INSERT TO f01_auth WITH CHECK (true);
