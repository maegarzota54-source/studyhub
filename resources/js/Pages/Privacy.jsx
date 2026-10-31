import { Head, Link, usePage } from '@inertiajs/react';

/** Privacy Notice (RA 10173, Data Privacy Act of 2012). Public so it can be read before registering. */
export default function Privacy() {
    const { auth } = usePage().props;
    const h2 = 'mt-6 text-lg font-bold text-[#0A1F44]';
    return (
        <div className="min-h-screen bg-[#F5EFE6] px-4 py-10 text-[#0A1F44]">
            <Head title="Privacy Notice" />
            <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow sm:p-10">
                <h1 className="text-2xl font-extrabold">StudyHub Privacy Notice</h1>
                <p className="mt-1 text-sm text-gray-600">In line with the Data Privacy Act of 2012 (Republic Act No. 10173).</p>

                <h2 className={h2}>What we collect</h2>
                <p>Your name, email, optional photo and bio, subjects, availability, study goal, messages and files you share in your circles, tasks, schedules, study-session minutes and ratings you give.</p>

                <h2 className={h2}>Why we collect it</h2>
                <p>To create your account, match you with study circles and partners, run group chat, tasks, schedules and progress tracking, and keep the platform safe (reports and moderation by administrators).</p>

                <h2 className={h2}>Who can see it</h2>
                <p>Only members of a circle can see its messages, files, tasks and schedule. Private and “specific people” events are visible only to the people chosen. Administrators can review reported content and manage accounts. We do not sell your data.</p>

                <h2 className={h2}>How we protect it</h2>
                <p>Passwords are stored hashed, uploaded files are stored privately and served only to authorized users, and suspended accounts are blocked from signing in.</p>

                <h2 className={h2}>Your rights</h2>
                <p>You may access and download your data, correct your profile, withdraw consent by deleting your account, and complain to the National Privacy Commission. {auth?.user ? <>Use <Link href={route('profile.edit')} className="font-semibold underline">Profile</Link> to download or delete your data.</> : 'Log in and open Profile to download or delete your data.'}</p>

                <p className="mt-8"><Link href={auth?.user ? route('dashboard') : route('register')} className="font-semibold underline">← Back</Link></p>
            </main>
        </div>
    );
}
