-- Retain signed full-refund events even if Checkout has not arrived yet.
-- No order FK: Stripe delivery order is not guaranteed.
CREATE TABLE payment_reversals (
  payment_intent_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  reversed_at TEXT NOT NULL
);
