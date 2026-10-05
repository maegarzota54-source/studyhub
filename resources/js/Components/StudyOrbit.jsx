import { useState } from 'react';
import { BookOpen } from 'lucide-react';

const PEOPLE = [
    { n: 'Anna', bg: '#E30B5C', say: "Okay! I'll share the notes." },
    { n: 'Mark', bg: '#4a7c52', say: 'Great! See you all at 10 AM.' },
    { n: 'Liza', bg: '#1F2937', say: 'Who wants to quiz each other?' },
    { n: 'John', bg: '#C81E51', say: 'Just uploaded the chapter summary.' },
    { n: 'Mia', bg: '#2a4a2f', say: 'Chapter 4 review: done!' },
];

/**
 * The signature element: a study circle that orbits a book hexagon.
 * Hover pauses it, tap a face to hear them, move the mouse to tilt it.
 * `youName` adds a new member (used on the register page).
 */
export default function StudyOrbit({ label = 'Study circle', tone = '#355E3B', youName = '', size = 360, dark = false }) {
    const [say, setSay] = useState(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });

    const name = youName.trim();
    const people = name ? [...PEOPLE, { n: name, bg: '#E30B5C', you: true, say: `Welcome to the circle, ${name.split(' ')[0]}!` }] : PEOPLE;
    const R = size * 0.38, av = size * 0.17;
    const ring = dark ? 'rgba(255,255,255,.28)' : 'rgba(53,94,59,.28)';

    const move = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 10, y: -((e.clientY - r.top) / r.height - 0.5) * 10 });
    };

    return (
        <div>
            <div className="sh-stage relative mx-auto" style={{ width: size, height: size }}
                onMouseMove={move} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
                <div className="absolute inset-0" style={{ transform: `perspective(900px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`, transition: 'transform .2s' }}>
                    <svg className="absolute inset-0" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={ring} strokeWidth="1.5" strokeDasharray="4 8" />
                        <circle cx={size / 2} cy={size / 2} r={R * 0.62} fill="none" stroke={ring} strokeWidth="1" />
                    </svg>

                    {/* centre hexagon */}
                    <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center" style={{ width: size * 0.3, height: size * 0.3 }}>
                        <span className="sh-pulse absolute inset-0 rounded-full" style={{ background: dark ? '#fff' : tone, opacity: 0.4 }} />
                        <div className="relative flex h-full w-full flex-col items-center justify-center text-white"
                            style={{ background: `linear-gradient(145deg, ${tone}, #1d3321)`, clipPath: 'polygon(25% 4%,75% 4%,100% 50%,75% 96%,25% 96%,0 50%)', transition: 'background .4s' }}>
                            <BookOpen size={size * 0.085} aria-hidden="true" />
                            <span className="sh-display mt-1 max-w-[80%] truncate text-center font-bold" style={{ fontSize: size * 0.036 }}>{label}</span>
                        </div>
                    </div>

                    {/* orbiting members */}
                    <div className="sh-orbit absolute inset-0">
                        {people.map((p, i) => {
                            const a = -90 + (360 / people.length) * i;
                            return (
                                <div key={p.n + i} className="absolute left-1/2 top-1/2" style={{ width: av, height: av, transform: `translate(-50%,-50%) rotate(${a}deg) translateX(${R}px)` }}>
                                    <div style={{ width: av, height: av, transform: `rotate(${-a}deg)` }}>
                                        <div className="sh-counter" style={{ width: av, height: av }}>
                                            <button type="button" aria-label={`${p.n} says hello`} onClick={() => setSay(p)}
                                                className={`sh-avatar relative flex items-center justify-center rounded-full font-bold text-white ${p.you ? 'sh-pop' : ''}`}
                                                style={{ width: av, height: av, background: p.bg, fontSize: av * 0.42, border: `3px solid ${dark ? '#fff' : '#F3F4F6'}` }}>
                                                {p.n[0].toUpperCase()}
                                                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <p className="mt-4 min-h-[3rem] text-center text-sm" style={{ color: dark ? '#d6e5d9' : '#4B5563' }} aria-live="polite">
                {say ? <span key={say.n} className="sh-fade inline-block"><b className="sh-display">{say.n}:</b> {say.say}</span> : 'Tap a face. Hover to pause the circle.'}
            </p>
        </div>
    );
}