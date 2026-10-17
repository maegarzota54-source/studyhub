// Tiny JSON helper for the live endpoints (uses Laravel's XSRF cookie).
const xsrf = () => decodeURIComponent((document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN=')) || '').split('=').slice(1).join('=') || '');

export function api(method, url, body) {
    return fetch(url, {
        method, credentials: 'same-origin', keepalive: method !== 'GET',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': xsrf() },
        body: body ? JSON.stringify(body) : undefined,
    }).then((r) => (r.ok ? r.json() : Promise.reject(r)));
}
