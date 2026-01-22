-- Seed a default location so the app has something to show on first run.

insert into public.locations (name, region, latitude, longitude, timezone)
select 'Dar es Salaam', 'TZ', -6.792400, 39.208300, 'Africa/Dar_es_Salaam'
where not exists (
  select 1 from public.locations
  where latitude = -6.792400 and longitude = 39.208300
);
