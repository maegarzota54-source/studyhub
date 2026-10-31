import { Link, router } from '@inertiajs/react';
import { Sparkles } from 'lucide-react';
import { StarDisplay } from '@/Components/Stars';

/** "Suggested for you": circles (and study partners) ranked by the matching score from GroupMatcher. */
export default function SuggestedGroups({ suggested = [], partners = [], compact = false }) {
    if (suggested.length === 0 && (compact || partners.length === 0)) {
        return compact ? null : (
            <section aria-labelledby="sg-title" className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
                <h2 id="sg-title" className="flex items-center gap-2 font-semibold"><Sparkles size={16} aria-hidden="true" /> Suggested for you</h2>
                <p className="mt-1 text-sm text-gray-500">Add your subjects, free days and study goal in <Link href={route('profile.edit')} className="font-semibold underline">your profile</Link> and StudyHub will match you with circles and study partners.</p>
            </section>
        );
    }
    const join = (g) => router.post(route('groups.join', g.id), {}, { preserveScroll: true });
    return (
        <section aria-labelledby="sg-title" className={compact ? 'p-5' : 'mb-6 rounded-xl border border-gray-200 bg-white p-4'}>
            <h2 id="sg-title" className="mb-3 flex items-center gap-2 font-semibold"><Sparkles size={16} aria-hidden="true" /> Suggested for you</h2>
            <ul className={`grid gap-3 ${compact ? '' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
                {suggested.map((g) => (
                    <li key={g.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate font-semibold">{g.title}</p>
                                <p className="truncate text-xs text-gray-500">{g.topic} · {g.skill_level} · {g.mode}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-[#0B8A94] px-2 py-0.5 text-xs font-bold text-white" aria-label={`${g.match_score} percent match`}>{g.match_score}%</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {g.match_reasons.map((r) => <span key={r} className="rounded-full bg-black/5 px-2 py-0.5 text-[11px]">{r}</span>)}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <StarDisplay value={g.ratings_avg_stars} count={g.ratings_count ?? null} />
                            <button type="button" onClick={() => join(g)} className="rounded-lg bg-[#2EC4B6] px-3 py-1.5 text-sm font-semibold text-[#0A1F44] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0B8A94]">Join</button>
                        </div>
                    </li>
                ))}
            </ul>
            {!compact && partners.length > 0 && (
                <>
                    <h3 className="mb-2 mt-5 text-sm font-semibold">Study partners with similar subjects</h3>
                    <ul className="flex flex-wrap gap-3">
                        {partners.map((p) => (
                            <li key={p.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 pr-3">
                                <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-full" />
                                <div className="text-sm"><p className="font-semibold">{p.name}</p><p className="text-xs text-gray-500">{p.common_subjects.join(', ') || 'Similar schedule'}</p></div>
                                <Link href={route('messages.index', { user_id: p.id })} className="ml-2 rounded-lg px-2 py-1 text-xs font-semibold text-[#0B8A94] underline">Message</Link>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {compact && <Link href={route('groups.find')} className="mt-3 inline-block text-sm font-semibold underline">See all suggestions</Link>}
        </section>
    );
}
