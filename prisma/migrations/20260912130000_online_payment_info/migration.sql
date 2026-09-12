-- Wallet/bank details printed on the customer bill so a diner can transfer the amount
-- instead of paying at the counter. Held as free text, one line per field, and editable
-- from Settings > Printer & Receipts - the numbers change more often than the code does.
ALTER TABLE "RestaurantSettings" ADD COLUMN "onlinePaymentInfo" TEXT;

-- Seed the accounts currently in use.
UPDATE "RestaurantSettings"
SET "onlinePaymentInfo" = 'Jazzcash: 03216303563
Name: M.Abubakar zia
Easypaisa: 03057729767
Name: Tariq naseem'
WHERE "id" = 'singleton' AND "onlinePaymentInfo" IS NULL;
