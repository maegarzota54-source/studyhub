<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GroupReading extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['started_at' => 'datetime']; }
    public function user() { return $this->belongsTo(User::class); }
    public function message() { return $this->belongsTo(Message::class); }
}
