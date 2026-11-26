# Claude Quest

A free browser game for learning to work well with Claude. It runs on any phone or computer, with nothing to install, no sign-up and no tokens spent by players.

**Play it:** https://ravigajul.github.io/claude-quest/

Designed by [Ravi Gajul](https://www.linkedin.com/in/ravigajul), built together with Claude.

## Why I built it

I use Claude every day as a QA lead. Most learning material I found was about prompt writing. Real mastery felt wider than that: catching made-up facts, steering a chat that went wrong, choosing the right tool, spotting hidden instructions. I wanted a way to practice those skills that felt like a game, not a course.

## Three worlds

Pick a world when you start. Every world teaches the same skills, but with its own story, puzzles, look and mechanic. Each world keeps its own save, so you can switch anytime from the header and pick up where you left off.

| | The Office | The Heist | The Academy |
|---|---|---|---|
| Story | Your first week at Lumen Labs, a startup | The City Museum hires the crew to test its security before the Silver Gala | An apprentice at Lumen Academy, with Claude as your familiar |
| Puzzles | App launch taglines, a launch article, a refund reply | Gala invitations, a guest bio, a night-shift handoff | Potion stall slogans, a founding-history scroll, a worried parent |
| Look | Bright white and blue | Noir black, alarm red and gold | Violet night sky and mint magic |
| Home screen | An office tower that lights up floor by floor | A corkboard of crew photos and red string | A star map that lights a star per mentor |
| How you play | A message window, a document you mark up with a red pen, a chat app, app tiles | A blueprint, a dossier you scan under UV light, radio talk, metal lockers | A cauldron, a parchment scroll you dispel, a crystal ball, treasure chests |
| Mechanic | The inbox never stops: decide fast whether Claude should handle each request | The guards are coming: beat the clock, or the run is capped at 2 stars | Brew in order: add your ingredients to the cauldron yourself |

## How it plays

- **Every level is a different skill.** Asking clearly, catching invented facts, rescuing a chat, picking the right tool, and spotting hidden instructions.
- **Fail first, then learn.** You choose, see what Claude does with your choice, then get a debrief that explains why.
- **Enemies are failure modes.** The Vague, The Fabricator, The Yes-Man, The Drifter, and a villain called The Injector.
- **Concepts become cards.** Pass a level to earn cards. Play them well in a boss fight to master them.
- **Badges.** Earn Clean getaway, Inbox zero and Master Brewer for playing your world well.
- **Failing gives loot.** Weak choices add bloopers to your blooper reel.
- **Hidden progression.** You never see how many levels are left. A secret level waits after the boss.
- **Use it tomorrow.** Every level ends with one lesson and one small mission to try at work.
- **You're in control.** Pause any level (or press Esc) to resume, save and go home, restart, or end it. Going home keeps your place.

## Level types

| Type | What you do |
|---|---|
| Tutorial | A guaranteed first win that shows how a round works |
| Build | Assemble a prompt from cards and see Claude's answer |
| Spot the bug | Find the invented facts in Claude's draft |
| Rescue | Pick the next message in a chat that went sideways |
| Pick the tool | Sort jobs into chat, project, artifact, skill, or "you decide" |
| Boss | Bring 4 cards and counter each wave |
| Saboteur | Find instructions hidden inside an email or letter |

## Works everywhere

Phone-first, with a two-column layout on laptops and desktops. Respects reduced-motion settings. Sound can be turned off. Progress saves in your browser.

## Status

The first chapter is playable in all three worlds: a tutorial, four levels, a boss and a secret bonus level. The full plan covers 100 concepts across 10 chapters.

## Run it locally

It is one self-contained file. Open `index.html` in a browser.

## Project structure

| File | What it is |
|---|---|
| `index.html` | The whole game: data, engine, styles |
| `tests/regression.js` | Regression tests that play the game in a headless browser |
| `package.json` | Test setup (`npm test`) |
| `.github/workflows/pages.yml` | Runs the tests, then deploys to GitHub Pages on every push to `main` |
| `.github/workflows/regression.yml` | Runs the tests on every pull request |

Inside `index.html`:

- `LEVELS` holds the base level data (the Office world). Each level type has its own shape.
- `THEMES` holds the three worlds: UI text, character roles, skin, and `lv`, which replaces each level's puzzles for that world.
- `CARDS` and `ENEMIES` hold the toolkit cards and the bestiary.
- The engine covers screens, world mechanics, pause and save, animations and sound.

## Tests

The regression suite plays every level in every world and checks:

- every level reaches a perfect run with no JavaScript errors, with animations on and off
- no screen shows totals, and the signature is on every page
- each world has its own skin, puzzles, stage props and button wording
- the Heist clock, the Office inbox and the Academy brewing order work
- pause, resume, restart, end and save-and-go-home work
- each world keeps its own save, and restarting a world clears only that world
- weak answers fail softly and drop a blooper
- the credits and links are right

```
npm install
npm test
```

## Deployment

Every push to `main` runs the tests first. The game is deployed to GitHub Pages only if every test passes, so the live game never breaks.

One-time setup: in the repo, open **Settings**, then **Pages**, and set **Source** to **GitHub Actions**.

## Changelog

- Hosted on GitHub Pages, with tests gating every deploy.
- Each world has its own mechanic: a guard clock, an inbox, a brewing order.
- Each world plays differently, with its own stages, props and button wording.
- Each world has its own puzzles and wording.
- Pause, save, restart and end any level mid-way.
- Regression test suite with GitHub Actions.
- Three worlds with separate saves and a Switch world button.
- Distinct colors, fonts and picker cards per world.
- First chapter rebuilt so each level teaches a different skill, not only prompting.
- Animations: 3D tilt cards, monster reactions, boss attacks, confetti, sound.
- Hidden level count and a secret bonus level.
- Wide-screen layout.

## Honesty note

Claude's answers in the game are examples written with Claude to show typical behavior. They are not live recordings.

This is a fan-made project. It is not affiliated with or endorsed by Anthropic. Claude is a trademark of Anthropic.

## Contributing

Ideas, new levels and bug reports are welcome. Open an issue or a pull request. Please run `npm test` before opening a pull request.

## License

MIT. See `LICENSE`.
