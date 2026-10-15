import { useEffect, useState } from 'react';
import { getActivity, subscribe } from '@/lib/groupActivity';

const TONES = [['#1B4322', '#038666'], ['#038666', '#081C15'], ['#FBB02D', '#1B4322'], ['#081C15', '#038666'], ['#1B4322', '#FBB02D']];

/** The group's chosen picture as a card background (or a palette gradient with its initial when there is none). */
export function GroupCover({ group, className = '', children }) {
    const [a, b] = TONES[group.id % TONES.length];
    const shade = 'linear-gradient(180deg, rgba(8,28,21,.05), rgba(8,28,21,.78))';
    const style = group.cover_url
        ? { backgroundImage: `${shade}, url(${group.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { backgroundImage: `${shade}, linear-gradient(135deg, ${a}, ${b})` };
    return (
        <div className={`relative overflow-hidden ${className}`} style={style}>
            {!group.cover_url && <span aria-hidden="true" className="pointer-events-none absolute -right-2 -top-6 select-none text-8xl font-black text-white/15">{group.title[0].toUpperCase()}</span>}
            {children}
        </div>
    );
}

/** Green pulsing pill when somebody has the group chat open right now, gray when nobody does. */
export function ActiveBadge({ groupId, onCover = false }) {
    const [, tick] = useState(0);
    useEffect(() => subscribe(() => tick((n) => n + 1)), []);
    const a = getActivity(groupId);
    const on = !!a?.active;
    return (
        <span title={on ? `In the chat now: ${a.names.join(', ')}` : 'Nobody is in this chat right now'}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: onCover ? 'rgba(8,28,21,.72)' : on ? 'rgba(34,197,94,.16)' : 'rgba(107,114,128,.16)', color: on ? (onCover ? '#86efac' : '#15803d') : onCover ? '#d1d5db' : '#6B7280' }}>
            <span className="relative flex h-2.5 w-2.5">
                {on && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${on ? 'bg-green-500' : 'bg-gray-400'}`} />
            </span>
            {on ? `Active · ${a.count}` : 'Quiet'}
        </span>
    );
}
