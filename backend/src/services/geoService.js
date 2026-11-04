import { CITY_COORDINATES } from '../utils/geoUtils.js';

/**
 * Geospatial, Reverse-Geocoding, and Address Enrichment Service
 *
 * Implements:
 * 1. Google Maps Geocoding API (when GOOGLE_MAPS_API_KEY / VITE_GOOGLE_MAPS_API_KEY is configured).
 * 2. High-precision OpenStreetMap Nominatim with Landmark, Shop, Commercial, and Amenity extraction.
 * 3. India Post Official Postal API integration (free, no key needed) for 100% verified Indian postal data.
 */

/**
 * Reverse geocode latitude and longitude into normalized Indian address components.
 *
 * @param {number|string} lat - Latitude (-90 to 90)
 * @param {number|string} lng - Longitude (-180 to 180)
 * @returns {Promise<Object>} Normalized address object
 */
export const reverseGeocode = async (lat, lng) => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    const err = new Error('Invalid latitude or longitude coordinates');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const mapplsApiKey =
    process.env.MAPPLS_API_KEY ||
    process.env.MAPMYINDIA_KEY ||
    process.env.VITE_MAPPLS_API_KEY;

  // 1. Mappls (MapmyIndia) Reverse Geocoding API (High-accuracy doorstep mapping for India)
  if (mapplsApiKey && typeof mapplsApiKey === 'string' && mapplsApiKey.trim().length > 10) {
    try {
      const mapplsUrl = `https://search.mappls.com/search/address/rev-geocode?lat=${latitude}&lng=${longitude}&access_token=${mapplsApiKey.trim()}`;
      const mRes = await fetch(mapplsUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Bystander/1.0',
        },
      });

      if (mRes.ok) {
        const mData = await mRes.json();
        if (
          (mData.responseCode === 200 || mData.responseCode === '200') &&
          Array.isArray(mData.results) &&
          mData.results.length > 0
        ) {
          const item = mData.results[0];

          let district = (item.district || '').replace(/\s+District$/i, '').trim();
          if (!district && item.subDistrict) {
            district = item.subDistrict.replace(/\s+District$/i, '').trim();
          }
          district = district || item.city || 'Kozhikode';

          const state = item.state || 'Kerala';
          const pincode = item.pincode ? String(item.pincode).replace(/\D/g, '').slice(0, 6) : '';
          const city = item.city || item.district || district || 'Kozhikode';

          const streetParts = [
            item.poi,
            item.houseNumber ? `#${item.houseNumber}` : '',
            item.houseName,
            item.subLocality,
            item.street,
          ].filter(Boolean);

          const address =
            streetParts.length > 0
              ? streetParts.join(', ')
              : item.formatted_address?.split(',').slice(0, 2).join(', ') || '';

          const area =
            item.locality ||
            item.subLocality ||
            item.subSubLocality ||
            item.village ||
            city;

          return {
            address: address || area,
            area: item.locality || item.subLocality || area,
            city,
            district,
            state,
            pincode,
            formattedAddress: item.formatted_address,
            lat: latitude,
            lng: longitude,
            source: 'mappls',
          };
        }
      }
    } catch (mErr) {
      console.warn('[GeoService] Mappls reverse-geocoding failed, falling back:', mErr.message);
    }
  }

  const googleApiKey =
    process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  // 1. Google Maps Platform Geocoding API (Primary when configured)
  if (
    googleApiKey &&
    typeof googleApiKey === 'string' &&
    googleApiKey.trim().length > 10 &&
    !googleApiKey.includes('your_')
  ) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleApiKey.trim()}`;
      const gRes = await fetch(gUrl);
      if (gRes.ok) {
        const gData = await gRes.json();
        if (
          gData.status === 'OK' &&
          Array.isArray(gData.results) &&
          gData.results.length > 0
        ) {
          const first = gData.results[0];
          const components = first.address_components || [];

          const getComp = (...types) => {
            const found = components.find((c) =>
              types.some((t) => c.types.includes(t)),
            );
            return found ? found.long_name : '';
          };

          const streetNumber = getComp('street_number');
          const route = getComp('route');
          const subpremise = getComp('subpremise', 'premise', 'point_of_interest', 'establishment');
          const neighborhood = getComp('neighborhood', 'sublocality_level_2');
          const sublocality = getComp('sublocality_level_1', 'sublocality');
          const locality = getComp('locality');
          const district = getComp('administrative_area_level_2');
          const state = getComp('administrative_area_level_1');
          const pincode = getComp('postal_code');

          const streetParts = [subpremise, streetNumber, route].filter(Boolean);
          const address =
            streetParts.length > 0
              ? streetParts.join(', ')
              : route || first.formatted_address.split(',')[0] || '';
          const area = [sublocality, neighborhood].filter(Boolean).join(', ') || locality || '';

          return {
            address: address || area,
            area: area || locality,
            city: locality || district || 'Kozhikode',
            district: district || 'Kozhikode',
            state: state || 'Kerala',
            pincode: pincode ? pincode.slice(0, 6) : '',
            formattedAddress: first.formatted_address,
            plusCode: first.plus_code?.compound_code || '',
            lat: latitude,
            lng: longitude,
            source: 'google',
          };
        }
      }
    } catch (gErr) {
      console.warn('[GeoService] Google Geocoding API lookup failed, falling back:', gErr.message);
    }
  }

  // 2. High-Resolution Nominatim (OpenStreetMap) with Landmark / Shop extraction
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=19&addressdetails=1`;
    const osmRes = await fetch(osmUrl, {
      headers: {
        'User-Agent': 'BystanderCare/1.0 (healthcare booking location resolution)',
        'Accept-Language': 'en',
      },
    });

    if (osmRes.ok) {
      const osmData = await osmRes.json();
      const addr = osmData.address || {};

      let pincode = addr.postcode
        ? String(addr.postcode).replace(/\D/g, '').slice(0, 6)
        : '';
      let district = addr.state_district || addr.county || 'Kozhikode';
      let state = addr.state || 'Kerala';
      let postOfficeArea = '';

      // 3. India Post Official Postal API (100% Free Government Database)
      if (pincode && pincode.length === 6) {
        try {
          const postRes = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
          if (postRes.ok) {
            const postData = await postRes.json();
            if (
              postData[0]?.Status === 'Success' &&
              Array.isArray(postData[0]?.PostOffice) &&
              postData[0].PostOffice.length > 0
            ) {
              const po = postData[0].PostOffice[0];
              district = po.District || district;
              state = po.State || state;
              postOfficeArea = po.Name || '';
            }
          }
        } catch (_) {
          // Non-blocking fallback
        }
      }

      const landmark =
        addr.shop ||
        addr.building ||
        addr.amenity ||
        addr.office ||
        addr.commercial ||
        addr.house_name ||
        addr.place;

      const area =
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        postOfficeArea ||
        addr.city_district ||
        '';

      const streetParts = [
        landmark ? `Near ${landmark}` : '',
        addr.house_number ? `#${addr.house_number}` : '',
        addr.road,
      ].filter(Boolean);

      const address =
        streetParts.length > 0
          ? streetParts.join(', ')
          : addr.road || area || '';

      return {
        address: address || area,
        area: area || postOfficeArea || district,
        city: addr.city || addr.town || district,
        district,
        state,
        pincode,
        formattedAddress: osmData.display_name,
        lat: latitude,
        lng: longitude,
        source: 'nominatim_india_post',
      };
    }
  } catch (osmErr) {
    console.warn('[GeoService] Nominatim fallback failed:', osmErr.message);
  }

  // 4. Default Safe Fallback
  return {
    address: '',
    area: '',
    city: 'Kozhikode',
    district: 'Kozhikode',
    state: 'Kerala',
    pincode: '',
    lat: latitude,
    lng: longitude,
    source: 'fallback',
  };
};

