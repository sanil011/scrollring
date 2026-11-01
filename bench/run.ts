/// <reference types="node" />
// Runs both benchmark pages in Chromium and prints the median of each metric.
//
//   npm run bench                 10 runs per page, headless
//   RUNS=20 npm run bench         more runs
//   HEADED=1 npm run bench        real window (more realistic frame times)
//   CPU_SLOWDOWN=4 npm run bench  simulate a slower device

import { spawn } from "node:child_process";
import os from "node:os";
import { chromium, type Browser } from "@playwright/test";

// Set up by the inline script in bench/naive.html and bench/ring.html.
declare global {
  interface Window {
    bench: {
      firstRender(): Promise<number>;
      scroll(): Promise<number[]>;
    };
  }
}

interface RunResult {
  elements: number;
  firstRenderMs: number;
  frameP50: number;
  frameP95: number;
  frameP99: number;
}

const RUNS = Number(process.env.RUNS ?? 10);
const HEADED = process.env.HEADED === "1";
const CPU_SLOWDOWN = Number(process.env.CPU_SLOWDOWN ?? 1);
const PORT = 5179;
const BASE = `http://localhost:${PORT}/bench`;

const PAGES = [
  { name: "naive (all rows)", url: `${BASE}/naive.html` },
  { name: "scrollring", url: `${BASE}/ring.html` },
];

const median = (xs: number[]) => percentile(xs, 50);

// Nearest-rank percentile.
function percentile(xs: number[], p: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.max(0, rank - 1)];
}

async function startVite() {
  const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${BASE}/naive.html`);
      if (res.ok) return vite;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  vite.kill();
  throw new Error("Vite did not start");
}

/** One measurement on a fresh page, so runs can't affect each other. */
async function measureOnce(browser: Browser, url: string): Promise<RunResult> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  if (CPU_SLOWDOWN > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
  }

  await page.goto(url);
  await page.waitForFunction(() => window.bench);

  const firstRenderMs = await page.evaluate(() => window.bench.firstRender());

  const elements = await page.evaluate(
    () => document.getElementsByTagName("*").length,
  );
  const frames = await page.evaluate(() => window.bench.scroll());

  await context.close();
  return {
    elements,
    firstRenderMs,
    frameP50: percentile(frames, 50),
    frameP95: percentile(frames, 95),
    frameP99: percentile(frames, 99),
  };
}

const vite = await startVite();
const browser = await chromium.launch({ headless: !HEADED });

try {
  const rows = [];
  for (const { name, url } of PAGES) {
    const runs: RunResult[] = [];
    for (let i = 0; i < RUNS; i++) {
      runs.push(await measureOnce(browser, url));
      process.stdout.write(`\r${name}: run ${i + 1}/${RUNS}   `);
    }
    process.stdout.write("\n");

    const med = (key: keyof RunResult) => median(runs.map((r) => r[key]));
    rows.push({
      page: name,
      "DOM elements": med("elements"),
      "first render (ms)": med("firstRenderMs").toFixed(1),
      "frame p50 (ms)": med("frameP50").toFixed(1),
      "frame p95 (ms)": med("frameP95").toFixed(1),
      "frame p99 (ms)": med("frameP99").toFixed(1),
    });
  }

  console.log(`\nMedian of ${RUNS} runs per page (fresh page each run)\n`);
  console.table(rows);
  console.log(`
Browser:     Chromium ${browser.version()} (${HEADED ? "headed" : "headless"})
OS:          ${os.type()} ${os.release()} (${os.arch()})
CPU:         ${os.cpus()[0]?.model} x${os.cpus().length}
Memory:      ${(os.totalmem() / 1024 ** 3).toFixed(0)} GB
CPU slowdown: ${CPU_SLOWDOWN}x
Rows:        100,000, 40px each, 400px viewport
Scroll test: 600 frames, +200px per frame (scripted)`);
} finally {
  await browser.close();
  vite.kill();
}
