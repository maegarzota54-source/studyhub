import { api } from '@/lib/api';

// One shared poller for every <ActiveBadge /> on the page.
let state = {}, timer = null;
const listeners = new Set();

async function load() {
    try { state = await api('GET', route('groups.activity', {}, false)); listeners.forEach((l) => l()); } catch (e) { /* offline: keep last state */ }
}

export function subscribe(listener) {
    listeners.add(listener);
    if (!timer) { load(); timer = setInterval(load, 10000); }
    return () => {
        listeners.delete(listener);
        if (!listeners.size) { clearInterval(timer); timer = null; }
    };
}
export const getActivity = (id) => state[id];
