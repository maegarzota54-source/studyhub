# Edits for the features update (do these after copying the files)

## 1. routes/web.php  (add the new route file; order matters)
    require __DIR__.'/auth.php';
    require __DIR__.'/studyhub-live.php';
    require __DIR__.'/studyhub-chat.php';   // NEW
    require __DIR__.'/studyhub.php';

## 2. Installable app (PWA)
resources/views/app.blade.php, inside <head>, above @routes:
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="theme-color" content="#081C15">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">

resources/js/app.jsx, at the very bottom:
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
    }

## 3. Calendar export button (Schedule page)
resources/js/Pages/Schedule/Index.jsx, right under  <h2 className="mb-3 font-semibold">Add a session</h2>
    <a href={route('schedule.export')} className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-black/5">Download calendar (.ics)</a>

## 4. Database
    php artisan migrate        (adds messages.edited_at and messages.forwarded_from)
