(function () {
  'use strict';
  // Make the script idempotent – safe to run many times
  if (window.__tabPowerSaverApplied) {
    console.log('⚠️ Throttle script already applied to this tab – skipping re-injection');
    return; // Exit entire script execution
  }

  console.log("Applying SUPER-AGGRESSIVE throttling...");

  // Mark this tab as throttled
  window.__tabPowerSaverApplied = true;

  // Store original functions for restoration - use bind to lock them to their current context
  // This prevents any reference chain breaks if restoration and re-throttling occur
  const originalSetTimeout = window.setTimeout.bind(window);
  const originalSetInterval = window.setInterval.bind(window);
  const originalRAF = window.requestAnimationFrame.bind(window);
  const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;

  window.__tabPowerSaverOriginals = {
    setTimeout: originalSetTimeout,
    setInterval: originalSetInterval,
    requestAnimationFrame: originalRAF,
    canvasGetContext: originalCanvasGetContext
  };

  // === 1. EXTREME JAVASCRIPT TIMING THROTTLING ===
  // Use the locked original references to prevent recursion issues
  Object.defineProperty(window, 'setTimeout', {
  value: (cb, delay = 0) => {
    if (delay < 1000) {
      console.debug(`[THROTTLE] Short setTimeout (${delay}ms) intercepted and extended`);
    }
    return originalSetTimeout(cb, Math.max(delay, 10000));
  },
  configurable: true,
  writable: true
});

Object.defineProperty(window, 'setInterval', {
  value: (cb, delay = 0) => {
    if (delay < 5000) {
      console.debug(`[THROTTLE] Short setInterval (${delay}ms) intercepted and extended`);
    }
    return originalSetInterval(cb, Math.max(delay, 30000));
  },
  configurable: true,
  writable: true
});

// === 2. EXTREME ANIMATION FRAME THROTTLING ===
let lastAnimationFrameTime = 0;
const MIN_FRAME_INTERVAL = 2000; // 2 seconds between frames

// Track RAF IDs and their corresponding timer IDs for proper cancellation
const rafIdMap = new Map(); // Maps fake RAF IDs to real timer IDs
let nextRafId = 1;

Object.defineProperty(window, 'requestAnimationFrame', {
  value: (callback) => {
    const currentTime = performance.now();

    if (currentTime - lastAnimationFrameTime >= MIN_FRAME_INTERVAL) {
      lastAnimationFrameTime = currentTime;
      const realRafId = originalRAF(callback);
      
      // Store mapping in case cancellation is needed
      const fakeId = nextRafId++;
      rafIdMap.set(fakeId, { type: 'raf', id: realRafId });
      return fakeId;
    }

    // Use setTimeout fallback but return a trackable ID
    const fakeId = nextRafId++;
    const timerId = originalSetTimeout(() => {
      rafIdMap.delete(fakeId);
      lastAnimationFrameTime = performance.now();
      callback(lastAnimationFrameTime);
    }, MIN_FRAME_INTERVAL - (currentTime - lastAnimationFrameTime));
    
    rafIdMap.set(fakeId, { type: 'timeout', id: timerId });
    return fakeId;
  },
  configurable: true,
  writable: true
});

// Store original cancelAnimationFrame
const originalCancelRAF = window.cancelAnimationFrame.bind(window);
const originalClearTimeout = window.clearTimeout.bind(window);

// Override cancelAnimationFrame to handle our fake IDs
Object.defineProperty(window, 'cancelAnimationFrame', {
  value: (id) => {
    const mapping = rafIdMap.get(id);
    if (mapping) {
      if (mapping.type === 'raf') {
        originalCancelRAF(mapping.id);
      } else {
        originalClearTimeout(mapping.id);
      }
      rafIdMap.delete(id);
    } else {
      // Fallback to original if not in our map
      originalCancelRAF(id);
    }
  },
  configurable: true,
  writable: true
});

// Store for restoration
window.__tabPowerSaverOriginals.cancelAnimationFrame = originalCancelRAF;
window.__tabPowerSaverOriginals.clearTimeout = originalClearTimeout;
window.__tabPowerSaverRAFIdMap = rafIdMap;

// === 3. CANVAS & WEBGL RENDERING THROTTLING ===
(function() {
  // Track last render time for each canvas context - stored globally for better lifecycle
  const canvasLastRender = new WeakMap();
  const MIN_CANVAS_RENDER_INTERVAL = 5000; // 5 seconds between renders

  // Store the WeakMap globally so it can be accessed during restoration if needed
  window.__tabPowerSaverCanvasRenderMap = canvasLastRender;

  // Create throttled getContext function
  const throttledGetContext = function(type, ...args) {
    const context = originalCanvasGetContext.call(this, type, ...args);

    if (type === '2d' && context) {
      // Only override if not already overridden (for contexts created during throttling)
      if (!context.__tabPowerSaverThrottled) {
        // Store original methods on the context itself
        const originalFillRect = context.fillRect.bind(context);
        const originalDrawImage = context.drawImage.bind(context);
        const originalStroke = context.stroke.bind(context);
        const originalFill = context.fill.bind(context);

        // Override rendering methods with throttled versions
        context.fillRect = function(...args) {
          const now = performance.now();
          if (!canvasLastRender.has(this) || now - canvasLastRender.get(this) >= MIN_CANVAS_RENDER_INTERVAL) {
            canvasLastRender.set(this, now);
            return originalFillRect(...args);
          }
          return null;
        };

        context.drawImage = function(...args) {
          const now = performance.now();
          if (!canvasLastRender.has(this) || now - canvasLastRender.get(this) >= MIN_CANVAS_RENDER_INTERVAL) {
            canvasLastRender.set(this, now);
            return originalDrawImage(...args);
          }
          return null;
        };

        context.stroke = function(...args) {
          const now = performance.now();
          if (!canvasLastRender.has(this) || now - canvasLastRender.get(this) >= MIN_CANVAS_RENDER_INTERVAL) {
            canvasLastRender.set(this, now);
            return originalStroke(...args);
          }
          return null;
        };

        context.fill = function(...args) {
          const now = performance.now();
          if (!canvasLastRender.has(this) || now - canvasLastRender.get(this) >= MIN_CANVAS_RENDER_INTERVAL) {
            canvasLastRender.set(this, now);
            return originalFill(...args);
          }
          return null;
        };

        // Store originals for restoration
        context.__originalFillRect = originalFillRect;
        context.__originalDrawImage = originalDrawImage;
        context.__originalStroke = originalStroke;
        context.__originalFill = originalFill;
        context.__tabPowerSaverThrottled = true;
      }
    }

    return context;
  };

  // Use Object.defineProperty to override getContext (more reliable in strict mode)
  try {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: throttledGetContext,
      configurable: true,
      writable: true
    });
  } catch (e) {
    // Fallback to direct assignment if Object.defineProperty fails
    console.warn("[THROTTLE] Could not use Object.defineProperty for canvas, using direct assignment:", e.message);
    HTMLCanvasElement.prototype.getContext = throttledGetContext;
  }

  // Store reference for restoration
  window.__tabPowerSaverOriginalCanvasGetContext = originalCanvasGetContext;
})();