/**
 * Forward geocode a typed address, town, or pincode into latitude & longitude coordinates.
 * Implements cascading fallback:
 * 1. Full address (street + locality + district + state + pincode)
 * 2. Town / Locality + District + pincode
 * 3. 6-digit Indian PIN code lookup (India Post + Nominatim)
 * 4. Local Kerala towns & districts dictionary (CITY_COORDINATES)
 *
 * @param {Object|string} params - Search query string or address parameters object
 * @returns {Promise<{ latitude: number, longitude: number, displayName?: string, source: string } | null>}
 */
export const forwardGeocode = async (params) => {
  if (!params) return null;

  let address = '';
  let area = '';
  let city = '';
  let district = '';
  let state = 'Kerala';
  let pincode = '';
  let rawQuery = '';

  if (typeof params === 'string') {
    rawQuery = params.trim();
  } else {
    address = (params.address || params.street || '').trim();
    area = (params.area || params.locality || '').trim();
    city = (params.city || '').trim();
    district = (params.district || '').trim();
    state = (params.state || 'Kerala').trim();
    pincode = (params.pincode || '').replace(/\D/g, '').slice(0, 6);
    rawQuery = (params.q || params.query || '').trim();
  }

  // 1. Authoritative India Post PIN Code Lookup (when 6-digit PIN is provided)
  let officialDistrict = '';
  let poName = '';
  let poBlock = '';
  if (pincode && pincode.length === 6) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const postRes = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (postRes.ok) {
        const postData = await postRes.json();
        if (
          postData[0]?.Status === 'Success' &&
          Array.isArray(postData[0]?.PostOffice) &&
          postData[0].PostOffice.length > 0
        ) {
          const po = postData[0].PostOffice[0];
          officialDistrict = (po.District || '').replace(/\s+District$/i, '').trim();
          poName = (po.Name || '').trim();
          poBlock = (po.Block || '').trim();
        }
      }
    } catch (_) {}
  }

  // Detect town from area/locality, poName, or city (never from raw address text to prevent false positives like "near Calicut University")
  let detectedTown = '';
  const searchInLocality = `${area} ${poName} ${city} ${rawQuery}`.toLowerCase();
  for (const townName of Object.keys(CITY_COORDINATES)) {
    if (townName.length >= 4 && new RegExp(`\\b${townName}\\b`, 'i').test(searchInLocality)) {
      detectedTown = townName;
      break;
    }
  }

  // If still no detected town, check address only if area and pincode are empty
  if (!detectedTown && !area && !pincode && address) {
    const searchInAddress = address.toLowerCase();
    for (const townName of Object.keys(CITY_COORDINATES)) {
      if (townName.length >= 4 && new RegExp(`\\b${townName}\\b`, 'i').test(searchInAddress)) {
        detectedTown = townName;
        break;
      }
    }
  }

  // 2. Build OpenStreetMap Nominatim queries in strict order of geographic specificity
  const queries = [];
  const targetDistrict = officialDistrict || district;

  // 1b. Google Maps Geocoding API (High-precision forward geocoding when configured)
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (
    googleApiKey &&
    typeof googleApiKey === 'string' &&
    googleApiKey.trim().length > 10 &&
    !googleApiKey.includes('your_')
  ) {
    const geoQuery =
      rawQuery ||
      [address, area, targetDistrict || city, state, pincode, 'India']
        .filter(Boolean)
        .join(', ');

    if (geoQuery) {
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(geoQuery)}&key=${googleApiKey.trim()}`;
        const gRes = await fetch(gUrl);
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.status === 'OK' && Array.isArray(gData.results) && gData.results.length > 0) {
            const first = gData.results[0];
            const loc = first.geometry?.location;
            if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
              let gDistrict = '';
              let gState = '';
              let gCity = '';
              if (Array.isArray(first.address_components)) {
                for (const comp of first.address_components) {
                  if (comp.types?.includes('administrative_area_level_2')) {
                    gDistrict = comp.long_name.replace(/\s+District$/i, '').trim();
                  }
                  if (comp.types?.includes('administrative_area_level_1')) {
                    gState = comp.long_name;
                  }
                  if (comp.types?.includes('locality') || comp.types?.includes('sublocality')) {
                    gCity = comp.long_name;
                  }
                }
              }
              return {
                latitude: loc.lat,
                longitude: loc.lng,
                displayName: first.formatted_address,
                district: gDistrict || officialDistrict || targetDistrict || 'Kozhikode',
                city: gCity || poName || area || city || 'Kozhikode',
                locality: area || poName || detectedTown,
                pincode: pincode,
                state: gState || state,
                source: 'google',
              };
            }
          }
        }
      } catch (gErr) {
        console.warn('[GeoService] Google forward-geocoding fallback:', gErr.message);
      }
    }
  }

  if (rawQuery) {
    queries.push(rawQuery);
    if (!rawQuery.toLowerCase().includes('india')) {
      queries.push(`${rawQuery}, India`);
    }
  }

  // Query 1: Locality + Target District + State + India
  if (area && targetDistrict) {
    queries.push(`${area}, ${targetDistrict}, ${state}, India`);
  }

  // Query 2: Locality alone in State (bypasses potential district mismatch)
  if (area) {
    queries.push(`${area}, ${state}, India`);
  }

  // Query 3: Post Office Name from PIN + District
  if (poName && targetDistrict) {
    queries.push(`${poName}, ${targetDistrict}, ${state}, India`);
  }
  if (poName) {
    queries.push(`${poName}, ${state}, India`);
  }

  // Query 4: 6-digit PIN code (authoritative postal delivery area)
  if (pincode && pincode.length === 6) {
    queries.push(`${pincode}, ${state}, India`);
    queries.push(`${pincode}, India`);
  }

  // Query 5: Full address with resolved locality
  const resolvedLocality = area || poName || detectedTown;
  if (address && resolvedLocality) {
    queries.push(`${address}, ${resolvedLocality}, ${targetDistrict ? targetDistrict + ', ' : ''}${state}, India`);
  }

  // Query 6: Detected Town + District
  if (detectedTown) {
    queries.push(`${detectedTown}, ${targetDistrict ? targetDistrict + ', ' : ''}${state}, India`);
    queries.push(`${detectedTown}, ${state}, India`);
  }

  // Deduplicate queries
  const uniqueQueries = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];

  // Execute Nominatim search
  for (const query of uniqueQueries) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=in&limit=1`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'BystanderCare/1.0 (healthcare booking geocoding)',
          'Accept-Language': 'en',
        },
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            return {
              latitude: Number(lat.toFixed(6)),
              longitude: Number(lng.toFixed(6)),
              displayName: first.display_name,
              source: 'nominatim',
              district: officialDistrict || district,
              city: poName || area || city || officialDistrict || district,
              locality: area || poName,
              pincode: pincode,
              state: state,
            };
          }
        }
      }
    } catch (_) {
      // Continue to next fallback query
    }
  }

  // 3. Fallback: India Post Dictionary Match
  if (poName && CITY_COORDINATES[poName.toLowerCase()]) {
    const coords = CITY_COORDINATES[poName.toLowerCase()];
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      displayName: `${poName}, ${officialDistrict || district}, ${pincode}`,
      source: 'india_post_dictionary',
      district: officialDistrict || district,
      city: poName,
      locality: area || poName,
      pincode: pincode,
      state: state,
    };
  }

  // 4. Fallback: Local Kerala & National Metro Dictionary
  const candidates = [
    area,
    poName,
    detectedTown,
    city,
    targetDistrict,
    address,
    rawQuery,
  ]
    .filter(Boolean)
    .map((s) => s.toLowerCase().trim());

  for (const name of candidates) {
    if (CITY_COORDINATES[name]) {
      return {
        latitude: CITY_COORDINATES[name].latitude,
        longitude: CITY_COORDINATES[name].longitude,
        displayName: `${name}, Kerala`,
        source: 'local_dictionary',
        district: officialDistrict || district,
        city: poName || area || city,
        locality: area || poName,
        pincode: pincode,
        state: state,
      };
    }
    const simplified = name.split(',')[0].trim();
    if (CITY_COORDINATES[simplified]) {
      return {
        latitude: CITY_COORDINATES[simplified].latitude,
        longitude: CITY_COORDINATES[simplified].longitude,
        displayName: `${simplified}, Kerala`,
        source: 'local_dictionary',
        district: officialDistrict || district,
        city: poName || area || city,
        locality: area || poName,
        pincode: pincode,
        state: state,
      };
    }
    for (const [townName, coords] of Object.entries(CITY_COORDINATES)) {
      if (townName.length >= 4 && new RegExp(`\\b${townName}\\b`, 'i').test(name)) {
        return {
          latitude: coords.latitude,
          longitude: coords.longitude,
          displayName: `${townName}, Kerala`,
          source: 'local_dictionary_match',
          district: officialDistrict || district,
          city: poName || area || city,
          locality: area || poName,
          pincode: pincode,
          state: state,
        };
      }
    }
  }

  return null;
};

export default {
  reverseGeocode,
  forwardGeocode,
};
