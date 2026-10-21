-- Applied to the Supabase Dissertation Project as migration
-- 20261021151713_unique_restaurant_demand_date.
-- One row per calendar date is required for atomic booking aggregates.
ALTER TABLE public.restaurant_demand_features
    ADD CONSTRAINT restaurant_demand_features_pkey PRIMARY KEY (date);
