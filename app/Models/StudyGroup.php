<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudyGroup extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['target_date' => 'date:Y-m-d']; }
    public function owner() { return $this->belongsTo(User::class, 'owner_id'); }
    public function members() { return $this->belongsToMany(User::class, 'group_members')->withPivot('role')->withTimestamps(); }
    public function messages() { return $this->hasMany(Message::class); }
    public function files() { return $this->hasMany(NoteFile::class); }
    public function hasMember(User $u): bool { return $this->members()->whereKey($u->id)->exists(); }
    public function isGroupAdmin(User $u): bool {
        return $u->isAdmin() || $this->members()->whereKey($u->id)->wherePivot('role', 'admin')->exists();
    }
}
