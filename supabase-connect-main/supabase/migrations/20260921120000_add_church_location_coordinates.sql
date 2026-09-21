alter table public.churches
  add column latitude double precision,
  add column longitude double precision;

alter table public.churches
  add constraint churches_latitude_range
  check (latitude is null or latitude between -90 and 90),
  add constraint churches_longitude_range
  check (longitude is null or longitude between -180 and 180);
