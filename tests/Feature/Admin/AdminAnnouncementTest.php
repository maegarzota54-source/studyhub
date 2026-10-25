<?php

namespace Tests\Feature\Admin;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAnnouncementTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $name, string $role = 'student'): User
    {
        $user = User::create([
            'name' => $name,
            'email' => strtolower($name).'@example.test',
            'email_verified_at' => now(),
            'password' => 'password',
        ]);

        $user->forceFill(['role' => $role])->save();

        return $user;
    }

    private function settingsPayload(string $announcement, bool $enabled = true): array
    {
        return [
            'announcement' => $announcement,
            'announcement_enabled' => $enabled,
            'max_group_size' => 50,
        ];
    }

    public function test_enabled_announcement_is_sent_to_students_and_shown_in_their_notifications(): void
    {
        $admin = $this->makeUser('admin', 'admin');
        $student = $this->makeUser('student');
        $anotherStudent = $this->makeUser('anotherstudent');
        $anotherAdmin = $this->makeUser('anotheradmin', 'admin');

        $this->actingAs($admin)->post(route('admin.settings.save'), $this->settingsPayload('Exam week updates'))
            ->assertRedirect();

        $notification = $student->notifications()->first();
        $this->assertNotNull($notification);
        $this->assertSame('Admin announcement: Exam week updates', $notification->data['message']);
        $this->assertSame(route('notifications.index', [], false), $notification->data['url']);
        $this->assertSame(1, $anotherStudent->notifications()->count());
        $this->assertSame(0, $admin->notifications()->count());
        $this->assertSame(0, $anotherAdmin->notifications()->count());

        $this->actingAs($student)->get(route('notifications.index'))
            ->assertOk()
            ->assertSee('Admin announcement: Exam week updates')
            ->assertInertia(fn ($page) => $page
                ->component('Notifications')
                ->has('recent_notifications', 1)
                ->where('recent_notifications.0.message', 'Admin announcement: Exam week updates')
                ->has('recent', 1)
                ->where('recent.0.message', 'Admin announcement: Exam week updates'));
    }

    public function test_saving_an_unchanged_enabled_announcement_does_not_send_it_again(): void
    {
        $admin = $this->makeUser('admin', 'admin');
        $student = $this->makeUser('student');
        Setting::put('announcement', 'Exam week updates');
        Setting::put('announcement_enabled', '1');
        Setting::put('announcement_last_notified', 'Exam week updates');

        $this->actingAs($admin)->post(route('admin.settings.save'), $this->settingsPayload('Exam week updates'))
            ->assertRedirect();

        $this->assertSame(0, $student->notifications()->count());
    }

    public function test_changed_announcement_is_sent_as_a_new_notification(): void
    {
        $admin = $this->makeUser('admin', 'admin');
        $student = $this->makeUser('student');
        Setting::put('announcement', 'Old message');
        Setting::put('announcement_enabled', '1');
        Setting::put('announcement_last_notified', 'Old message');

        $this->actingAs($admin)->post(route('admin.settings.save'), $this->settingsPayload('Updated message'))
            ->assertRedirect();

        $this->assertSame(1, $student->notifications()->count());
        $this->assertSame('Admin announcement: Updated message', $student->notifications()->first()->data['message']);
    }

    public function test_disabled_announcement_is_not_sent_and_can_be_sent_again_when_reenabled(): void
    {
        $admin = $this->makeUser('admin', 'admin');
        $student = $this->makeUser('student');
        Setting::put('announcement', 'Exam week updates');
        Setting::put('announcement_enabled', '1');
        Setting::put('announcement_last_notified', 'Exam week updates');

        $this->actingAs($admin)->post(route('admin.settings.save'), $this->settingsPayload('Exam week updates', false))
            ->assertRedirect();

        $this->assertSame(0, $student->notifications()->count());
        $this->assertSame('', Setting::get('announcement_last_notified'));

        $this->actingAs($admin)->post(route('admin.settings.save'), $this->settingsPayload('Exam week updates'))
            ->assertRedirect();

        $this->assertSame(1, $student->notifications()->count());
    }

    public function test_student_cannot_publish_an_announcement(): void
    {
        $student = $this->makeUser('student');

        $this->actingAs($student)->post(route('admin.settings.save'), $this->settingsPayload('Private message'))
            ->assertForbidden();

        $this->assertSame(0, $student->notifications()->count());
        $this->assertNull(Setting::get('announcement'));
    }
}
