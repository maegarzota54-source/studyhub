import { Star } from 'lucide-react';

/** Read-only stars, e.g. 4.3 (12 ratings). Screen readers hear "4.3 out of 5 stars". */
export function StarDisplay({ value = 0, count = null, size = 14 }) {
    const v = Number(value) || 0;
    return (
        <span className="inline-flex items-center gap-1" role="img" aria-label={count === 0 || !v ? 'Not rated yet' : `${v.toFixed(1)} out of 5 stars${count != null ? `, ${count} ratings` : ''}`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={size} aria-hidden="true" className={n <= Math.round(v) ? 'fill-[#FBB02D] text-[#FBB02D]' : 'text-gray-300'} />
            ))}
            <span className="text-xs text-gray-500">{count === 0 || !v ? 'No ratings' : `${v.toFixed(1)}${count != null ? ` (${count})` : ''}`}</span>
        </span>
    );
}

/** Clickable 1–5 stars (keyboard: Tab to a star, Enter/Space to choose). */
export function StarInput({ value, onChange }) {
    return (
        <div role="radiogroup" aria-label="Your rating" className="inline-flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    onClick={() => onChange(n)} className="rounded p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#038666]">
                    <Star size={24} aria-hidden="true" className={n <= value ? 'fill-[#FBB02D] text-[#FBB02D]' : 'text-gray-300'} />
                </button>
            ))}
        </div>
    );
}
