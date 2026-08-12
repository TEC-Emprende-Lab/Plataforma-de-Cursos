-- 1. Tabla
CREATE TABLE IF NOT EXISTS svg_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  file_name     text        NOT NULL,
  style         text        NOT NULL DEFAULT 'Personalizado',
  course        text        NOT NULL DEFAULT 'Todos los programas',
  tags          text[]      NOT NULL DEFAULT '{}',
  colors        text[]      NOT NULL DEFAULT '{}',
  name_id       text        NOT NULL DEFAULT 'recipient_name',
  date_id       text        NOT NULL DEFAULT 'issue_date',
  storage_path  text,
  is_builtin    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS svg_templates_name_idx ON svg_templates(name);

ALTER TABLE svg_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de plantillas" ON svg_templates;
CREATE POLICY "Lectura pública de plantillas"
  ON svg_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Solo usuarios autenticados insertan" ON svg_templates;
CREATE POLICY "Solo usuarios autenticados insertan"
  ON svg_templates FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Solo usuarios autenticados eliminan sus plantillas" ON svg_templates;
CREATE POLICY "Solo usuarios autenticados eliminan sus plantillas"
  ON svg_templates FOR DELETE
  TO authenticated USING (true);

-- 2. Bucket
INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  'certificate-templates',
  'certificate-templates',
  true,
  ARRAY['image/svg+xml', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

-- 3. Políticas storage
DROP POLICY IF EXISTS "SVG públicos para lectura" ON storage.objects;
CREATE POLICY "SVG públicos para lectura"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificate-templates');

DROP POLICY IF EXISTS "Autenticados suben SVG" ON storage.objects;
CREATE POLICY "Autenticados suben SVG"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificate-templates');

DROP POLICY IF EXISTS "Autenticados eliminan SVG" ON storage.objects;
CREATE POLICY "Autenticados eliminan SVG"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'certificate-templates');;
