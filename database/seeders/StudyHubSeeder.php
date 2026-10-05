<?php
namespace Database\Seeders;

use App\Models\{StudyGroup, User};
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class StudyHubSeeder extends Seeder
{
    public function run(): void {
        $admin = User::forceCreate(['name' => 'Admin', 'email' => 'admin@studyhub.test', 'password' => Hash::make('password'), 'role' => 'admin', 'email_verified_at' => now()]);
        $anna = User::forceCreate(['name' => 'Anna Reyes', 'email' => 'anna@studyhub.test', 'password' => Hash::make('password'), 'email_verified_at' => now()]);
        $mark = User::forceCreate(['name' => 'Mark Santos', 'email' => 'mark@studyhub.test', 'password' => Hash::make('password'), 'email_verified_at' => now()]);
        $g = StudyGroup::create(['owner_id' => $anna->id, 'title' => 'Math Study Group', 'topic' => 'Calculus', 'description' => 'Pass the exam together.', 'target_date' => now()->addMonth()]);
        $g->members()->attach($anna->id, ['role' => 'admin']);
        $g->members()->attach($mark->id, ['role' => 'member']);
    }
}
