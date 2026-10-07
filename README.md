<<<<<<< HEAD
# StudyHub: Group Circle System (overlay)

This is an **overlay**: the StudyHub-specific files for a fresh Laravel + Breeze (React/Inertia) app.
Copy it over a new project and follow the steps below. It does not include `vendor/`, `node_modules/`, or Breeze's own auth pages.

Built against: Laravel 13, Inertia.js v2, React 18/19, Tailwind CSS, Laravel Reverb, PeerJS.
I wrote this without being able to install Laravel in my sandbox, so **nothing here has been run**. Expect to fix small
version-specific issues (Breeze stubs, Tailwind v3 vs v4, Ziggy import). The "Known gaps" section lists what to check first.

## 1. Requirements
- PHP 8.3+ with extensions: `sqlite3`, `pdo_sqlite`, `mbstring`, `openssl`, `fileinfo`, `curl`, `xml`, `tokenizer`, `ctype`, `bcmath`
- Composer 2.x, Node 20+ with npm
- A TURN server for calls across strict NATs (optional for local testing)

## 2. Create the project
```bash
composer create-project laravel/laravel studyhub        # Laravel 13
cd studyhub
composer require laravel/breeze --dev
php artisan breeze:install react                         # choose React (Inertia), no SSR; Pest/PHPUnit as you like
composer require inertiajs/inertia-laravel               # already pulled in by Breeze, harmless
php artisan install:broadcasting                         # choose Reverb; installs laravel-echo + pusher-js
npm install lucide-react recharts peerjs
```

## 3. Copy the overlay
Copy everything from this folder into the project root (merge folders), **overwriting** `ProfileController.php`.
Then:
1. `routes/web.php`: delete Breeze's `/dashboard` route and add `require __DIR__.'/studyhub.php';` at the bottom.
2. `routes/channels.php`: if `install:broadcasting` created one, merge the three `Broadcast::channel` lines from the overlay.
3. `bootstrap/app.php`: register middleware aliases (see `snippets/bootstrap-app.php.txt`).
4. `app/Http/Middleware/HandleInertiaRequests.php`: replace `share()` (see `snippets/HandleInertiaRequests.php.txt`).
5. `resources/css/app.css`: paste the `@theme` block from `resources/css/studyhub.css` (Tailwind v3: add the same colors to `tailwind.config.js` under `theme.extend.colors`).
6. `resources/js/app.js`: add `import './echo';` at the top. Remove the `laravel-echo` bootstrap that `install:broadcasting` may have added to `bootstrap.js` if it duplicates.
7. Login page: import `QuoteRotator` into `resources/js/Pages/Auth/Login.jsx` (or the guest layout) for the quote rotator.
8. Breeze imports its own layout in `Pages/Profile/Edit.jsx`; add avatar, bio and preference fields there (the controller already accepts `avatar`, `bio`, `study_preferences.*`; send as `forceFormData` multipart with `_method: 'patch'`).

## 4. Database and storage (SQLite)
```bash
# .env
DB_CONNECTION=sqlite            # remove DB_HOST/DB_PORT/DB_DATABASE/... lines
BROADCAST_CONNECTION=reverb
QUEUE_CONNECTION=sync           # events use ShouldBroadcastNow, so no queue worker needed
FILESYSTEM_DISK=local           # chat attachments and files stay private; served via authorised controllers

touch database/database.sqlite
php artisan migrate
php artisan db:seed --class=StudyHubSeeder     # admin@studyhub.test / anna@... / mark@...  (password: password)
php artisan storage:link                        # needed for public avatars
```
Change the seeded passwords before any real deployment.

## 5. Run it (four terminals, or use `composer dev` if you add reverb to it)
```bash
php artisan serve               # http://127.0.0.1:8000
npm run dev                     # Vite
php artisan reverb:start        # WebSockets on :8080 (presence, live chat)
```
Calls use PeerJS's free cloud broker by default. For production run your own `peerjs-server` and set `host`/`port`/TURN `iceServers` in `CallPanel.jsx`.
Camera/mic require HTTPS or `localhost`.

## 6. What is included
| Area | Files |
|---|---|
| Schema | 8 migrations: users fields, study_groups, group_members, messages, notes_files, schedules (+schedule_user), tasks (+task_comments), study_sessions, notifications |
| Roles | `role` column, `EnsureAdmin`, `EnsureActive` (suspension + last seen), Admin dashboard (metrics, users, groups, flagged content) |
| Circles | Membership checks on every group route; discovery shows only title/topic; modules tab; join/leave/delete |
| Chat | Group + DM, threaded replies, message kinds (comment/answer/suggestion), attachments, save-to-Notes&Files, report, Reverb events, presence dots |
| Calls | `CallPanel` (PeerJS mesh, mute/camera toggles) in group chat and DMs |
| Schedule | Month calendar, Public / Specific people / Private visibility enforced in `Schedule::scopeVisibleTo` |
| Tasks | Personal or circle tasks, assignee, due date, status toggle, comment thread |
| Progress | Manual log + auto-timer, 7-day bar chart, per-circle weekly leaderboard |

## 7. Known gaps / things to verify
- **Not executed.** Run `php artisan route:list` and `npm run build` first and fix anything that surfaces.
- Email verification: Breeze enables `verified`; drop it from the route group in `studyhub.php` if you don't send mail.
- Group calls are a mesh (fine up to ~6 people); there is no ringing UI beyond a confirm dialog and no call history.
- "Threaded replies" are one level deep. The message list is capped at 100 recent top-level messages with no pagination.
- Presence dots use a global `window.__online` set refreshed by events; fine for a prototype, move to a React context if you extend it.
- No automated tests, rate limiting on uploads, antivirus scanning, or per-user storage quotas. Add these before production.
- Group ratings and password-reset UI from the mockup are not built (Breeze covers password reset).
- If your Tailwind is v3, the custom class names (`bg-hunter-700`, `text-raspberry-600`, `bg-cool-100`) need the colors added to the config as described above.
=======
# studyhub
STUDYHUB-GROUP CIRCLE SYSTEM
>>>>>>> 85d3a54ed30dc357011fd59dd0d0602886932c28
