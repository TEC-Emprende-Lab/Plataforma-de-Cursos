import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="config-error">
          <div className="config-error__card">
            <h1>Error de configuración</h1>

            <p>
              La aplicación no pudo iniciar correctamente debido a
              un problema con la configuración del entorno.
            </p>

            <div className="config-error__details">
              <strong>Detalle:</strong>
              <pre>{this.state.error?.message}</pre>
            </div>

            <p>
              Revise las variables de entorno y reinicie la aplicación.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}