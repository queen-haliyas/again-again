# Again Again

A beautiful, private habit tracker that lives in a single HTML file. Do it again, and again.

> **Level 1 of my 20-app learning series.** Each app in the series is a small, complete project built to practise a new set of skills. This is the first.

## Features

- **Habits with personality** - a name, emoji icon, colour and category (Health, Faith, Work, Learning, Personal).
- **Flexible schedules** - every day, specific weekdays, or X times per week.
- **Streaks that respect your schedule** - current and best streak per habit. A day you didn't plan to do a habit never breaks the streak.
- **Check-in notes** - add an optional note to any day, and backfill the last 7 days with a tap.
- **Stats tab** - a year-long GitHub-style heatmap for every habit (tap any day to mark or unmark it), completion rates for this week, this month and all time, a 30-day completion line chart, your best day of the week and your most consistent habit.
- **Category filters** across the whole app.
- **Premium mobile feel** - bottom navigation, a progress ring for today's completion, smooth tick animations, and confetti at 7, 30 and 100-day streaks.
- **Drag and drop reordering** that works with mouse, touch and keyboard.
- **Light and dark mode** - follows your device, or pick your own.
- **Private by design** - everything is stored in your browser's `localStorage`. There is no account and no server. Export and import JSON backups from Settings.

## Tech

- Plain **HTML, CSS and JavaScript** - no framework, no build step, one `index.html`.
- [Chart.js](https://www.chartjs.org/) 4 from the cdnjs CDN for the line chart (the only external dependency).
- Pointer Events for drag and drop, `<dialog>` for bottom sheets, CSS `color-mix()` for habit colours, and a small canvas for confetti.

## Run it

Open `index.html` in any modern browser. That's it. (An internet connection is only needed for the chart.)

## Build log

1. **Basics** - add, list, tick and delete habits, saved in `localStorage`.
2. **Advanced habits** - emoji, colour, category, schedules, schedule-aware streaks, notes and editing. Old data migrates automatically.
3. **Stats** - yearly heatmaps, completion rates, a Chart.js trend line, best weekday and most consistent habit.
4. **Premium mobile redesign** - bottom nav, progress ring, dark mode, animations, confetti milestones and drag-to-reorder.
5. **Renamed to Again Again** and published.

## License

[MIT](LICENSE)
