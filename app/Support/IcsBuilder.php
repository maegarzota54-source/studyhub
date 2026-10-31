<?php
namespace App\Support;

/** Builds an iCalendar (.ics) file that Google Calendar, Outlook and Apple Calendar can import. */
class IcsBuilder
{
    public static function escape(string $s): string {
        return str_replace(['\\', ';', ',', "\r\n", "\n", "\r"], ['\\\\', '\\;', '\\,', '\\n', '\\n', '\\n'], $s);
    }

    /** Lines longer than 75 bytes must be folded (continuation lines start with one space). */
    public static function fold(string $line): string {
        $out = ''; $limit = 75;
        while (strlen($line) > $limit) {
            $cut = $limit;
            while ($cut > 0 && (ord($line[$cut]) & 0xC0) === 0x80) $cut--;   // never split a multi-byte character
            $out .= substr($line, 0, $cut)."\r\n ";
            $line = substr($line, $cut);
            $limit = 74;
        }
        return $out.$line;
    }

    /** @param array<int,array{uid:string,title:string,description?:?string,start:\DateTimeInterface,end?:?\DateTimeInterface}> $events */
    public static function build(array $events, string $name = 'StudyHub'): string {
        $utc = new \DateTimeZone('UTC');
        $lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StudyHub//Group Circle System//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:'.self::escape($name)];
        $stamp = gmdate('Ymd\THis\Z');
        foreach ($events as $e) {
            $start = \DateTimeImmutable::createFromInterface($e['start'])->setTimezone($utc);
            $end = !empty($e['end']) ? \DateTimeImmutable::createFromInterface($e['end'])->setTimezone($utc) : $start->modify('+1 hour');
            $lines[] = 'BEGIN:VEVENT';
            $lines[] = 'UID:'.$e['uid'];
            $lines[] = 'DTSTAMP:'.$stamp;
            $lines[] = 'DTSTART:'.$start->format('Ymd\THis\Z');
            $lines[] = 'DTEND:'.$end->format('Ymd\THis\Z');
            $lines[] = 'SUMMARY:'.self::escape($e['title']);
            if (!empty($e['description'])) $lines[] = 'DESCRIPTION:'.self::escape($e['description']);
            $lines[] = 'END:VEVENT';
        }
        $lines[] = 'END:VCALENDAR';
        return implode("\r\n", array_map([self::class, 'fold'], $lines))."\r\n";
    }
}
