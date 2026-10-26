<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A permanent record of one admin action (what was done, by whom, and a copy of what was removed). */
class ModerationLog extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['details' => 'array']; }
    public function admin() { return $this->belongsTo(User::class, 'admin_id'); }

    public static function record(?User $admin, string $action, string $type, ?int $id, string $summary, array $details = []): self {
        return static::create([
            'admin_id' => $admin?->id, 'action' => $action, 'target_type' => $type, 'target_id' => $id,
            'summary' => mb_substr($summary, 0, 255), 'details' => $details ?: null,
        ]);
    }
}
