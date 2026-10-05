import { Head, Link, useForm } from '@inertiajs/react';
import { Check, X } from 'lucide-react';
import AuthShell, { Field, PasswordField } from '@/Components/AuthShell';

const rules = (pw) => [
    ['8+ characters', pw.length >= 8],
    ['Upper and lower case', /[a-z]/.test(pw) && /[A-Z]/.test(pw)],
    ['A number', /\d/.test(pw)],
    ['A symbol', /[^A-Za-z0-9]/.test(pw)],
];

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({ name: '', email: '', password: '', password_confirmation: '' });
    const checks = rules(data.password);
    const score = checks.filter(([, ok]) => ok).length;
    const meter = [['#D1D5DB', 'Start typing'], ['#E30B5C', 'Weak'], ['#C81E51', 'Getting there'], ['#4a7c52', 'Good'], ['#355E3B', 'Strong']][data.password ? score || 1 : 0];
    const mismatch = data.password_confirmation && data.password !== data.password_confirmation;
    const first = data.name.trim().split(' ')[0];

    const submit = (e) => {
        e.preventDefault();
        post(route('register'), { onFinish: () => reset('password', 'password_confirmation') });
    };

    return (
        <AuthShell youName={data.name} title={first ? `Hi ${first}, grab a seat` : 'Join a study circle'}
            subtitle="Create your account and see yourself join the circle."
            footer={<>Already have an account? <Link href={route('login')} className="font-semibold text-[#E30B5C] hover:underline">Log in</Link></>}>
            <Head title="Create account" />
            <form onSubmit={submit} className="space-y-4">
                <Field id="name" label="Full name" autoComplete="name" autoFocus value={data.name}
                    onChange={(e) => setData('name', e.target.value)} error={errors.name} placeholder="Anna Reyes" />
                <Field id="email" label="Email" type="email" autoComplete="username" value={data.email}
                    onChange={(e) => setData('email', e.target.value)} error={errors.email} placeholder="you@school.edu" />
                <div>
                    <PasswordField id="password" label="Password" autoComplete="new-password" value={data.password}
                        onChange={(e) => setData('password', e.target.value)} error={errors.password} placeholder="Create a password" />
                    <div className="mt-2 flex gap-1" aria-hidden="true">
                        {[1, 2, 3, 4].map((n) => <span key={n} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: score >= n && data.password ? meter[0] : '#E5E7EB' }} />)}
                    </div>
                    <p className="mt-1 text-xs font-medium" style={{ color: meter[0] }} aria-live="polite">{meter[1]}</p>
                    {data.password && (
                        <ul className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-gray-600">
                            {checks.map(([t, ok]) => (
                                <li key={t} className="flex items-center gap-1">{ok ? <Check size={12} className="text-[#355E3B]" /> : <X size={12} className="text-gray-400" />}{t}</li>
                            ))}
                        </ul>
                    )}
                </div>
                <PasswordField id="password_confirmation" label="Confirm password" autoComplete="new-password" value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    error={errors.password_confirmation || (mismatch ? 'Passwords do not match yet.' : null)} placeholder="Type it again" />
                <button className="sh-btn sh-btn-accent w-full" disabled={processing || mismatch}>{processing ? 'Creating your account…' : 'Create account'}</button>
            </form>
        </AuthShell>
    );
}