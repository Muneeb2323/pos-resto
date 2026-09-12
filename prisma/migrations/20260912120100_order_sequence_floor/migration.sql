-- Order numbers are issued from the "Order".orderSequence database sequence so that
-- concurrent terminals can never be handed the same number. This sets the sequence's
-- floor to 1000 (first order becomes #1001), matching the numbering the restaurant
-- already uses, while never moving it backwards past orders that already exist.
SELECT setval(
    pg_get_serial_sequence('"Order"', 'orderSequence'),
    GREATEST(1000, COALESCE((SELECT MAX("orderSequence") FROM "Order"), 0)),
    true
);
