-- Disposable replay database only. All fixture rows are rolled back.
BEGIN;
DO $$
DECLARE
    actor_id bigint;
    first_id uuid := '54c00000-0000-4000-8000-000000000001';
BEGIN
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.staff_chat_actions'::regclass)
       OR has_table_privilege('anon','public.staff_chat_actions','SELECT')
       OR has_table_privilege('authenticated','public.staff_chat_actions','SELECT')
       OR has_table_privilege('anon','public.staff_chat_actions','INSERT')
       OR has_table_privilege('authenticated','public.staff_chat_actions','UPDATE') THEN
        RAISE EXCEPTION 'Staff-chat actions must remain server-only with RLS';
    END IF;
    INSERT INTO public.users(full_name,email,password_hash,role,status)
    VALUES ('Staff chat replay','staff-chat-replay@example.invalid','not-a-login','manager','active')
    RETURNING id INTO actor_id;
    INSERT INTO public.staff_chat_actions(id,actor_user_id,kind,state)
    VALUES (first_id,actor_id,'register','draft');
    BEGIN
        INSERT INTO public.staff_chat_actions(id,actor_user_id,kind,state)
        VALUES ('54c00000-0000-4000-8000-000000000002',actor_id,'register','draft');
        RAISE EXCEPTION 'Expected one-active-action constraint';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.staff_chat_actions SET draft='{"password":"must-not-persist"}' WHERE id=first_id;
        RAISE EXCEPTION 'Expected secret draft rejection';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.staff_chat_actions SET state='review' WHERE id=first_id;
        RAISE EXCEPTION 'Expected reviewed-snapshot requirement';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.staff_chat_actions SET state='completed',completed_at=now() WHERE id=first_id;
        RAISE EXCEPTION 'Expected completed-receipt requirement';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE public.staff_chat_actions SET state='cancelled' WHERE id=first_id;
    INSERT INTO public.staff_chat_actions(id,actor_user_id,kind,state)
    VALUES ('54c00000-0000-4000-8000-000000000003',actor_id,'register','draft');
    INSERT INTO public.auth_rate_limits(scope,key_hash,attempt_count,window_started_at,updated_at)
    VALUES ('chat_model_actor_minute',repeat('a',64),1,now(),now()),
           ('chat_model_actor_day',repeat('a',64),1,now(),now()),
           ('chat_model_global_day',repeat('a',64),1,now(),now()),
           ('staff_chat_actor',repeat('a',64),1,now(),now());
END $$;
ROLLBACK;
