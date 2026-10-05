import { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import ShStyle from '@/Components/ShStyle';
import StudyOrbit from '@/Components/StudyOrbit';

const QUOTES = [
    'Small groups make big goals happen.',
    'Study together, grow together.',
    'Consistency beats cramming.',
    'Teach it to someone and you will know it.',
    'Progress, not perfection.',
];

function Quotes() {
    const [i, setI] = useState(0);
    useEffect(() => { const t = setInterval(() => setI((n) => (n + 1) % QUOTES.length), 5500); return () => clearInterval(t); }, []);
    return (
        <blockquote key={i} className="sh-display sh-fade min-h-[4.5rem] text-center text-2xl font-bold text-white" aria-live="polite">
            “{QUOTES[i]}”
        </blockquote>
    );
}

export function Field({ id, label, error, right, ...props }) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between">
                <label htmlFor={id} className="text-sm font-medium text-[#1F2937]">{label}</label>{right}
            </div>
            <input id={id} {...props} className={`sh-input ${error ? 'err' : ''}`} aria-invalid={!!error} />
            {error && <p role="alert" className="mt-1 text-sm text-[#C81E51]">{error}</p>}
        </div>
    );
}

export function PasswordField({ id, label, error, right, ...props }) {
    const [show, setShow] = useState(false);
    return (
        <div>
            <div className="mb-1 flex items-center justify-between">
                <label htmlFor={id} className="text-sm font-medium text-[#1F2937]">{label}</label>{right}
            </div>
            <div className="relative">
                <input id={id} type={show ? 'text' : 'password'} {...props} className={`sh-input pr-12 ${error ? 'err' : ''}`} aria-invalid={!!error} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#355E3B]">
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
            {error && <p role="alert" className="mt-1 text-sm text-[#C81E51]">{error}</p>}
        </div>
    );
}

export default function AuthShell({ title, subtitle, youName = '', footer, children }) {
    return (
        <div className="grid min-h-screen bg-[#F3F4F6] lg:grid-cols-2">
            <ShStyle />
            <aside className="relative hidden flex-col items-center justify-between overflow-hidden px-10 py-10 lg:flex"
                style={{ background: 'radial-gradient(circle at 30% 20%, #4a7c52 0%, #355E3B 45%, #1d3321 100%)' }}>
                <Link href="/" className="sh-display flex items-center gap-2 self-start text-lg font-extrabold text-white">
                    <img src="/images/studyhub-logo.png" alt="" className="h-10 w-10 rounded-full bg-white" /> StudyHub
                </Link>
                <StudyOrbit dark youName={youName} label={youName ? 'Your circle' : 'Study circle'} tone="#E30B5C" size={380} />
                <Quotes />
            </aside>

            <main className="flex items-center justify-center px-6 py-12">
                <div className="sh-fade w-full max-w-md">
                    <Link href="/" className="sh-display mb-8 flex items-center gap-2 text-lg font-extrabold text-[#355E3B] lg:hidden">
                        <img src="/images/studyhub-logo.png" alt="" className="h-10 w-10 rounded-full bg-white" /> StudyHub
                    </Link>
                    <h1 className="sh-display text-4xl font-extrabold text-[#1d3321]">{title}</h1>
                    <p className="mt-2 text-gray-600">{subtitle}</p>
                    <div className="mt-8">{children}</div>
                    <p className="mt-8 text-center text-sm text-gray-600">{footer}</p>
                </div>
            </main>
        </div>
    );
}