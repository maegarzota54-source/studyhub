<?php

namespace Tests\Feature;

use App\Models\NoteFile;
use App\Models\StudyGroup;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StudyGeneratorTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $name): User
    {
        return User::create([
            'name' => $name,
            'email' => strtolower($name).'@example.test',
            'email_verified_at' => now(),
            'password' => 'password',
        ]);
    }

    private function geminiResponse(array $items): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => json_encode(['items' => $items])]]]]]];
    }

    private function flashcards(): array
    {
        return [
            ['question' => 'What is the basic unit of life?', 'answer' => 'The cell.'],
            ['question' => 'What do cells contain?', 'answer' => 'Genetic material.'],
            ['question' => 'What roles do cells perform?', 'answer' => 'Structural and functional roles.'],
        ];
    }

    private function configureGemini(): void
    {
        config(['services.gemini.key' => 'test-key', 'services.gemini.study_model' => 'gemini-test-model']);
    }

    public function test_note_can_generate_flashcards_from_gemini(): void
    {
        $this->configureGemini();
        $user = $this->makeUser('student');
        $note = NoteFile::create([
            'user_id' => $user->id,
            'kind' => 'note',
            'title' => 'Cell biology',
            'body' => 'Cells are the basic structural and functional units of all known living organisms. They contain genetic material.',
        ]);
        Http::fake([
            'generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent*' => Http::response($this->geminiResponse($this->flashcards())),
        ]);

        $this->actingAs($user)->postJson(route('files.study', $note), [
            'mode' => 'flashcards',
        ])->assertOk()->assertJsonCount(3, 'items')->assertJsonPath('items.0.answer', 'The cell.');

        Http::assertSent(fn ($request) => $request->url() === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent'
            && $request->hasHeader('x-goog-api-key', 'test-key')
            && $request['generationConfig']['responseMimeType'] === 'application/json'
            && $request['contents'][0]['parts'][0]['text'] !== '');
    }

    public function test_pdf_is_sent_as_inline_data_to_gemini(): void
    {
        $this->configureGemini();
        $user = $this->makeUser('student');
        $path = 'files/study-source.pdf';
        Storage::put($path, '%PDF-1.4 sample source file');
        $file = NoteFile::create([
            'user_id' => $user->id,
            'kind' => 'file',
            'title' => 'Biology notes.pdf',
            'path' => $path,
            'mime' => 'application/pdf',
        ]);
        Http::fake([
            'generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent*' => Http::response($this->geminiResponse($this->flashcards())),
        ]);

        $this->actingAs($user)->postJson(route('files.study', $file), [
            'mode' => 'flashcards',
        ])->assertOk()->assertJsonCount(3, 'items');

        Http::assertSent(fn ($request) => $request->url() === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent'
            && $request['contents'][0]['parts'][1]['inlineData']['mimeType'] === 'application/pdf'
            && base64_decode($request['contents'][0]['parts'][1]['inlineData']['data']) === '%PDF-1.4 sample source file');
    }

    public function test_multiple_choice_and_situational_modes_return_their_expected_shapes(): void
    {
        $this->configureGemini();
        $user = $this->makeUser('student');
        $note = NoteFile::create([
            'user_id' => $user->id,
            'kind' => 'note',
            'title' => 'Research ethics',
            'body' => 'Informed consent requires participants to understand a study and voluntarily agree to take part.',
        ]);
        Http::fake([
            'generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent*' => Http::sequence()
                ->push($this->geminiResponse([
                    ['question' => 'What does informed consent require?', 'options' => ['A', 'B', 'C', 'D'], 'correct_index' => 1, 'explanation' => 'Participants must understand and agree.'],
                    ['question' => 'Question 2?', 'options' => ['A', 'B', 'C', 'D'], 'correct_index' => 0, 'explanation' => 'Explanation.'],
                    ['question' => 'Question 3?', 'options' => ['A', 'B', 'C', 'D'], 'correct_index' => 3, 'explanation' => 'Explanation.'],
                ]))
                ->push($this->geminiResponse([
                    ['scenario' => 'A participant does not understand the study.', 'question' => 'What should the researcher do?', 'model_answer' => 'Explain it clearly and obtain voluntary consent.', 'key_points' => ['Explain the study', 'Ensure consent is voluntary']],
                    ['scenario' => 'Scenario 2.', 'question' => 'Question 2?', 'model_answer' => 'Answer.', 'key_points' => ['Point one', 'Point two']],
                    ['scenario' => 'Scenario 3.', 'question' => 'Question 3?', 'model_answer' => 'Answer.', 'key_points' => ['Point one', 'Point two']],
                ])),
        ]);

        $this->actingAs($user)->postJson(route('files.study', $note), [
            'mode' => 'multiple_choice',
        ])->assertOk()->assertJsonPath('items.0.correct_index', 1);

        $this->postJson(route('files.study', $note), [
            'mode' => 'situational',
        ])->assertOk()->assertJsonPath('items.0.key_points.0', 'Explain the study');
    }

    public function test_generation_requires_a_key_and_the_file_must_be_visible(): void
    {
        config(['services.gemini.key' => null]);
        $owner = $this->makeUser('owner');
        $other = $this->makeUser('other');
        $note = NoteFile::create([
            'user_id' => $owner->id,
            'kind' => 'note',
            'title' => 'Private note',
            'body' => 'A sufficiently long note body that would otherwise be used to create a study set.',
        ]);

        $this->actingAs($owner)->postJson(route('files.study', $note), [
            'mode' => 'flashcards',
        ])->assertStatus(503)->assertJsonPath('message', 'Study generation is not configured yet. Add GEMINI_API_KEY to the server .env file.');

        $this->actingAs($other)->postJson(route('files.study', $note), [
            'mode' => 'flashcards',
        ])->assertNotFound();
    }

    public function test_group_members_can_generate_study_material_from_a_module(): void
    {
        $this->configureGemini();
        $owner = $this->makeUser('owner');
        $member = $this->makeUser('member');
        $outsider = $this->makeUser('outsider');
        $group = StudyGroup::create([
            'owner_id' => $owner->id,
            'title' => 'Study circle',
            'topic' => 'Science',
        ]);
        $group->members()->attach([$owner->id, $member->id]);
        $module = NoteFile::create([
            'user_id' => $owner->id,
            'study_group_id' => $group->id,
            'kind' => 'module',
            'title' => 'Cell biology',
            'body' => 'Cells are the basic structural and functional units of all known living organisms. They contain genetic material.',
        ]);
        Http::fake([
            'generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent*' => Http::response($this->geminiResponse($this->flashcards())),
        ]);

        $this->actingAs($member)->postJson(route('files.study', $module), [
            'mode' => 'flashcards',
        ])->assertOk()->assertJsonCount(3, 'items');

        $this->actingAs($outsider)->postJson(route('files.study', $module), [
            'mode' => 'flashcards',
        ])->assertNotFound();
    }
}
