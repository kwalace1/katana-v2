-- =============================================================================
-- Seed one KYI demo company for investor demo (e.g. March 15).
-- Run this in Supabase Dashboard → SQL Editor after applying supabase-kyi-schema.sql.
-- Adjust company name to match the name used in the legacy KYI Flask app (e.g. DW Griffin Capital).
-- =============================================================================

-- Ensure default company exists (id 1) so platform lead pool is valid
INSERT INTO public.kyi_companies (id, name, location, industry, website, description, created_at)
VALUES (1, 'Default Company', NULL, NULL, NULL, NULL, now())
ON CONFLICT (id) DO NOTHING;

-- Demo company (id 2) — use same name as in KYI Flask app for Suggested Investors / Access Map
INSERT INTO public.kyi_companies (id, name, location, industry, website, description, created_at)
VALUES (2, 'DW Griffin Capital', 'Austin, TX', 'Investment', 'https://example.com', 'Demo company for investor presentation.', now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  industry = EXCLUDED.industry,
  website = EXCLUDED.website,
  description = EXCLUDED.description;

-- Two investors (run once; re-run may create duplicates)
INSERT INTO public.kyi_investors (company_id, full_name, firm, title, location, created_at, updated_at)
SELECT 2, 'Nicholas Griffin', 'DW Griffin Capital', 'Partner', 'Austin, TX', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.kyi_investors WHERE company_id = 2 AND full_name = 'Nicholas Griffin');

INSERT INTO public.kyi_investors (company_id, full_name, firm, title, location, created_at, updated_at)
SELECT 2, 'Seamus Walsh', 'DW Griffin Capital', 'Principal', 'Austin, TX', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.kyi_investors WHERE company_id = 2 AND full_name = 'Seamus Walsh');

-- Geo targeting: Austin, TX, 50 mi radius (approx bbox)
INSERT INTO public.kyi_client_geo_settings (
  client_id, location_label, center_lat, center_lng, radius_miles,
  bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, updated_at
)
VALUES (
  2,
  'Austin, TX',
  30.2672, -97.7431,
  50,
  29.5430, 30.9914, -98.5782, -96.9080,
  now()
)
ON CONFLICT (client_id) DO UPDATE SET
  location_label = EXCLUDED.location_label,
  center_lat = EXCLUDED.center_lat,
  center_lng = EXCLUDED.center_lng,
  radius_miles = EXCLUDED.radius_miles,
  bbox_min_lat = EXCLUDED.bbox_min_lat,
  bbox_max_lat = EXCLUDED.bbox_max_lat,
  bbox_min_lng = EXCLUDED.bbox_min_lng,
  bbox_max_lng = EXCLUDED.bbox_max_lng,
  updated_at = now();
