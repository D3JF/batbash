// Standardize browser API across Firefox and Chrome
const browserApi = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', () => {
  const statusEl   = document.getElementById('status');
  const toggleBtn  = document.getElementById('toggleBtn');
  const optionsBtn = document.getElementById('optionsBtn');
  const whitelistBtn = document.getElementById('whitelistBtn'); // NEW

  // Load current state
  browserApi.storage.local.get('powerSavingEnabled', (data) => {
    const enabled = data.powerSavingEnabled || false;
    updateUI(enabled);
  });

  // Update UI based on state
  function updateUI(enabled) {
    statusEl.textContent = enabled ? 'POWER SAVING ACTIVE' : 'POWER SAVING OFF';
    statusEl.style.color = enabled ? '#52c41a' : '#8c8c8c';
    toggleBtn.textContent = enabled ? 'Disable Power Saving' : 'Enable Power Saving';
  }

  // Toggle button click
  toggleBtn.addEventListener('click', () => {
    browserApi.storage.local.get('powerSavingEnabled', (data) => {
      const newState = !(data.powerSavingEnabled || false);

      // First update storage
      browserApi.storage.local.set({ powerSavingEnabled: newState }, () => {
        // Then update our local UI
        updateUI(newState);

        // Notify background script with proper error handling
        browserApi.runtime.sendMessage({ 
          type: 'power_saving_toggle', 
          enabled: newState 
        }).catch(() => {
          // Safe to ignore - background will catch up via storage change
        });
      });
    });
  });

  // Options button
  optionsBtn.addEventListener('click', () => {
    browserApi.runtime.openOptionsPage();
  });

  // Whitelist manager button
  whitelistBtn.addEventListener('click', () => {
    browserApi.tabs.create({url: browserApi.runtime.getURL('whitelist.html')});
    window.close(); // close popup
  });
});
