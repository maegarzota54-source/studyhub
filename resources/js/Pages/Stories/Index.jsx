import { useCallback, useEffect, useRef, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Camera, Eye, Globe, Lock, Plus, Trash2, Users, X } from 'lucide-react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';
import Modal from '@/Components/Modal';
import resizeImage from '@/utils/resizeImage';
import { api } from '@/lib/api';

const STORY_MS = 5000;
const AUDIENCES = {
    public: { label: 'Public', hint: 'Every StudyHub student can see it', Icon: Globe },
    specific: { label: 'Specific people', hint: 'Only the students you choose', Icon: Users },
    private: { label: 'Only me', hint: 'Just you, like a private photo', Icon: Lock },
};

function AudienceBadge({ audience, className = '' }) {
    const { label, Icon } = AUDIENCES[audience] ?? AUDIENCES.public;
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}><Icon size={11} aria-hidden="true" /> {label}</span>;
}

/** Pop-up to post a new story: pick a photo, add a caption, choose who can see it. */
function CreateStory({ contacts, onClose }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [caption, setCaption] = useState('');
    const [audience, setAudience] = useState('public');
    const [ids, setIds] = useState([]);
    const [busy, setBusy] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!file) { setPreview(null); return undefined; }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const toggle = (id) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

    const submit = async (e) => {
        e.preventDefault();
        if (!file || busy) return;
        if (audience === 'specific' && ids.length === 0) { setErrors({ viewer_ids: 'Pick at least one student.' }); return; }
        setBusy(true); setErrors({});
        const image = await resizeImage(file, 1440, 0.85);
        router.post(route('stories.store'), { image, caption, audience, viewer_ids: audience === 'specific' ? ids : [] }, {
            forceFormData: true, preserveScroll: true,
            onSuccess: () => onClose(),
            onError: (errs) => { setErrors(errs); setBusy(false); },
            onCancel: () => setBusy(false),
        });
    };

    return (
        <Modal show onClose={onClose} maxWidth="md">
            <form onSubmit={submit} className="p-5">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">New story</h3>
                    <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                </div>

                <label className="relative flex h-60 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-cool-100 hover:border-hunter-500">
                    {preview ? <img src={preview} alt="Story preview" className="h-full w-full object-contain" />
                        : <span className="flex flex-col items-center gap-2 text-sm text-gray-500"><Camera size={28} aria-hidden="true" /> Choose a photo</span>}
                    <input type="file" accept="image/*" className="sr-only" aria-label="Choose a photo"
                        onChange={(e) => { setFile(e.target.files[0] ?? null); setErrors({}); }} />
                </label>
                {errors.image && <p role="alert" className="mt-1 text-xs text-raspberry-600">{errors.image}</p>}

                <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="Add a caption (optional)" aria-label="Caption" className={`${inputCls} mt-3`} />

                <fieldset className="mt-4">
                    <legend className="mb-1 text-sm font-semibold">Who can see this?</legend>
                    <div className="space-y-1.5">
                        {Object.entries(AUDIENCES).map(([key, { label, hint, Icon }]) => (
                            <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${audience === key ? 'border-hunter-700 bg-hunter-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="audience" value={key} checked={audience === key} onChange={() => setAudience(key)} className="text-hunter-700 focus:ring-hunter-700" />
                                <Icon size={16} aria-hidden="true" className="text-hunter-700" />
                                <span><b className="block">{label}</b><span className="text-xs text-gray-500">{hint}</span></span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                {audience === 'specific' && (
                    <div className="mt-3 rounded-lg border border-gray-200 p-2">
                        {contacts.length === 0 && <p className="p-2 text-sm text-gray-500">Join a circle to pick students.</p>}
                        <div className="max-h-44 overflow-y-auto">
                            {contacts.map((c) => (
                                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50">
                                    <input type="checkbox" checked={ids.includes(c.id)} onChange={() => toggle(c.id)} className="rounded text-hunter-700 focus:ring-hunter-700" />
                                    <img src={c.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                                    <span className="truncate">{c.name}</span>
                                </label>
                            ))}
                        </div>
                        {ids.length > 0 && <p className="px-2 pt-1 text-xs text-gray-500">{ids.length} selected</p>}
                    </div>
                )}
                {errors.viewer_ids && <p role="alert" className="mt-1 text-xs text-raspberry-600">{errors.viewer_ids}</p>}
                {errors.caption && <p role="alert" className="mt-1 text-xs text-raspberry-600">{errors.caption}</p>}

                <p className="mt-3 text-xs text-gray-500">Stories disappear after 24 hours.</p>
                <div className="mt-3 flex justify-end gap-2">
                    <Btn type="button" variant="ghost" onClick={onClose}>Cancel</Btn>
                    <Btn disabled={!file || busy}>{busy ? 'Posting…' : 'Share story'}</Btn>
                </div>
            </form>
        </Modal>
    );
}

/** Full-screen story viewer: tap right/left to move, hold to pause, owners see who viewed. */
function Viewer({ groups, start, onClose }) {
    const [gi, setGi] = useState(start);
    const group = groups[gi];
    const [si, setSi] = useState(() => { const i = group.stories.findIndex((s) => !s.seen); return i >= 0 ? i : 0; });
    const [progress, setProgress] = useState(0);
    const [held, setHeld] = useState(false);
    const [showViewers, setShowViewers] = useState(false);
    const story = group.stories[si];
    const paused = held || showViewers;

    const next = useCallback(() => {
        if (si < group.stories.length - 1) setSi(si + 1);
        else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); }
        else onClose();
    }, [si, gi, group, groups, onClose]);
    const prev = useCallback(() => {
        if (progress > 15 || (si === 0 && gi === 0)) setProgress(0);
        else if (si > 0) setSi(si - 1);
        else { setGi(gi - 1); setSi(groups[gi - 1].stories.length - 1); }
    }, [progress, si, gi, groups]);

    // New story: restart the bar and tell the server it was seen (owners don't count as viewers).
    useEffect(() => {
        setProgress(0); setShowViewers(false);
        if (!group.mine) api('POST', route('stories.view', story.id)).catch(() => {});
    }, [story.id]);   // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (paused) return undefined;
        const t = setInterval(() => setProgress((p) => Math.min(100, p + (50 / STORY_MS) * 100)), 50);
        return () => clearInterval(t);
    }, [paused, story.id]);

    useEffect(() => { if (progress >= 100) next(); }, [progress]);   // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const key = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
        };
        document.addEventListener('keydown', key);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; };
    }, [next, prev, onClose]);

    const remove = () => {
        if (!window.confirm('Delete this story?')) return;
        router.delete(route('stories.destroy', story.id), { preserveScroll: true });
        onClose();
    };

    const hold = { onPointerDown: () => setHeld(true), onPointerUp: () => setHeld(false), onPointerLeave: () => setHeld(false), onPointerCancel: () => setHeld(false) };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black" role="dialog" aria-modal="true" aria-label={`${group.user.name}'s story`}>
            <div className="relative h-full w-full max-w-md bg-black">
                <img src={story.url} alt={story.caption || `Story by ${group.user.name}`} className="h-full w-full select-none object-contain" draggable={false} />

                {/* tap zones */}
                <button type="button" aria-label="Previous story" onClick={prev} {...hold} className="absolute inset-y-16 left-0 w-1/3 cursor-default" />
                <button type="button" aria-label="Next story" onClick={next} {...hold} className="absolute inset-y-16 right-0 w-2/3 cursor-default" />

                <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-3 pb-8">
                    <div className="flex gap-1" aria-hidden="true">
                        {group.stories.map((s, i) => (
                            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded bg-white/30">
                                <div className="h-full bg-white" style={{ width: `${i < si ? 100 : i === si ? progress : 0}%` }} />
                            </div>
                        ))}
                    </div>
                    <div className="pointer-events-auto mt-3 flex items-center gap-2 text-white">
                        <img src={group.user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        <div className="min-w-0 flex-1 text-sm leading-tight">
                            <b className="block truncate">{group.mine ? 'Your story' : group.user.name}</b>
                            <span className="text-xs text-white/70">{story.ago}</span>
                        </div>
                        <AudienceBadge audience={story.audience} className="bg-white/20 text-white" />
                        {group.mine && <button type="button" onClick={remove} aria-label="Delete story" className="rounded-full p-2 hover:bg-white/20"><Trash2 size={18} /></button>}
                        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/20"><X size={20} /></button>
                    </div>
                </div>

                {(story.caption || group.mine) && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10 text-white">
                        {story.caption && <p className="mb-3 whitespace-pre-wrap break-words text-sm">{story.caption}</p>}
                        {group.mine && (
                            <button type="button" onClick={() => setShowViewers((v) => !v)} aria-expanded={showViewers}
                                className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30">
                                <Eye size={15} aria-hidden="true" /> {story.viewers.length} {story.viewers.length === 1 ? 'view' : 'views'}
                            </button>
                        )}
                    </div>
                )}

                {showViewers && (
                    <div className="absolute inset-x-0 bottom-0 z-10 max-h-[55%] overflow-y-auto rounded-t-2xl bg-white p-4 text-slate-900 shadow-xl">
                        <div className="mb-2 flex items-center justify-between">
                            <b>Viewed by {story.viewers.length}</b>
                            <button type="button" onClick={() => setShowViewers(false)} aria-label="Close viewers" className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
                        </div>
                        {story.viewers.length === 0 && <p className="py-4 text-center text-sm text-gray-500">No one has viewed this yet.</p>}
                        {story.viewers.map((v) => (
                            <div key={v.id} className="flex items-center gap-3 py-1.5 text-sm">
                                <img src={v.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                                <span className="min-w-0 flex-1 truncate">{v.name}</span>
                                <span className="text-xs text-gray-400">{v.viewed_at}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Stories({ groups = [], contacts = [] }) {
    const [creating, setCreating] = useState(false);
    const [viewing, setViewing] = useState(null);   // index into groups
    const mine = groups.find((g) => g.mine);
    const closeViewer = () => { setViewing(null); router.reload({ only: ['groups'], preserveScroll: true }); };

    return (
        <AppLayout title="Stories">
            <Head title="Stories" />
            <Card className="mb-4">
                <div className="flex gap-4 overflow-x-auto pb-1" aria-label="Stories">
                    <button type="button" onClick={() => setCreating(true)} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-hunter-500 bg-hunter-50 text-hunter-700"><Plus size={24} aria-hidden="true" /></span>
                        <span className="w-16 truncate text-center font-medium">Add story</span>
                    </button>
                    {groups.map((g, i) => (
                        <button key={g.user.id} type="button" onClick={() => setViewing(i)} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-xs"
                            aria-label={`${g.mine ? 'Your story' : g.user.name}${g.unseen ? ', new' : ''}`}>
                            <span className={`rounded-full p-[3px] ${g.unseen ? 'bg-gradient-to-tr from-amber-400 via-raspberry-500 to-hunter-500' : 'bg-gray-300'}`}>
                                <img src={g.user.avatar_url} alt="" className="h-14 w-14 rounded-full border-2 border-white object-cover" />
                            </span>
                            <span className={`w-16 truncate text-center ${g.unseen ? 'font-semibold' : 'text-gray-600'}`}>{g.mine ? 'Your story' : g.user.name}</span>
                        </button>
                    ))}
                </div>
                {groups.length === 0 && <p className="mt-3 text-sm text-gray-500">No stories right now. Share a photo to start.</p>}
            </Card>

            <Card>
                <h2 className="mb-1 font-semibold">Your stories</h2>
                <p className="mb-3 text-sm text-gray-500">Each one disappears 24 hours after you post it.</p>
                {(!mine || mine.stories.length === 0) && <p className="text-sm text-gray-500">You have no active stories.</p>}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {mine?.stories.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-2">
                            <button type="button" onClick={() => setViewing(groups.indexOf(mine))} aria-label="Open story" className="shrink-0">
                                <img src={s.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                            </button>
                            <div className="min-w-0 flex-1 text-sm">
                                <AudienceBadge audience={s.audience} className="bg-hunter-100 text-hunter-800" />
                                <p className="mt-1 text-xs text-gray-500">{s.viewers.length} {s.viewers.length === 1 ? 'view' : 'views'} · ends in {s.expires_in}</p>
                                {s.caption && <p className="truncate text-xs">{s.caption}</p>}
                            </div>
                            <button type="button" aria-label="Delete story" onClick={() => window.confirm('Delete this story?') && router.delete(route('stories.destroy', s.id), { preserveScroll: true })}
                                className="rounded-lg p-2 text-raspberry-600 hover:bg-raspberry-500/10"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </Card>

            {creating && <CreateStory contacts={contacts} onClose={() => setCreating(false)} />}
            {viewing !== null && groups[viewing] && <Viewer groups={groups} start={viewing} onClose={closeViewer} />}
        </AppLayout>
    );
}
