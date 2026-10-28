-- Añadir metadata explícita para plantillas (Fase 5)
-- Compatible con plantillas existentes (valores por defecto/nulos)

alter table public.svg_templates
  add column if not exists template_key text,
  add column if not exists fields jsonb,
  add column if not exists version integer default 1,
  add column if not exists metadata jsonb;

-- Índice para búsquedas por clave
create index if not exists svg_templates_key_idx on public.svg_templates(template_key);

-- Comentarios informativos
comment on column public.svg_templates.template_key is 'Clave explícita para detección de tipo de certificado';
comment on column public.svg_templates.fields is 'Metadatos de campos detectados/mapeados';
comment on column public.svg_templates.version is 'Versión de metadata';
comment on column public.svg_templates.metadata is 'Metadatos adicionales extendidos';
