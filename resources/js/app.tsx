import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

const appName = import.meta.env.VITE_APP_NAME || 'ez.wiki';

// Global route polyfill for Ziggy
const routeMap: Record<string, string> = {
    home: '/',
    welcome: '/',
    login: '/login',
    register: '/register',
    logout: '/logout',
    dashboard: '/dashboard',
    marketplace: '/marketplace',
    templatemarketplace: '/templatemarketplace',
    'profile.edit': '/settings/profile',
    'profile.destroy': '/settings/profile',
    'profile.update': '/settings/profile',
    password: '/settings/password',
    appearance: '/settings/appearance',
};

if (typeof window !== 'undefined') {
    if (!(window as any).auth) {
        (window as any).auth = { user: null };
    }
    const routeFn = (name?: string, _params?: any) => {
        if (!name) return { current: () => false };
        if (routeMap[name]) return routeMap[name];
        return `/${name.replace(/\./g, '/')}`;
    };
    routeFn.current = (_name?: string) => false;
    (window as any).route = routeFn;
}

// Fallback initial page for standalone mounting
let appEl = document.getElementById('app');
if (!appEl) {
    appEl = document.createElement('div');
    appEl.id = 'app';
    document.body.appendChild(appEl);
}

if (!appEl.dataset.page) {
    const pathname = window.location.pathname || '/';
    if (pathname.startsWith('/X/')) {
        const slug = decodeURIComponent(pathname.replace(/^\/X\//, '').split('?')[0]);
        appEl.dataset.page = JSON.stringify({
            component: 'AISearchView',
            props: {
                search: {
                    id: 1,
                    slug,
                    conversation_id: 'conv_' + slug,
                    thread_id: 'thread_' + slug,
                    conversation_title: slug,
                    message_role: 'user',
                    content_type: 'social_media_post',
                    query: '',
                    response: '',
                    sources: [],
                    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                    thinking_enabled: false,
                    model: 'gemini',
                    temperature: 0.7,
                    max_tokens: 1000,
                    finish_reason: 'stop',
                    created_at: new Date().toISOString(),
                    created_at_formatted: new Date().toLocaleString(),
                    updated_at: new Date().toISOString(),
                    share_url: `/X/${encodeURIComponent(slug)}`,
                    conversation_url: `/X/${encodeURIComponent(slug)}`,
                    total_tokens: 0,
                    conversation_tokens: 0,
                    conversation_cost: 0,
                    status: 'public',
                    format: 'ezsheet',
                    social_media_metadata: {
                        format: 'ezsheet',
                        wall_id: slug,
                    },
                },
                conversation_messages: [],
                message_count: 0,
                share_url: `/X/${encodeURIComponent(slug)}`,
                related_searches: [],
                domains: [
                    { id: 1, domain: 'ez.wiki' },
                    { id: 2, domain: 'oki.wiki' },
                    { id: 3, domain: 'ez3d.ai' },
                ],
                auth: { user: null },
            },
            url: pathname,
            version: '',
        });
    } else {
        appEl.dataset.page = JSON.stringify({
            component: 'ezbar',
            props: {
                auth: { user: { id: 1, name: 'SUJIT DAS', email: 'indianstory555@gmail.com' } },
                domains: [
                    { id: 1, domain: 'ez.wiki' },
                    { id: 2, domain: 'oki.wiki' },
                    { id: 3, domain: 'ez3d.ai' },
                ],
                tooltips: {},
                autoSearchKeyword: 'love',
                topcontent: [
                    {
                        title: 'New Self Improving Hyper Agents',
                        subtitle: 'AI Revolution',
                        company: 'Meta',
                        badge: 'INTRODUCING',
                        headline: 'HYPER AGENTS',
                        url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
                    },
                ],
                bottomcontent: [],
                aiSettings: {
                    guest_ai_enabled: true,
                    guest_char_limit: 1000,
                    user_ai_enabled: true,
                    user_char_limit: 5000,
                },
            },
            url: pathname,
            version: '',
        });
    }
}

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
