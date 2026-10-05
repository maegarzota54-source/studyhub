<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudySession extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['studied_on' => 'date:Y-m-d']; }
    public function user() { return $this->belongsTo(User::class); }
    public function group() { return $this->belongsTo(StudyGroup::class, 'study_group_id'); }
}
