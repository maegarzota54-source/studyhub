<?php
namespace App\Support;

use App\Models\{StudyGroup, User};
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Automatic group matching ("Suggested for you").
 * Scores every open circle the student has not joined against their profile, out of 100:
 *   subjects 30 · free days 15 · time of day 5 · skill level 15 (7 if one step apart) · study goal 10
 *   · study mode 10 · same topic as joined circles 5 · teacher recommended 5 · session this week 5
 * The best matches are returned with `score` / `why` (shown on the cards) and, for older components,
 * the same values as `match_score` / `match_reasons`.
 */
class GroupMatcher
{
    public const MIN_SCORE = 20;

    /** @return string[] lowercase words of at least $min letters */
    private static function words(?string $text, int $min = 4): array {
        return collect(preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower((string) $text)))
            ->filter(fn ($w) => mb_strlen($w) >= $min)->unique()->values()->all();
    }

    /** Topics of the circles the student already joined (lowercase). */
    private static function myTopics(User $u): array {
        return $u->groups()->pluck('topic')->map(fn ($t) => mb_strtolower($t))->all();
    }

    /** Ids of circles that have a public session in the next 7 days, as [id => 0]. */
    private static function soon(): array {
        return DB::table('schedules')->where('visibility', 'public')->whereBetween('starts_at', [now(), now()->addDays(7)])
            ->pluck('study_group_id')->unique()->flip()->all();
    }

    /** @return array{score:int, reasons:string[]} */
    public static function score(User $u, StudyGroup $g, ?array $myTopics = null, ?array $soon = null): array {
        $score = 0; $why = [];
        $prefs = $u->study_preferences ?? [];
        $myTopics ??= self::myTopics($u);
        $soon ??= self::soon();
        $hay = mb_strtolower($g->topic.' '.$g->title.' '.$g->description);

        // Subjects (30): one of my subjects appears in the circle's topic, title or description.
        $hit = collect($u->subjects ?? [])->map(fn ($s) => mb_strtolower(trim($s)))
            ->filter(fn ($s) => $s !== '' && str_contains($hay, $s));
        if ($hit->isNotEmpty()) { $score += 30; $why[] = 'Subject: '.$hit->first(); }

        // Schedule (20): shared meeting days (15) + same time of day (5).
        $shared = array_values(array_intersect($u->availability['days'] ?? [], $g->meeting_days ?? []));
        if ($shared) { $score += 15; $why[] = 'Free on '.implode(', ', $shared); }
        $time = $u->availability['time'] ?? null;
        if ($time && $time === $g->meeting_time) { $score += 5; $why[] = ucfirst($time).' sessions'; }

        // Skill level (15): same level = 15, one step apart = 7.
        $order = ['beginner' => 0, 'intermediate' => 1, 'advanced' => 2];
        $a = $order[$prefs['skill_level'] ?? ''] ?? null; $b = $order[$g->skill_level] ?? null;
        if ($a !== null && $b !== null) {
            if ($a === $b) { $score += 15; $why[] = 'Matches your level'; }
            elseif (abs($a - $b) === 1) { $score += 7; }
        }

        // Study goal (10): words from the goal appear in the circle's text.
        $goal = self::words($prefs['goal'] ?? '');
        if ($goal && collect($goal)->contains(fn ($w) => str_contains($hay, $w))) { $score += 10; $why[] = 'Fits your goal'; }

        // Study mode (10): online / in-person preference.
        if (!empty($prefs['mode']) && $prefs['mode'] === $g->mode) { $score += 10; $why[] = 'Your study mode'; }

        // Same topic as a circle I already joined (5), teacher recommendation (5), a session this week (5).
        if (in_array(mb_strtolower($g->topic), $myTopics, true)) { $score += 5; $why[] = 'Same topic as your circles'; }
        if ($g->recommended_by) { $score += 5; $why[] = "Recommended by {$g->recommended_by}"; }
        if (isset($soon[$g->id])) { $score += 5; $why[] = 'Session this week'; }

        return ['score' => min(100, $score), 'reasons' => $why];
    }

    /** Open circles the student has not joined, best match first. */
    public static function suggest(User $u, int $limit = 6): Collection {
        $topics = self::myTopics($u); $soon = self::soon();
        return StudyGroup::query()->withCount(['members', 'ratings'])->withAvg('ratings', 'stars')
            ->with('members:users.id,users.name,users.avatar')
            ->whereDoesntHave('members', fn ($q) => $q->whereKey($u->id))
            ->latest()->limit(100)->get()
            ->filter(fn ($g) => $g->members_count < $g->max_members)
            ->map(function ($g) use ($u, $topics, $soon) {
                $m = self::score($u, $g, $topics, $soon);
                $g->setAttribute('score', $m['score']);          $g->setAttribute('why', $m['reasons']);
                $g->setAttribute('match_score', $m['score']);    $g->setAttribute('match_reasons', $m['reasons']);
                $g->setAttribute('is_member', false);
                return $g;
            })
            ->filter(fn ($g) => $g->score >= self::MIN_SCORE)
            ->sortByDesc('score')->take($limit)->values();
    }

    /** Study partners: active students who share subjects (60) / free days (25) / skill level (15) with me. */
    public static function partners(User $u, int $limit = 6): Collection {
        $mine = collect($u->subjects ?? [])->map(fn ($s) => mb_strtolower($s));
        return User::where('id', '!=', $u->id)->where('role', 'student')->where('is_suspended', false)
            ->orderByDesc('last_seen_at')->limit(300)->get()      // recently active students only, keeps the page fast
            ->map(function ($p) use ($u, $mine) {
                $common = collect($p->subjects ?? [])->filter(fn ($s) => $mine->contains(mb_strtolower($s)))->values();
                $days = array_intersect($u->availability['days'] ?? [], $p->availability['days'] ?? []);
                $score = ($common->isNotEmpty() ? 60 : 0) + ($days ? 25 : 0)
                    + ((($u->study_preferences['skill_level'] ?? 'x') === ($p->study_preferences['skill_level'] ?? 'y')) ? 15 : 0);
                return ['id' => $p->id, 'name' => $p->name, 'avatar_url' => $p->avatar_url, 'bio' => $p->bio,
                    'score' => $score, 'common_subjects' => $common->all()];
            })
            ->filter(fn ($p) => $p['score'] >= 60)->sortByDesc('score')->take($limit)->values();
    }
}
