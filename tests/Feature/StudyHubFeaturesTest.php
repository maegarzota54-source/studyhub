<?php
namespace Tests\Feature;

use App\Models\{GroupRating, Message, Schedule, StudyGroup, User};
use App\Notifications\StudyHubNotice;
use App\Support\GroupMatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Covers the items the panel circled on the ISO/IEC 25010 sheet. */
class StudyHubFeaturesTest extends TestCase
{
    use RefreshDatabase;

    private function student(array $extra = []): User { return User::factory()->create($extra); }

    private function circle(User $owner, array $extra = []): StudyGroup {
        $g = StudyGroup::create($extra + ['owner_id' => $owner->id, 'title' => 'Code Club', 'topic' => 'Programming Basics',
            'skill_level' => 'beginner', 'mode' => 'online', 'max_members' => 10]);
        $g->members()->attach($owner->id, ['role' => 'admin']);
        return $g;
    }

    // ---------------- A2: automatic matching ----------------
    public function test_matching_suggests_circles_with_shared_subject_schedule_and_level(): void {
        $owner = $this->student();
        $match = $this->circle($owner, ['meeting_days' => ['Mon', 'Wed'], 'meeting_time' => 'evening']);
        $other = $this->circle($owner, ['title' => 'Cooking', 'topic' => 'Pastry', 'skill_level' => 'advanced', 'mode' => 'in-person']);
        $me = $this->student(['subjects' => ['programming'], 'availability' => ['days' => ['Mon'], 'time' => 'evening'],
            'study_preferences' => ['skill_level' => 'beginner', 'goal' => 'Learn programming', 'mode' => 'online']]);

        $ids = GroupMatcher::suggest($me)->pluck('id');
        $this->assertTrue($ids->contains($match->id));
        $this->assertFalse($ids->contains($other->id));
        // subject 30 + days 15 + evening 5 + level 15 + goal 10 + mode 10
        $this->assertSame(85, GroupMatcher::score($me, $match)['score']);
    }

    public function test_find_groups_page_receives_suggestions_and_hides_joined_circles(): void {
        $owner = $this->student();
        $g = $this->circle($owner);
        $me = $this->student(['subjects' => ['programming']]);
        $this->actingAs($me)->get('/groups/find')->assertInertia(fn (Assert $p) => $p->has('suggested', 1)->where('suggested.0.id', $g->id));
        $g->members()->attach($me->id, ['role' => 'member']);
        $this->actingAs($me)->get('/groups/find')->assertInertia(fn (Assert $p) => $p->has('suggested', 0));
    }

    public function test_joining_a_circle_goes_straight_to_my_groups(): void {
        $owner = $this->student();
        $g = $this->circle($owner);
        $me = $this->student();
        $this->actingAs($me)->post("/groups/{$g->id}/join")->assertRedirect(route('groups.index'));
        $this->assertTrue($g->fresh()->hasMember($me));
        $this->actingAs($me)->get('/groups')->assertInertia(fn (Assert $p) => $p->where('groups.0.id', $g->id));
        // joined circles no longer clutter Find Groups
        $this->actingAs($me)->get('/groups/find')->assertInertia(fn (Assert $p) => $p->where('groups.data', []));
    }

    public function test_full_circle_cannot_be_joined_and_stays_on_find_groups(): void {
        $owner = $this->student();
        $g = $this->circle($owner, ['max_members' => 2]);
        $g->members()->attach($this->student()->id, ['role' => 'member']);
        $me = $this->student();
        $this->actingAs($me)->from('/groups/find')->post("/groups/{$g->id}/join")->assertRedirect('/groups/find')->assertSessionHasErrors('join');
        $this->assertFalse($g->fresh()->hasMember($me));
    }

    public function test_suggested_for_you_falls_back_to_popular_circles_when_profile_is_empty(): void {
        $owner = $this->student();
        $g = $this->circle($owner);
        $me = $this->student();
        $this->actingAs($me)->get('/groups/find')->assertInertia(fn (Assert $p) => $p
            ->has('suggested', 0)->has('popular', 1)->where('popular.0.id', $g->id)->where('profileIncomplete', true));
    }

    public function test_matching_rewards_teacher_recommendation_and_topics_of_joined_circles(): void {
        $owner = $this->student();
        $joined = $this->circle($owner, ['title' => 'Alpha', 'topic' => 'Networking']);
        $rec = $this->circle($owner, ['title' => 'Beta', 'topic' => 'Networking', 'recommended_by' => 'Ms. Cruz']);
        $me = $this->student(['subjects' => []]);
        $joined->members()->attach($me->id, ['role' => 'member']);
        $s = GroupMatcher::score($me, $rec);
        $this->assertSame(10, $s['score']);                       // same topic 5 + recommended 5
        $this->assertContains('Recommended by Ms. Cruz', $s['reasons']);
        $this->assertCount(0, GroupMatcher::suggest($me));        // 10 is below the minimum, so no weak suggestion is shown
    }

