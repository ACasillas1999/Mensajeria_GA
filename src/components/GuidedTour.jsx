import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import Shepherd from 'shepherd.js';

const GuidedTour = forwardRef(({ onTourComplete }, ref) => {
  const tourRef = useRef(null);
  const [mode, setMode] = useState('client');

  // Detect current app mode from DOM
  useEffect(() => {
    const detectMode = () => {
      if (typeof document !== 'undefined') {
        const currentMode = document.documentElement.dataset.appMode || 'client';
        setMode(currentMode);
      }
    };

    detectMode();

    // Listen for mode changes
    const handleModeChange = (event) => {
      setMode(event.detail.mode);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('app-mode-change', handleModeChange);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('app-mode-change', handleModeChange);
      }
    };
  }, []);

  // Expose startTour method to parent components
  useImperativeHandle(ref, () => ({
    startTour: () => {
      if (tourRef.current) {
        tourRef.current.start();
      }
    }
  }));

  useEffect(() => {
    // Define tour steps based on mode
    const steps = mode === 'client' ? getClientModeSteps() : getInternalModeSteps();

    // Initialize Shepherd tour
    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: {
          enabled: true
        },
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' }
      }
    });

    // Add steps to tour
    steps.forEach(step => tour.addStep(step));

    // Handle tour completion
    tour.on('complete', () => {
      localStorage.setItem('mensajeria-tour-completed', 'true');
      if (onTourComplete) {
        onTourComplete();
      }
    });

    // Handle tour cancellation
    tour.on('cancel', () => {
      if (onTourComplete) {
        onTourComplete();
      }
    });

    tourRef.current = tour;

    // Expose startTour globally
    if (typeof window !== 'undefined') {
      window.__startGuidedTour = () => {
        if (tourRef.current) {
          tourRef.current.start();
        }
      };
    }

    // Cleanup on unmount
    return () => {
      if (tour) {
        tour.complete();
      }
      if (typeof window !== 'undefined') {
        delete window.__startGuidedTour;
      }
    };
  }, [mode, onTourComplete]);

  return null; // This component doesn't render anything
});

GuidedTour.displayName = 'GuidedTour';

// Client Mode Tour Steps
function getClientModeSteps() {
  return [
    {
      id: 'welcome',
      title: '¡Bienvenido! 👋',
      text: `
        <p>Te damos la bienvenida al sistema de mensajería.</p>
        <p>Este tour te mostrará cómo usar las funciones principales.</p>
        <p><strong>Duración:</strong> Aproximadamente 1 minuto</p>
      `,
      buttons: [
        {
          text: 'Saltar',
          classes: 'shepherd-button-secondary',
          action() {
            this.cancel();
          }
        },
        {
          text: 'Comenzar Tour',
          classes: 'shepherd-button-primary',
          action() {
            this.next();
          }
        }
      ]
    },
    {
      id: 'mode-toggle',
      title: 'Cambio de Modo',
      text: `
        <p>Este botón te permite cambiar entre dos modos:</p>
        <p>🟢 <strong>Modo Cliente:</strong> Para atender conversaciones con clientes</p>
        <p>🔵 <strong>Modo Interno:</strong> Para chat con tu equipo</p>
      `,
      attachTo: {
        element: '[data-tour="mode-toggle"]',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Atrás',
          classes: 'shepherd-button-secondary',
          action() {
            this.back();
          }
        },
        {
          text: 'Siguiente',
          classes: 'shepherd-button-primary',
          action() {
            this.next();
          }
        }
      ]
    },
    {
      id: 'conversations',
      title: 'Panel de Conversaciones',
      text: `
        <p>Aquí verás todas tus conversaciones activas.</p>
        <p>💡 <strong>Tip:</strong> Haz clic en cualquier conversación para abrirla y ver los mensajes.</p>
        <p>Las conversaciones con mensajes nuevos aparecen resaltadas.</p>
      `,
      attachTo: {
        element: '.h-full.flex.flex-col.bg-white',
        on: 'right'
      },
      buttons: [
        {
          text: 'Atrás',
          classes: 'shepherd-button-secondary',
          action() {
            this.back();
          }
        },
        {
          text: 'Siguiente',
          classes: 'shepherd-button-primary',
          action() {
            this.next();
          }
        }
      ]
    },
    {
      id: 'finish',
      title: '¡Listo! 🎉',
      text: `
        <p>Ya conoces lo básico del sistema de mensajería.</p>
        <p><strong>Próximos pasos:</strong></p>
        <p>1. Selecciona una conversación del panel izquierdo</p>
        <p>2. Lee los mensajes en el área central</p>
        <p>3. Escribe tu respuesta y presiona Enter</p>
        <p>💡 Puedes volver a ver este tour haciendo clic en el botón <strong>?</strong> en la barra superior.</p>
      `,
      buttons: [
        {
          text: 'Finalizar',
          classes: 'shepherd-button-primary',
          action() {
            this.complete();
          }
        }
      ]
    }
  ];
}

