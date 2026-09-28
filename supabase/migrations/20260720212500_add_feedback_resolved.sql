alter table public.feedbacks
  add column if not exists isresolved boolean not null default false;
