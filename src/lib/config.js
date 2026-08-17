const storageMode = import.meta.env.VITE_STORAGE_MODE
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export function validateConfig() {
  if (!storageMode) {
    return {
      valid: false,
      message:
        'VITE_STORAGE_MODE no está configurado. Debe ser "supabase" o "local".',
    }
  }

  if (storageMode !== 'supabase' && storageMode !== 'local') {
    return {
      valid: false,
      message:
        `VITE_STORAGE_MODE inválido: "${storageMode}". Debe ser "supabase" o "local".`,
    }
  }

  if (storageMode === 'local' && import.meta.env.PROD) {
    return {
      valid: false,
      message:
        'El modo local no está permitido en producción.',
    }
  }

  if (storageMode === 'supabase' && (!url || !key)) {
    return {
      valid: false,
      message:
        'Supabase no está configurado. VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son obligatorias.',
    }
  }

  return {
    valid: true,
    message: null,
  }
}

export { storageMode }