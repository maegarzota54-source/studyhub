<?php
namespace App\Notifications;

use Illuminate\Notifications\Notification;

class StudyHubNotice extends Notification
{
    public function __construct(public string $message, public ?string $url = null) {}
    public function via($notifiable): array { return ['database']; }
    public function toArray($notifiable): array { return ['message' => $this->message, 'url' => $this->url]; }
}
