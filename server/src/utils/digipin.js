/**
 * DigiPin - Geographic Coordinate Encoder
 * 
 * Encodes latitude and longitude into a compact 10-character hex string
 * representing a 3.8m-precision grid cell using recursive 4×4 partitioning.
 * 
 * Algorithm:
 * 1. Start with world divided into 36×36 degree grid
 * 2. Recursively partition into 4×4 sub-cells (10 levels total)
 * 3. For each level, find which sub-cell contains the point
 * 4. Encode row/col as hex digit (0-F)
 * 5. Result: 10-character DigiPin
 */

const LEVELS = 10;
const GRID_SIZE = 4;

/**
 * Validate geographic coordinates
 * @param {number} lat - Latitude (-90 to 90)
 * @param {number} lon - Longitude (-180 to 180)
 * @throws {Error} If coordinates are invalid
 */
function validateCoordinates(lat, lon) {
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
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} 10-character hex DigiPin (e.g., "1A3F5B7C9E")
 */
function encodeDigiPin(lat, lon) {
  validateCoordinates(lat, lon);
  
  let minLat = -90, maxLat = 90;
  let minLon = -180, maxLon = 180;
  let digipin = '';
  
  // Iterate through 10 levels of recursion
  for (let level = 0; level < LEVELS; level++) {
    // Calculate current cell dimensions
    const cellHeight = (maxLat - minLat) / GRID_SIZE;
    const cellWidth = (maxLon - minLon) / GRID_SIZE;
    
    // Find row and column within current cell
    let row = Math.floor((lat - minLat) / cellHeight);
    let col = Math.floor((lon - minLon) / cellWidth);
    
    // Clamp to [0, 3] to handle floating-point rounding errors at boundaries
    row = Math.max(0, Math.min(3, row));
    col = Math.max(0, Math.min(3, col));
    
    // Convert row/col to cell index (0-15) and then to hex digit (0-F)
    const cellIndex = row * GRID_SIZE + col;
    digipin += cellIndex.toString(16).toUpperCase();
    
    // Descend into selected sub-cell for next iteration
    minLat += row * cellHeight;
    maxLat = minLat + cellHeight;
    minLon += col * cellWidth;
    maxLon = minLon + cellWidth;
  }
  
  return digipin;
}

module.exports = { encodeDigiPin, validateCoordinates };
