<?php

namespace Tests\Feature;

use App\Models\ChatReadState;
use App\Models\Message;
use App\Models\StudyGroup;
use App\Models\User;
use App\Support\ChatReadReceipts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Tests\TestCase;

class ChatReadReceiptsTest extends TestCase
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

    public function test_direct_chat_receipts_advance_and_are_attached_to_messages(): void
    {
        $sender = $this->makeUser('sender');
        $recipient = $this->makeUser('recipient');
        $message = Message::create([
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'body' => 'Hello',
        ]);

        $this->actingAs($recipient)->postJson(route('messages.receipts'), [
            'message_id' => $message->id,
            'status' => 'delivered',
        ])->assertOk()->assertJson(['ok' => true]);

        $this->postJson(route('messages.receipts'), [
            'message_id' => $message->id,
            'status' => 'read',
        ])->assertOk();
        $this->postJson(route('messages.receipts'), [
            'message_id' => $message->id,
            'status' => 'delivered',
        ])->assertOk();

        $this->assertDatabaseHas('chat_read_states', [
            'user_id' => $recipient->id,
            'conversation_key' => ChatReadReceipts::directKey($sender->id, $recipient->id),
            'delivered_through_id' => $message->id,
            'read_through_id' => $message->id,
        ]);

        $messages = new Collection([$message->fresh()]);
        ChatReadReceipts::attach(
            $messages,
            ChatReadReceipts::directKey($sender->id, $recipient->id),
            $sender->id,
            [$recipient->id],
        );

        $this->assertSame($recipient->id, $messages->first()->read_by[0]['id']);
    }

    public function test_group_receipts_are_limited_to_group_members(): void
    {
        $sender = $this->makeUser('sender');
        $reader = $this->makeUser('reader');
        $outsider = $this->makeUser('outsider');
        $group = StudyGroup::create([
            'owner_id' => $sender->id,
            'title' => 'Study circle',
            'topic' => 'Science',
        ]);
        $group->members()->attach([$sender->id, $reader->id]);
        $message = Message::create([
            'sender_id' => $sender->id,
            'study_group_id' => $group->id,
            'body' => 'Group hello',
        ]);

        $this->actingAs($reader)->postJson(route('messages.receipts'), [
            'message_id' => $message->id,
            'status' => 'read',
        ])->assertOk();

        $messages = new Collection([$message->fresh()]);
        ChatReadReceipts::attach(
            $messages,
            ChatReadReceipts::groupKey($group->id),
            $sender->id,
            [$sender->id, $reader->id],
        );
        $this->assertSame($reader->id, $messages->first()->read_by[0]['id']);

        $this->actingAs($outsider)->postJson(route('messages.receipts'), [
            'message_id' => $message->id,
            'status' => 'read',
        ])->assertForbidden();

        $this->assertSame(1, ChatReadState::count());
    }
}
