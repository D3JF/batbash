(function () {
  'use strict';
  // Make the script idempotent – safe to run many times
  if (window.__tabPowerSaverApplied) {
    console.log('⚠️ Throttle script already applied to this tab – skipping re-injection');
    return; // This return is inside the IIFE
  }
})();

console.log("Applying SUPER-AGGRESSIVE throttling...");

// Mark this tab as throttled
window.__tabPowerSaverApplied = true;

// Store original functions for restoration
window.__tabPowerSaverOriginals = {
  setTimeout: window.setTimeout,
  setInterval: window.setInterval,
  requestAnimationFrame: window.requestAnimationFrame,
  canvasGetContext: HTMLCanvasElement.prototype.getContext
};

// === 1. EXTREME JAVASCRIPT TIMING THROTTLING ===
Object.defineProperty(window, 'setTimeout', {
  value: (cb, delay = 0) => {
    if (delay < 1000) {
      console.debug(`[THROTTLE] Short setTimeout (${delay}ms) intercepted and extended`);
    }
    return window.__tabPowerSaverOriginals.setTimeout(cb, Math.max(delay, 10000));
  },
  configurable: true,
  writable: true
});

Object.defineProperty(window, 'setInterval', {
  value: (cb, delay = 0) => {
    if (delay < 5000) {
      console.debug(`[THROTTLE] Short setInterval (${delay}ms) intercepted and extended`);
    }
    return window.__tabPowerSaverOriginals.setInterval(cb, Math.max(delay, 30000));
  },
  configurable: true,
  writable: true
});

// === 2. EXTREME ANIMATION FRAME THROTTLING ===
let lastAnimationFrameTime = 0;
const MIN_FRAME_INTERVAL = 2000; // 2 seconds between frames

Object.defineProperty(window, 'requestAnimationFrame', {
  value: (callback) => {
    const currentTime = performance.now();

    if (currentTime - lastAnimationFrameTime >= MIN_FRAME_INTERVAL) {
      lastAnimationFrameTime = currentTime;
      return window.__tabPowerSaverOriginals.requestAnimationFrame(callback);
    }

    return window.__tabPowerSaverOriginals.setTimeout(() => {
      lastAnimationFrameTime = performance.now();
      callback(lastAnimationFrameTime);
    }, MIN_FRAME_INTERVAL - (currentTime - lastAnimationFrameTime));
  },
  configurable: true,
  writable: true
});

// === 3. CANVAS & WEBGL RENDERING THROTTLING ===
(function() {
  // Track last render time for each canvas
  const canvasLastRender = new WeakMap();
  const MIN_CANVAS_RENDER_INTERVAL = 5000; // 5 seconds between renders

  // Throttle 2D canvas
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const context = window.__tabPowerSaverOriginals.canvasGetContext.call(this, type, ...args);

    if (type === '2d' && context) {
      // Store original methods
      const originalFillRect = context.fillRect;
      const originalDrawImage = context.drawImage;

      // Override rendering methods
      context.fillRect = function(...args) {
        const now = performance.now();
        if (!canvasLastRender.has(this) || now - canvasLastRender.get(this) >= MIN_CANVAS_RENDER_INTERVAL) {
          canvasLastRender.set(this, now);
          return originalFillRect.apply(this, args);
        }
        return null;
      };

      context.drawImage = function(...args) {
        const now = performance.now();
        if (!canvasLastRender.has(this) || now - canvasLastRender.get(this) >= MIN_CANVAS_RENDER_INTERVAL) {
          canvasLastRender.set(this, now);
          return originalDrawImage.apply(this, args);
        }
        return null;
      };

      // Store originals for restoration
      context.__originalFillRect = originalFillRect;
      context.__originalDrawImage = originalDrawImage;
    }

    return context;
  };

  // Store reference for restoration
  window.__tabPowerSaverOriginalCanvasGetContext = window.__tabPowerSaverOriginals.canvasGetContext;
})();

// === 4. MEDIA HANDLING ===
const mediaElements = [];
document.querySelectorAll('video, audio').forEach(media => {
  if (!media.paused) {
    mediaElements.push({ element: media, wasPlaying: true, currentTime: media.currentTime });
    media.pause();
    media.setAttribute('data-was-playing', 'true');
  } else {
    mediaElements.push({ element: media, wasPlaying: false, currentTime: media.currentTime });
  }

  // Prevent autoplay when tab becomes active
  media.autoplay = false;
  media.muted = true;

  // Store original play method to restore later
  const originalPlay = media.play;
  media.play = function() {
    console.debug("[THROTTLE] Blocked autoplay attempt in background tab");
    return Promise.reject(new Error("Autoplay blocked by Tab Power Saver"));
  };
  media.__originalPlay = originalPlay;
});