// Internal Mode Tour Steps
function getInternalModeSteps() {
  return [
    {
      id: 'welcome-internal',
      title: 'Modo Interno 💼',
      text: `
        <p>Bienvenido al <strong>Modo Interno</strong>, diseñado para la comunicación entre tu equipo.</p>
        <p>Aquí podrás enviar mensajes a tus compañeros de trabajo de forma rápida y eficiente.</p>
      `,
      buttons: [
        {
          text: 'Saltar',
          classes: 'shepherd-button-secondary',
          action() {
            this.cancel();
          }
        },
        {
          text: 'Comenzar',
          classes: 'shepherd-button-primary',
          action() {
            this.next();
          }
        }
      ]
    },
    {
      id: 'internal-directory',
      title: 'Directorio de Contactos',
      text: `
        <p>Este es tu directorio de contactos internos.</p>
        <p>Aquí verás a todos los miembros de tu equipo y podrás iniciar conversaciones con ellos.</p>
        <p>Los contactos en línea aparecen con un indicador verde.</p>
      `,
      attachTo: {
        element: '[data-tour="internal-directory"]',
        on: 'right'
      },
      buttons: [
        {
          text: 'Atrás',
          classes: 'shepherd-button-secondary',
          action() {
            this.back();
          }
        },
        {
          text: 'Siguiente',
          classes: 'shepherd-button-primary',
          action() {
            this.next();
          }
        }
      ]
    },
    {
      id: 'internal-messaging',
      title: 'Mensajería Interna',
      text: `
        <p>Los mensajes internos funcionan igual que los mensajes con clientes.</p>
        <p>Escribe tu mensaje y presiona Enter para enviar.</p>
        <p>Ideal para coordinación rápida con tu equipo.</p>
      `,
      attachTo: {
        element: '[data-tour="message-input"]',
        on: 'top'
      },
      buttons: [
        {
          text: 'Atrás',
          classes: 'shepherd-button-secondary',
          action() {
            this.back();
          }
        },
        {
          text: 'Siguiente',
          classes: 'shepherd-button-primary',
          action() {
            this.next();
          }
        }
      ]
    },
    {
      id: 'switch-back',
      title: 'Cambiar de Modo',
      text: `
        <p>Recuerda que puedes volver al <strong>Modo Cliente</strong> en cualquier momento usando el botón de cambio de modo.</p>
        <p>Así podrás alternar fácilmente entre atender clientes y comunicarte con tu equipo.</p>
      `,
      attachTo: {
        element: '[data-tour="mode-toggle"]',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Atrás',
          classes: 'shepherd-button-secondary',
          action() {
            this.back();
          }
        },
        {
          text: 'Finalizar',
          classes: 'shepherd-button-primary',
          action() {
            this.complete();
          }
        }
      ]
    }
  ];
}

export default GuidedTour;
