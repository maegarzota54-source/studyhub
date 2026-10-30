<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'completed_at' => 'datetime']; }
    public function user() { return $this->belongsTo(User::class); }
    public function group() { return $this->belongsTo(StudyGroup::class, 'study_group_id'); }
    public function attendees() { return $this->belongsToMany(User::class, 'schedule_user'); }

    /** The host, a circle admin or a site admin may mark a session completed. */
    public function canComplete(User $u): bool {
        return $this->user_id === $u->id || $u->isAdmin() || ($this->group && $this->group->isGroupAdmin($u));
    }

    /** Sets `can_complete` on each event with one query (so the pages can show the button without N+1 lookups). */
    public static function flagCompletable($events, User $u): void {
        $adminGroups = $u->isAdmin() ? null : \Illuminate\Support\Facades\DB::table('group_members')->where('user_id', $u->id)->where('role', 'admin')->pluck('study_group_id')->all();
        foreach ($events as $e) {
            $e->setAttribute('can_complete', $e->user_id === $u->id || $adminGroups === null || ($e->study_group_id && in_array($e->study_group_id, $adminGroups)));
        }
    }

    /** public = every circle member; private = owner only; specific = owner + chosen attendees */
    public function scopeVisibleTo($q, User $u) {
        $groupIds = $u->groups()->pluck('study_groups.id');
        return $q->where(function ($w) use ($u, $groupIds) {
            $w->where('user_id', $u->id)
              ->orWhere(fn ($x) => $x->where('visibility', 'public')->whereIn('study_group_id', $groupIds))
              ->orWhere(fn ($x) => $x->where('visibility', 'specific')->whereHas('attendees', fn ($a) => $a->whereKey($u->id)));
        });
    }
}
