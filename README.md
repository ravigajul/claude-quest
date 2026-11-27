# 5:00 PM Forever

**A 3D time-loop game that teaches developers and testers how to work with Claude.**

▶ **Play it:** https://ravigajul.github.io/claude-quest/

Created by **[Ravi Gajul](https://github.com/ravigajul)**, designed and built together with Claude.

---

## The idea

You are the AI agent. It's release day, 4:48 PM, the checkout tests are red, and your user wants them fixed before the 5:00 release.
When the clock hits 5:00, the day rewinds and you forget everything. **Only what you write down survives.**

That isn't a metaphor laid over Claude. It's how Claude actually works:

| In the game | In Claude Code |
|---|---|
| Waking up with amnesia every loop | Every new session starts with an empty context |
| The 3 notes that survive the loop | `CLAUDE.md` memory |
| Your context tank, and the blackout when it overflows | The context window and compaction |
| Sending a clone to explore | Subagents |
| Opening a portal to the ops ticket | MCP connectors |
| Freezing time to choose a route | Plan mode |
| The force field before `rm -rf` | Permissions |
| Carving a procedure every future session follows | Skills (`SKILL.md`) |
| Setting tests to run on their own | Hooks (`settings.json`) |

## Mission 1: Release Day (three levels)

1. **Amnesia.** You're meant to fail, and you learn what's worth writing down.
2. **The Clone and the Portal.** Use your notes, a subagent and MCP to diagnose, fix and prove it.
3. **Make It Stick.** Fixing it once isn't enough. Plan, get permission, then leave a skill and a hook so the next session can't get it wrong.

Every concept you meet unlocks in the **Field Guide**, with how to do it in Claude Code and a small exercise to try at work.
At the end you can download a real `CLAUDE.md`, `SKILL.md` and `settings.json` hook built from your choices.

## Mission 2: The Vague Story

A product owner sends a one-line user story. You build a prompt from parts (role, task, the ADO ticket through MCP, a design screenshot, clarifying questions, an example, the output format and a "don't invent facts" rule) and send it. Each run shows what Claude produces and a QA lead's review: requirements covered, invented rules, whether manual testers can run it, and whether it imports into Azure DevOps. You learn what each part of a prompt does by watching the output change. At the end you keep the prompt as a template.

## See what you learned

Each mission starts and ends with the same five real-world questions, so you can see the difference, for example "Before: 2/5 → Now: 5/5".

## Tech

- Three.js (MIT), vendored in `vendor/`: no CDN, no build step
- Vanilla JavaScript modules, synthesized WebAudio sound
- Free hosting on GitHub Pages

Run it locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Feedback

This is a prototype. Ideas and bug reports are welcome as [issues](https://github.com/ravigajul/claude-quest/issues).

## License

MIT © 2026 Ravi Gajul. Three.js is MIT licensed by its authors.
