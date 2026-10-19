<?php

namespace App\Support;

use App\Models\ChatReadState;
use App\Models\Message;
use Illuminate\Support\Collection;

class ChatReadReceipts
{
    public static function directKey(int $firstUserId, int $secondUserId): string
    {
        $userIds = [$firstUserId, $secondUserId];
        sort($userIds);

        return "dm:{$userIds[0]}:{$userIds[1]}";
    }

    public static function groupKey(int $groupId): string
    {
        return "group:{$groupId}";
    }

    public static function attach(Collection $messages, string $conversationKey, int $viewerId, array $participantIds): void
    {
        $states = ChatReadState::query()
            ->where('conversation_key', $conversationKey)
            ->whereIn('user_id', $participantIds)
            ->where('user_id', '!=', $viewerId)
            ->with('user:id,name,avatar')
            ->get();

        $messages->each(fn ($message) => self::attachToMessage($message, $states));
    }

    private static function attachToMessage(Message $message, Collection $states): void
    {
        $message->setAttribute('delivered_by', self::profilesThrough($states, 'delivered_through_id', $message->id));
        $message->setAttribute('read_by', self::profilesThrough($states, 'read_through_id', $message->id));
        if ($message->relationLoaded('replies')) {
            $message->replies->each(fn (Message $reply) => self::attachToMessage($reply, $states));
        }
    }

    private static function profilesThrough(Collection $states, string $cursor, int $messageId): array
    {
        return $states
            ->filter(fn (ChatReadState $state) => $state->{$cursor} !== null && $state->{$cursor} >= $messageId)
            ->map(fn (ChatReadState $state) => [
                'id' => $state->user->id,
                'name' => $state->user->name,
                'avatar_url' => $state->user->avatar_url,
            ])
            ->values()
            ->all();
    }
}
