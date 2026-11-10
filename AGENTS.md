# Agent notes

Start with **`.agents/skills/riplay/SKILL.md`** — the rules, environment traps and deploy
facts live there, and every agent directory (`.claude/skills/riplay`, and the machine-wide
`~/.agents/skills/riplay`, which points back here) resolves to that one file.

Then, in order: `docs/00-concept.md` (the constitution), `docs/02-handoff.md` (**current
state** — what is live, what is pending, why decisions were made), `PLAN.md` (the 30
sessions and their done tests).

The three that cause damage fastest if skipped:

- **Nothing unreal.** Unknown values render as visible gaps (`doplní se`), never as
  plausible placeholders. No stock photos, no invented numbers, no "we".
- This shell exports `PORT=0`, so the dev server needs
  `npm run dev -- --port 4321 --host 127.0.0.1`.
- Finish a session by updating `docs/02-handoff.md` and committing. That file is how the
  next session resumes; a stale one is worse than none.
