-- Schema for the Listing Search Service.
-- Columns mirror sample_listings.json.
--
-- `id` is only unique *within* a source (e.g. MLS_A and MLS_B can both have an
-- "A1"), so the primary key is the composite (id, source).

CREATE TABLE IF NOT EXISTS listings (
  id          TEXT NOT NULL,
  source      TEXT NOT NULL,
  address     TEXT NOT NULL,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  zip         TEXT NOT NULL,
  price       NUMERIC(12,2) NOT NULL,
  bedrooms    INTEGER,
  bathrooms   NUMERIC(3,1),
  sqft        INTEGER,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  listed_date TIMESTAMPTZ NOT NULL,
  status      TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (id, source)
);

-- Supports the price-range filter and the default ordering.
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings (price);
-- Supports the city filter.
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings (city);
