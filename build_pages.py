#!/usr/bin/env python3
"""Copy the game into the GitHub Pages repo checkout, ready to commit.

Usage: python3 build_pages.py <path-to-claude-quest-repo-checkout>

- Wraps index.html (written for Claude artifacts, which add the skeleton) in a full HTML document,
  keeping the repo's existing <head> wrapper (charset, description, social preview tags).
- Adds ?v=<build> to every game module link so browsers fetch fresh files after each deploy
  (GitHub Pages lets browsers cache .js for 10 minutes). The same version is used everywhere,
  so a module shared by two files still loads only once.
"""
import re, shutil, sys, time
from pathlib import Path

SRC = Path(__file__).resolve().parent
dst = Path(sys.argv[1]).resolve()
ver = time.strftime('%Y%m%d%H%M%S')

# Play statistics (GoatCounter, no cookies). Fill in Ravi's site code to switch them on; empty = off.
# Only the GitHub Pages build gets the counter; the Claude artifact never loads it.
GOATCOUNTER_CODE = 'ravigajul-claudequest'

# game/ : copy, then version the relative './x.js' imports
shutil.rmtree(dst / 'game', ignore_errors=True)
shutil.copytree(SRC / 'game', dst / 'game')
for f in (dst / 'game').glob('*.js'):
    t = f.read_text()
    t = re.sub(r"""(from\s+|import\()(['"])\./([\w-]+\.js)\2""", lambda m: f"{m.group(1)}{m.group(2)}./{m.group(3)}?v={ver}{m.group(2)}", t)
    f.write_text(t)

# vendor/ : copy as is (Three.js never changes between our deploys)
shutil.rmtree(dst / 'vendor', ignore_errors=True)
shutil.copytree(SRC / 'vendor', dst / 'vendor', ignore=shutil.ignore_patterns('.DS_Store'))

# PLAN.md : backup of the roadmap and change log, refreshed on every deploy
shutil.copy2(SRC / 'PLAN.md', dst / 'PLAN.md')
shutil.copy2(SRC / 'README.md', dst / 'README.md')
for f in ('LICENSE', 'social.png', 'pages_head.html', '.gitignore', 'CLAUDE.md', 'build_pages.py', 'sounds.html'):
    shutil.copy2(SRC / f, dst / f)
# tests/ and the review skill travel with the repo, so GitHub Actions (and anyone who clones it) can run them
shutil.rmtree(dst / 'tests', ignore_errors=True)
shutil.copytree(SRC / 'tests', dst / 'tests', ignore=shutil.ignore_patterns('node_modules', 'test-results', 'playwright-report', '.DS_Store'))
shutil.rmtree(dst / 'promo', ignore_errors=True)
shutil.copytree(SRC / 'promo', dst / 'promo', ignore=shutil.ignore_patterns('out', '.DS_Store'))   # promo video scripts, not the video
shutil.rmtree(dst / 'docs', ignore_errors=True)
shutil.copytree(SRC / 'docs', dst / 'docs')   # lessons, roadmap, deploy, stats, change log
(dst / '.github' / 'workflows').mkdir(parents=True, exist_ok=True)
shutil.copy2(SRC / '.github' / 'workflows' / 'pages.yml', dst / '.github' / 'workflows' / 'pages.yml')   # test job gates the deploy
if (SRC / '.claude' / 'skills').exists():
    shutil.rmtree(dst / '.claude' / 'skills', ignore_errors=True)
    shutil.copytree(SRC / '.claude' / 'skills', dst / '.claude' / 'skills')   # the repo front page; edit the Mac copy, not the repo

# index.html : wrap and version the entry script
src = (SRC / 'index.html').read_text()
pre = (SRC / 'pages_head.html').read_text()   # doctype, charset and link-preview tags (og:*), kept in the source folder
i = src.index('</style>') + len('</style>')
head, body = src[:i], src[i:]
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
body = body.replace('src="game/engine.js"', f'src="game/engine.js?v={ver}"')
if GOATCOUNTER_CODE:
    head += (f'\n<script data-goatcounter="https://{GOATCOUNTER_CODE}.goatcounter.com/count" '
             'data-goatcounter-settings=\'{"no_onload": true}\' async src="vendor/goatcounter/count.js"></script>')
(dst / 'index.html').write_text(pre + head + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n')
print(f'built version {ver}')
