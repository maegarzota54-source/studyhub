import { useForm } from '@inertiajs/react';
import { Btn, Card, inputCls } from '@/Layouts/AppLayout';
import { StarDisplay, StarInput } from '@/Components/Stars';

/** Members rate their circle 1–5 stars with an optional comment; one rating each, editable. */
export default function GroupRatingBox({ group, rating }) {
    const f = useForm({ stars: rating.mine?.stars ?? 0, comment: rating.mine?.comment ?? '' });
    const submit = (e) => { e.preventDefault(); f.post(route('groups.rate', group.id), { preserveScroll: true }); };
    return (
        <Card>
            <h3 className="mb-1 text-sm font-semibold">Group rating</h3>
            <StarDisplay value={rating.avg} count={rating.count} size={18} />
            <form onSubmit={submit} className="mt-4 space-y-2">
                <p className="text-sm">{rating.mine ? 'Update your rating' : 'Rate this circle'}</p>
                <StarInput value={f.data.stars} onChange={(n) => f.setData('stars', n)} />
                <label className="sr-only" htmlFor="rate-comment">Comment (optional)</label>
                <textarea id="rate-comment" rows="2" maxLength="500" className={inputCls} placeholder="What made this circle helpful? (optional)" value={f.data.comment} onChange={(e) => f.setData('comment', e.target.value)} />
                {f.errors.stars && <p role="alert" className="text-xs text-[#C81E51]">{f.errors.stars}</p>}
                <Btn disabled={f.processing || !f.data.stars}>{rating.mine ? 'Update rating' : 'Submit rating'}</Btn>
            </form>
            {rating.recent.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                    {rating.recent.filter((r) => r.comment).map((r) => (
                        <li key={r.id} className="text-sm"><StarDisplay value={r.stars} size={12} /> <b className="ml-1">{r.user?.name}</b><p className="text-gray-600">{r.comment}</p></li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
