<?php
namespace App\Services;

use ZipArchive;

/**
 * Builds flashcards, multiple-choice and situational questions from plain study text.
 * No AI involved: it looks for patterns ("Term: definition", "X is ...", "If ..., ...") and
 * quality depends on how structured the notes are. Output is deterministic for the same text + seed.
 */
class StudyQuiz
{
    private const MAX_TEXT = 300000;
    private const STOP = ['which', 'about', 'there', 'their', 'these', 'those', 'would', 'could', 'should', 'being', 'where', 'while', 'because', 'between', 'through', 'during', 'before', 'after', 'other', 'another', 'without', 'within', 'using', 'usually', 'called', 'refers', 'defined', 'something', 'anything', 'example', 'important'];
    private const BAD_TERM_START = ['it', 'this', 'that', 'they', 'there', 'he', 'she', 'we', 'you', 'i', 'these', 'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'if', 'also', 'so', 'then', 'and', 'but', 'or'];

    /** Plain text of a stored file, or null when we cannot read that type. $notice gets a hint when it fails. */
    public static function extractText(string $absPath, string $ext, ?string &$notice = null): ?string
    {
        $ext = strtolower($ext);
        if (!is_file($absPath)) return null;
        if (in_array($ext, ['txt', 'md', 'csv', 'log'], true)) {
            return self::clean((string) file_get_contents($absPath, false, null, 0, self::MAX_TEXT));
        }
        if ($ext === 'docx') {
            if (!class_exists(ZipArchive::class)) { $notice = 'The PHP zip extension is not enabled, so Word files cannot be read.'; return null; }
            $zip = new ZipArchive();
            if ($zip->open($absPath) !== true) { $notice = 'Could not open this Word file.'; return null; }
            $xml = $zip->getFromName('word/document.xml'); $zip->close();
            if ($xml === false) { $notice = 'This Word file has no readable text.'; return null; }
            $xml = preg_replace('#</w:p>#', "\n", $xml);
            $xml = preg_replace('#<w:(tab|br)\b[^>]*/>#', ' ', $xml);
            return self::clean(html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8'));
        }
        if ($ext === 'pptx') {
            if (!class_exists(ZipArchive::class)) { $notice = 'The PHP zip extension is not enabled, so PowerPoint files cannot be read.'; return null; }
            $zip = new ZipArchive();
            if ($zip->open($absPath) !== true) { $notice = 'Could not open this PowerPoint file.'; return null; }
            $slides = [];
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = (string) $zip->getNameIndex($i);
                if (preg_match('#^ppt/slides/slide(\d+)\.xml$#', $name, $m)) $slides[(int) $m[1]] = $name;
            }
            ksort($slides);
            $out = [];
            foreach (array_slice($slides, 0, 200, true) as $name) {
                $xml = $zip->getFromName($name);
                if ($xml === false) continue;
                $xml = preg_replace('#</a:p>#', "\n", $xml);
                $xml = preg_replace('#<a:br\b[^>]*/>#', "\n", $xml);
                $t = trim(html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8'));
                if ($t !== '') $out[] = $t;
            }
            $zip->close();
            if (!$out) { $notice = 'This PowerPoint has no readable text (maybe only pictures).'; return null; }
            return self::clean(mb_substr(implode("\n\n", $out), 0, self::MAX_TEXT));
        }
        if ($ext === 'pdf') {
            if (!class_exists(\Smalot\PdfParser\Parser::class)) { $notice = 'PDF reading is not installed on the server. Run: composer require smalot/pdfparser'; return null; }
            try {
                $text = (new \Smalot\PdfParser\Parser())->parseFile($absPath)->getText();
            } catch (\Throwable $e) { $notice = 'Could not read text from this PDF (it may be scanned images).'; return null; }
            if (trim($text) === '') { $notice = 'This PDF has no selectable text (maybe scanned images).'; return null; }
            return self::clean(mb_substr($text, 0, self::MAX_TEXT));
        }
        $notice = 'Question generation supports notes and .txt, .md, .csv, .docx, .pptx and .pdf files.';
        return null;
    }

    private static function clean(string $t): string
    {
        $t = str_replace(["\r\n", "\r", "\xC2\xA0"], ["\n", "\n", ' '], $t);
        $t = preg_replace('/[ \t]+/', ' ', $t);
        $t = preg_replace("/\n{3,}/", "\n\n", $t);
        return trim($t);
    }

    /** @return array{flashcards:array,multiple_choice:array,situational:array,notes:array} */
    public static function build(string $text, int $seed = 1): array
    {
        $text = self::clean($text);
        $notes = [];
        $pairs = self::findPairs($text);
        $sentences = self::sentences($text);
        $covered = array_map(fn ($p) => mb_strtolower(rtrim($p['definition'], '.')), $pairs);
        $isCovered = function (string $sentence) use ($covered) {
            $l = mb_strtolower($sentence);
            foreach ($covered as $d) if ($d !== '' && mb_strpos($l, $d) !== false) return true;
            return false;
        };

        // ---- flashcards
        $cards = [];
        foreach ($pairs as $p) {
            $cards[] = ['front' => self::ask($p['term']), 'back' => $p['definition']];
        }
        $clozes = [];
        foreach ($sentences as $s) {
            if ($isCovered($s)) continue;
            if ($c = self::cloze($s)) $clozes[] = $c;
        }
        foreach (array_slice($clozes, 0, max(0, 30 - count($cards))) as $c) {
            $cards[] = ['front' => $c['text'], 'back' => $c['answer']];
        }

        // ---- multiple choice
        $mc = [];
        $terms = array_values(array_unique(array_map(fn ($p) => $p['term'], $pairs)));
        $i = 0;
        foreach ($pairs as $p) {
            if (count($terms) < 4) break;
            $i++;
            $short = mb_strlen($p['definition']) <= 140;
            if ($short && $i % 2 === 0) {
                $others = array_values(array_filter($pairs, fn ($q) => $q['term'] !== $p['term']));
                $wrong = self::pick(array_map(fn ($q) => self::trim($q['definition'], 140), $others), 3, $seed + $i);
                if (count($wrong) < 3) continue;
                $mc[] = self::mcq('What is ' . $p['term'] . '?', self::trim($p['definition'], 140), $wrong, $seed + $i, $p['term'] . ': ' . $p['definition']);
            } else {
                $wrong = self::pick(array_values(array_filter($terms, fn ($t) => $t !== $p['term'])), 3, $seed + $i);
                if (count($wrong) < 3) continue;
                $mc[] = self::mcq('Which term matches this description? "' . self::trim($p['definition'], 200) . '"', $p['term'], $wrong, $seed + $i, $p['term'] . ': ' . $p['definition']);
            }
        }
        $vocab = self::vocabulary($clozes);
        foreach ($clozes as $c) {
            if (count($mc) >= 20 || count($vocab) < 4) break;
            $pool = array_values(array_filter($vocab, fn ($w) => mb_strtolower($w) !== mb_strtolower($c['answer'])));
            $wrong = self::similar($pool, $c['answer'], 3, $seed + count($mc) + 50);
            if (count($wrong) < 3) continue;
            $mc[] = self::mcq('Fill in the blank: ' . $c['text'], $c['answer'], $wrong, $seed + count($mc), $c['sentence']);
        }
        $mc = array_slice($mc, 0, 20);

        // ---- situational (conditional / rule sentences), template fallback from definitions
        $sit = [];
        foreach ($sentences as $s) {
            if ($r = self::situation($s)) $sit[] = $r;
        }
        $answers = array_map(fn ($r) => $r['answer'], $sit);
        foreach ($sit as $k => &$r) {
            $wrong = self::pick(array_values(array_filter($answers, fn ($a) => $a !== $r['answer'])), 3, $seed + $k + 99);
            if (count($wrong) >= 3) {
                $opts = self::shuffle(array_merge([$r['answer']], $wrong), $seed + $k);
                $r['options'] = $opts; $r['correct'] = array_search($r['answer'], $opts, true);
            } else { $r['options'] = null; $r['correct'] = null; }
        }
        unset($r);
        $sit = array_slice($sit, 0, 15);
        if (count($sit) < 3) {
            foreach (array_slice($pairs, 0, 5) as $p) {
                $sit[] = ['situation' => 'A classmate who missed the lesson asks you what "' . $p['term'] . '" means and why it matters. How do you explain it?', 'answer' => $p['definition'], 'options' => null, 'correct' => null, 'template' => true];
            }
            if ($sit) $notes[] = 'Not many "If … then …" or "Use … when …" sentences were found, so some situational questions use a simple template. Write rules like "If the node has no children, it is a leaf." for better ones.';
        }

        if (!$cards && !$mc && !$sit) {
            $notes[] = 'Nothing could be generated from this text. Write notes in a pattern like "Term: definition", "X is …", or "If …, then …" and try again.';
        } elseif (!$pairs) {
            $notes[] = 'Tip: lines like "Term: definition" give the best flashcards and multiple-choice questions.';
        }
        if ($mc === [] && ($cards || $sit)) $notes[] = 'Multiple choice needs at least 4 different terms or key words to build wrong answers from.';

        return ['flashcards' => array_slice($cards, 0, 30), 'multiple_choice' => $mc, 'situational' => $sit, 'notes' => $notes];
    }

    // ------------------------------------------------------------------ finders

    /** "Term: definition", "Term - definition", "X is/are/means/refers to Y". */
    private static function findPairs(string $text): array
    {
        $pairs = []; $seen = [];
        $add = function (string $term, string $def) use (&$pairs, &$seen) {
            $term = trim(preg_replace('/^(?:an?|the)\s+/iu', '', trim($term, " \t-*•:;,.")));
            $def = self::cap(trim($def));
            $key = mb_strtolower($term);
            $words = preg_split('/\s+/', $term);
            if ($term === '' || isset($seen[$key]) || count($words) > 6 || mb_strlen($term) > 60 || mb_strlen($def) < 12) return;
            if (in_array(mb_strtolower($words[0]), self::BAD_TERM_START, true)) return;
            $seen[$key] = true;
            $pairs[] = ['term' => $term, 'definition' => rtrim($def, " ;") ];
        };
        foreach (preg_split('/\n/', $text) as $line) {
            $line = trim($line);
            if ($line === '') continue;
            $line = preg_replace('/^\s*(?:[-*•·]+|\d+[.)])\s*/u', '', $line);
            if (preg_match('/^([^:–—]{2,60}?)\s*(?::|\s[–—-]\s)\s*(.{12,})$/u', $line, $m) && !preg_match('#^https?$#i', trim($m[1]))) {
                $add($m[1], $m[2]);
            }
        }
        foreach (self::sentences($text) as $s) {
            if (preg_match('/^(?:An?|The)?\s*([A-Z][A-Za-z0-9\-\/()\' ]{1,50}?)\s+(?:is defined as|is called|refers to|means|stands for|is|are)\s+(.{15,})$/u', $s, $m)) {
                $add($m[1], $m[2]);
            }
        }
        return $pairs;
    }

    private static function sentences(string $text): array
    {
        $out = [];
        foreach (preg_split('/\n+/', $text) as $line) {
            $line = trim(preg_replace('/^\s*(?:[-*•·]+|\d+[.)])\s*/u', '', $line));
            if ($line === '') continue;
            foreach (preg_split('/(?<=[.!?])\s+(?=[A-Z0-9"“(])/u', $line) as $s) {
                $s = trim($s);
                if (mb_strlen($s) >= 25 && mb_strlen($s) <= 300) $out[] = $s;
            }
        }
        return array_values(array_unique($out));
    }

    /** Blank the most "keyword-like" word of a sentence. */
    private static function cloze(string $s): ?array
    {
        $best = null;
        foreach (preg_split('/[^A-Za-z0-9\-\']+/', $s, -1, PREG_SPLIT_NO_EMPTY) as $idx => $w) {
            if ($idx === 0) continue;
            $lw = mb_strtolower($w);
            if (mb_strlen($w) < 6 || in_array($lw, self::STOP, true) || ctype_digit($w)) continue;
            $score = mb_strlen($w) + (ctype_upper($w[0]) ? 3 : 0);
            if (!$best || $score > $best[1]) $best = [$w, $score];
        }
        if (!$best) return null;
        $text = preg_replace('/\b' . preg_quote($best[0], '/') . '\b/u', '_____', $s, 1);
        if ($text === $s || mb_substr_count($text, '_____') !== 1) return null;
        return ['text' => $text, 'answer' => $best[0], 'sentence' => $s];
    }

    private static function situation(string $s): ?array
    {
        $s = rtrim($s);
        $body = rtrim($s, '.!');
        if (preg_match('/^(?:If|When|Whenever)\s+(.{8,}?),\s*(?:then\s+)?(.{8,})$/iu', $body, $m)) {
            return ['situation' => 'Situation: ' . self::cap($m[1]) . '. What should you expect or do?', 'answer' => self::cap($m[2]) . '.', 'template' => false];
        }
        if (preg_match('/^(Use|Apply|Choose|Prefer|Select)\s+(.{3,}?)\s+(?:when|if|for)\s+(.{8,})$/iu', $body, $m)) {
            return ['situation' => 'Situation: ' . self::cap($m[3]) . '. What should you ' . mb_strtolower($m[1]) . '?', 'answer' => self::cap($m[2]) . '.', 'template' => false];
        }
        if (preg_match('/^(.{8,}?)\s+(?:,\s*)?(?:so that|in order to|because)\s+(.{8,})$/iu', $body, $m) && preg_match('/\b(should|must|need to|have to|always|never)\b/i', $m[1])) {
            return ['situation' => 'Why ' . mb_strtolower(self::lowerFirst($m[1])) . '?', 'answer' => self::cap($m[2]) . '.', 'template' => false];
        }
        return null;
    }

    // ------------------------------------------------------------------ helpers

    private static function ask(string $term): string
    {
        return 'What is ' . $term . '?';
    }

    private static function mcq(string $q, string $correct, array $wrong, int $seed, ?string $explain): array
    {
        $opts = self::shuffle(array_merge([$correct], $wrong), $seed);
        return ['question' => $q, 'options' => $opts, 'correct' => array_search($correct, $opts, true), 'explanation' => $explain];
    }

    private static function vocabulary(array $clozes): array
    {
        $v = [];
        foreach ($clozes as $c) $v[mb_strtolower($c['answer'])] = $c['answer'];
        return array_values($v);
    }

    /** Prefer wrong answers that look like the right one (same ending, similar length). */
    private static function similar(array $pool, string $answer, int $n, int $seed): array
    {
        $pool = self::shuffle(array_values(array_unique($pool)), $seed);
        usort($pool, function ($a, $b) use ($answer) {
            $score = fn ($w) => abs(mb_strlen($w) - mb_strlen($answer)) + (mb_substr($w, -2) === mb_substr($answer, -2) ? -3 : 0) + (ctype_upper($w[0]) === ctype_upper($answer[0]) ? 0 : 2);
            return $score($a) <=> $score($b);
        });
        return array_slice($pool, 0, $n);
    }

    private static function trim(string $s, int $max): string
    {
        return mb_strlen($s) > $max ? rtrim(mb_substr($s, 0, $max - 1)) . '…' : $s;
    }

    private static function cap(string $s): string
    {
        $s = trim($s);
        return mb_strtoupper(mb_substr($s, 0, 1)) . mb_substr($s, 1);
    }

    private static function lowerFirst(string $s): string
    {
        return mb_strtolower(mb_substr($s, 0, 1)) . mb_substr($s, 1);
    }

    /** Deterministic shuffle (no global RNG state). */
    private static function shuffle(array $a, int $seed): array
    {
        $a = array_values($a);
        $x = ($seed * 2654435761 + 12345) & 0x7fffffff;
        for ($i = count($a) - 1; $i > 0; $i--) {
            $x = ($x * 1103515245 + 12345) & 0x7fffffff;
            $j = $x % ($i + 1);
            [$a[$i], $a[$j]] = [$a[$j], $a[$i]];
        }
        return $a;
    }

    private static function pick(array $pool, int $n, int $seed): array
    {
        $pool = array_values(array_unique($pool));
        return array_slice(self::shuffle($pool, $seed), 0, $n);
    }
}
