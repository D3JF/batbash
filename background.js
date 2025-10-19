// Standardize browser API across Firefox and Chrome
const browserApi = typeof browser !== 'undefined' ? browser : chrome;

// Track power-saving state
let powerSavingEnabled = false;

// Track which tabs have been throttled
const throttledTabs = new Set();

// List of URL schemes we cannot access
const RESTRICTED_SCHEMES = [
  'about:', 
  'chrome:', 
  'file:', 
  'moz-extension:', 
  'view-source:'
];

// ---------- WHITELIST START ----------
let sites = [];                       // eTLD+1 list

/* return the registrable domain (eTLD+1) */
function getDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    // polyfill for browsers without chrome.domains
    const parts = host.split('.');
    if (parts.length > 2) return parts.slice(-2).join('.');
    return host;
  } catch (_) { return ''; }
}

// true if hostname is whitelisted
function isWhitelisted(url) {
  const d = getDomain(url);
  return d && sites.includes(d);
}

// load whitelist once at start-up
browserApi.storage.local.get('whitelistedSites', data => {
  sites = data.whitelistedSites || [];
});

// keep in-sync when user edits the list
browserApi.storage.onChanged.addListener(changes => {
  if (changes.whitelistedSites) sites = changes.whitelistedSites.newValue || [];
});
// ---------- WHITELIST END ----------

// Initialize extension
function initializeExtension() {
  console.log(`⚙️ [${Date.now() % 100000}] Initializing extension...`);

  // Load saved state
  browserApi.storage.local.get('powerSavingEnabled', (data) => {
    powerSavingEnabled = data.powerSavingEnabled || false;
    updateButtonIcon(powerSavingEnabled);

    if (powerSavingEnabled) {
      console.log(`✅ [${Date.now() % 100000}] Resuming Power Saving Mode`);
      startTabMonitoring();
      // Throttle any existing background tabs
      detectAllBackgroundTabs();
    }

    // SET UP ALL LISTENERS AFTER STATE IS LOADED
    setupEventListeners();
    setupButtonListener();
    setupMessageListener();
  });
}

// Setup all event listeners
function setupEventListeners() {
  console.log(`👂 [${Date.now() % 100000}] Setting up event listeners...`);

  // Tab activation - restore when tab becomes active
  browserApi.tabs.onActivated.addListener(handleTabActivation);

  // Tab update - handle new tabs or URL changes
  browserApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!powerSavingEnabled) return;

    // Handle tab becoming active (fallback for restoration)
    if (tab.active && changeInfo.status === 'complete') {
      if (throttledTabs.has(tabId)) {
        console.log(`🔄 [${Date.now() % 100000}] Restoring activated tab: ${tabId} - ${tab.title}`);
        restoreTab(tabId);
      }
      return;
    }

    // Skip if not a completed tab load
    if (!changeInfo.status || changeInfo.status !== 'complete') return;

    // Skip if active tab
    if (tab.active) return;

    // Skip if not accessible
    if (!isTabAccessible(tab)) return;

    // Skip if already throttled
    if (throttledTabs.has(tabId)) return;

    // Skip if should be excluded
    if (tab.pinned || tab.audible) return;

    // Skip if whitelisted
    if (isWhitelisted(tab.url)) return;

    console.log(`⏳ [${Date.now() % 100000}] Detected new background tab: ${tabId} - ${tab.title}`);
    throttleTab(tabId);
  });

  // Tab removal - clean up tracking
  browserApi.tabs.onRemoved.addListener(tabId => {
    throttledTabs.delete(tabId);
    console.log(`🗑️ [${Date.now() % 100000}] Cleaned up throttled tab tracking for: ${tabId}`);
  });

  // Handle browser restarts
  browserApi.runtime.onStartup.addListener(() => {
    if (powerSavingEnabled) {
      console.log(`🚀 [${Date.now() % 100000}] Browser restarted with Power Saving Mode enabled`);
      // Give browser time to load tabs
      setTimeout(detectAllBackgroundTabs, 2000);
    }
  });
}

// Setup message listener for popup communication
function setupMessageListener() {
  console.log(`📨 [${Date.now() % 100000}] Setting up message listener...`);

  browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'power_saving_toggle') {
      console.log(`🔄 [${Date.now() % 100000}] Processing toggle command: ${message.enabled}`);

      // Update internal state
      powerSavingEnabled = message.enabled;

      // Update button icon
      updateButtonIcon(powerSavingEnabled);

      if (powerSavingEnabled) {
        console.log(`✅ [${Date.now() % 100000}] POWER SAVING MODE ON - Throttling background tabs`);
        startTabMonitoring();
        detectAllBackgroundTabs();
      } else {
        console.log(`⏸️ [${Date.now() % 100000}] POWER SAVING MODE OFF - Restoring all tabs`);
        stopTabMonitoring();
        browserApi.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (isTabAccessible(tab) && throttledTabs.has(tab.id)) {
              restoreTab(tab.id);
            }
          });
        });
      }

      // Keep message channel open for async response
      return true;
    }
  });
}

