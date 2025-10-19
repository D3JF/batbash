(function () {
  'use strict';
  // Make the script idempotent - safe to run many times
  if (!window.__tabPowerSaverApplied) {
    console.log('Tab was not throttled - skipping restoration');
    return; // Exit entire script execution
  }

  console.log("Restoring tab from aggressive throttled state...");
  
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
  
    // Restore cancelAnimationFrame
    if (window.__tabPowerSaverOriginals.cancelAnimationFrame) {
      Object.defineProperty(window, 'cancelAnimationFrame', {
        value: window.__tabPowerSaverOriginals.cancelAnimationFrame,
        configurable: true,
        writable: true
      });
    }
  
    // Clear RAF ID mapping
    if (window.__tabPowerSaverRAFIdMap) {
      window.__tabPowerSaverRAFIdMap.clear();
      delete window.__tabPowerSaverRAFIdMap;
    }
  
    console.log("✓ JavaScript timing functions restored");
  } else {
    console.warn("Warning: Original timing functions not found for restoration");
  }
  
  // === 2. RESTORE CANVAS & WEBGL FUNCTIONALITY ===
  if (window.__tabPowerSaverOriginalCanvasGetContext) {
    try {
      // First, restore existing canvas contexts BEFORE changing the prototype
      // (because once we restore the prototype, we lose access to the throttled flag)
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        try {
          // Try to get existing context without creating a new one
          // Use the throttled getContext which will return existing contexts with the flag
          const existingContext = canvas.getContext && canvas.getContext('2d', { willReadFrequently: true });
          if (existingContext && existingContext.__tabPowerSaverThrottled) {
            // Restore all overridden methods
            if (existingContext.__originalFillRect) {
              existingContext.fillRect = existingContext.__originalFillRect;
              delete existingContext.__originalFillRect;
            }
            if (existingContext.__originalDrawImage) {
              existingContext.drawImage = existingContext.__originalDrawImage;
              delete existingContext.__originalDrawImage;
            }
            if (existingContext.__originalStroke) {
              existingContext.stroke = existingContext.__originalStroke;
              delete existingContext.__originalStroke;
            }
            if (existingContext.__originalFill) {
              existingContext.fill = existingContext.__originalFill;
              delete existingContext.__originalFill;
            }
    
            // Clean up throttle marker
            delete existingContext.__tabPowerSaverThrottled;
          }
        } catch (e) {
          console.debug("Could not restore individual canvas context:", e);
        }
      });

      // Now restore canvas getContext method on prototype for future contexts
      // Use Object.defineProperty to avoid "read-only" errors
      try {
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
          value: window.__tabPowerSaverOriginalCanvasGetContext,
          configurable: true,
          writable: true
        });
      } catch (e) {
        // If Object.defineProperty fails, try direct assignment as fallback
        try {
          HTMLCanvasElement.prototype.getContext = window.__tabPowerSaverOriginalCanvasGetContext;
        } catch (e2) {
          console.warn("Could not restore HTMLCanvasElement.prototype.getContext:", e2.message);
        }
      }
    
      // Clear the render time tracking WeakMap
      if (window.__tabPowerSaverCanvasRenderMap) {
        delete window.__tabPowerSaverCanvasRenderMap;
      }
      
      // Clean up the stored original
      delete window.__tabPowerSaverOriginalCanvasGetContext;
    
      console.log("✓ Canvas rendering functionality restored");
    } catch (e) {
      console.warn("Warning: Could not fully restore canvas methods:", e.message);
    }
  } else {
    console.warn("Warning: Original canvas methods not found for restoration");
  }
  
  // === 3. RESTORE MEDIA STATE ===
  // First, disconnect the mutation observer
  if (window.__tabPowerSaverMediaObserver) {
    window.__tabPowerSaverMediaObserver.disconnect();
    delete window.__tabPowerSaverMediaObserver;
    console.log("✓ Media mutation observer disconnected");
  }
  
  if (window.__tabPowerSaverMediaState) {
    window.__tabPowerSaverMediaState.forEach(({ element, wasPlaying, currentTime, originalAutoplay }) => {
      // Restore original play method
      if (element.__originalPlay) {
        element.play = element.__originalPlay;
        delete element.__originalPlay;
      }
  
      // Clean up throttle marker
      delete element.__tabPowerSaverThrottled;
  
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
  
      // Restore original autoplay state (default to true if not stored)
      element.removeAttribute('data-was-playing');
      element.autoplay = originalAutoplay !== undefined ? originalAutoplay : true;
    });
  
    delete window.__tabPowerSaverMediaState;
    console.log("✓ Media playback restored");
  } else {
    console.warn("Warning: Media state not found for restoration");
  }
  
  // === 4. RESTORE LAYOUT FUNCTIONALITY ===
  if (window.__tabPowerSaverOriginalResizeObserver) {
    try {
      Object.defineProperty(window, 'ResizeObserver', {
        value: window.__tabPowerSaverOriginalResizeObserver,
        configurable: true,
        writable: true
      });
      delete window.__tabPowerSaverOriginalResizeObserver;
      console.log("✓ ResizeObserver restored");
    } catch (e) {
      console.warn("Warning: Could not restore ResizeObserver:", e.message);
    }
  }
  
  if (window.__tabPowerSaverOriginalIntersectionObserver) {
    try {
      Object.defineProperty(window, 'IntersectionObserver', {
        value: window.__tabPowerSaverOriginalIntersectionObserver,
        configurable: true,
        writable: true
      });
      delete window.__tabPowerSaverOriginalIntersectionObserver;
      console.log("✓ IntersectionObserver restored");
    } catch (e) {
      console.warn("Warning: Could not restore IntersectionObserver:", e.message);
    }
  }
  
  // === 5. RESTORE WEB WORKER FUNCTIONALITY ===
  if (window.__tabPowerSaverOriginalWorker) {
    try {
      // Restore Worker constructor for future workers
      Object.defineProperty(window, 'Worker', {
        value: window.__tabPowerSaverOriginalWorker,
        configurable: true,
        writable: true
      });
      delete window.__tabPowerSaverOriginalWorker;
  
      // NOTE: Cannot restore existing worker instances - browser security prevents
      // enumeration of active workers. The constructor restoration ensures NEW workers
      // created after restoration will work normally. Existing throttled workers will
      // remain throttled until they are terminated or the page is reloaded.
  
      console.log("✓ Web Worker constructor restored (existing workers remain throttled)");
    } catch (e) {
      console.warn("Warning: Could not restore Worker constructor:", e.message);
    }
  }
  
  // === 6. RESTORE CSS LAYOUT – WITH SCROLL POSITION ===
  if (window.__tabPowerSaverStyleElement) {
    // Remove our throttling styles first
    if (window.__tabPowerSaverStyleElement.parentNode) {
      window.__tabPowerSaverStyleElement.parentNode.removeChild(window.__tabPowerSaverStyleElement);
    }
  
    // remember scroll offset before we reflow
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
    // Restore overflow WITHOUT destroying existing inline styles
    // Use setProperty with priority instead of cssText
    document.documentElement.style.setProperty('overflow', 'auto', 'important');
    document.body.style.setProperty('overflow', 'auto', 'important');
  
    // put scrollbar back at the previous position
    window.scrollTo(0, scrollTop);
  
    // Trigger a reflow to ensure layout recalculates
    void document.body.offsetWidth;
  
    console.log("✓ CSS layout restored with overflow fixes");
  } else {
    // Fallback restoration if style element is missing
    document.documentElement.style.setProperty('overflow', 'auto', 'important');
    document.body.style.setProperty('overflow', 'auto', 'important');
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
})(); // End IIFE - ensures idempotency check prevents re-execution