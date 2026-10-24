import { useEffect, useMemo, useState } from 'react';
import { Check, Search, Send, Users } from 'lucide-react';
import Modal from '@/Components/Modal';
import { api } from '@/lib/api';

/**
 * Pick one or more chats (students and study groups) and POST them to `url`.
 * Used to forward a chat message and to share a file from Notes & Files.
 */
export default function ForwardModal({ url, title = 'Forward to…', onClose }) {
    const [targets, setTargets] = useState(null);
    const [picked, setPicked] = useState({ u: [], g: [] });
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let dead = false;
        api('GET', route('messages.forward.targets'))
            .then((t) => { if (!dead) setTargets(t); })
            .catch(() => { if (!dead) setError('Could not load your chats.'); });
        return () => { dead = true; };
    }, []);

    const needle = q.trim().toLowerCase();
    const users = useMemo(() => (targets?.users ?? []).filter((u) => u.name.toLowerCase().includes(needle)), [targets, needle]);
    const groups = useMemo(() => (targets?.groups ?? []).filter((g) => g.title.toLowerCase().includes(needle)), [targets, needle]);
    const total = picked.u.length + picked.g.length;
    const toggle = (kind, id) => setPicked((p) => ({ ...p, [kind]: p[kind].includes(id) ? p[kind].filter((x) => x !== id) : [...p[kind], id] }));

    const send = async () => {
        if (!total || busy) return;
        setBusy(true); setError('');
        try {
            const r = await api('POST', url, { user_ids: picked.u, group_ids: picked.g });
            setDone(r.count);
            setTimeout(onClose, 1100);
        } catch (e) {
            let msg = 'Could not send. Try again.';
            try { const j = await e.json(); msg = j.message || msg; } catch { /* keep default */ }
            setError(msg); setBusy(false);
        }
    };

    const Row = ({ active, onClick, children }) => (
        <button type="button" onClick={onClick} aria-pressed={active}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm ${active ? 'bg-hunter-100' : 'hover:bg-gray-50'}`}>
            {children}
            <span className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full border ${active ? 'border-hunter-700 bg-hunter-700 text-white' : 'border-gray-300'}`}>
                {active && <Check size={12} aria-hidden="true" />}
            </span>
        </button>
    );

    return (
        <Modal show onClose={onClose} maxWidth="md">
            <div className="p-5">
                <h3 className="mb-3 truncate text-lg font-semibold">{title}</h3>
                <div className="relative mb-3">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students or groups" aria-label="Search"
                        className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-hunter-700 focus:ring-hunter-700" />
                </div>
                <div className="max-h-72 space-y-3 overflow-y-auto">
                    {!targets && !error && <p className="py-6 text-center text-sm text-gray-500">Loading…</p>}
                    {targets && groups.length === 0 && users.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No chats found. Join a circle to start chatting.</p>}
                    {groups.length > 0 && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Study groups</p>
                        {groups.map((g) => (
                            <Row key={`g${g.id}`} active={picked.g.includes(g.id)} onClick={() => toggle('g', g.id)}>
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hunter-100 text-hunter-700"><Users size={15} aria-hidden="true" /></span>
                                <span className="min-w-0 truncate">{g.title}</span>
                            </Row>
                        ))}</div>}
                    {users.length > 0 && <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Students</p>
                        {users.map((u) => (
                            <Row key={`u${u.id}`} active={picked.u.includes(u.id)} onClick={() => toggle('u', u.id)}>
                                <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                                <span className="min-w-0 truncate">{u.name}</span>
                            </Row>
                        ))}</div>}
                </div>
                {error && <p role="alert" className="mt-3 text-sm text-raspberry-600">{error}</p>}
                {done !== null && <p role="status" className="mt-3 text-sm font-medium text-hunter-700">Sent to {done} {done === 1 ? 'chat' : 'chats'}.</p>}
                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-cool-100">Cancel</button>
                    <button type="button" onClick={send} disabled={!total || busy || done !== null}
                        className="inline-flex items-center gap-2 rounded-lg bg-hunter-700 px-4 py-2 text-sm font-semibold text-white hover:bg-hunter-800 disabled:opacity-50">
                        <Send size={14} aria-hidden="true" /> Send{total > 0 && ` (${total})`}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
