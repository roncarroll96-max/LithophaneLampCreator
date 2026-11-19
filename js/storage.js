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

/**
 * Turns a saved photo (a data:image/...;base64 string) back into a file. Anything else gives
 * null: a project file can't make the app fetch from the internet.
 */
function dataUrlToBlob(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=\s]*)$/);
  if (!m) return null;
  try {
    const bin = atob(m[2].replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  } catch {
    return null;
  }
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Downloads a .lithoproj file containing the settings and the photos.
 * photos: [{ id, name, blob }] matching settings.photos by id.
 */
export async function saveProjectFile({ settings, photos }, filename) {
  const doc = {
    format: FILE_TAG, version: 2, savedAt: new Date().toISOString(),
    settings,
    photos: await Promise.all((photos || []).map(async (p) => ({ id: p.id, name: p.name || null, data: await blobToDataUrl(p.blob) }))),
  };
  download(new Blob([JSON.stringify(doc)], { type: 'application/json' }), filename);
}

/** Older saves held one photo as { photoBlob, photoName }; turn either form into a photo list. */
export function projectPhotos(proj) {
  if (Array.isArray(proj.photos)) return proj.photos.filter((p) => p && p.blob);
  return proj.photoBlob ? [{ id: 'p1', name: proj.photoName || 'photo', blob: proj.photoBlob }] : [];
}

export async function readProjectFile(file) {
  let doc;
  try { doc = JSON.parse(await file.text()); } catch { throw new Error('That file is not a Lithophane Lamp Creator project.'); }
  if (!doc || doc.format !== FILE_TAG) throw new Error('That file is not a Lithophane Lamp Creator project.');
  // Skip any photo entry that isn't a picture saved by the app
  if (Array.isArray(doc.photos)) {
    const photos = doc.photos
      .filter((p) => p && typeof p.id === 'string')
      .map((p) => ({ id: p.id, name: typeof p.name === 'string' ? p.name : 'photo', blob: dataUrlToBlob(p.data) }))
      .filter((p) => p.blob);
    return { settings: doc.settings, photos };
  }
  // version 1: a single photo
  const blob = dataUrlToBlob(doc.photo);
  return {
    settings: doc.settings,
    photos: blob ? [{ id: 'p1', name: typeof doc.photoName === 'string' ? doc.photoName : 'photo', blob }] : [],
  };
}
