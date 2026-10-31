import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import { Check, File as FileIcon, Search, X } from 'lucide-react';
import { api } from '@/lib/api';

export function Dialog({ title, onClose, children }) {
    useEffect(() => {
        const h = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title}
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[#F5EFE6] text-[#0A1F44] shadow-2xl">
                <header className="flex items-center justify-between border-b border-black/10 px-4 py-3">
                    <h2 className="font-semibold">{title}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-black/10"><X size={18} /></button>
                </header>
                {children}
            </div>
        </div>
    );
}

const SearchBox = ({ value, onChange, placeholder }) => (
    <div className="relative border-b border-black/10 p-3">
        <Search size={15} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#0B8A94] focus:outline-none" />
    </div>
);

/** Pick study groups and people to forward one message to. */
export function ForwardDialog({ message, onClose }) {
    const [data, setData] = useState(null);
    const [groups, setGroups] = useState([]), [users, setUsers] = useState([]);
    const [filter, setFilter] = useState(''), [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        api('GET', route('messages.targets', {}, false)).then((d) => alive && setData(d)).catch(() => alive && setData({ groups: [], people: [] }));
        return () => { alive = false; };
    }, []);

    const toggle = (list, set, id) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    const f = filter.trim().toLowerCase();
    const shownG = (data?.groups ?? []).filter((g) => g.title.toLowerCase().includes(f));
    const shownP = (data?.people ?? []).filter((p) => p.name.toLowerCase().includes(f));
    const picked = groups.length + users.length;

    const send = () => {
        setBusy(true);
        router.post(route('messages.forward', message.id), { groups, users }, { preserveScroll: true, onSuccess: onClose, onFinish: () => setBusy(false) });
    };

    const Row = ({ on, onClick, img, label }) => (
        <button type="button" onClick={onClick} aria-pressed={on} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-black/5">
            {img ? <img src={img} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#12315F] text-xs font-bold text-white">{label[0]}</span>}
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? 'border-[#0B8A94] bg-[#0B8A94] text-white' : 'border-gray-400'}`}>{on && <Check size={12} />}</span>
        </button>
    );

    return (
        <Dialog title="Forward message" onClose={onClose}>
            <p className="mx-4 mt-3 truncate rounded-lg bg-black/5 px-3 py-2 text-xs text-gray-600">
                {message.body ? `“${message.body}”` : `📎 ${message.attachment_name ?? 'Attachment'}`}
            </p>
            <SearchBox value={filter} onChange={setFilter} placeholder="Search groups and people" />
            <div className="min-h-[8rem] flex-1 overflow-y-auto p-2">
                {data === null && <p className="p-3 text-sm text-gray-500">Loading…</p>}
                {shownG.length > 0 && <p className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Study groups</p>}
                {shownG.map((g) => <Row key={`g${g.id}`} on={groups.includes(g.id)} onClick={() => toggle(groups, setGroups, g.id)} img={g.cover_url} label={g.title} />)}
                {shownP.length > 0 && <p className="px-2 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">People</p>}
                {shownP.map((p) => <Row key={`u${p.id}`} on={users.includes(p.id)} onClick={() => toggle(users, setUsers, p.id)} img={p.avatar_url} label={p.name} />)}
                {data && shownG.length + shownP.length === 0 && <p className="p-3 text-sm text-gray-500">No chats match.</p>}
            </div>
            <footer className="border-t border-black/10 p-3">
                <button type="button" onClick={send} disabled={!picked || busy} className="w-full rounded-lg bg-[#2EC4B6] py-2.5 text-sm font-bold text-[#0A1F44] hover:brightness-95 disabled:opacity-50">
                    {busy ? 'Forwarding…' : picked ? `Forward to ${picked} chat${picked > 1 ? 's' : ''}` : 'Choose a chat'}
                </button>
            </footer>
        </Dialog>
    );
}

const bytes = (b) => (b ? (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.ceil(b / 1e3)} KB`) : '');

/** Send a file that is already in Notes & Files into this chat. */
export function FilePickerDialog({ dest, onClose }) {
    const [items, setItems] = useState(null), [filter, setFilter] = useState(''), [busy, setBusy] = useState(null);

    useEffect(() => {
        let alive = true;
        api('GET', route('messages.files', {}, false)).then((d) => alive && setItems(d)).catch(() => alive && setItems([]));
        return () => { alive = false; };
    }, []);

    const share = (file) => {
        setBusy(file.id);
        router.post(route('messages.share'), { note_file_id: file.id, ...dest }, { preserveScroll: true, onSuccess: onClose, onFinish: () => setBusy(null) });
    };
    const shown = (items ?? []).filter((i) => i.title.toLowerCase().includes(filter.trim().toLowerCase()));

    return (
        <Dialog title="Share from Notes & Files" onClose={onClose}>
            <SearchBox value={filter} onChange={setFilter} placeholder="Search your files" />
            <div className="min-h-[8rem] flex-1 overflow-y-auto p-2">
                {items === null && <p className="p-3 text-sm text-gray-500">Loading…</p>}
                {items && shown.length === 0 && <p className="p-3 text-sm text-gray-500">{items.length ? 'No files match.' : 'You have no uploaded files yet. Add some in Notes & Files.'}</p>}
                {shown.map((i) => (
                    <button key={i.id} type="button" onClick={() => share(i)} disabled={busy !== null} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-60">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#12315F] text-[#2EC4B6]"><FileIcon size={16} /></span>
                        <span className="min-w-0 flex-1"><b className="block truncate font-medium">{i.title}</b><span className="block truncate text-xs text-gray-500">{i.group} · {i.kind} · {bytes(i.size)}</span></span>
                        <span className="text-xs font-semibold text-[#0B8A94]">{busy === i.id ? 'Sending…' : 'Send'}</span>
                    </button>
                ))}
            </div>
        </Dialog>
    );
}
