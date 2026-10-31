import '../css/app.css';
import '../css/studyhub-theme.css';


import { Component } from 'react';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
const reloadKey = 'studyhub:error-reload-at';

function reloadAfterError() {
    try {
        const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
        if (Date.now() - lastReload < 10000) return;
        sessionStorage.setItem(reloadKey, String(Date.now()));
    } catch (error) {
        console.warn('Could not store the error recovery state', error);
    }
    window.location.reload();
}

router.on('invalid', (event) => {
    event.preventDefault();
    reloadAfterError();
});

router.on('exception', (event) => {
    event.preventDefault();
    reloadAfterError();
});

class AppErrorBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.error('Page rendering failed; reloading the application.', error);
        reloadAfterError();
    }

    render() {
        return this.state.failed
            ? <main role="status" className="p-6 text-center text-sm text-gray-600">Something went wrong. Reloading the page…</main>
            : this.props.children;
    }
}

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<AppErrorBoundary><App {...props} /></AppErrorBoundary>);
    },
    progress: {
        color: '#4B5563',
    },

    
});

if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
    }
