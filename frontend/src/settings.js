import './settings.css';

const settingsButton = document.querySelector('#settingsButton');
const modal = document.querySelector('#settingsModal');
const closeButton = document.querySelector('#closeSettingsButton');
const setDefaultButton = document.querySelector('#setDefaultButton');
const openDefaultAppsButton = document.querySelector('#openDefaultAppsButton');
const status = document.querySelector('#associationStatus');

function showSettings() {
  modal.hidden = false;
  requestAnimationFrame(() => closeButton.focus());
}

function hideSettings() {
  modal.hidden = true;
  settingsButton.focus();
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

async function invokeNative(command, payload = {}) {
  if (!window.zero?.invoke) {
    throw new Error('This option is available only in the packaged Windows app.');
  }
  return window.zero.invoke(command, payload);
}

settingsButton.addEventListener('click', showSettings);
closeButton.addEventListener('click', hideSettings);

modal.addEventListener('click', (event) => {
  if (event.target === modal) hideSettings();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) hideSettings();
});

setDefaultButton.addEventListener('click', async () => {
  setDefaultButton.disabled = true;
  openDefaultAppsButton.disabled = true;
  setStatus('Registering supported 3D formats with Windows…');

  try {
    await invokeNative('app.registerFileAssociations');
    setStatus('Registered. Confirm Windows 3D Viewer for the formats you want on the Default Apps page.');
    await invokeNative('app.openDefaultApps');
  } catch (error) {
    console.error(error);
    setStatus(error?.message || 'Could not register file associations.', true);
  } finally {
    setDefaultButton.disabled = false;
    openDefaultAppsButton.disabled = false;
  }
});

openDefaultAppsButton.addEventListener('click', async () => {
  openDefaultAppsButton.disabled = true;
  setStatus('Opening Windows Default Apps…');

  try {
    await invokeNative('app.openDefaultApps');
    setStatus('Windows Default Apps opened.');
  } catch (error) {
    console.error(error);
    setStatus(error?.message || 'Could not open Windows Default Apps.', true);
  } finally {
    openDefaultAppsButton.disabled = false;
  }
});