    public function test_partners_share_subjects_and_filters_hide_suggestions(): void {
        $a = $this->student(['subjects' => ['Math']]); $b = $this->student(['subjects' => ['math', 'Art']]); $c = $this->student(['subjects' => ['Cooking']]);
        $ids = GroupMatcher::partners($a)->pluck('id');
        $this->assertTrue($ids->contains($b->id));
        $this->assertFalse($ids->contains($c->id));
        $this->actingAs($a)->get('/groups/find?q=zzz')->assertInertia(fn (Assert $p) => $p->has('suggested', 0)->has('partners', 0));
    }

    // ---------------- A6: group rating ----------------
    public function test_members_can_rate_once_and_rerating_updates(): void {
        $owner = $this->student(); $g = $this->circle($owner); $m = $this->student();
        $g->members()->attach($m->id, ['role' => 'member']);
        $this->actingAs($m)->post("/groups/{$g->id}/rating", ['stars' => 4, 'comment' => 'Helpful'])->assertSessionHasNoErrors();
        $this->actingAs($m)->post("/groups/{$g->id}/rating", ['stars' => 5])->assertSessionHasNoErrors();
        $this->assertSame(1, GroupRating::count());
        $this->assertSame(5, GroupRating::first()->stars);
    }

    public function test_non_members_cannot_rate_and_stars_are_validated(): void {
        $owner = $this->student(); $g = $this->circle($owner); $x = $this->student();
        $this->actingAs($x)->post("/groups/{$g->id}/rating", ['stars' => 5])->assertForbidden();
        $this->actingAs($owner)->post("/groups/{$g->id}/rating", ['stars' => 9])->assertSessionHasErrors('stars');
        $this->assertSame(0, GroupRating::count());
    }

    public function test_group_page_and_admin_list_show_the_average_rating(): void {
        $owner = $this->student(); $g = $this->circle($owner); $m = $this->student();
        $g->members()->attach($m->id, ['role' => 'member']);
        GroupRating::create(['study_group_id' => $g->id, 'user_id' => $owner->id, 'stars' => 5]);
        GroupRating::create(['study_group_id' => $g->id, 'user_id' => $m->id, 'stars' => 4]);
        $this->actingAs($m)->get("/groups/{$g->id}")->assertInertia(fn (Assert $p) => $p->where('rating.avg', 4.5)->where('rating.count', 2));
        $admin = $this->student(); $admin->forceFill(['role' => 'admin'])->save();
        $this->actingAs($admin)->get('/admin/groups')->assertInertia(fn (Assert $p) => $p->where('groups.data.0.ratings_count', 2));
    }

    public function test_admin_dashboard_reports_ratings(): void {
        $owner = $this->student(); $g = $this->circle($owner);
        GroupRating::create(['study_group_id' => $g->id, 'user_id' => $owner->id, 'stars' => 4]);
        $admin = $this->student(); $admin->forceFill(['role' => 'admin'])->save();
        $this->actingAs($admin)->get('/admin')->assertInertia(fn (Assert $p) => $p
            ->where('kpis.ratings_count', 1)->where('kpis.ratings_avg', 4)->where('topGroups.0.ratings_count', 1));
    }

    // ---------------- A3: manage members ----------------
    public function test_circle_admin_can_invite_promote_and_remove_but_members_cannot(): void {
        Notification::fake();
        $owner = $this->student(); $g = $this->circle($owner);
        $m = $this->student(); $g->members()->attach($m->id, ['role' => 'member']);
        $guest = $this->student();

        $this->actingAs($owner)->post("/groups/{$g->id}/invite", ['email' => $guest->email])->assertSessionHasNoErrors();
        Notification::assertSentTo($guest, StudyHubNotice::class);

        $this->actingAs($owner)->patch("/groups/{$g->id}/members/{$m->id}", ['role' => 'admin'])->assertSessionHasNoErrors();
        $this->assertSame('admin', $g->members()->whereKey($m->id)->first()->pivot->role);
        $this->actingAs($owner)->patch("/groups/{$g->id}/members/{$m->id}", ['role' => 'member']);

        $this->actingAs($m)->delete("/groups/{$g->id}/members/{$owner->id}")->assertForbidden();   // plain member
        $this->actingAs($owner)->delete("/groups/{$g->id}/members/{$owner->id}")->assertStatus(422); // owner is protected
        $this->actingAs($owner)->delete("/groups/{$g->id}/members/{$m->id}")->assertSessionHasNoErrors();
        $this->assertFalse($g->hasMember($m));
    }

