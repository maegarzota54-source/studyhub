import { Head } from '@inertiajs/react';
import AppLayout, { Card } from '@/Layouts/AppLayout';
import ProfileDetailsForm from './Partials/ProfileDetailsForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import DeleteUserForm from './Partials/DeleteUserForm';

export default function Edit({ status }) {
    return (
        <AppLayout title="Profile">
            <Head title="Profile" />
            <div className="mx-auto max-w-3xl space-y-6">
                <Card><ProfileDetailsForm status={status} /></Card>
                <Card><UpdatePasswordForm className="max-w-xl" /></Card>
                <Card><DeleteUserForm className="max-w-xl" /></Card>
            </div>
        </AppLayout>
    );
}