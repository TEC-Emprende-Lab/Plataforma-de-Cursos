// ============================================================
//  config.js — Fuente única de URLs/configuración externa.
//  Centralizar acá evita repetir direcciones en varios archivos:
//  si cambia el backend o una API, se edita SOLO este archivo.
// ============================================================

// Backend Flask de generación de certificados
// Configurable por build: VITE_CERT_API_URL
export const CERT_API =
  import.meta.env.VITE_CERT_API_URL ||
  'https://plataforma-de-cursos-1-l606.onrender.com'

// API pública de Hacienda CR para consultar nombre por cédula/DIMEX
export const HACIENDA_API = 'https://apis.gometa.org/cedulas'
