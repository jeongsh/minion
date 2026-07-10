revoke all on public.fan_temperature_events from public, anon, authenticated;
revoke all on public.fan_onions from public, anon, authenticated;

grant select on public.fan_onions to anon, authenticated;
grant all on public.fan_temperature_events to service_role;
grant all on public.fan_onions to service_role;