    public function test_members_can_leave_but_owner_cannot(): void {
        $owner = $this->student(); $g = $this->circle($owner); $m = $this->student();
        $g->members()->attach($m->id, ['role' => 'member']);
        $this->actingAs($owner)->delete("/groups/{$g->id}/leave")->assertStatus(422);
        $this->actingAs($m)->delete("/groups/{$g->id}/leave")->assertRedirect(route('groups.index'));
        $this->assertFalse($g->hasMember($m));
    }

    // ---------------- A4 / E: role-based access, suspension ----------------
    public function test_students_cannot_open_admin_pages_but_admins_can(): void {
        $s = $this->student(); $a = $this->student(); $a->forceFill(['role' => 'admin'])->save();
        foreach (['/admin', '/admin/users', '/admin/groups', '/admin/reports'] as $url) {
            $this->actingAs($s)->get($url)->assertForbidden();
            $this->actingAs($a)->get($url)->assertOk();
        }
    }

    public function test_suspended_users_are_blocked_and_logged_out(): void {
        $u = $this->student(); $u->forceFill(['is_suspended' => true])->save();
        $this->actingAs($u)->get('/dashboard')->assertRedirect(route('login'));
        $this->assertGuest();
    }

    // ---------------- A5 / E: only members see a circle's content ----------------
    public function test_non_members_cannot_open_a_circle_or_its_attachments(): void {
        $owner = $this->student(); $g = $this->circle($owner); $x = $this->student();
        $msg = Message::create(['study_group_id' => $g->id, 'sender_id' => $owner->id, 'body' => 'secret', 'kind' => 'message',
            'attachment_path' => 'chat/secret.pdf', 'attachment_name' => 'secret.pdf']);
        $this->actingAs($x)->get("/groups/{$g->id}")->assertForbidden();
        $this->actingAs($x)->get("/messages/{$msg->id}/attachment")->assertForbidden();
        $this->actingAs($x)->post("/groups/{$g->id}/messages", ['body' => 'hi', 'kind' => 'message'])->assertForbidden();
    }

    public function test_private_schedule_events_are_visible_only_to_their_owner(): void {
        $a = $this->student(); $b = $this->student();
        $this->actingAs($a)->post('/schedule', ['title' => 'My private review', 'starts_at' => now()->addDay()->toDateTimeString(), 'visibility' => 'private']);
        $this->assertSame(1, Schedule::visibleTo($a)->count());
        $this->assertSame(0, Schedule::visibleTo($b)->count());
    }

    // ---------------- E: data privacy (RA 10173) ----------------
    public function test_registration_requires_privacy_consent_and_records_it(): void {
        $base = ['name' => 'Ana Reyes', 'email' => 'ana@example.com', 'password' => 'Password1!', 'password_confirmation' => 'Password1!'];
        $this->post('/register', $base)->assertSessionHasErrors('privacy_consent');
        $this->assertSame(0, User::count());
        $this->post('/register', $base + ['privacy_consent' => true])->assertSessionHasNoErrors();
        $u = User::first();
        $this->assertNotNull($u->privacy_consent_at);
        $this->assertTrue(password_verify('Password1!', $u->password));   // stored hashed
        $this->assertNotSame('Password1!', $u->password);
    }

    public function test_privacy_notice_is_public_and_students_can_download_their_data(): void {
        $this->get('/privacy')->assertOk();
        $u = $this->student(['subjects' => ['math']]);
        $r = $this->actingAs($u)->get('/profile/export');
        $r->assertOk()->assertHeader('content-disposition');
        $json = json_decode($r->streamedContent(), true);
        $this->assertSame($u->email, $json['profile']['email']);
        $this->assertSame(['math'], $json['profile']['subjects']);
    }

    public function test_profile_saves_subjects_and_availability_used_for_matching(): void {
        $u = $this->student();
        $this->actingAs($u)->from('/profile')->patch('/profile', ['name' => 'N', 'email' => $u->email, 'subjects' => ['Math', 'Physics'],
            'availability' => ['days' => ['Tue', 'Thu'], 'time' => 'morning']])->assertSessionHasNoErrors();
        $u->refresh();
        $this->assertSame(['Math', 'Physics'], $u->subjects);
        $this->assertSame('morning', $u->availability['time']);
    }
}
