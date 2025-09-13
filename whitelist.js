const browserApi = typeof browser !== 'undefined' ? browser : chrome;

const form   = document.getElementById('addForm');
const input  = document.getElementById('siteInput');
const listEl = document.getElementById('siteList');

let sites = [];

// return registrable domain (eTLD+1)
function getDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const parts = host.split('.');
    if (parts.length > 2) return parts.slice(-2).join('.');
    return host;
  } catch (_) { return ''; }
}

// Load stored whitelist
browserApi.storage.local.get('whitelistedSites', data => {
  sites = data.whitelistedSites || [];
  render();
});

// Add site
form.addEventListener('submit', e => {
  e.preventDefault();
  const raw = input.value.trim().toLowerCase();
  if (!raw) return;
  // store only registrable domain
  const d = getDomain('https://' + raw);
  if (!d || sites.includes(d)) return;
  sites.push(d);
  saveAndRender();
  input.value = '';
});

// Remove site
function removeSite(site) {
  sites = sites.filter(s => s !== site);
  saveAndRender();
}

// Persist + redraw
function saveAndRender() {
  browserApi.storage.local.set({ whitelistedSites: sites }, render);
}

function render() {
  listEl.innerHTML = '';
  sites.forEach(s => {
    const li = document.createElement('li');
    li.textContent = s;
    const x = document.createElement('button');
    x.textContent = '✕';
    x.onclick = () => removeSite(s);
    li.appendChild(x);
    listEl.appendChild(li);
  });
}
