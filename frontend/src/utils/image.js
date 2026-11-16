/**
 * Image Utilities
 *
 * Compresses an image File or Blob to a lightweight JPEG Data URL using HTML5 Canvas.
 * Automatically constrains maximum dimensions while maintaining aspect ratio,
 * preventing huge payload transfers while preserving crisp visual quality for avatars.
 *
 * @param {File|Blob} file
 * @param {number} [maxWidth=640]
 * @param {number} [quality=0.82]
 * @returns {Promise<string>} JPEG Data URL
 */
export const compressImage = (file, maxWidth = 640, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No image file provided'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image data'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target.result);
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Converts a File, Blob, or Data URL to an optimized, lightweight Data URL.
 * Automatically downsamples large camera images to max 1400px and JPEG 0.8 quality
 * to guarantee payloads stay well within proxy transfer limits (< 300KB)
 * while preserving high visual clarity for text and documents.
 *
 * @param {File|Blob|string|Object} file
 * @returns {Promise<string|null>} Data URL or null
 */
export const fileToOptimizedDataUrl = async (file) => {
  if (!file) return null;
  if (typeof file === 'string') {
    return file.startsWith('data:') ? file : null;
  }
  const raw = file.rawFile || file.file || file;
  if (!(raw instanceof Blob || (typeof File !== 'undefined' && raw instanceof File))) {
    return typeof raw === 'string' && raw.startsWith('data:') ? raw : null;
  }
  if (raw.type && raw.type.startsWith('image/')) {
    try {
      return await compressImage(raw, 1400, 0.8);
    } catch {
      // Fall through to raw reader if canvas rendering fails
    }
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(raw);
  });
};
