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

export default {
  reverseGeocode,
};