// === 4. MEDIA HANDLING ===
const mediaElements = [];

// Function to throttle a single media element
function throttleMediaElement(media) {
  // Skip if already throttled
  if (media.__tabPowerSaverThrottled) return;
  
  const wasPlaying = !media.paused;
  const currentTime = media.currentTime;
  const originalAutoplay = media.autoplay;
  const originalMuted = media.muted; // Store original muted state
  
  if (wasPlaying) {
    media.pause();
    media.setAttribute('data-was-playing', 'true');
    // Mute while paused to prevent any background audio
    media.muted = true;
  }
  
  // Store state including original muted value
  mediaElements.push({ 
    element: media, 
    wasPlaying, 
    currentTime, 
    originalAutoplay, 
    originalMuted 
  });

  // Prevent autoplay when tab becomes active
  media.autoplay = false;

  // Store original play method to restore later
  if (!media.__originalPlay) {
    const originalPlay = media.play;
    media.play = function() {
      console.debug("[THROTTLE] Blocked autoplay attempt in background tab");
      return Promise.reject(new Error("Autoplay blocked by Tab Power Saver"));
    };
    media.__originalPlay = originalPlay;
  }
  
  media.__tabPowerSaverThrottled = true;
}

// Throttle existing media elements
document.querySelectorAll('video, audio').forEach(throttleMediaElement);

// Watch for dynamically added media elements
const mediaObserver = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) { // Element node
        // Check if the node itself is media
        if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
          console.debug("[THROTTLE] Detected dynamically added media element");
          throttleMediaElement(node);
        }
        // Check if node contains media elements
        if (node.querySelectorAll) {
          node.querySelectorAll('video, audio').forEach(throttleMediaElement);
        }
      }
    });
  });
});

// Start observing
mediaObserver.observe(document.documentElement, {
  childList: true,
  subtree: true
});

// Store media state and observer for restoration
window.__tabPowerSaverMediaState = mediaElements;
window.__tabPowerSaverMediaObserver = mediaObserver;

// === 5. LAYOUT THRASHING PREVENTION ===
// NOTE: ResizeObserver and IntersectionObserver are read-only in modern browsers
// Attempting to override them causes silent script failures, so we skip them (KISS principle)

// === 6. WEB WORKER THROTTLING ===
// NOTE: Worker throttling is overly complex and can break web apps
// Following KISS principle - skip this feature for better reliability

// === 7. CSS OPTIMIZATIONS – SIMPLIFIED ===
// Add data attribute to mark throttled state
document.documentElement.setAttribute('data-tab-power-saver', 'throttled');

// Add minimal CSS to pause animations - keep it simple to avoid layout issues
const style = document.createElement('style');
style.setAttribute('data-power-saver', 'true');
style.textContent = `
  /* ONLY pause CSS animations - nothing else to avoid breaking layouts */
  html[data-tab-power-saver="throttled"] * {
    animation-play-state: paused !important;
    -webkit-animation-play-state: paused !important;
  }
`;
document.head.appendChild(style);
window.__tabPowerSaverStyleElement = style;

console.log("✓ Tab throttling applied successfully");
console.log("✓ JavaScript timers, animations, canvas, and media are now throttled");
})(); // End IIFE - ensures idempotency check prevents re-execution