// Start monitoring tabs for changes
function startTabMonitoring() {
  console.log(`⏱️ [${Date.now() % 100000}] Starting periodic background tab monitoring (5s interval)`);

  // Clear any existing interval first
  if (window.tabMonitoringInterval) {
    clearInterval(window.tabMonitoringInterval);
  }

  // Check for background tabs every 5 seconds
  window.tabMonitoringInterval = setInterval(detectAllBackgroundTabs, 5000);
}

// Stop monitoring tabs for changes
function stopTabMonitoring() {
  console.log(`⏹️ [${Date.now() % 100000}] Stopping background tab monitoring`);
  if (window.tabMonitoringInterval) {
    clearInterval(window.tabMonitoringInterval);
    window.tabMonitoringInterval = null;
  }
}

// Detect and throttle ALL background tabs (simple & robust)
function detectAllBackgroundTabs() {
  const detectionTime = Date.now();
  console.log(`🔍 [${detectionTime % 100000}] Running comprehensive background tab detection...`);

  // Early-exit if power-saving was disabled while this timer was pending
  if (!powerSavingEnabled) return;

  browserApi.tabs.query({}, (tabs) => {
    if (browserApi.runtime.lastError) {
      console.error(`❌ [${detectionTime % 100000}] Failed to query tabs:`, browserApi.runtime.lastError);
      return;
    }

    let throttledCount = 0;
    let restoredCount = 0;

    tabs.forEach(tab => {
      if (!isTabAccessible(tab)) return;
      if (isWhitelisted(tab.url)) {
        console.log(`⏭️ [${detectionTime % 100000}] Skipping whitelisted website: ${tab.url}`);
        return;
      }

      // Case 1: Tab should be throttled but isn't
      if (!tab.active && !tab.pinned && !tab.audible && !throttledTabs.has(tab.id)) {
        console.log(`⏳ [${detectionTime % 100000}] Throttling background tab: ${tab.id} - ${tab.title}`);
        throttleTab(tab.id);
        throttledCount++;
      } 
      // Case 2: Tab should NOT be throttled but is
      else if (tab.active && throttledTabs.has(tab.id)) {
        console.log(`🔄 [${detectionTime % 100000}] Restoring active tab: ${tab.id} - ${tab.title}`);
        restoreTab(tab.id);
        restoredCount++;
      }
    });

    console.log(`📊 [${detectionTime % 100000}] Status: ${throttledCount} throttled, ${restoredCount} restored, ${throttledTabs.size} total throttled`);
  });
}

// Handle tab activation (simple restoration)
function handleTabActivation(activeInfo) {
  const activationTime = Date.now();
  console.log(`🎯 [${activationTime % 100000}] TAB ACTIVATION DETECTED! Tab: ${activeInfo.tabId}`);

  // Simple: Just restore the tab if it's throttled
  setTimeout(() => {
    browserApi.tabs.get(activeInfo.tabId, (tab) => {
      if (browserApi.runtime.lastError || !tab || !tab.active) return;

      if (throttledTabs.has(tab.id)) {
        console.log(`🔄 [${activationTime % 100000}] Restoring activated tab: ${tab.id} - ${tab.title}`);
        restoreTab(tab.id);
      }
    });
  }, 100);
}

// Check if tab URL is accessible
function isTabAccessible(tab) {
  if (!tab.url) return false;
  const isAccessible = !RESTRICTED_SCHEMES.some(scheme => tab.url.startsWith(scheme));
  if (!isAccessible) {
    console.debug(`🔒 [${Date.now() % 100000}] Tab not accessible: ${tab.id} - ${tab.url}`);
  }
  return isAccessible;
}

