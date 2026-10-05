<?php
use App\Models\StudyGroup;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('dm.{a}.{b}', fn ($user, $a, $b) => in_array($user->id, [(int) $a, (int) $b], true));
Broadcast::channel('group.{id}', fn ($user, $id) => ($g = StudyGroup::find($id)) && ($g->hasMember($user) || $user->isAdmin()));
// Presence channel: powers online/offline indicators.
Broadcast::channel('online', fn ($user) => ['id' => $user->id, 'name' => $user->name]);
