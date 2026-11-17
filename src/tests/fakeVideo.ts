import { vi } from "vitest";

/**
 * jsdom has no media playback: `play()` is unimplemented and `paused`,
 * `currentTime`, `duration`, `readyState` and `ended` never move. This swaps
 * in a small, synchronous model of a `<video>` element on the prototype, with
 * the events a real one fires, so a test can drive playback and read it back.
 */
interface FakeState {
  paused: boolean;
  currentTime: number;
  duration: number;
  readyState: number;
  ended: boolean;
  muted: boolean;
}

const states = new WeakMap<HTMLMediaElement, FakeState>();

function st(el: HTMLMediaElement): FakeState {
  let s = states.get(el);
  if (!s) {
    s = { paused: true, currentTime: 0, duration: NaN, readyState: 0, ended: false, muted: false };
    states.set(el, s);
  }
  return s;
}

const fire = (el: HTMLMediaElement, type: string) => el.dispatchEvent(new Event(type));

const PROPS = ["paused", "currentTime", "duration", "readyState", "ended", "muted", "play", "pause"] as const;

export function installFakeVideo() {
  const proto = HTMLMediaElement.prototype;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const p of PROPS) saved.set(p, Object.getOwnPropertyDescriptor(proto, p));

  const getter = (key: keyof FakeState) => ({
    configurable: true,
    get(this: HTMLMediaElement) {
      return st(this)[key];
    },
  });
  Object.defineProperty(proto, "paused", getter("paused"));
  Object.defineProperty(proto, "duration", getter("duration"));
  Object.defineProperty(proto, "readyState", getter("readyState"));
  Object.defineProperty(proto, "ended", getter("ended"));
  Object.defineProperty(proto, "currentTime", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return st(this).currentTime;
    },
    set(this: HTMLMediaElement, v: number) {
      const s = st(this);
      s.currentTime = v;
      if (!(v >= s.duration)) s.ended = false;
      fire(this, "seeked");
    },
  });
  Object.defineProperty(proto, "muted", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return st(this).muted;
    },
    set(this: HTMLMediaElement, v: boolean) {
      const s = st(this);
      if (s.muted === v) return;
      s.muted = v;
      fire(this, "volumechange");
    },
  });

  const play = vi.fn(function (this: HTMLMediaElement) {
    const s = st(this);
    if (s.ended) {
      // Playing an ended video starts it over, as a browser does.
      s.ended = false;
      s.currentTime = 0;
    }
    if (s.paused) {
      s.paused = false;
      fire(this, "play");
      fire(this, "playing");
    }
    return Promise.resolve();
  });
  const pause = vi.fn(function (this: HTMLMediaElement) {
    const s = st(this);
    if (!s.paused) {
      s.paused = true;
      fire(this, "pause");
    }
  });
  Object.defineProperty(proto, "play", { configurable: true, writable: true, value: play });
  Object.defineProperty(proto, "pause", { configurable: true, writable: true, value: pause });

  return {
    play,
    pause,
    restore() {
      for (const [p, d] of saved) {
        if (d) Object.defineProperty(proto, p, d);
        else delete (proto as unknown as Record<string, unknown>)[p];
      }
    },
  };
}

/** The file's metadata arrives: its duration is known and it can play. */
export function loadMetadata(el: HTMLMediaElement, durationMs: number) {
  const s = st(el);
  s.duration = durationMs / 1000;
  s.readyState = 1;
  fire(el, "loadedmetadata");
  fire(el, "durationchange");
}

/** Playback has moved on to `ms`, with no event (as between `timeupdate`s). */
export function playTo(el: HTMLMediaElement, ms: number) {
  st(el).currentTime = ms / 1000;
}

/** The video reaches its end with no loop. */
export function endVideo(el: HTMLMediaElement) {
  const s = st(el);
  s.currentTime = s.duration;
  s.paused = true;
  s.ended = true;
  fire(el, "pause");
  fire(el, "ended");
}

/** The file cannot be played. */
export function failVideo(el: HTMLMediaElement) {
  fire(el, "error");
}