// Throttle a specific tab - ENHANCED WITH REDECLARATION FIX
function throttleTab(tabId) {
  const throttleTime = Date.now();
  console.log(`⚡ [${throttleTime % 100000}] ATTEMPTING TO THROTTLE tab: ${tabId}`);

  // Check if already in our tracked set (quick local check)
  if (throttledTabs.has(tabId)) {
    console.log(`⏭️ [${throttleTime % 100000}] Tab already in throttled set, skipping: ${tabId}`);
    return;
  }

  browserApi.tabs.get(tabId, (tab) => {
    if (browserApi.runtime.lastError || !isTabAccessible(tab)) {
      if (browserApi.runtime.lastError) {
        console.debug(`❌ [${throttleTime % 100000}] Failed to get tab for throttling:`, browserApi.runtime.lastError.message);
      }
      return;
    }

    // Before injecting, check if the page already has the throttle applied
    browserApi.tabs.executeScript(tabId, {
      code: 'typeof window.__tabPowerSaverApplied !== "undefined" && window.__tabPowerSaverApplied === true'
    }, (checkResults) => {
      if (browserApi.runtime.lastError) {
        // Can't check, try throttling anyway
        console.debug(`⚠️ [${throttleTime % 100000}] Could not check throttle status, proceeding: ${browserApi.runtime.lastError.message}`);
        injectThrottleScript(tabId, tab, throttleTime);
        return;
      }

      if (checkResults && checkResults[0] === true) {
        console.log(`⏭️ [${throttleTime % 100000}] Tab already throttled in page, adding to set: ${tabId}`);
        throttledTabs.add(tabId);
        return;
      }

      // Not throttled, inject the script
      injectThrottleScript(tabId, tab, throttleTime);
    });
  });
}

// Helper function to inject throttle script
function injectThrottleScript(tabId, tab, throttleTime) {
  try {
    browserApi.tabs.executeScript(tabId, {
      file: 'throttle-script.js'
    }, (results) => {
      if (browserApi.runtime.lastError) {
        if (browserApi.runtime.lastError.message.includes('Missing host permission')) {
          console.log(`🔒 [${throttleTime % 100000}] Skipping tab without permission: ${tab.url}`);
        } else {
          console.error(`❌ [${throttleTime % 100000}] Failed to throttle tab ${tabId}:`, browserApi.runtime.lastError.message);
        }
        return;
      }
      
      // Add to Set AFTER successful injection
      throttledTabs.add(tabId);
      console.log(`✅ [${throttleTime % 100000}] THROTTLED tab: ${tabId} - ${tab.title}`);
    });
  } catch (e) {
    console.error(`❌ [${throttleTime % 100000}] Exception while throttling tab ${tabId}:`, e.message);
  }
}

// Restore a specific tab
function restoreTab(tabId) {
  const restoreTime = Date.now();
  console.log(`🔄 [${restoreTime % 100000}] ATTEMPTING TO RESTORE tab: ${tabId}`);

  browserApi.tabs.get(tabId, (tab) => {
    if (browserApi.runtime.lastError || !isTabAccessible(tab)) {
      console.error(`❌ [${restoreTime % 100000}] Failed to get tab for restoration:`, browserApi.runtime.lastError);
      throttledTabs.delete(tabId);
      return;
    }

    try {
      browserApi.tabs.executeScript(tabId, {
        file: 'restore-script.js'
      }, () => {
        if (browserApi.runtime.lastError) {
          if (!browserApi.runtime.lastError.message.includes('Missing host permission')) {
            console.error(`❌ [${restoreTime % 100000}] Failed to restore tab: ${tabId} - ${tab.title}`, browserApi.runtime.lastError.message);
          }
        } else {
          console.log(`✅ [${restoreTime % 100000}] RESTORED tab: ${tabId} - ${tab.title}`);
        }
        throttledTabs.delete(tabId);
      });
    } catch (e) {
      console.error(`❌ [${restoreTime % 100000}] Exception while restoring tab: ${tabId} - ${tab.title}`, e.message);
      throttledTabs.delete(tabId);
    }
  });
}

// Handle button clicks
function setupButtonListener() {
  browserApi.browserAction.onClicked.addListener(() => {
    powerSavingEnabled = !powerSavingEnabled;
    browserApi.storage.local.set({ powerSavingEnabled });
    updateButtonIcon(powerSavingEnabled);

    if (powerSavingEnabled) {
      console.log(`✅ [${Date.now() % 100000}] POWER SAVING MODE ON - Throttling background tabs`);
      startTabMonitoring();
      detectAllBackgroundTabs();
    } else {
      console.log(`⏸️ [${Date.now() % 100000}] POWER SAVING MODE OFF - Restoring all tabs`);
      stopTabMonitoring();
      browserApi.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (isTabAccessible(tab) && throttledTabs.has(tab.id)) {
            restoreTab(tab.id);
          }
        });
      });
    }
  });
}

// Update button appearance
function updateButtonIcon(enabled) {
  browserApi.browserAction.setIcon({
    path: {
      16: enabled ? "icon-active.png" : "icon.png",
      48: enabled ? "icon-active.png" : "icon.png"
    }
  });
}

// Initialize everything (single initialization point)
initializeExtension();
