-- Keep illustrative served covers separate from manager-entered actuals.
-- Existing rows remain manager entries and retain their required actor.
BEGIN;

ALTER TABLE public.service_actual_covers
    ADD COLUMN source text NOT NULL DEFAULT 'manager'
        CHECK (source IN ('manager', 'demo')),
    ALTER COLUMN recorded_by DROP NOT NULL;

ALTER TABLE public.service_actual_covers
    ADD CONSTRAINT service_actual_covers_source_actor_check
    CHECK (
        (source = 'manager' AND recorded_by IS NOT NULL)
        OR source = 'demo'
    );

COMMIT;
