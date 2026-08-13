/// <reference types="vite/client" />

interface WakeLockSentinel extends EventTarget {
  readonly released: boolean;
  readonly type: "screen";
  release(): Promise<void>;
}

interface Navigator {
  wakeLock?: {
    request(type: "screen"): Promise<WakeLockSentinel>;
  };
}

interface Window {
  __PILATES_SW_REGISTERED__?: boolean;
  webkitAudioContext?: typeof AudioContext;
}
