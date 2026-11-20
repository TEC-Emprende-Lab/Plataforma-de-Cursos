# Pruebas E2E

**Estado: pendiente.** Todavía no hay un runner ni un entorno aislado
configurado. `npm run test:e2e` termina con error a propósito para no dar la
apariencia de que las pruebas E2E pasan.

`tests/e2e/**` está excluido de Vitest en `vite.config.js`: las pruebas unitarias
no deben ejecutar pruebas de navegador.

## Para implementarlas

1. Instalar `@playwright/test` y fijarlo en `package.json`/`package-lock.json`.
2. Crear `playwright.config.js` con una base URL configurable y un entorno
   aislado: Supabase local y el backend Flask local levantados con
   `docker compose up`. **Nunca** ejecutarlas contra producción.
3. Cambiar `test:e2e` en `package.json` por `playwright test` y añadir un job
   separado en CI si el entorno aislado puede reproducirse allí.
4. Añadir un archivo `*.spec.js` dentro de `tests/e2e/` con los casos de abajo.

## Casos a cubrir

- [ ] Login con credenciales de prueba.
- [ ] Listado de participantes, cursos y etiquetas.
- [ ] Generación de certificado individual.
- [ ] Generación por lote desde CSV.
- [ ] Importación y exportación.
- [ ] Filtros y revocación automática.
