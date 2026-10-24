<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['is_flagged' => 'boolean']; }
    public function sender() { return $this->belongsTo(User::class, 'sender_id'); }
    public function recipient() { return $this->belongsTo(User::class, 'recipient_id'); }

    public function parent() { return $this->belongsTo(self::class, 'parent_id'); }
    public function replies() { return $this->hasMany(self::class, 'parent_id')->oldest(); }
    /** Notes & Files copies auto-saved from this message's attachment. */
    public function savedFiles() { return $this->hasMany(NoteFile::class, 'message_id'); }
    public function reactions() { return $this->belongsToMany(User::class, 'message_reactions')->withPivot('emoji')->withTimestamps(); }
    public function hiddenByUsers() { return $this->belongsToMany(User::class, 'message_user_hides')->withPivot('created_at'); }
    public function task() { return $this->belongsTo(Task::class)->select('id', 'title', 'status', 'due_date'); }
    public function group() { return $this->belongsTo(StudyGroup::class, 'study_group_id'); }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->whereDoesntHave('hiddenByUsers', fn (Builder $users) => $users->where('users.id', $user->id));
    }
}
