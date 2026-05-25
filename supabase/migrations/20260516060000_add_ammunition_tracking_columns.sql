-- Add ammunition tracking columns to monthly_report_items
-- These columns track quantity flow for AMMUNITIONS equipment type only

ALTER TABLE public.monthly_report_items
ADD COLUMN previous_report INTEGER,
ADD COLUMN expended INTEGER,
ADD COLUMN replenished INTEGER,
ADD COLUMN balance_on_hand INTEGER;

COMMENT ON COLUMN public.monthly_report_items.previous_report IS 'Quantity from previous month''s balance - AMMUNITIONS equipment type only';
COMMENT ON COLUMN public.monthly_report_items.expended IS 'Quantity used/consumed this month - AMMUNITIONS equipment type only';
COMMENT ON COLUMN public.monthly_report_items.replenished IS 'Quantity added this month - AMMUNITIONS equipment type only';
COMMENT ON COLUMN public.monthly_report_items.balance_on_hand IS 'Calculated balance: previous_report - expended + replenished - AMMUNITIONS equipment type only';
