/**
 * Phase 3: who is online right now.
 * - "ping" source: every open page tells the server "I'm here" every 30s and gets back the online ids.
 *   It needs no websocket server, so it works even when Reverb is off.
 * - "echo" source: the live presence channel, if Laravel Echo is set up (optional, makes it instant).
 * Both are merged into window.__online (a Set of user ids). Components listen for the 'presence' event.
 */
const sources = { ping: new Set(), echo: new Set() };

function publish() {
  window.__online = new Set([...sources.ping, ...sources.echo]);
  window.dispatchEvent(new Event('presence'));
}
export const setPing = (ids) => { sources.ping = new Set(ids); publish(); };
export const setEcho = (ids) => { sources.echo = new Set(ids); publish(); };

const xsrf = () => decodeURIComponent((document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/) || [])[1] || '');

export async function ping() {
  try {
    const res = await fetch(route('presence.ping', {}, false), {
      method: 'POST', credentials: 'same-origin',
      headers: { 'X-XSRF-TOKEN': xsrf(), Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (res.ok) setPing((await res.json()).online ?? []);
  } catch { /* offline or server restarting: try again on the next beat */ }
}

/** Starts pinging; returns a function that stops it. */
export function startHeartbeat() {
  ping();
  const timer = setInterval(() => { if (!document.hidden) ping(); }, 30000);
  const onVisible = () => { if (!document.hidden) ping(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
}
