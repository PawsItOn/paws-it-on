const TARGET_BYTES = 4.5 * 1024 * 1024;
const MAX_DIMENSION = 1800;

export async function prepareListingPhotos(files) {
  const prepared = [];
  for (const file of files) prepared.push(await prepareListingPhoto(file));
  return prepared;
}

export async function prepareListingPhoto(file) {
  if (!looksLikeImage(file)) throw new Error('not-image');
  if (file.size < TARGET_BYTES) return file;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.84;
    let blob = await canvasBlob(canvas, quality);
    while (blob.size >= TARGET_BYTES && quality > 0.5) {
      quality -= 0.08;
      blob = await canvasBlob(canvas, quality);
    }
    if (blob.size >= 5 * 1024 * 1024) throw new Error('too-large');
    const base = (file.name || 'listing-photo').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (e) {
    if (e.message === 'too-large') throw e;
    // Some mobile formats may not be canvas-decodable. If already under the
    // Firebase limit we can still upload the original safely.
    if (file.size < 5 * 1024 * 1024) return file;
    throw new Error('too-large');
  }
}

function looksLikeImage(file) {
  if ((file.type || '').startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name || '');
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode-failed')); };
    img.src = url;
  });
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('encode-failed')), 'image/jpeg', quality);
  });
}
