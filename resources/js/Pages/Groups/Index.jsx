import { useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowRight, Camera, Check, GraduationCap, ImagePlus, Plus, Sparkles, Users, X } from 'lucide-react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';
import { ActiveBadge, ActivePeople, GroupCover } from '@/Components/GroupBits';

/* ------------------------------------------------------------------ create form (with picture) */
function CreateGroup() {
    const f = useForm({ title: '', topic: '', description: '', target_date: '', skill_level: 'beginner', mode: 'online', max_members: 10, cover: null });
    const set = (k) => (e) => f.setData(k, e.target.value);
    const err = (k) => f.errors[k] && <p className="mt-1 text-xs text-[#C81E51]">{f.errors[k]}</p>;
    const label = 'mb-1 block text-sm font-medium';
    const preview = f.data.cover ? URL.createObjectURL(f.data.cover) : null;

    return (
        <Card>
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Plus size={18} aria-hidden="true" /> Create a study circle</h2>
            <form onSubmit={(e) => { e.preventDefault(); f.post(route('groups.store'), { forceFormData: true }); }} className="grid gap-3 md:grid-cols-2">
                <div><label className={label} htmlFor="g-title">Group title</label><input id="g-title" className={inputCls} value={f.data.title} onChange={set('title')} />{err('title')}</div>
                <div><label className={label} htmlFor="g-topic">Topic of study</label><input id="g-topic" className={inputCls} value={f.data.topic} onChange={set('topic')} />{err('topic')}</div>
                <div><label className={label} htmlFor="g-date">Target date</label><input id="g-date" type="date" className={inputCls} value={f.data.target_date} onChange={set('target_date')} />{err('target_date')}</div>
                <div><label className={label} htmlFor="g-max">Maximum members</label><input id="g-max" type="number" min="2" className={inputCls} value={f.data.max_members} onChange={set('max_members')} />{err('max_members')}</div>
                <div><label className={label} htmlFor="g-skill">Skill level</label>
                    <select id="g-skill" className={inputCls} value={f.data.skill_level} onChange={set('skill_level')}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>{err('skill_level')}</div>
                <div><label className={label} htmlFor="g-mode">Study mode</label>
                    <select id="g-mode" className={inputCls} value={f.data.mode} onChange={set('mode')}><option value="online">Online</option><option value="in-person">In person</option></select>{err('mode')}</div>
                <div className="md:col-span-2"><label className={label} htmlFor="g-desc">Description</label><textarea id="g-desc" rows="3" className={inputCls} value={f.data.description} onChange={set('description')} />{err('description')}</div>
                <div className="md:col-span-2">
                    <span className={label}>Group picture (shown on your circle's card)</span>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-3 transition-colors hover:border-[#038666]">
                        {preview ? <img src={preview} alt="Picture preview" className="h-16 w-24 rounded-lg object-cover" /> : <span className="flex h-16 w-24 items-center justify-center rounded-lg bg-black/5"><ImagePlus size={22} /></span>}
                        <span className="text-sm">{f.data.cover ? f.data.cover.name : 'Choose an image (JPG, PNG or WebP, up to 3 MB)'}</span>
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => f.setData('cover', e.target.files[0] ?? null)} />
                    </label>
                    {err('cover')}
                </div>
                <div className="md:col-span-2"><Btn disabled={f.processing}>{f.processing ? 'Creating…' : 'Create circle'}</Btn></div>
            </form>
        </Card>
    );
}

