-- The Windows print queue name was hard-coded in the print route, which meant swapping
-- the thermal printer required a code change. It is restaurant configuration, so it
-- belongs in settings alongside paper width and printer type.
ALTER TABLE "RestaurantSettings"
ADD COLUMN "printerName" TEXT NOT NULL DEFAULT 'Black Copper BC-85AC';
