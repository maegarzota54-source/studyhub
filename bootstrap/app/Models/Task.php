<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['due_date' => 'date:Y-m-d']; }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    /** Phase 4: any number of assigned members. */
    public function assignees() { return $this->belongsToMany(User::class, 'task_user')->select('users.id', 'users.name', 'users.avatar'); }
    public function group() { return $this->belongsTo(StudyGroup::class, 'study_group_id'); }
    public function comments() { return $this->hasMany(TaskComment::class)->with('user:id,name,avatar')->oldest(); }
    public function scopeVisibleTo($q, User $u) {
        return $q->where(fn ($w) => $w->where('created_by', $u->id)
            ->orWhereHas('assignees', fn ($a) => $a->where('users.id', $u->id))
            ->orWhereIn('study_group_id', $u->groups()->pluck('study_groups.id')));
    }
    public function canManage(User $u): bool {   // edit details, assign, share, delete
        return $this->created_by === $u->id || ($this->group && $this->group->isGroupAdmin($u));
    }
    public function canEdit(User $u): bool {     // also lets assigned members tick it off
        return $this->canManage($u) || $this->assignees->contains('id', $u->id);
    }
}