/* ------------------------------------------------------------------ Find Groups card */
function FindCard({ g }) {
    const me = usePage().props.auth.user;
    const [joined, setJoined] = useState(false);
    const [error, setError] = useState('');
    const isIn = g.is_member || joined;
    const optimistic = joined && !g.is_member;           // show me instantly, before the server answers
    const members = optimistic ? [...g.members, { id: me.id, name: me.name, avatar_url: me.avatar_url }] : g.members;
    const count = g.members_count + (optimistic ? 1 : 0);

    const join = () => {
        setError(''); setJoined(true);                    // flips to "Joined" immediately
        router.post(route('groups.join', g.id), {}, {
            preserveScroll: true, preserveState: true,
            onError: (e) => { setJoined(false); setError(e.join || 'Could not join this circle.'); },
        });
    };

    return (
        <article className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:-translate-y-1 hover:shadow-xl">
            <GroupCover group={g} className="h-28">
                <div className="absolute inset-x-0 bottom-0 p-3 text-white"><h3 className="truncate font-bold">{g.title}</h3><p className="truncate text-xs text-white/80">{g.topic} · {g.skill_level} · {g.mode}</p></div>
                {g.recommended_by && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#FBB02D] px-2.5 py-1 text-[11px] font-bold text-[#081C15]"><GraduationCap size={12} aria-hidden="true" /> Recommended by {g.recommended_by}</span>}
            </GroupCover>
            <div className="p-4">
                {g.description && <p className="mb-3 line-clamp-2 text-sm">{g.description}</p>}
                {g.why?.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Why this is suggested">
                        {g.why.map((w) => <span key={w} className="rounded-full bg-[#038666]/15 px-2 py-0.5 text-[11px] font-semibold text-[#025f48]">{w}</span>)}
                    </div>
                )}
                <div className="flex items-center gap-2" aria-label="Members who joined">
                    <div className="flex -space-x-2">
                        {members.slice(0, 5).map((m) => <img key={m.id} src={m.avatar_url} title={m.name} alt={m.name} className="h-7 w-7 rounded-full border-2 border-white object-cover" />)}
                    </div>
                    <span className="min-w-0 truncate text-xs text-gray-500">
                        {members.slice(0, 3).map((m) => m.name.split(' ')[0]).join(', ')}{members.length > 3 && ` +${members.length - 3}`}
                    </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-gray-500"><Users size={13} aria-hidden="true" /> {count}/{g.max_members} members</span>
                    <div className="flex items-center gap-2">
                        {isIn && <Link href={route('groups.show', g.id)} aria-label={`Open ${g.title}`} className="rounded-lg p-2 text-[#038666] hover:bg-black/5"><ArrowRight size={16} /></Link>}
                        <button onClick={join} disabled={isIn} aria-pressed={isIn}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${isIn ? 'cursor-default bg-[#038666] text-white' : 'bg-[#FBB02D] text-[#081C15] hover:brightness-95'}`}>
                            {isIn ? <><Check size={15} aria-hidden="true" /> Joined</> : 'Join'}
                        </button>
                    </div>
                </div>
                {error && <p role="alert" className="mt-2 text-xs text-[#C81E51]">{error}</p>}
            </div>
        </article>
    );
}

/* ------------------------------------------------------------------ My Groups card (green / gray indicator) */
function MineCard({ g }) {
    const admin = g.pivot?.role === 'admin';
    const upload = (e) => { const file = e.target.files[0]; if (file) router.post(route('groups.cover', g.id), { cover: file }, { forceFormData: true, preserveScroll: true }); };
    return (
        <article className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:-translate-y-1 hover:shadow-xl">
            <GroupCover group={g} className="h-28">
                <div className="absolute right-2 top-2 flex items-center gap-1.5">
                    <ActiveBadge groupId={g.id} onCover />
                    {admin && <label className="cursor-pointer rounded-full bg-[#081C15]/70 p-1.5 text-white hover:bg-[#081C15]" title="Change group picture"><Camera size={14} /><input type="file" accept="image/*" className="sr-only" onChange={upload} /></label>}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3 text-white"><h3 className="truncate font-bold">{g.title}</h3><p className="truncate text-xs text-white/80">{g.topic}</p></div>
            </GroupCover>
            <div className="px-4 pt-3"><ActivePeople groupId={g.id} /></div>
            <div className="flex items-center justify-between p-4">
                <span className="flex items-center gap-1 text-xs text-gray-500"><Users size={13} aria-hidden="true" /> {g.members_count}/{g.max_members} members{admin && ' · admin'}</span>
                <Link href={route('groups.show', g.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#FBB02D] px-4 py-2 text-sm font-semibold text-[#081C15] transition-all hover:brightness-95 active:scale-95">Open <ArrowRight size={14} /></Link>
            </div>
        </article>
    );
}

/* ------------------------------------------------------------------ page */
function FilterSelect({ label, value, onChange, options }) {
    return (
        <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
            className={`rounded-full border px-3 py-2 text-sm font-medium focus:outline-none ${value ? 'border-[#FBB02D] bg-[#FBB02D] text-[#081C15]' : 'border-[#EBF2FA]/30 bg-transparent text-[#EBF2FA]'}`}>
            {options.map(([v, t]) => <option key={v} value={v} className="text-black">{t}</option>)}
        </select>
    );
}

export default function GroupsIndex({ mode, groups, filters = {}, topics = [], suggested = [] }) {
    const list = groups.data ?? groups;
    const [q, setQ] = useState(filters.q ?? '');
    const apply = (next = {}) => {
        const merged = { ...filters, q: q || undefined, ...next };
        router.get(route('groups.find'), Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined && v !== null && v !== '')), { preserveState: true });
    };
    const anyFilter = Object.values(filters).some(Boolean);

    return (
        <AppLayout title={mode === 'find' ? 'Find Study Groups' : 'My Study Circles'}>
            <Head title="Groups" />
            {mode === 'find' ? (
                <div className="mb-5 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <form onSubmit={(e) => { e.preventDefault(); apply(); }} className="flex min-w-[16rem] flex-1 gap-2">
                            <input className={inputCls} placeholder="Search by title or topic" value={q} onChange={(e) => setQ(e.target.value)} />
                            <Btn>Search</Btn>
                        </form>
                        <button onClick={() => apply({ recommended: filters.recommended ? undefined : 1 })} aria-pressed={!!filters.recommended}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${filters.recommended ? 'border-[#FBB02D] bg-[#FBB02D] text-[#081C15]' : 'border-[#EBF2FA]/30 text-[#EBF2FA] hover:bg-white/10'}`}>
                            <GraduationCap size={15} aria-hidden="true" /> Recommended by my teacher
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
                        <FilterSelect label="Subject" value={filters.topic} onChange={(v) => apply({ topic: v })} options={[['', 'Any subject'], ...topics.map((t) => [t, t])]} />
                        <FilterSelect label="Skill level" value={filters.skill_level} onChange={(v) => apply({ skill_level: v })} options={[['', 'Any level'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]} />
                        <FilterSelect label="Study mode" value={filters.mode} onChange={(v) => apply({ mode: v })} options={[['', 'Online or in person'], ['online', 'Online'], ['in-person', 'In person']]} />
                        <FilterSelect label="Schedule" value={filters.schedule} onChange={(v) => apply({ schedule: v })} options={[['', 'Any schedule'], ['week', 'Has a session this week']]} />
                        {anyFilter && <button onClick={() => { setQ(''); router.get(route('groups.find')); }} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm text-[#EBF2FA]/80 underline hover:text-white"><X size={14} /> Clear filters</button>}
                    </div>
                </div>
            ) : <div className="mb-6"><CreateGroup /></div>}

            {mode === 'find' && suggested.length > 0 && (
                <section className="mb-8" aria-label="Suggested for you">
                    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Sparkles size={18} color="#FBB02D" aria-hidden="true" /> Suggested for you</h2>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{suggested.map((g) => <FindCard key={`s${g.id}`} g={g} />)}</div>
                    <h2 className="mb-1 mt-8 text-lg font-bold">All study groups</h2>
                </section>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.length === 0 && <p className="text-sm text-gray-500">{mode === 'find' ? 'No circles match. Try another subject or clear the filters.' : "You haven't joined a circle yet."}</p>}
                {list.map((g) => (mode === 'find' ? <FindCard key={g.id} g={g} /> : <MineCard key={g.id} g={g} />))}
            </div>

            {groups.links && groups.links.length > 3 && (
                <nav className="mt-6 flex flex-wrap gap-1" aria-label="Pagination">
                    {groups.links.map((l, i) => l.url
                        ? <Link key={i} href={l.url} preserveScroll className={`rounded-lg px-3 py-1 text-sm ${l.active ? 'bg-[#FBB02D] font-bold text-[#081C15]' : 'text-[#EBF2FA] hover:bg-white/10'}`} dangerouslySetInnerHTML={{ __html: l.label }} />
                        : <span key={i} className="px-3 py-1 text-sm text-[#EBF2FA]/40" dangerouslySetInnerHTML={{ __html: l.label }} />)}
                </nav>
            )}
        </AppLayout>
    );
}
