<?php
namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;
    protected $guarded = ['id', 'role', 'is_suspended'];
    protected $hidden = ['password', 'remember_token'];
    protected $appends = ['avatar_url'];

    protected function casts(): array {
        return ['email_verified_at' => 'datetime', 'password' => 'hashed',
                'study_preferences' => 'array', 'last_seen_at' => 'datetime', 'is_suspended' => 'boolean'];
    }
    public function isAdmin(): bool { return $this->role === 'admin'; }
    public function groups() { return $this->belongsToMany(StudyGroup::class, 'group_members')->withPivot('role')->withTimestamps(); }
    public function studySessions() { return $this->hasMany(StudySession::class); }
    public function getAvatarUrlAttribute(): string {
        return $this->avatar ? asset('storage/'.$this->avatar)
            : 'https://ui-avatars.com/api/?background=355E3B&color=fff&name='.urlencode($this->name);
    }
}
