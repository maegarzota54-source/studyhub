<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Story extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['expires_at' => 'datetime']; }

    public function user() { return $this->belongsTo(User::class); }
    /** People a "specific people" story was shared with. */
    public function allowed() { return $this->belongsToMany(User::class, 'story_viewers'); }
    /** People who opened the story. */
    public function views() { return $this->belongsToMany(User::class, 'story_views')->withPivot('viewed_at'); }

    public function scopeActive(Builder $q): Builder { return $q->where('expires_at', '>', now()); }

    /** Owner always; everyone else only while it is live and the audience allows them. */
    public function scopeVisibleTo(Builder $q, User $u): Builder
    {
        return $q->where(function (Builder $w) use ($u) {
            $w->where('user_id', $u->id)
              ->orWhere(function (Builder $o) use ($u) {
                  $o->where('expires_at', '>', now())->where(function (Builder $a) use ($u) {
                      $a->where('audience', 'public')
                        ->orWhere(fn (Builder $s) => $s->where('audience', 'specific')
                            ->whereHas('allowed', fn (Builder $x) => $x->where('users.id', $u->id)));
                  });
              });
        });
    }
}
