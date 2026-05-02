/**
 * DigiPin - Client-side TypeScript wrapper
 * 
 * Exposes the DigiPin encoding algorithm for React components.
 * Identical algorithm to server/src/utils/digipin.js but with TypeScript types.
 */

const LEVELS = 10;
const GRID_SIZE = 4;

/**
 * Result of a DigiPin encoding operation
 */
export interface DigiPinResult {
  digipin: string;
  latitude: number;
  longitude: number;
}

/**
 * Validate geographic coordinates
 * @param lat - Latitude (-90 to 90)
 * @param lon - Longitude (-180 to 180)
 * @throws Error if coordinates are invalid
 */
function validateCoordinates(lat: number, lon: number): void {
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error('Coordinates must be numbers');
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Coordinates must be finite (not NaN or Infinity)');
  }
  if (lat < -90 || lat > 90) {
    throw new Error(`Latitude out of range: ${lat} (must be -90 to 90)`);
  }
  if (lon < -180 || lon > 180) {
    throw new Error(`Longitude out of range: ${lon} (must be -180 to 180)`);
  }
}

/**
 * Encode geographic coordinates to DigiPin
 * 
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns 10-character hex DigiPin (e.g., "1A3F5B7C9E")
 * 
 * @example
 * const digipin = encodeDigiPin(28.7041, 77.1025); // Delhi
 * console.log(digipin); // "XXXXXXXXXXXX" (10 hex digits)
 */
export function encodeDigiPin(latitude: number, longitude: number): string {
  validateCoordinates(latitude, longitude);
  
  let minLat = -90, maxLat = 90;
  let minLon = -180, maxLon = 180;
  let digipin = '';
  
  // Iterate through 10 levels of recursive partitioning
  for (let level = 0; level < LEVELS; level++) {
    // Calculate current cell dimensions
    const cellHeight = (maxLat - minLat) / GRID_SIZE;
    const cellWidth = (maxLon - minLon) / GRID_SIZE;
    
    // Find row and column within current cell
    let row = Math.floor((latitude - minLat) / cellHeight);
    let col = Math.floor((longitude - minLon) / cellWidth);
    
    // Clamp to [0, 3] to handle floating-point rounding errors
    row = Math.max(0, Math.min(3, row));
    col = Math.max(0, Math.min(3, col));
    
    // Convert row/col to cell index (0-15) and encode as hex digit (0-F)
    const cellIndex = row * GRID_SIZE + col;
    digipin += cellIndex.toString(16).toUpperCase();
    
    // Descend into selected sub-cell
    minLat += row * cellHeight;
    maxLat = minLat + cellHeight;
    minLon += col * cellWidth;
    maxLon = minLon + cellWidth;
  }
  
  return digipin;
}

/**
 * Format a raw 10-character DigiPin into human-readable groups.
 * Default grouping: 3-4-3 -> "ABC DEFG HJK"
 */
export function formatDigiPin(raw: string): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.trim().toUpperCase();
  if (cleaned.length !== 10) return cleaned;
  return `${cleaned.slice(0,3)} ${cleaned.slice(3,7)} ${cleaned.slice(7,10)}`;
}

/**
 * Decode a 10-character DigiPin back to its bounding box and centroid.
 * Returns { minLat, minLon, maxLat, maxLon, center: [lat, lon] }
 * Throws on invalid input.
 */
export function decodeDigiPin(raw: string) {
  if (typeof raw !== 'string') throw new Error('Invalid DigiPin');
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[0-9A-F]{10}$/.test(cleaned)) throw new Error('Invalid DigiPin format');

  let minLat = -90, maxLat = 90;
  let minLon = -180, maxLon = 180;
  const GRID = 4;

  for (let i = 0; i < cleaned.length; i++) {
    const hex = cleaned[i];
    const idx = parseInt(hex, 16);
    if (!Number.isFinite(idx) || idx < 0 || idx > 15) throw new Error('Invalid DigiPin digit');

    const row = Math.floor(idx / GRID);
    const col = idx % GRID;

    const cellHeight = (maxLat - minLat) / GRID;
    const cellWidth = (maxLon - minLon) / GRID;

    minLat += row * cellHeight;
    maxLat = minLat + cellHeight;
    minLon += col * cellWidth;
    maxLon = minLon + cellWidth;
  }

  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  return {
    minLat,
    minLon,
    maxLat,
    maxLon,
    center: [centerLat, centerLon]
  };
}

/**
 * Check if coordinates are within India bounds
 * 
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns true if point is within India, false otherwise
 */
export function isInIndia(latitude: number, longitude: number): boolean {
  const INDIA_BOUNDS = {
    minLat: 8.0,   // Southernmost
    maxLat: 35.0,  // Northernmost
    minLon: 68.0,  // Westernmost
    maxLon: 97.0   // Easternmost
  };
  
  return (
    latitude >= INDIA_BOUNDS.minLat &&
    latitude <= INDIA_BOUNDS.maxLat &&
    longitude >= INDIA_BOUNDS.minLon &&
    longitude <= INDIA_BOUNDS.maxLon
  );
}

/**
 * Copy text to clipboard
 * 
 * @param text - Text to copy
 * @returns Promise that resolves when copy is successful
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    throw err;
  }
}
