-- Plantillas SVG: lectura pública, escrituras únicamente desde el backend
-- confiable usando la service role después de validar JWT y contenido.

create table if not exists public.svg_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_name text not null,
  style text not null default 'Personalizado',
  course text not null default 'Todos los programas',
  tags text[] not null default '{}',
  colors text[] not null default '{}',
  name_id text not null default 'recipient_name',
  date_id text not null default 'issue_date',
  storage_path text,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists svg_templates_name_idx on public.svg_templates(name);
alter table public.svg_templates enable row level security;

drop policy if exists "Lectura pública de plantillas" on public.svg_templates;
drop policy if exists "Solo usuarios autenticados insertan" on public.svg_templates;
drop policy if exists "Solo usuarios autenticados eliminan sus plantillas" on public.svg_templates;
create policy "Lectura pública de plantillas"
  on public.svg_templates for select
  to anon, authenticated
  using (true);

grant select on public.svg_templates to anon, authenticated;
revoke insert, update, delete on public.svg_templates from anon, authenticated;

insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'certificate-templates',
  'certificate-templates',
  true,
  array['image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "SVG públicos para lectura" on storage.objects;
drop policy if exists "Autenticados suben SVG" on storage.objects;
drop policy if exists "Autenticados eliminan SVG" on storage.objects;
create policy "SVG públicos para lectura"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'certificate-templates');
