import './settings.css';

const settingsButton = document.querySelector('#settingsButton');
const modal = document.querySelector('#settingsModal');
const closeButton = document.querySelector('#closeSettingsButton');
const setDefaultButton = document.querySelector('#setDefaultButton');
const openDefaultAppsButton = document.querySelector('#openDefaultAppsButton');
const status = document.querySelector('#associationStatus');
const singleInstanceRadio = document.querySelector('#singleInstanceRadio');
const multipleInstancesRadio = document.querySelector('#multipleInstancesRadio');
const instanceModeStatus = document.querySelector('#instanceModeStatus');

const updaterSection = document.createElement('div');
updaterSection.className = 'settings-section updater-section';
updaterSection.innerHTML = `
  <div class="settings-copy">
    <div class="settings-section-heading">
      <div>
        <h3>App updates</h3>
        <p>Secure updates from GitHub Releases.</p>
      </div>
      <span id="updateVersionBadge" class="version-badge">v—</span>
    </div>

    <div class="update-card">
      <div class="update-status-row">
        <span id="updateStateDot" class="update-state-dot"></span>
        <div class="update-status-copy">
          <strong id="updateStatusTitle">Checking for updates…</strong>
          <span id="updateStatusDetail">Connecting to GitHub Releases</span>
        </div>
      </div>

      <div id="updateProgressWrap" class="update-progress-wrap" hidden>
        <div class="update-progress-track"><span id="updateProgressBar"></span></div>
        <span id="updateProgressText">0%</span>
      </div>

      <div class="settings-actions update-actions">
        <button id="checkUpdateButton">Check again</button>
        <button id="updateActionButton" class="primary" hidden>Download update</button>
      </div>
    </div>

    <p class="update-integrity-note">Updates are verified with SHA-256 before installation.</p>
  </div>
`;

const firstSettingsSection = modal.querySelector('.settings-section');
firstSettingsSection.before(updaterSection);

const updateVersionBadge = updaterSection.querySelector('#updateVersionBadge');
const updateStateDot = updaterSection.querySelector('#updateStateDot');
const updateStatusTitle = updaterSection.querySelector('#updateStatusTitle');
const updateStatusDetail = updaterSection.querySelector('#updateStatusDetail');
const updateProgressWrap = updaterSection.querySelector('#updateProgressWrap');
const updateProgressBar = updaterSection.querySelector('#updateProgressBar');
const updateProgressText = updaterSection.querySelector('#updateProgressText');
const checkUpdateButton = updaterSection.querySelector('#checkUpdateButton');
const updateActionButton = updaterSection.querySelector('#updateActionButton');

let updatePollTimer = null;
let lastUpdateState = null;

function setAssociationStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function setInstanceModeStatus(message, isError = false) {
  instanceModeStatus.textContent = message;
  instanceModeStatus.classList.toggle('error', isError);
}

