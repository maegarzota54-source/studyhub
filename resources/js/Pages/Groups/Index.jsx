import { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowRight, Camera, GraduationCap, ImagePlus, Plus, Sparkles, Users, X } from 'lucide-react';
import AppLayout, { Btn, Card, inputCls } from '@/Layouts/AppLayout';
import { ActiveBadge, ActivePeople, GroupCover } from '@/Components/GroupBits';
import { StarDisplay } from '@/Components/Stars';

/* ------------------------------------------------------------------ create form (with picture) */
function CreateGroup() {
    const f = useForm({ title: '', topic: '', description: '', target_date: '', skill_level: 'beginner', mode: 'online', max_members: 10, cover: null, meeting_days: [], meeting_time: '' });
    const set = (k) => (e) => f.setData(k, e.target.value);
    const err = (k) => f.errors[k] && <p className="mt-1 text-xs text-[#C81E51]">{f.errors[k]}</p>;
    const label = 'mb-1 block text-sm font-medium';
    const preview = f.data.cover ? URL.createObjectURL(f.data.cover) : null;
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <Card>
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Plus size={18} aria-hidden="true" /> Create a study circle</h2>
            <form onSubmit={(e) => { e.preventDefault(); f.post(route('groups.store'), { forceFormData: true }); }} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div><label className={label} htmlFor="g-title">Group title</label><input id="g-title" className={inputCls} value={f.data.title} onChange={set('title')} />{err('title')}</div>
                <div><label className={label} htmlFor="g-topic">Topic of study</label><input id="g-topic" className={inputCls} value={f.data.topic} onChange={set('topic')} />{err('topic')}</div>
                <div><label className={label} htmlFor="g-date">Target date</label><input id="g-date" type="date" className={inputCls} value={f.data.target_date} onChange={set('target_date')} />{err('target_date')}</div>
                <div><label className={label} htmlFor="g-max">Maximum members</label><input id="g-max" type="number" min="2" className={inputCls} value={f.data.max_members} onChange={set('max_members')} />{err('max_members')}</div>
                <div><label className={label} htmlFor="g-skill">Skill level</label>
                    <select id="g-skill" className={inputCls} value={f.data.skill_level} onChange={set('skill_level')}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>{err('skill_level')}</div>
                <div><label className={label} htmlFor="g-mode">Study mode</label>
                    <select id="g-mode" className={inputCls} value={f.data.mode} onChange={set('mode')}><option value="online">Online</option><option value="in-person">In person</option></select>{err('mode')}</div>
                <fieldset className="md:col-span-2">
                    <legend className={label}>Usual meeting days (used for matching)</legend>
                    <div className="flex flex-wrap gap-2">
                        {DAYS.map((d) => (
                            <label key={d} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm has-[:checked]:border-[#0B8A94] has-[:checked]:bg-[#0B8A94]/10">
                                <input type="checkbox" className="rounded" checked={f.data.meeting_days.includes(d)}
                                    onChange={() => f.setData('meeting_days', f.data.meeting_days.includes(d) ? f.data.meeting_days.filter((x) => x !== d) : [...f.data.meeting_days, d])} /> {d}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <div><label className={label} htmlFor="g-time">Usual time of day</label>
                    <select id="g-time" className={inputCls} value={f.data.meeting_time} onChange={set('meeting_time')}><option value="">Flexible</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></div>
                <div className="md:col-span-2"><label className={label} htmlFor="g-desc">Description</label><textarea id="g-desc" rows="3" className={inputCls} value={f.data.description} onChange={set('description')} />{err('description')}</div>
                <div className="md:col-span-2">
                    <span className={label}>Group picture (shown on your circle's card)</span>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-3 transition-colors hover:border-[#0B8A94]">
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
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const members = g.members ?? [];
    const count = g.members_count ?? members.length;

    // Joining sends the student straight to My Groups (the server redirects there).
    const join = () => {
        setError(''); setBusy(true);
        router.post(route('groups.join', g.id), {}, {
            onError: (e) => setError(e.join || 'Could not join this circle.'),
            onFinish: () => setBusy(false),
        });
    };

    return (
        <article className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:-translate-y-1 hover:shadow-xl">
            <GroupCover group={g} className="h-28">
                <div className="absolute inset-x-0 bottom-0 p-3 text-white"><h3 className="truncate font-bold">{g.title}</h3><p className="truncate text-xs text-white/80">{g.topic} · {g.skill_level} · {g.mode}</p></div>
                {g.recommended_by && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#2EC4B6] px-2.5 py-1 text-[11px] font-bold text-[#0A1F44]"><GraduationCap size={12} aria-hidden="true" /> Recommended by {g.recommended_by}</span>}
            </GroupCover>
            <div className="p-4">
                {g.description && <p className="mb-3 line-clamp-2 text-sm">{g.description}</p>}
                <div className="mb-2"><StarDisplay value={g.ratings_avg_stars} count={g.ratings_count ?? 0} /></div>
                {g.why?.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Why this is suggested">
                        {g.why.map((w) => <span key={w} className="rounded-full bg-[#0B8A94]/15 px-2 py-0.5 text-[11px] font-semibold text-[#06626B]">{w}</span>)}
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
                        <button onClick={join} disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2EC4B6] px-4 py-2 text-sm font-semibold text-[#0A1F44] transition-all hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A1F44] active:scale-95 disabled:opacity-60">
                            {busy ? 'Joining…' : <>Join <ArrowRight size={14} aria-hidden="true" /></>}
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
        <article className="relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-all focus-within:ring-2 focus-within:ring-[#2EC4B6] hover:border-[#2EC4B6] hover:shadow-xl">
            <GroupCover group={g} className="h-28">
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
                    <ActiveBadge groupId={g.id} onCover />
                    {admin && <label className="cursor-pointer rounded-full bg-[#0A1F44]/70 p-1.5 text-white hover:bg-[#0A1F44]" title="Change group picture"><Camera size={14} /><input type="file" accept="image/*" className="sr-only" onChange={upload} /></label>}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3 text-white"><h3 className="truncate font-bold">{g.title}</h3><p className="truncate text-xs text-white/80">{g.topic}</p></div>
            </GroupCover>
            <div className="px-4 pt-3"><ActivePeople groupId={g.id} /></div>
            <div className="flex items-center justify-between p-4">
                <span className="flex items-center gap-1 text-xs text-gray-500"><Users size={13} aria-hidden="true" /> {g.members_count}/{g.max_members} members{admin && ' · admin'}</span>
                <Link href={route('groups.show', g.id)} className="inline-flex items-center gap-1.5 rounded-lg after:absolute after:inset-0 after:content-[''] bg-[#2EC4B6] px-4 py-2 text-sm font-semibold text-[#0A1F44] transition-colors hover:bg-[#25B3A6]">Joined <ArrowRight size={14} /></Link>
            </div>
        </article>
    );
}

/* ------------------------------------------------------------------ page */
function FilterSelect({ label, value, onChange, options }) {
    return (
        <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
            className={`rounded-full border px-3 py-2 text-sm font-medium focus:outline-none ${value ? 'border-[#2EC4B6] bg-[#2EC4B6] text-[#0A1F44]' : 'border-[#F5EFE6]/30 bg-transparent text-[#F5EFE6]'}`}>
            {options.map(([v, t]) => <option key={v} value={v} className="text-black">{t}</option>)}
        </select>
    );
}

export default function GroupsIndex({ mode, groups, filters = {}, topics = [], suggested = [], popular = [], profileIncomplete = false, partners = [] }) {
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
                            <input aria-label="Search by title or topic" className={inputCls} placeholder="Search by title or topic" value={q} onChange={(e) => setQ(e.target.value)} />
                            <Btn>Search</Btn>
                        </form>
                        <button onClick={() => apply({ recommended: filters.recommended ? undefined : 1 })} aria-pressed={!!filters.recommended}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${filters.recommended ? 'border-[#2EC4B6] bg-[#2EC4B6] text-[#0A1F44]' : 'border-[#F5EFE6]/30 text-[#F5EFE6] hover:bg-white/10'}`}>
                            <GraduationCap size={15} aria-hidden="true" /> Recommended by my teacher
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
                        <FilterSelect label="Subject" value={filters.topic} onChange={(v) => apply({ topic: v })} options={[['', 'Any subject'], ...topics.map((t) => [t, t])]} />
                        <FilterSelect label="Skill level" value={filters.skill_level} onChange={(v) => apply({ skill_level: v })} options={[['', 'Any level'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]} />
                        <FilterSelect label="Study mode" value={filters.mode} onChange={(v) => apply({ mode: v })} options={[['', 'Online or in person'], ['online', 'Online'], ['in-person', 'In person']]} />
                        <FilterSelect label="Schedule" value={filters.schedule} onChange={(v) => apply({ schedule: v })} options={[['', 'Any schedule'], ['week', 'Has a session this week']]} />
                        {anyFilter && <button onClick={() => { setQ(''); router.get(route('groups.find')); }} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm text-[#F5EFE6]/80 underline hover:text-white"><X size={14} /> Clear filters</button>}
                    </div>
                </div>
            ) : <div className="mb-6"><CreateGroup /></div>}

            {mode === 'find' && !anyFilter && (() => {
                const picks = suggested.length > 0 ? suggested : popular;
                return (
                    <section aria-labelledby="suggested-title" className="mb-8 rounded-2xl border-2 border-[#2EC4B6] bg-[#F5EFE6] p-4 text-[#0A1F44] shadow-lg sm:p-5">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 id="suggested-title" className="flex items-center gap-2 text-xl font-extrabold"><Sparkles size={20} color="#0B8A94" aria-hidden="true" /> Suggested for you</h2>
                                <p className="mt-0.5 text-sm text-[#0A1F44]/80">
                                    {suggested.length > 0 ? 'Matched to your subjects, free days, skill level and study goal.' : picks.length > 0 ? 'No profile match yet, so here are popular circles to start with.' : 'No open circles to suggest right now.'}
                                </p>
                            </div>
                            {(profileIncomplete || suggested.length === 0) && (
                                <Link href={route('profile.edit')} className="rounded-lg bg-[#0A1F44] px-3 py-2 text-sm font-semibold text-white hover:bg-[#12315F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B8A94]">
                                    Add subjects &amp; free days for better matches
                                </Link>
                            )}
                        </div>
                        {picks.length > 0 && <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{picks.map((g) => <FindCard key={`s${g.id}`} g={g} />)}</div>}
                    </section>
                );
            })()}

            {mode === 'find' && <h2 className="mb-3 text-lg font-bold text-[#F5EFE6]">All study groups</h2>}

            {mode === 'find' && partners.length > 0 && (
                <section className="mb-8" aria-label="Study partners for you">
                    <h2 className="mb-3 text-lg font-bold">Study partners with similar subjects</h2>
                    <ul className="flex flex-wrap gap-3">
                        {partners.map((p) => (
                            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 pr-4">
                                <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                                <div className="min-w-0 text-sm text-gray-900">
                                    <p className="truncate font-semibold">{p.name}</p>
                                    <p className="truncate text-xs text-gray-500">{p.common_subjects.length ? p.common_subjects.join(', ') : 'Similar schedule'}</p>
                                </div>
                                <Link href={route('messages.index', { user_id: p.id })} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#0B8A94] underline">Message</Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.length === 0 && <p className="text-sm text-gray-500">{mode === 'find' ? 'No circles match. Try another subject or clear the filters.' : "You haven't joined a circle yet."}</p>}
                {list.map((g) => (mode === 'find' ? <FindCard key={g.id} g={g} /> : <MineCard key={g.id} g={g} />))}
            </div>

            {groups.links && groups.links.length > 3 && (
                <nav className="mt-6 flex flex-wrap gap-1" aria-label="Pagination">
                    {groups.links.map((l, i) => l.url
                        ? <Link key={i} href={l.url} preserveScroll className={`rounded-lg px-3 py-1 text-sm ${l.active ? 'bg-[#2EC4B6] font-bold text-[#0A1F44]' : 'text-[#F5EFE6] hover:bg-white/10'}`} dangerouslySetInnerHTML={{ __html: l.label }} />
                        : <span key={i} className="px-3 py-1 text-sm text-[#F5EFE6]/40" dangerouslySetInnerHTML={{ __html: l.label }} />)}
                </nav>
            )}
        </AppLayout>
    );
}
