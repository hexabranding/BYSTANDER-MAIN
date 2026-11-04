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
