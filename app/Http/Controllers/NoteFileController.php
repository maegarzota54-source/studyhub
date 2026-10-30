<?php
namespace App\Http\Controllers;

use App\Support\UploadRules;
use App\Models\{NoteFile, StudyGroup};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class NoteFileController extends Controller
{
    /** Types that are safe to show inline. Decided by the extension Laravel chose when it stored the file, never by the uploaded name. */
    private const PREVIEWABLE = [
        'jpg' => ['image', 'image/jpeg'], 'jpeg' => ['image', 'image/jpeg'], 'png' => ['image', 'image/png'],
        'gif' => ['image', 'image/gif'], 'webp' => ['image', 'image/webp'],
        'pdf' => ['pdf', 'application/pdf'],
        'txt' => ['text', 'text/plain; charset=UTF-8'], 'md' => ['text', 'text/plain; charset=UTF-8'],
        'csv' => ['text', 'text/plain; charset=UTF-8'], 'log' => ['text', 'text/plain; charset=UTF-8'], 'json' => ['text', 'text/plain; charset=UTF-8'],
        'mp3' => ['audio', 'audio/mpeg'], 'wav' => ['audio', 'audio/wav'], 'ogg' => ['audio', 'audio/ogg'],
        'docx' => ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'pptx' => ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        'xlsx' => ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        'mp4' => ['video', 'video/mp4'], 'webm' => ['video', 'video/webm'],
    ];

    public static function previewType(?string $path): ?string {
        return $path ? (self::PREVIEWABLE[strtolower(pathinfo($path, PATHINFO_EXTENSION))][0] ?? null) : null;
    }

    public static function previewMimeType(?string $path): ?string {
        return $path ? (self::PREVIEWABLE[strtolower(pathinfo($path, PATHINFO_EXTENSION))][1] ?? null) : null;
    }

    private function previewInfo(NoteFile $f): ?array {
        return $f->path ? (self::PREVIEWABLE[strtolower(pathinfo($f->path, PATHINFO_EXTENSION))] ?? null) : null;
    }

    public function index(Request $request) {
        $u = $request->user();
        $items = NoteFile::visibleTo($u)->with(['user:id,name', 'group:id,title'])
            ->when($request->group_id === 'personal', fn ($q) => $q->whereNull('study_group_id'))
            ->when(is_numeric($request->group_id), fn ($q) => $q->where('study_group_id', $request->group_id))
            ->when($request->kind, fn ($q, $k) => $q->where('kind', $k))
            ->latest()->get()
            ->each(fn ($f) => $f->setAttribute('preview', $this->previewInfo($f)[0] ?? null));   // image | pdf | text | audio | video | null
        return Inertia::render('Files/Index', ['items' => $items, 'groups' => $u->groups()->get(['study_groups.id', 'title']), 'filters' => $request->only('group_id', 'kind')]);
    }

    public function store(Request $request) {
        $u = $request->user();
        $d = $request->validate([
            'kind' => 'required|in:note,file,module', 'title' => 'required|string|max:150',
            'body' => 'nullable|string|max:50000', 'study_group_id' => 'nullable|exists:study_groups,id',
            'file' => ['nullable', 'file', 'max:20480', UploadRules::extensions()],
        ], UploadRules::messages('file'));
        if (!empty($d['study_group_id'])) abort_unless(StudyGroup::find($d['study_group_id'])->hasMember($u), 403);
        $row = ['user_id' => $u->id, 'study_group_id' => $d['study_group_id'] ?? null, 'kind' => $d['kind'], 'title' => $d['title'], 'body' => $d['body'] ?? null];
        if ($f = $request->file('file')) {
            $row += ['path' => $f->store('files'), 'mime' => $f->getClientMimeType(), 'size' => $f->getSize()];
        }
        NoteFile::create($row);
        return back()->with('success', 'Saved.');
    }

    public function download(Request $request, NoteFile $file) {
        abort_unless(NoteFile::visibleTo($request->user())->whereKey($file->id)->exists(), 403);
        abort_unless($file->path, 404);
        return Storage::download($file->path, $file->title);
    }

    /** Show the file in the browser instead of downloading it. Same access rule as download. */
    public function preview(Request $request, NoteFile $file) {
        abort_unless(NoteFile::visibleTo($request->user())->whereKey($file->id)->exists(), 403);
        $info = $this->previewInfo($file);
        abort_unless($info && Storage::exists($file->path), 404);
        return response()->file(Storage::path($file->path), [
            'Content-Type' => $info[1],
            'Content-Disposition' => 'inline; filename="'.preg_replace('/[^A-Za-z0-9._-]/', '_', $file->title).'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    public function destroy(Request $request, NoteFile $file) {
        $u = $request->user();
        abort_unless($file->user_id === $u->id || ($file->group && $file->group->isGroupAdmin($u)), 403);
        if ($file->path) Storage::delete($file->path);
        $file->delete();
        return back()->with('success', 'Deleted.');
    }
}
