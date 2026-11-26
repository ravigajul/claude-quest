# Claude Quest

A free browser game for learning to work well with Claude. It runs on any phone or computer, with nothing to install, no sign-up and no tokens spent by players.

**Play it:** https://claude.ai/artifact/ATSajzDMnM3J8J4q4CZiAf

Designed by [Ravi Gajul](https://www.linkedin.com/in/ravigajul), built together with Claude.

## Why I built it

I use Claude every day as a QA lead. Most learning material I found was about prompt writing. Real mastery felt wider than that: catching made-up facts, steering a chat that went wrong, choosing the right tool, spotting hidden instructions. I wanted a way to practice those skills that felt like a game, not a course.

## How it plays

- **Pick a world.** The Office (a startup, close to real IT work), The Heist (a crew of clever, perfectly legal jobs) or The Academy (a school of magic). Each world has its own story, colors, fonts and home screen, and teaches the same skills. Each world keeps its own save, so you can switch anytime.
- **Every level is a different skill.** Asking clearly, catching invented facts, rescuing a chat, picking the right tool, and more.
- **Fail first, then learn.** You choose, see what Claude does with your choice, then get a debrief that explains why.
- **Enemies are failure modes.** The Vague, The Fabricator, The Yes-Man, The Drifter, and a villain called The Injector.
- **Concepts become cards.** Pass a level to earn cards. Play them well in a boss fight to master them.
- **Hidden progression.** You never see how many levels are left. A secret level waits after the boss.
- **Use it tomorrow.** Every level ends with one lesson and one small mission to try at work.

## Works everywhere

Phone-first, with a two-column layout on laptops and desktops. Respects reduced-motion settings. Sound can be turned off.

## Level types

| Type | What you do |
|---|---|
| Build | Assemble a prompt from cards and see the result |
| Spot the bug | Find the invented facts or broken lines |
| Rescue | Pick the next message in a chat that went sideways |
| Pick the tool | Sort jobs into chat, project, artifact, skill, or "you decide" |
| Boss | Bring 4 cards and counter each wave |
| Saboteur | Find instructions hidden inside an email or file |

## Run it locally

It is one self-contained file. Open `index.html` in a browser. Progress saves in the browser's local storage.

## Project structure

Everything lives in `index.html`:

- `LEVELS` holds the level data. Each level type has its own shape, described in the comments.
- `THEMES` holds the three worlds: their story text, character roles and home screen.
- `CARDS` and `ENEMIES` hold the toolkit cards and the bestiary.
- The engine (screens, animations, sound, saves) sits below the data.

## Status

The first chapter is playable in all three worlds: a tutorial, four levels, a boss and a secret bonus level. The full plan covers 100 concepts across 10 chapters.

## Honesty note

Claude's answers in the game are examples written with Claude to show typical behavior. They are not live recordings.

This is a fan-made project. It is not affiliated with or endorsed by Anthropic. Claude is a trademark of Anthropic.

## Changelog

- Each world has its own puzzles and wording: an app launch, a museum security test, a potion stall.
- Pause, save, restart and end any level mid-way.
- Regression test suite with GitHub Actions.
- Three worlds with separate saves and a Switch world button.
- Distinct colors, fonts and picker cards per world.
- First chapter rebuilt so each level teaches a different skill, not only prompting.
- Animations: 3D tilt cards, monster reactions, boss attacks, confetti, sound.
- Hidden level count and a secret bonus level.
- Wide-screen layout.

## Tests

Regression tests play every level in every world in a headless browser and check pause, saves, world switching, hidden totals, credits and per-world puzzles. They run on every push through GitHub Actions.

```
npm install
npm test
```

## Contributing

Ideas, new levels and bug reports are welcome. Open an issue or a pull request.

## License

MIT. See `LICENSE`.
