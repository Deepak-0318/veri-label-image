import { describe, it, expect } from 'vitest';
import { isPointInPolygon, isPointNearPolyline } from '@/components/annotation/AnnotationCanvas';
import { Point } from '@/types/annotation';

describe('AnnotationCanvas Geometric Helpers', () => {
  describe('isPointInPolygon', () => {
    // A simple 100x100 square polygon at origin
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ];

    it('should return true for a point clearly inside the polygon', () => {
      const point: Point = { x: 50, y: 50 };
      expect(isPointInPolygon(point, square)).toBe(true);
    });

    it('should return false for a point clearly outside the polygon', () => {
      const point: Point = { x: 150, y: 50 };
      expect(isPointInPolygon(point, square)).toBe(false);
    });

    it('should return false for a point at the boundary/external', () => {
      const point: Point = { x: -1, y: -1 };
      expect(isPointInPolygon(point, square)).toBe(false);
    });
  });

  describe('isPointNearPolyline', () => {
    // A simple two-segment line: (0,0) -> (100,0) -> (100,100)
    const polyline: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 }
    ];

    it('should return true for a point directly on one of the segments', () => {
      const point: Point = { x: 50, y: 0 };
      expect(isPointNearPolyline(point, polyline, 5)).toBe(true);
    });

    it('should return true for a point close to a segment within threshold', () => {
      const point: Point = { x: 50, y: 3 };
      expect(isPointNearPolyline(point, polyline, 5)).toBe(true);
    });

    it('should return false for a point further than threshold from any segment', () => {
      const point: Point = { x: 50, y: 10 };
      expect(isPointNearPolyline(point, polyline, 5)).toBe(false);
    });

    it('should return true for a point close to the second segment', () => {
      const point: Point = { x: 98, y: 50 };
      expect(isPointNearPolyline(point, polyline, 5)).toBe(true);
    });
  });
});
