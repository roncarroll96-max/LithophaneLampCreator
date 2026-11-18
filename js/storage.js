// Saving work: automatic browser save (IndexedDB) and project files you can keep or send.

const DB_NAME = 'lithophane-lamp-creator';
const STORE = 'projects';
const KEY = 'autosave';
const FILE_TAG = 'lithophane-lamp-creator-project';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Saves the current project in this browser. Failures are ignored (private windows etc.). */
export async function autosave(project) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(project, KEY);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch (e) {
    console.warn('Autosave failed:', e);
    return false;
  }
}

export async function loadAutosave() {
  try {
    const db = await openDb();
    const val = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    db.close();
    return val || null;
  } catch (e) {
    console.warn('Could not read autosave:', e);
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result); r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url) {
  const res = await fetch(url);
  return res.blob();
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Downloads a .lithoproj file containing the settings and the photo. */
export async function saveProjectFile({ settings, photoBlob, photoName }, filename) {
  const doc = {
    format: FILE_TAG, version: 1, savedAt: new Date().toISOString(),
    settings, photoName: photoName || null,
    photo: photoBlob ? await blobToDataUrl(photoBlob) : null,
  };
  download(new Blob([JSON.stringify(doc)], { type: 'application/json' }), filename);
}

export async function readProjectFile(file) {
  let doc;
  try { doc = JSON.parse(await file.text()); } catch { throw new Error('That file is not a Lithophane Lamp Creator project.'); }
  if (!doc || doc.format !== FILE_TAG) throw new Error('That file is not a Lithophane Lamp Creator project.');
  return {
    settings: doc.settings,
    photoName: doc.photoName,
    photoBlob: doc.photo ? await dataUrlToBlob(doc.photo) : null,
  };
}
