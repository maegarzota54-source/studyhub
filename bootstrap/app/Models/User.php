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
    /**
     * Phase 1: avatars are served by the app itself (route profile.avatar), so nobody has to run
     * `php artisan storage:link`. The ?v= part changes whenever a new photo is uploaded, which busts the browser cache.
     */
    public function getAvatarUrlAttribute(): string {
        if ($this->avatar && $this->id) {
            return route('profile.avatar', $this->id, false).'?v='.substr(md5($this->avatar), 0, 8);
        }
        return 'https://ui-avatars.com/api/?background=355E3B&color=fff&name='.urlencode($this->name ?? 'User');
    }
}
