<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Reliability (ISO/IEC 25010): keeps dated copies of the SQLite database so data can be restored after a disruption.
 *   php artisan studyhub:backup              → storage/app/backups/database-YYYY-MM-DD_HHMMSS.sqlite (keeps the newest 7)
 *   php artisan studyhub:backup --files      → also zips uploaded files (chat attachments, notes, covers)
 * Restore: stop the app, copy a backup over database/database.sqlite, start the app again.
 */
class BackupDatabase extends Command
{
    protected $signature = 'studyhub:backup {--keep=7 : How many backups to keep} {--files : Also back up uploaded files}';
    protected $description = 'Save a dated backup copy of the SQLite database (and optionally the uploaded files).';

    public function handle(): int {
        $conn = config('database.default');
        if ($conn !== 'sqlite') { $this->error("This command backs up SQLite only (current connection: {$conn})."); return self::FAILURE; }
        $src = config('database.connections.sqlite.database');
        if (!is_string($src) || $src === ':memory:' || !is_file($src)) { $this->error('Database file not found: '.var_export($src, true)); return self::FAILURE; }

        $dir = storage_path('app/backups');
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        $stamp = now()->format('Y-m-d_His');
        $dest = "{$dir}/database-{$stamp}.sqlite";

        try {
            // VACUUM INTO makes a consistent copy even while people are using the app; a plain copy is the fallback.
            DB::statement('VACUUM INTO '.DB::getPdo()->quote($dest));
        } catch (\Throwable $e) {
            if (!copy($src, $dest)) { $this->error('Could not write the backup.'); return self::FAILURE; }
        }
        $this->info('Database saved: '.$dest.' ('.number_format(filesize($dest) / 1024, 1).' KB)');

        if ($this->option('files')) $this->zipFiles($dir, $stamp);

        foreach (['database-*.sqlite', 'files-*.zip'] as $pattern) {
            $old = glob("{$dir}/{$pattern}") ?: [];
            rsort($old);   // names contain the date, so newest first
            foreach (array_slice($old, max(1, (int) $this->option('keep'))) as $f) { @unlink($f); $this->line('Removed old backup: '.basename($f)); }
        }
        return self::SUCCESS;
    }

    private function zipFiles(string $dir, string $stamp): void {
        $root = storage_path('app');
        $zip = new \ZipArchive();
        $path = "{$dir}/files-{$stamp}.zip";
        if ($zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) { $this->warn('Could not create the files zip.'); return; }
        $count = 0;
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS));
        foreach ($it as $file) {
            $full = $file->getPathname();
            $rel = str_replace('\\', '/', substr($full, strlen($root) + 1));
            if (!$file->isFile() || str_starts_with($rel, 'backups/')) continue;
            $zip->addFile($full, $rel); $count++;
        }
        $zip->close();
        $this->info("Files saved: {$path} ({$count} files)");
    }
}