// Store media state for restoration
window.__tabPowerSaverMediaState = mediaElements;

// === 5. LAYOUT THRASHING PREVENTION ===
(function() {
  // Store originals for restoration
  window.__tabPowerSaverOriginalResizeObserver = window.ResizeObserver;
  window.__tabPowerSaverOriginalIntersectionObserver = window.IntersectionObserver;

  // Throttle ResizeObserver
  window.ResizeObserver = class extends window.__tabPowerSaverOriginalResizeObserver {
    constructor(callback) {
      super(entries => {
        // Only process resize observations once every 10 seconds
        window.__tabPowerSaverOriginals.setTimeout(() => callback(entries), 10000);
      });
    }
  };

  // Throttle IntersectionObserver
  window.IntersectionObserver = class extends window.__tabPowerSaverOriginalIntersectionObserver {
    constructor(callback, options) {
      super(entries => {
        // Only process intersection observations once every 5 seconds
        window.__tabPowerSaverOriginals.setTimeout(() => callback(entries), 5000);
      }, options);
    }
  };
})();

// === 6. WEB WORKER THROTTLING ===
(function() {
  // Store original for restoration
  window.__tabPowerSaverOriginalWorker = window.Worker;

  window.Worker = function(url, options) {
    console.debug(`[THROTTLE] Worker creation intercepted: ${url}`);

    // Create the actual worker
    const worker = new window.__tabPowerSaverOriginalWorker(url, options);

    // Store original methods for restoration
    worker.__originalPostMessage = worker.postMessage;

    // Throttle worker messages to once every 5 seconds
    worker.postMessage = function(message, transfer) {
      window.__tabPowerSaverOriginals.setTimeout(() => {
        this.__originalPostMessage(message, transfer);
      }, 5000);
    };

    // Store original event handlers
    worker.__originalOnMessage = worker.onmessage;
    worker.__originalOnError = worker.onerror;

    // Throttle message handling
    worker.onmessage = function(e) {
      window.__tabPowerSaverOriginals.setTimeout(() => {
        if (this.__originalOnMessage) {
          this.__originalOnMessage(e);
        }
      }, 5000);
    };

    worker.onerror = function(e) {
      window.__tabPowerSaverOriginals.setTimeout(() => {
        if (this.__originalOnError) {
          this.__originalOnError(e);
        }
      }, 5000);
    };

    return worker;
  };
})();

// === 7. CSS OPTIMIZATIONS – LAYOUT-SAFE ===
// Add data attribute to mark throttled state
document.documentElement.setAttribute('data-tab-power-saver', 'throttled');

const style = document.createElement('style');
style.setAttribute('data-power-saver', 'true');
style.textContent = `
  /* HIGH SPECIFICITY SELECTORS - ONLY APPLY WHEN DATA ATTRIBUTE IS PRESENT */
  html[data-tab-power-saver="throttled"] {
    overflow: hidden !important;
    /* keep original height so player does not resize */
    min-height: 100vh !important;
    height: auto !important;
  }

  html[data-tab-power-saver="throttled"] body {
    overflow: hidden !important;
    /* do NOT force height:100% – let content keep its original size */
  }

  /* pause only heavy animations, leave UI chrome alone */
  html[data-tab-power-saver="throttled"] * {
    animation: none !important;
    transition: none !important !important;
    -webkit-transition: none !important !important;
    will-change: auto !important;
  }

  html[data-tab-power-saver="throttled"] *::before,
  html[data-tab-power-saver="throttled"] *::after {
    display: none !important;
  }

  /* Higher specificity for repaint reduction */
  html[data-tab-power-saver="throttled"] * {
    -webkit-backface-visibility: hidden !important;
    -moz-backface-visibility: hidden !important;
    backface-visibility: hidden !important;
    -webkit-transform: translate3d(0, 0, 0) !important;
    transform: translate3d(0, 0, 0) !important;
  }
`;
document.head.appendChild(style);
window.__tabPowerSaverStyleElement = style;

console.log("SUPER-AGGRESSIVE throttling applied successfully (layout-safe)");
console.log("JavaScript timers, animations, canvas, and media are now severely restricted");
