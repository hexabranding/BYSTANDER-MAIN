import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BROADCAST_RADIUS_KM,
  calculateDistanceKm,
  resolveCoordinates,
  isWithinRadius,
  CITY_COORDINATES,
} from '../src/utils/geoUtils.js';

test('GeoRadius 1: DEFAULT_BROADCAST_RADIUS_KM is authoritatively set to 30 km', () => {
  assert.equal(DEFAULT_BROADCAST_RADIUS_KM, 30);
});

test('GeoRadius 2: calculateDistanceKm accurately calculates Haversine distances', () => {
  // Kochi (9.9312, 76.2673) to Aluva (10.1076, 76.3516) is approx 21.6 km
  const kochiToAluva = calculateDistanceKm(9.9312, 76.2673, 10.1076, 76.3516);
  assert.ok(kochiToAluva > 20 && kochiToAluva < 24, `Expected ~21.6 km, got ${kochiToAluva}`);

  // Kaloor (9.9950, 76.2960) to Edappally (10.0236, 76.3116) is approx 3.6 km
  const kaloorToEdappally = calculateDistanceKm(9.9950, 76.2960, 10.0236, 76.3116);
  assert.ok(kaloorToEdappally >= 3.0 && kaloorToEdappally <= 4.5, `Expected ~3.6 km, got ${kaloorToEdappally}`);

  // Kochi to Thrissur (10.5276, 76.2144) is approx 66 km (> 30 km)
  const kochiToThrissur = calculateDistanceKm(9.9312, 76.2673, 10.5276, 76.2144);
  assert.ok(kochiToThrissur > 60 && kochiToThrissur < 75, `Expected ~66 km, got ${kochiToThrissur}`);

  // Same point distance is 0 km
  const samePoint = calculateDistanceKm(9.9312, 76.2673, 9.9312, 76.2673);
  assert.equal(samePoint, 0);

  // Missing or invalid coordinates return null
  assert.equal(calculateDistanceKm(null, null, 10, 10), null);
  assert.equal(calculateDistanceKm(10, 10, undefined, null), null);
});

test('GeoRadius 3: resolveCoordinates resolves from GPS, address, and city fallbacks', () => {
  // Direct coordinates subdocument
  const gpsLocation = {
    addressLine: 'Aster Medcity',
    coordinates: { latitude: 10.0528, longitude: 76.2731 },
  };
  const resolvedGps = resolveCoordinates(gpsLocation);
  assert.equal(resolvedGps.latitude, 10.0528);
  assert.equal(resolvedGps.longitude, 76.2731);

  // Fallback to known city
  const cityLocation = {
    city: 'Kochi, KL',
    area: 'Palarivattom',
  };
  const resolvedCity = resolveCoordinates(cityLocation);
  assert.ok(resolvedCity !== null);
  assert.equal(resolvedCity.latitude, CITY_COORDINATES['palarivattom'].latitude);

  // Unknown string returns null
  assert.equal(resolveCoordinates({ city: 'NonExistentCityXYZ' }), null);
});

test('GeoRadius 4: isWithinRadius respects the 30 km boundary', () => {
  const patientLocation = {
    city: 'Kochi',
    coordinates: { latitude: 9.9312, longitude: 76.2673 },
  };

  // Caretaker 1: In Aluva (approx 21.6 km) -> Within 30 km
  const caretakerNearby = {
    city: 'Aluva',
    coordinates: { latitude: 10.1076, longitude: 76.3516 },
  };
  const nearbyCheck = isWithinRadius(patientLocation, caretakerNearby, 30);
  assert.equal(nearbyCheck.isWithin, true);
  assert.ok(nearbyCheck.distanceKm <= 30);

  // Caretaker 2: In Thrissur (approx 66 km) -> Beyond 30 km
  const caretakerFar = {
    city: 'Thrissur',
    coordinates: { latitude: 10.5276, longitude: 76.2144 },
  };
  const farCheck = isWithinRadius(patientLocation, caretakerFar, 30);
  assert.equal(farCheck.isWithin, false);
  assert.ok(farCheck.distanceKm > 30);
});

test('GeoRadius 5: isWithinRadius gracefully handles missing coordinates with city match', () => {
  const locA = { city: 'Kochi, KL', area: 'Kaloor' };
  const locB = { city: 'Kochi, KL', area: 'Panampilly Nagar' };

  const check = isWithinRadius(locA, locB, 30);
  assert.equal(check.isWithin, true);
  assert.equal(typeof check.distanceKm, 'number');
});

