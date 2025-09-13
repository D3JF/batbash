(function () {
  'use strict';
  // Make the script idempotent – safe to run many times
  if (!window.__tabPowerSaverApplied) {
    console.log('⚠️ Tab wasn’t throttled – skipping restoration');
    return; // This return is inside the IIFE
  }
})();

console.log("Restoring tab from aggressive throttled state...");

// Make sure we don't try to restore a tab that wasn't throttled
if (!window.__tabPowerSaverApplied) {
  console.log("⚠️ Tab wasn't throttled - skipping restoration");
  return;
}

// === 1. RESTORE JAVASCRIPT TIMING FUNCTIONS ===
if (window.__tabPowerSaverOriginals) {
  Object.defineProperty(window, 'setTimeout', {
    value: window.__tabPowerSaverOriginals.setTimeout,
    configurable: true,
    writable: true
  });

  Object.defineProperty(window, 'setInterval', {
    value: window.__tabPowerSaverOriginals.setInterval,
    configurable: true,
    writable: true
  });

  Object.defineProperty(window, 'requestAnimationFrame', {
    value: window.__tabPowerSaverOriginals.requestAnimationFrame,
    configurable: true,
    writable: true
  });

  console.log("✓ JavaScript timing functions restored");
} else {
  console.warn("Warning: Original timing functions not found for restoration");
}

// === 2. RESTORE CANVAS & WEBGL FUNCTIONALITY ===
if (window.__tabPowerSaverOriginalCanvasGetContext) {
  // Restore canvas getContext method
  HTMLCanvasElement.prototype.getContext = window.__tabPowerSaverOriginalCanvasGetContext;

  // Restore individual canvas context methods
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(canvas => {
    const context2d = canvas.getContext('2d');
    if (context2d && context2d.__originalFillRect && context2d.__originalDrawImage) {
      context2d.fillRect = context2d.__originalFillRect;
      context2d.drawImage = context2d.__originalDrawImage;

      // Clean up our added properties
      delete context2d.__originalFillRect;
      delete context2d.__originalDrawImage;
    }
  });

  console.log("✓ Canvas rendering functionality restored");
} else {
  console.warn("Warning: Original canvas methods not found for restoration");
}

// === 3. RESTORE MEDIA STATE ===
if (window.__tabPowerSaverMediaState) {
  window.__tabPowerSaverMediaState.forEach(({ element, wasPlaying, currentTime }) => {
    // Restore original play method
    if (element.__originalPlay) {
      element.play = element.__originalPlay;
      delete element.__originalPlay;
    }

    // Restore playback state
    if (wasPlaying) {
      element.currentTime = currentTime;
      element.muted = false;

      // Try to resume playback
      element.play().catch(e => {
        console.debug("[RESTORE] Auto-play prevented by browser policy - user interaction required", e);

        // Show visual indicator that user needs to click to resume
        if (element.controls) {
          element.controls = true;
        }
      });
    }

    element.removeAttribute('data-was-playing');
    element.autoplay = true;
  });

  delete window.__tabPowerSaverMediaState;
  console.log("✓ Media playback restored");
} else {
  console.warn("Warning: Media state not found for restoration");
}

// === 4. RESTORE LAYOUT FUNCTIONALITY ===
if (window.__tabPowerSaverOriginalResizeObserver) {
  window.ResizeObserver = window.__tabPowerSaverOriginalResizeObserver;
  delete window.__tabPowerSaverOriginalResizeObserver;
  console.log("✓ ResizeObserver restored");
}

if (window.__tabPowerSaverOriginalIntersectionObserver) {
  window.IntersectionObserver = window.__tabPowerSaverOriginalIntersectionObserver;
  delete window.__tabPowerSaverOriginalIntersectionObserver;
  console.log("✓ IntersectionObserver restored");
}

// === 5. RESTORE WEB WORKER FUNCTIONALITY ===
if (window.__tabPowerSaverOriginalWorker) {
  // Restore Worker constructor
  window.Worker = window.__tabPowerSaverOriginalWorker;

  // Clean up all worker instances
  const restoreWorkerMethods = (worker) => {
    if (worker.__originalPostMessage) {
      worker.postMessage = worker.__originalPostMessage;
      delete worker.__originalPostMessage;
    }

    if (worker.__originalOnMessage) {
      worker.onmessage = worker.__originalOnMessage;
      delete worker.__originalOnMessage;
    }

    if (worker.__originalOnError) {
      worker.onerror = worker.__originalOnError;
      delete worker.__originalOnError;
    }
  };

  // Try to restore any active workers (limited by browser security)
  try {
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
      if (script.src && script.src.includes('worker')) {
        try {
          const worker = new Worker(script.src);
          restoreWorkerMethods(worker);
        } catch (e) {
          // Can't directly access workers, but our constructor restoration should handle new ones
        }
      }
    });
  } catch (e) {
    console.debug("Could not enumerate workers for restoration", e);
  }

  delete window.__tabPowerSaverOriginalWorker;
  console.log("✓ Web Worker functionality restored");
}

// === 6. RESTORE CSS LAYOUT – WITH SCROLL POSITION ===
if (window.__tabPowerSaverStyleElement) {
  // Remove our throttling styles first
  if (window.__tabPowerSaverStyleElement.parentNode) {
    window.__tabPowerSaverStyleElement.parentNode.removeChild(window.__tabPowerSaverStyleElement);
  }

  // remember scroll offset before we reflow
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  // Forcefully restore overflow with highest priority
  document.documentElement.style.cssText = 'overflow: auto !important;';
  document.body.style.cssText = 'overflow: auto !important;';

  // put scrollbar back at the previous position
  window.scrollTo(0, scrollTop);

  // Trigger a reflow to ensure layout recalculates
  void document.body.offsetWidth;

  console.log("✓ CSS layout restored with overflow fixes");
} else {
  // Fallback restoration if style element is missing
  document.documentElement.style.overflow = 'auto';
  document.body.style.overflow = 'auto';
  console.warn("Warning: Throttling style element not found - using fallback overflow restoration");
}

// === 7. FINAL CLEANUP ===
if (window.__tabPowerSaverOriginals) {
  delete window.__tabPowerSaverOriginals;
}

// Remove all our stored references
document.documentElement.removeAttribute('data-tab-power-saver');
// Clean up our throttling state marker
delete window.__tabPowerSaverApplied;

console.log("✓ Tab restoration complete - all functionality restored");
