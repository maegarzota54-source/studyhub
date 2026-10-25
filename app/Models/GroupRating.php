<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GroupRating extends Model
{
    protected $guarded = ['id'];
    public function group() { return $this->belongsTo(StudyGroup::class, 'study_group_id'); }
    public function user() { return $this->belongsTo(User::class); }
}
