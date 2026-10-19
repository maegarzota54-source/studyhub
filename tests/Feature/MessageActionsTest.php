<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessageActionsTest extends TestCase
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

    public function test_sender_can_edit_their_message(): void
    {
        $sender = $this->makeUser('sender');
        $recipient = $this->makeUser('recipient');
        $message = Message::create([
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'body' => 'Original message',
        ]);

        $response = $this->actingAs($sender)->patch(route('messages.update', $message), [
            'body' => 'Corrected message',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('messages', [
            'id' => $message->id,
            'body' => 'Corrected message',
        ]);
        $this->assertNotNull($message->fresh()->edited_at);
    }

    public function test_recipient_cannot_edit_another_users_message(): void
    {
        $sender = $this->makeUser('sender');
        $recipient = $this->makeUser('recipient');
        $message = Message::create([
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'body' => 'Original message',
        ]);

        $this->actingAs($recipient)->patch(route('messages.update', $message), [
            'body' => 'Changed by recipient',
        ])->assertForbidden();

        $this->assertDatabaseHas('messages', [
            'id' => $message->id,
            'body' => 'Original message',
        ]);
    }

    public function test_unsend_for_me_hides_a_message_only_for_the_current_user(): void
    {
        $sender = $this->makeUser('sender');
        $recipient = $this->makeUser('recipient');
        $message = Message::create([
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'body' => 'Keep this between us',
        ]);

        $this->actingAs($recipient)->delete(route('messages.hide', $message))->assertRedirect();

        $this->assertDatabaseHas('messages', ['id' => $message->id]);
        $this->assertDatabaseHas('message_user_hides', [
            'message_id' => $message->id,
            'user_id' => $recipient->id,
        ]);
        $this->assertFalse(Message::visibleTo($recipient)->whereKey($message->id)->exists());
        $this->assertTrue(Message::visibleTo($sender)->whereKey($message->id)->exists());
    }
}
