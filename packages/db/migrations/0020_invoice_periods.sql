CREATE TABLE listing_invoice_periods (
 invoice_id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES employer_orders(id) ON DELETE CASCADE,
 subscription_id TEXT NOT NULL,
 payment_intent_id TEXT,
 period_start TEXT NOT NULL,
 period_end TEXT NOT NULL,
 amount_paid INTEGER NOT NULL,
 currency TEXT NOT NULL,
 event_id TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX idx_listing_invoice_order ON listing_invoice_periods(order_id,period_end);
CREATE INDEX idx_listing_invoice_payment ON listing_invoice_periods(payment_intent_id);
