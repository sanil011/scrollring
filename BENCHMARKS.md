# Benchmarks

scrollring compared with a naive list that puts every row in the DOM.
All numbers are from my own runs; the method and caveats are below.

## Results

100,000 rows, 40px each, in a 400px viewport. Median of 20 runs, fresh page
for every run.

| Metric                      | Naive (all rows)      | scrollring            |
| --------------------------- | --------------------- | --------------------- |
| DOM elements                | 100,009               | 121                   |
| Time to first render        | 916 ms                | 18 ms\*               |
| Frame time p50 / p95 / p99  | 32.4 / 50.1 / 50.9 ms | 16.7 / 18.5 / 18.7 ms |

\* Within one frame. The measurement waits for the next paint, which can take
up to ~16.7 ms at 60 Hz, so this is close to the lowest value it can report.

**How to read it:**

- **DOM elements:** scrollring keeps a fixed pool (111 row nodes here) plus
  the page's own elements, no matter how many rows the list has.
- **First render:** the naive list builds, lays out and paints 100,000 nodes
  before anything appears.
- **Frame time:** at 60 Hz a frame should take 16.7 ms. scrollring stays
  there. The naive list's median is about 30 fps, and its p95 frame takes
  about three frames' worth of time, which shows up as stutter.

## Conditions

| | |
| --- | --- |
| Command | `HEADED=1 CPU_SLOWDOWN=2 RUNS=20 npm run bench` |
| Browser | Chromium 156.0.8078.4, headed (visible window) |
| OS | macOS (Darwin 27.0.0, arm64) |
| Hardware | Apple M1, 8 cores, 8 GB RAM |
| CPU throttling | 2× slower, via the DevTools protocol |
| Rows | 100,000, 40px each, 400px viewport |
| Row content | One text node per row (`Row N`) |
| Served by | Vite dev server (unminified) |

## Method

The two pages, [`bench/naive.html`](bench/naive.html) and
[`bench/ring.html`](bench/ring.html), share data, row size, container and
measuring code ([`bench/shared.js`](bench/shared.js)), so the only difference
is how rows get into the DOM.
[`bench/run.mjs`](bench/run.mjs) opens each page in a fresh browser context
for every run and reports the median.

- **DOM elements:** `document.getElementsByTagName("*").length` after the
  first render.
- **Time to first render:** from the start of rendering until just after the
  next paint (a `requestAnimationFrame` callback posts a message to itself;
  the message runs after that frame is painted).
- **Frame time:** the page sets `scrollTop` +200px per frame for 600 frames
  and records the time between `requestAnimationFrame` callbacks. Reported
  as percentiles because users notice the slow frames, which an average hides.

## Caveats

- **Text-only rows.** Each row is a single text node. Real rows (icons,
  avatars, nested elements) cost more to render. That has not been measured
  here.
- **Scripted scroll.** The test sets `scrollTop` from JavaScript. Scrolling
  with a trackpad or wheel is handled partly on the browser's compositor
  thread, so a naive list may feel smoother under real input than these
  frame times suggest.
- **One machine.** An Apple M1 is faster than most users' devices; the 2×
  CPU throttling narrows that gap, but it is still an approximation.
- **Memory is not reported.** Chrome's JS heap size mostly reflects the
  shared 100,000-item data array, not the DOM, so it doesn't compare the
  two approaches fairly.

## Run it yourself

```bash
npm run bench                            # 10 runs per page, headless
HEADED=1 npm run bench                   # visible window, realistic frame times
CPU_SLOWDOWN=4 npm run bench             # simulate a slower device
HEADED=1 CPU_SLOWDOWN=2 RUNS=20 npm run bench   # the run above
```

The script prints a results table and the machine details. Numbers will
differ between machines; compare the two columns, not absolute values.
