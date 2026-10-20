<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NoteFile extends Model
{
    protected $table = 'notes_files';
    protected $guarded = ['id'];
    public function user() { return $this->belongsTo(User::class); }
    public function group() { return $this->belongsTo(StudyGroup::class, 'study_group_id'); }
    public function message() { return $this->belongsTo(Message::class); }
    public function scopeVisibleTo($q, User $u) {
        return $q->where(fn ($w) => $w->where('user_id', $u->id)
            ->orWhereIn('study_group_id', $u->groups()->pluck('study_groups.id')));
    }
}
