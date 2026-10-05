<?php
namespace App\Http\Controllers;

use App\Models\{NoteFile, StudyGroup};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class NoteFileController extends Controller
{
    public function index(Request $request) {
        $u = $request->user();
        $items = NoteFile::visibleTo($u)->with(['user:id,name', 'group:id,title'])
            ->when($request->group_id === 'personal', fn ($q) => $q->whereNull('study_group_id'))
            ->when(is_numeric($request->group_id), fn ($q) => $q->where('study_group_id', $request->group_id))
            ->when($request->kind, fn ($q, $k) => $q->where('kind', $k))
            ->latest()->get();
        return Inertia::render('Files/Index', ['items' => $items, 'groups' => $u->groups()->get(['study_groups.id', 'title']), 'filters' => $request->only('group_id', 'kind')]);
    }

    public function store(Request $request) {
        $u = $request->user();
        $d = $request->validate([
            'kind' => 'required|in:note,file,module', 'title' => 'required|string|max:150',
            'body' => 'nullable|string|max:50000', 'study_group_id' => 'nullable|exists:study_groups,id',
            'file' => 'nullable|file|max:20480',
        ]);
        abort_if($d['kind'] === 'module' && empty($d['study_group_id']), 422, 'Study modules belong to a circle.');
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

    public function destroy(Request $request, NoteFile $file) {
        $u = $request->user();
        abort_unless($file->user_id === $u->id || ($file->group && $file->group->isGroupAdmin($u)), 403);
        if ($file->path) Storage::delete($file->path);
        $file->delete();
        return back()->with('success', 'Deleted.');
    }
}
