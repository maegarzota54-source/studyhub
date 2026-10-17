import { useRef } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AuthShell, { Field, PasswordField } from '@/Components/AuthShell';

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({ email: '', password: '', remember: false });
    const formRef = useRef(null);

    const shake = () => {
        const el = formRef.current;
        if (!el) return;
        el.classList.remove('sh-shake'); void el.offsetWidth; el.classList.add('sh-shake');
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), { onError: shake, onFinish: () => reset('password') });
    };

    return (
        <AuthShell title="Welcome back" subtitle="Log in to rejoin your study circles."
            footer={<>New to StudyHub? <Link href={route('register')} className="font-semibold text-[#E30B5C] hover:underline">Create an account</Link></>}>
            <Head title="Log in" />
            {status && <div className="mb-4 rounded-lg bg-[#d6e5d9] px-4 py-2 text-sm text-[#2a4a2f]">{status}</div>}

            <form ref={formRef} onSubmit={submit} className="space-y-5">
                <Field id="email" label="Email" type="email" autoComplete="username" autoFocus value={data.email}
                    onChange={(e) => setData('email', e.target.value)} error={errors.email} placeholder="you@school.edu" />
                <PasswordField id="password" label="Password" autoComplete="current-password" value={data.password}
                    onChange={(e) => setData('password', e.target.value)} error={errors.password} placeholder="Your password"
                    right={canResetPassword && <Link href={route('password.request')} className="text-sm text-[#355E3B] hover:underline">Forgot password?</Link>} />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={data.remember} onChange={(e) => setData('remember', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-[#355E3B] focus:ring-[#355E3B]" /> Keep me logged in
                </label>
                <button className="sh-btn sh-btn-primary w-full" disabled={processing}>{processing ? 'Logging in…' : 'Log in'}</button>
            </form>

            {/* Dev-only shortcut for the seeded accounts. Stripped from production builds. */}
            {import.meta.env.DEV && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                    <p className="mb-2 text-xs text-gray-500">Demo accounts (local only)</p>
                    <div className="flex flex-wrap gap-2">
                        {[['Admin', 'admin@studyhub.test']].map(([n, em]) => (
                            <button key={n} type="button" className="sh-chip" onClick={() => { setData({ ...data, email: em, password: 'password' }); }}>{n}</button>
                        ))}
                    </div>
                </div>
            )}
        </AuthShell>
    );
}