async function invokeNative(command, payload = {}) {
  if (!window.zero?.invoke) {
    throw new Error('This option is available only in the packaged Windows app.');
  }
  return window.zero.invoke(command, payload);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const digits = index === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[index]}`;
}

function renderUpdateStatus(data) {
  lastUpdateState = data || { state: 'failed', message: 'Invalid updater response.' };
  const currentVersion = data?.currentVersion ? `v${data.currentVersion}` : 'v—';
  updateVersionBadge.textContent = currentVersion;
  updateStateDot.className = 'update-state-dot';
  updateProgressWrap.hidden = true;
  updateActionButton.hidden = true;
  updateActionButton.disabled = false;
  checkUpdateButton.disabled = false;

  switch (data?.state) {
    case 'idle':
      updateStatusTitle.textContent = 'Ready to check';
      updateStatusDetail.textContent = `Installed version ${currentVersion}`;
      break;
    case 'checking':
      updateStateDot.classList.add('busy');
      updateStatusTitle.textContent = 'Checking for updates…';
      updateStatusDetail.textContent = 'Reading the latest GitHub release';
      checkUpdateButton.disabled = true;
      break;
    case 'up-to-date':
      updateStateDot.classList.add('success');
      updateStatusTitle.textContent = 'You’re up to date';
      updateStatusDetail.textContent = `${currentVersion} is the latest version`;
      break;
    case 'available':
      updateStateDot.classList.add('available');
      updateStatusTitle.textContent = `Version v${data.latestVersion} is available`;
      updateStatusDetail.textContent = `Installed: ${currentVersion}`;
      updateActionButton.textContent = 'Download update';
      updateActionButton.hidden = false;
      break;
    case 'downloading': {
      updateStateDot.classList.add('busy');
      updateStatusTitle.textContent = `Downloading v${data.latestVersion}…`;
      const downloaded = Number(data.downloaded || 0);
      const total = Number(data.total || 0);
      const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((downloaded / total) * 100))) : 0;
      updateStatusDetail.textContent = total > 0
        ? `${formatBytes(downloaded)} of ${formatBytes(total)}`
        : `${formatBytes(downloaded)} downloaded`;
      updateProgressWrap.hidden = false;
      updateProgressBar.style.width = total > 0 ? `${percent}%` : '22%';
      updateProgressBar.classList.toggle('indeterminate', total <= 0);
      updateProgressText.textContent = total > 0 ? `${percent}%` : '…';
      checkUpdateButton.disabled = true;
      break;
    }
    case 'ready':
      updateStateDot.classList.add('success');
      updateStatusTitle.textContent = `v${data.latestVersion} is ready to install`;
      updateStatusDetail.textContent = 'Download verified. The app will restart after replacement.';
      updateActionButton.textContent = 'Install & restart';
      updateActionButton.hidden = false;
      break;
    case 'failed':
      updateStateDot.classList.add('error');
      updateStatusTitle.textContent = 'Update check failed';
      updateStatusDetail.textContent = data.message || 'Could not contact GitHub Releases.';
      break;
    case 'unsupported':
      updateStateDot.classList.add('error');
      updateStatusTitle.textContent = 'Updater unavailable';
      updateStatusDetail.textContent = data.message || 'Automatic updates require the packaged Windows app.';
      checkUpdateButton.disabled = true;
      break;
    default:
      updateStateDot.classList.add('error');
      updateStatusTitle.textContent = 'Unknown updater state';
      updateStatusDetail.textContent = 'Try checking again.';
      break;
  }
}

async function refreshUpdateStatus() {
  try {
    const data = await invokeNative('app.getUpdateStatus');
    renderUpdateStatus(data);
  } catch (error) {
    renderUpdateStatus({ state: 'unsupported', message: error?.message || String(error) });
  }
}

function startUpdatePolling() {
  stopUpdatePolling();
  refreshUpdateStatus();
  updatePollTimer = window.setInterval(refreshUpdateStatus, 700);
}

function stopUpdatePolling() {
  if (updatePollTimer !== null) {
    window.clearInterval(updatePollTimer);
    updatePollTimer = null;
  }
}

async function refreshInstanceMode() {
  try {
    const data = await invokeNative('app.getInstanceMode');
    const singleInstance = data?.singleInstance !== false;
    singleInstanceRadio.checked = singleInstance;
    multipleInstancesRadio.checked = !singleInstance;
    setInstanceModeStatus(singleInstance
      ? 'Single instance is active. Opening a model reuses this window.'
      : 'Multiple instances is active.');
  } catch (error) {
    setInstanceModeStatus(error?.message || 'Could not read instance mode.', true);
  }
}

async function saveInstanceMode(singleInstance) {
  singleInstanceRadio.disabled = true;
  multipleInstancesRadio.disabled = true;
  try {
    await invokeNative('app.setInstanceMode', { singleInstance });
    setInstanceModeStatus('Saved. Restart the app to apply the new instance mode.');
  } catch (error) {
    setInstanceModeStatus(error?.message || 'Could not save instance mode.', true);
    await refreshInstanceMode();
  } finally {
    singleInstanceRadio.disabled = false;
    multipleInstancesRadio.disabled = false;
  }
}

function showSettings() {
  modal.hidden = false;
  startUpdatePolling();
  refreshInstanceMode();
  requestAnimationFrame(() => closeButton.focus());
}

function hideSettings() {
  modal.hidden = true;
  stopUpdatePolling();
  settingsButton.focus();
}

settingsButton.addEventListener('click', showSettings);
closeButton.addEventListener('click', hideSettings);

modal.addEventListener('click', (event) => {
  if (event.target === modal) hideSettings();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) hideSettings();
});

singleInstanceRadio.addEventListener('change', () => {
  if (singleInstanceRadio.checked) saveInstanceMode(true);
});

multipleInstancesRadio.addEventListener('change', () => {
  if (multipleInstancesRadio.checked) saveInstanceMode(false);
});

checkUpdateButton.addEventListener('click', async () => {
  checkUpdateButton.disabled = true;
  updateActionButton.disabled = true;
  try {
    renderUpdateStatus(await invokeNative('app.checkForUpdates'));
  } catch (error) {
    renderUpdateStatus({ state: 'failed', message: error?.message || String(error) });
  }
});

updateActionButton.addEventListener('click', async () => {
  updateActionButton.disabled = true;
  try {
    if (lastUpdateState?.state === 'available') {
      renderUpdateStatus(await invokeNative('app.downloadUpdate'));
      return;
    }

    if (lastUpdateState?.state === 'ready') {
      updateStatusTitle.textContent = 'Installing update…';
      updateStatusDetail.textContent = 'Windows 3D Viewer will restart automatically.';
      checkUpdateButton.disabled = true;
      updateActionButton.disabled = true;
      await invokeNative('app.applyUpdate');
    }
  } catch (error) {
    renderUpdateStatus({ state: 'failed', message: error?.message || String(error) });
  }
});

setDefaultButton.addEventListener('click', async () => {
  setDefaultButton.disabled = true;
  openDefaultAppsButton.disabled = true;
  setAssociationStatus('Registering supported 3D formats with Windows…');

  try {
    await invokeNative('app.registerFileAssociations');
    setAssociationStatus('Supported formats registered. Use “Open Default Apps” only if Windows needs a final confirmation.');
  } catch (error) {
    console.error(error);
    setAssociationStatus(error?.message || 'Could not register file associations.', true);
  } finally {
    setDefaultButton.disabled = false;
    openDefaultAppsButton.disabled = false;
  }
});

openDefaultAppsButton.addEventListener('click', async () => {
  openDefaultAppsButton.disabled = true;
  setAssociationStatus('Opening Windows Default Apps…');

  try {
    await invokeNative('app.openDefaultApps');
    setAssociationStatus('Windows Default Apps opened.');
  } catch (error) {
    console.error(error);
    setAssociationStatus(error?.message || 'Could not open Windows Default Apps.', true);
  } finally {
    openDefaultAppsButton.disabled = false;
  }
});
