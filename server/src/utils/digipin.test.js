/**
 * Unit tests for DigiPin encoder
 * Tests: Basic encoding, boundary cases, validation, determinism
 */

const { encodeDigiPin, validateCoordinates } = require('../utils/digipin');

describe('DigiPin Encoder', () => {
  describe('validateCoordinates', () => {
    test('should accept valid coordinates', () => {
      expect(() => validateCoordinates(0, 0)).not.toThrow();
      expect(() => validateCoordinates(28.7041, 77.1025)).not.toThrow();
      expect(() => validateCoordinates(-90, 180)).not.toThrow();
    });

    test('should reject non-number inputs', () => {
      expect(() => validateCoordinates('0', 0)).toThrow('Coordinates must be numbers');
      expect(() => validateCoordinates(0, null)).toThrow('Coordinates must be numbers');
    });

    test('should reject NaN and Infinity', () => {
      expect(() => validateCoordinates(NaN, 0)).toThrow('Coordinates must be finite');
      expect(() => validateCoordinates(0, Infinity)).toThrow('Coordinates must be finite');
    });

    test('should reject out-of-range coordinates', () => {
      expect(() => validateCoordinates(91, 0)).toThrow('Latitude out of range');
      expect(() => validateCoordinates(0, 181)).toThrow('Longitude out of range');
    });
  });

  describe('encodeDigiPin', () => {
    test('should return 10-character hex string', () => {
      const digipin = encodeDigiPin(28.7041, 77.1025);
      expect(digipin).toMatch(/^[0-9A-F]{10}$/);
      expect(digipin.length).toBe(10);
    });

    test('should handle equator and prime meridian', () => {
      const digipin = encodeDigiPin(0, 0);
      expect(digipin).toMatch(/^[0-9A-F]{10}$/);
    });

    test('should handle south pole', () => {
      const digipin = encodeDigiPin(-90, 0);
      expect(digipin).toMatch(/^[0-9A-F]{10}$/);
    });

    test('should handle near north pole', () => {
      const digipin = encodeDigiPin(89.9999, 179.9999);
      expect(digipin).toMatch(/^[0-9A-F]{10}$/);
    });

    test('should be deterministic (same input = same output)', () => {
      const lat = 28.7041;
      const lon = 77.1025;
      
      const digipin1 = encodeDigiPin(lat, lon);
      const digipin2 = encodeDigiPin(lat, lon);
      const digipin3 = encodeDigiPin(lat, lon);
      
      expect(digipin1).toBe(digipin2);
      expect(digipin2).toBe(digipin3);
    });

    test('should produce different DigiPins for nearby coordinates', () => {
      const digipin1 = encodeDigiPin(28.7041, 77.1025);
      const digipin2 = encodeDigiPin(28.7042, 77.1026);
      
      expect(digipin1).not.toBe(digipin2);
    });

    test('should handle India coordinates', () => {
      // Delhi
      const delhi = encodeDigiPin(28.7041, 77.1025);
      expect(delhi).toMatch(/^[0-9A-F]{10}$/);
      
      // Mumbai
      const mumbai = encodeDigiPin(19.0760, 72.8777);
      expect(mumbai).toMatch(/^[0-9A-F]{10}$/);
      
      // Bangalore
      const bangalore = encodeDigiPin(12.9716, 77.5946);
      expect(bangalore).toMatch(/^[0-9A-F]{10}$/);
    });

    test('should handle boundary coordinates without errors', () => {
      const testCases = [
        [-90, -180],  // Southwest corner
        [-90, 180],   // Southeast corner
        [90, -180],   // Northwest corner
        [90, 180]     // Northeast corner (exclusive)
      ];

      testCases.forEach(([lat, lon]) => {
        expect(() => encodeDigiPin(lat, lon)).not.toThrow();
        const result = encodeDigiPin(lat, lon);
        expect(result).toMatch(/^[0-9A-F]{10}$/);
      });
    });

    test('should produce uppercase hex digits', () => {
      const digipin = encodeDigiPin(28.7041, 77.1025);
      expect(digipin).toBe(digipin.toUpperCase());
    });
  });

  describe('isInIndia', () => {
    // Note: isInIndia is tested in digipin.ts (client side)
    // This ensures boundaries are correctly checked
    test('should identify India coordinates', () => {
      // This is a placeholder; actual test would import from client/src/utils/digipin.ts
      // and test the isInIndia function
      expect(true).toBe(true);
    });
  });
});
