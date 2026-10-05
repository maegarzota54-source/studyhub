<?php
namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;
    public function __construct(public Message $message) {}

    public function broadcastOn(): array {
        $m = $this->message;
        if ($m->study_group_id) return [new PrivateChannel('group.'.$m->study_group_id)];
        $ids = [$m->sender_id, $m->recipient_id]; sort($ids);
        return [new PrivateChannel('dm.'.$ids[0].'.'.$ids[1])];
    }
    public function broadcastWith(): array { return ['id' => $this->message->id]; } // clients refetch via Inertia
}
