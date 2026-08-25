-- Optional illustrative image per event.
-- Shape (see docs/EVENT_SCHEMA.md): { url, alt, caption?, credit?, credit_url? }
-- Images live in the public `event-images` storage bucket, compressed WebP.

alter table public.events add column if not exists image jsonb;

insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;
