alter table public.fan_ratings
  drop constraint if exists fan_ratings_rating_check;

alter table public.fan_ratings
  alter column rating type numeric(3, 1)
  using (rating * 2)::numeric(3, 1);

alter table public.fan_ratings
  add constraint fan_ratings_rating_check
  check (rating >= 1 and rating <= 10 and rating = trunc(rating));
