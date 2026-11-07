-- Run after applying the initial schema migration to the NIT Calicut pilot project.
-- Verify the student mailbox domain with institute IT before opening registration.
insert into public.colleges (name, slug, email_domains, is_active)
values (
  'National Institute of Technology Calicut',
  'nit-calicut',
  array['nitc.ac.in'],
  true
)
on conflict (slug) do update
set name = excluded.name,
    email_domains = excluded.email_domains,
    is_active = true,
    updated_at = now();
