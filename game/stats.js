// Anonymous play statistics, so Ravi can see how many people try the game and how far they get.
// Uses GoatCounter (no cookies, no personal data). The counter script is only added to the
// GitHub Pages build (build_pages.py). In the Claude artifact and on localhost there is no counter,
// so every call here quietly does nothing.

const on = !!document.querySelector('script[data-goatcounter]');
const queue = [];
let tries = 0;

function flush() {
  const gc = window.goatcounter;
  if (!gc || !gc.count) {
    if (++tries < 40) setTimeout(flush, 500);   // the counter script loads async; wait up to 20 s
    return;
  }
  while (queue.length) gc.count(queue.shift());
}

function send(vars) {
  if (!on) return;
  queue.push(vars);
  flush();
}

export const statsOn = () => on;

// One event, e.g. track('m1-start', 'Mission 1 started').
export function track(name, title = name) { send({ path: name, title, event: true }); }

// The page view. Not counted again when "← Missions" reloads the page into the mission list.
let reloadToHub = false;
try { reloadToHub = sessionStorage.getItem('cq-open-hub') === '1'; } catch (e) {}
if (!reloadToHub) send({});
