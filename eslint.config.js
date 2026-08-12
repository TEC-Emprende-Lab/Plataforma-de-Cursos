// ============================================================
//  eslint.config.js — Configuración "suave".
//  Solo marca ERRORES reales que pueden romper la app
//  (variables sin definir, await mal puesto, hooks mal usados…).
//  El estilo y las preferencias quedan desactivados para no
//  generar ruido sobre el código existente.
// ============================================================

import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  // Ignorar artefactos y dependencias
  { ignores: ['dist/**', 'node_modules/**', '.venv/**', 'venv/**', 'backend/**', '*.config.js'] },

  // Reglas recomendadas base de JS
  js.configs.recommended,

  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // ── Errores reales (rompen o casi rompen la app) ──
      'no-undef': 'error',                    // variable sin definir / import faltante / typo
      'react-hooks/rules-of-hooks': 'error',  // hooks mal usados
      'no-const-assign': 'error',             // reasignar una const
      'no-dupe-keys': 'error',                // claves duplicadas en objeto
      'no-unreachable': 'error',              // código muerto tras return
      'no-cond-assign': 'error',              // = en vez de == por error

      // JSX: marcar como "usados" los componentes referenciados en JSX
      // (evita falsos "sin uso" en imports de componentes)
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',  // React 17+ no necesita estar en scope

      // ── Avisos útiles, NO bloqueantes (modo suave) ──
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      'react-hooks/exhaustive-deps': 'warn',

      // ── Apagados: estilo / preferencias / falsos positivos de JSX ──
      'react/prop-types': 'off',  // no usamos PropTypes
      'react/react-in-jsx-scope': 'off',  // React 17+ no lo requiere
      'no-empty': 'off',          // catch {} vacíos intencionales
    },
  },
]
