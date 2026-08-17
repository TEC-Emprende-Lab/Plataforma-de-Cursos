import React from 'react'
import ReactDOM from 'react-dom/client'
import { validateConfig } from './lib/config.js'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import './styles/global.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

const config = validateConfig()

if (!config.valid) {
  root.render(
    <div className="config-error">
      <div className="config-error__card">
        <h1>Error de configuración</h1>

        <p>
          La aplicación no puede iniciarse porque la configuración
          del entorno es incorrecta.
        </p>

        <div className="config-error__details">
          <strong>Detalle:</strong>
          <pre>{config.message}</pre>
        </div>

        <p>
          Revise las variables de entorno y reinicie la aplicación.
        </p>
      </div>
    </div>
  )
} else {
  import('./App.jsx')
    .then(({ default: App }) => {
      root.render(
        <React.StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </React.StrictMode>
      )
    })
    .catch((error) => {
      console.error('[main] Error al iniciar la aplicación:', error)

      root.render(
        <div className="config-error">
          <div className="config-error__card">
            <h1>Error al iniciar la aplicación</h1>

            <p>
              Ocurrió un error inesperado durante la inicialización.
            </p>

            <div className="config-error__details">
              <strong>Detalle:</strong>
              <pre>{error.message}</pre>
            </div>
          </div>
        </div>
      )
    })
}