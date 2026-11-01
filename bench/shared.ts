// Shared by both benchmark pages, so the only difference between them is
// how the rows get into the DOM.

export const TOTAL = 100_000;
export const ITEM_HEIGHT = 40;

// Rows scrolled per frame in the scroll test, and how many frames to record.
const SCROLL_STEP_PX = 200;
const SCROLL_FRAMES = 600;

export const data = Array.from({ length: TOTAL }, (_, i) => ({
  id: i,
  name: "Row " + (i + 1),
}));

/**
 * Resolves after the browser has painted the next frame.
 * rAF runs *before* that frame's style, layout and paint, so posting a
 * message from inside it lands just after the paint.
 */
export function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(null);
    });
  });
}

/** Times `render()` from the call until its result is on screen. */
export async function measureFirstRender(render: () => void): Promise<number> {
  const t0 = performance.now();
  render();
  await afterNextPaint();
  return performance.now() - t0;
}

/**
 * Scrolls `el` by a fixed step every frame and returns the time between
 * frames in ms. Fixed steps make every run do the same work.
 */
export function measureScroll(el: HTMLElement): Promise<number[]> {
  return new Promise((resolve) => {
    const frames: number[] = [];
    let last = -1;

    function step(now: number) {
      if (last >= 0) frames.push(now - last);
      last = now;

      if (frames.length >= SCROLL_FRAMES) return resolve(frames);
      el.scrollTop += SCROLL_STEP_PX;
      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  });
}
