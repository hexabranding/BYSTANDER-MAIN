/**
 * Google Maps JavaScript API Dynamic Loader
 *
 * Provides a cached Promise singleton that asynchronously loads the official
 * Google Maps JavaScript API with libraries: places, geometry, marker.
 * Guarantees single injection across all React components and view lifecycles.
 */

let loadPromise = null;

export const getGoogleMapsApiKey = () => {
  return (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
    ''
  ).trim();
};

export const isGoogleMapsConfigured = () => {
  const key = getGoogleMapsApiKey();
  return Boolean(key && key.length > 10 && !key.includes('your_'));
};

export const loadGoogleMaps = (customKey) => {
  const key = customKey || getGoogleMapsApiKey();

  if (!key) {
    return Promise.reject(new Error('Google Maps API key is missing or not configured'));
  }

  // If Map constructor is already ready on window, resolve immediately
  if (typeof window !== 'undefined' && window.google?.maps?.Map) {
    return Promise.resolve(window.google.maps);
  }

  // Return existing in-flight promise if loading
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('Google Maps can only be loaded in a browser environment'));
    }

    if (window.google?.maps?.Map) {
      return resolve(window.google.maps);
    }

    const waitForMap = (maxWaitMs = 12000) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(interval);
          resolve(window.google.maps);
        } else if (Date.now() - startTime > maxWaitMs) {
          clearInterval(interval);
          loadPromise = null;
          reject(new Error('Google Maps Map constructor timed out after script load'));
        }
      }, 50);
    };

    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      if (window.google?.maps?.Map) {
        return resolve(window.google.maps);
      }
      existingScript.addEventListener('load', () => waitForMap());
      existingScript.addEventListener('error', (err) => {
        loadPromise = null;
        reject(err);
      });
      waitForMap();
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry,marker`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      waitForMap();
    };

    script.onerror = (error) => {
      loadPromise = null;
      reject(new Error('Failed to load Google Maps script. Check network or API key restrictions.'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
};

export default {
  loadGoogleMaps,
  getGoogleMapsApiKey,
  isGoogleMapsConfigured,
};

