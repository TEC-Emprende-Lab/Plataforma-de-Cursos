# E2E Tests

Estos tests requieren un entorno aislado (Supabase local + backend Flask local) y NO deben ejecutarse contra producción.

## Configuración recomendada
- Usar [Playwright](https://playwright.dev/)
- Levantar entorno con `docker compose up` (Postgres/Redis/backend/frontend)
- Configurar variables de entorno de test
- Ejecutar: `npm run test:e2e`

## Casos a cubrir
- [ ] Login con credenciales de test
- [ ] Listado de participantes/cursos/etiquetas
- [ ] Generación de certificado individual
- [ ] Generación por lote CSV
- [ ] Importación/exportación
- [ ] Filtros y revocación automática
