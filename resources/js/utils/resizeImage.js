/**
 * Shrinks a photo in the browser before it is uploaded (Phase 1).
 * Phone photos are often 3-8 MB, which PHP/XAMPP rejects by default (2 MB limit). A 512px square-ish
 * JPEG is ~50-150 KB, which is plenty for an avatar and uploads instantly.
 * Returns a File. If anything goes wrong it returns the original file so the server can decide.
 */
export default async function resizeImage(file, max = 512, quality = 0.85) {
  try {
    if (!file || !file.type.startsWith('image/')) return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';            // transparent PNGs become white instead of black in a JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
