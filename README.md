# Again Again

A beautiful, private habit tracker that installs on your phone and works offline. Do it again, and again.

> **Level 1 of my 20-app learning series.** Each app in the series is a small, complete project built to practise a new set of skills. This is the first.

## Features

- **Habits with personality** - a name, emoji icon, colour and category (Health, Faith, Work, Learning, Personal).
- **Flexible schedules** - every day, specific weekdays, or X times per week.
- **Streaks that respect your schedule** - current and best streak per habit. A day you didn't plan to do a habit never breaks the streak.
- **Reminders** - choose a notification time for each habit.
- **Check-in notes** - add an optional note to any day, and backfill the last 7 days with a tap.
- **Stats tab** - a year-long GitHub-style heatmap for every habit (tap any day to mark or unmark it), completion rates for this week, this month and all time, a 30-day completion line chart, your best day of the week and your most consistent habit.
- **Category filters** across the whole app.
- **Premium mobile feel** - bottom navigation, a progress ring for today's completion, smooth tick animations, and confetti at 7, 30 and 100-day streaks.
- **Drag and drop reordering** that works with mouse, touch and keyboard.
- **Light and dark mode** - follows your device, or pick your own.
- **Installable and offline** - a Progressive Web App you can add to your home screen.
- **Backup and restore** - export everything to a JSON file, and import it later (replace everything, or merge).
- **Private by design** - everything is stored in your browser's `localStorage`. There is no account and no server.

## Tech

- Plain **HTML, CSS and JavaScript** - no framework, no build step.
- **Progressive Web App**: a web app manifest and a service worker (`sw.js`) that caches the app for offline use.
- The **Notifications API** for reminders.
- [Chart.js](https://www.chartjs.org/) 4 from the cdnjs CDN for the line chart (cached by the service worker after the first visit).
- Pointer Events for drag and drop, `<dialog>` for bottom sheets, CSS `color-mix()` for habit colours, and a small canvas for confetti.

## Project structure

```
index.html            page markup
styles.css            all styling (light + dark themes)
app.js                all app logic
sw.js                 service worker: offline cache + notification clicks
manifest.webmanifest  install metadata (name, icons, colours)
icons/                app icons (192, 512, maskable, Apple touch icon)
```

## Run it

Service workers and notifications only work on a secure origin, so don't open `index.html` by double-clicking it (that works for a quick look, but without install, offline or reminders). Serve the folder instead:

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>. To use it on your phone, host the folder on any HTTPS static host (for example GitHub Pages), open the URL on your phone and choose **Install app** / **Add to Home Screen**.

## How reminders work

There is no server, so there is nobody to send a notification while the app is completely closed. Instead the app checks the clock every 30 seconds and whenever you return to it. When a habit's reminder time has passed, the habit is due today and you haven't done it yet, it shows a notification (once per day, up to 3 hours late). That means reminders arrive while Again Again is open or running in the background, which on most phones means installed and recently used. For reminders that arrive when the app is fully closed you would need a push server, which is a good next step for a later level.

## Build log

1. **Basics** - add, list, tick and delete habits, saved in `localStorage`.
2. **Advanced habits** - emoji, colour, category, schedules, schedule-aware streaks, notes and editing. Old data migrates automatically.
3. **Stats** - yearly heatmaps, completion rates, a Chart.js trend line, best weekday and most consistent habit.
4. **Premium mobile redesign** - bottom nav, progress ring, dark mode, animations, confetti milestones and drag-to-reorder.
5. **Renamed to Again Again** and published to GitHub.
6. **PWA, reminders and backups** - split into separate files, added a manifest, service worker and icons, per-habit notification reminders, and JSON backup with merge or replace on import. Verified offline loading and reminder delivery in headless Edge.

## License

[MIT](LICENSE)
