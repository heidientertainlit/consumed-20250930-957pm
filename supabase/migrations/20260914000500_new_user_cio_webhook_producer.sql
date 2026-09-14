-- Harden the existing public.users signup producer in place.
--
-- The production database already has the
-- `on_public_user_created_notify_customerio` AFTER INSERT trigger calling
-- `notify_new_public_user_signup()`.  Replace only that function; do not add a
-- second auth.users trigger, which would duplicate signup events.
--
-- Setup (outside this migration):
--   1. Generate one random value.
--   2. Store it in Supabase Vault as `new_user_cio_webhook_secret`.
--   3. Store the same value as the Edge Function secret
--      `NEW_USER_CIO_WEBHOOK_SECRET`.
--
-- No credential is embedded in this migration. If the Vault value is absent,
-- the trigger leaves signup untouched and emits only a warning.

create or replace function public.notify_new_public_user_signup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  webhook_secret text;
  edge_url constant text :=
    'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/notify-new-user-cio';
begin
  select decrypted_secret
    into webhook_secret
  from vault.decrypted_secrets
  where name = 'new_user_cio_webhook_secret'
  order by created_at desc
  limit 1;

  if webhook_secret is null or btrim(webhook_secret) = '' then
    raise warning 'new-user Customer.io webhook is not configured in Vault';
    return new;
  end if;

  perform net.http_post(
    url := edge_url,
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', new.id,
        'email', new.email,
        'created_at', coalesce(new.created_at, now())
      )
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-consumed-new-user-secret', webhook_secret
    )
  );

  return new;
exception
  when others then
    -- Signup must not fail because an asynchronous notification is down.
    -- The endpoint itself remains fail-closed for unauthenticated callers.
    raise warning 'new-user Customer.io webhook enqueue failed';
    return new;
end;
$$;