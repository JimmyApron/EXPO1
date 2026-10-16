-- The Edge worker uses the service role through PostgREST. Keep its access
-- explicit even when the project's default privileges are customized.
grant select, insert, update, delete on public.notification_preferences,
  public.app_notifications, public.notification_devices,
  public.notification_push_attempts to service_role;

-- The settings screen currently supports Korean local time only. Fail the
-- migration if an existing row differs, so no user's setting is overwritten.
-- Invalid time zone names would otherwise abort the due-push claim for all users.
alter table public.notification_preferences
  add constraint notification_preferences_timezone_check
  check (timezone = 'Asia/Seoul');
