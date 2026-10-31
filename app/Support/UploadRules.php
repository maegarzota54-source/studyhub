<?php
namespace App\Support;

/**
 * Which file types students may upload (Notes & Files and chat attachments).
 * Study material only: documents, slides, spreadsheets, text, images, audio, video and zip.
 * Program files (.php, .exe, .js, .html, .svg ...) are refused with a clear message.
 */
class UploadRules
{
    public const EXTENSIONS = [
        'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'odp', 'ods', 'rtf',
        'txt', 'md', 'csv', 'log', 'json',
        'jpg', 'jpeg', 'png', 'gif', 'webp',
        'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'webm',
        'zip',
    ];

    /** Validation rule: checks the extension of the file the student picked. */
    public static function extensions(): string {
        return 'extensions:'.implode(',', self::EXTENSIONS);
    }

    /** Custom message for the given input name (e.g. "file" or "attachment"). */
    public static function messages(string $field): array {
        return [
            "{$field}.extensions" => 'This file type is not allowed. Use PDF, Word, PowerPoint, Excel, text, image, audio, video or zip files.',
            "{$field}.max" => 'This file is too large. The limit is 20 MB.',
        ];
    }
}
