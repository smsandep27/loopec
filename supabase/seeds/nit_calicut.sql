-- Run after applying the initial schema migration to the NIT Calicut pilot project.
-- Verify the student mailbox domain with institute IT before opening registration.
insert into public.colleges (id, name, slug, email_domains, is_active)
values (
  '35b88dad-65f3-4cd6-b44d-c7d2fda7711a',
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

-- NIT Calicut Official Campus Pickup Locations
insert into public.pickup_locations (id, college_id, name, address, instructions, sort_order, is_active)
values
  ('35b88dad-65f3-4cd6-b44d-c7d2fda7711b', '35b88dad-65f3-4cd6-b44d-c7d2fda7711a', 'Mega Mess 1 & 2 Courtyard', 'Central Dining Complex, NIT Calicut Campus', 'Meet outside main lobby entrance under the roof.', 10, true),
  ('35b88dad-65f3-4cd6-b44d-c7d2fda7711c', '35b88dad-65f3-4cd6-b44d-c7d2fda7711a', 'Student Activity Centre (SAC)', 'Near Basketball Court, NIT Calicut Campus', 'Meet at the main reception steps.', 20, true),
  ('35b88dad-65f3-4cd6-b44d-c7d2fda7711d', '35b88dad-65f3-4cd6-b44d-c7d2fda7711a', 'Central Library Entrance', 'Academic Complex, NIT Calicut Campus', 'Meet at the ground floor foyer near turnstiles.', 30, true),
  ('35b88dad-65f3-4cd6-b44d-c7d2fda7711e', '35b88dad-65f3-4cd6-b44d-c7d2fda7711a', 'MBH (Mega Boys Hostel) Gate', 'Hostel Zone, NIT Calicut Campus', 'Meet at the security checkpoint gate.', 40, true),
  ('35b88dad-65f3-4cd6-b44d-c7d2fda7711f', '35b88dad-65f3-4cd6-b44d-c7d2fda7711a', 'Ladies Hostel (LH) Gate', 'Ladies Hostel Complex, NIT Calicut Campus', 'Meet at visitor reception area.', 50, true)
on conflict (id) do update
set name = excluded.name,
    address = excluded.address,
    instructions = excluded.instructions,
    is_active = true;
