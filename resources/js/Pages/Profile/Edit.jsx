import { Head, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import AdminLayout from '@/Layouts/AdminLayout';
import ProfileDetailsForm from './Partials/ProfileDetailsForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import DeleteUserForm from './Partials/DeleteUserForm';

const Box = ({ children }) => <div className="rounded-xl border border-gray-200 bg-white p-5">{children}</div>;

export default function Edit({ status }) {
    const admin = usePage().url.includes('view=admin');
    const Layout = admin ? AdminLayout : AppLayout;
    const layoutProps = admin ? { title: 'Profile settings', crumbs: [['Profile']] } : { title: 'Profile' };

    return (
        <Layout {...layoutProps}>
            <Head title="Profile" />
            <div className="mx-auto max-w-3xl space-y-6">
                <Box><ProfileDetailsForm status={status} /></Box>
                <Box><UpdatePasswordForm className="max-w-xl" /></Box>
                <Box><DeleteUserForm className="max-w-xl" /></Box>
            </div>
        </Layout>
    );
}