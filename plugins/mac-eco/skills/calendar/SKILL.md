---
name: calendar
description: Manage macOS Calendar events. Use when the user asks to check, add, or manage calendar events.
---

# Calendar Skill Guide

Reads all calendars, writes only to "Agent" calendar.

```bash
scripts/ical.sh list                              # today's events
scripts/ical.sh add "<title>" "<start>" "<end>" "[notes]"
scripts/ical.sh calendars                         # list calendars
scripts/ical.sh ensure                            # create Agent calendar
```

- Date formats: `"2026-01-05 14:00"`, `"today 14:00"`, `"tomorrow 10:30"`

Constraint: Use `AskUserQuestion` to confirm before adding events.

Note: Requires Accessibility permissions for Terminal.
