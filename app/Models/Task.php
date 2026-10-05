<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['due_date' => 'date:Y-m-d']; }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function assignee() { return $this->belongsTo(User::class, 'assignee_id'); }
    public function group() { return $this->belongsTo(StudyGroup::class, 'study_group_id'); }
    public function comments() { return $this->hasMany(TaskComment::class)->with('user:id,name,avatar')->oldest(); }
    public function scopeVisibleTo($q, User $u) {
        return $q->where(fn ($w) => $w->where('created_by', $u->id)->orWhere('assignee_id', $u->id)
            ->orWhereIn('study_group_id', $u->groups()->pluck('study_groups.id')));
    }
}
