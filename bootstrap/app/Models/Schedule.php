<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['starts_at' => 'datetime', 'ends_at' => 'datetime']; }
    public function user() { return $this->belongsTo(User::class); }
    public function group() { return $this->belongsTo(StudyGroup::class, 'study_group_id'); }
    public function attendees() { return $this->belongsToMany(User::class, 'schedule_user'); }

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
