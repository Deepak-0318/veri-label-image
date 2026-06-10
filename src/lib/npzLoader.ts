import JSZip from "jszip";
import { load as loadNpy } from "npyjs";

export interface NpyArray {
  name: string;
  shape: number[];
  dtype: string;
  data: Float32Array | Float64Array | Int32Array | Int16Array | Uint8Array | any;
}

export interface PointCloudArray {
  name: string;
  shape: number[];
  dtype: string;
  /** XYZ as Float32Array length N*3 */
  positions: Float32Array;
  /** Optional intensities length N (normalized 0..1) */
  intensities?: Float32Array;
  pointCount: number;
}

/**
 * Parse a .npz archive (zip of .npy files) and return all contained arrays.
 * Throws a descriptive error if the archive is invalid or contains no .npy files.
 */
export async function parseNpz(buffer: ArrayBuffer): Promise<NpyArray[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    throw new Error("Invalid NPZ archive: file is not a valid zip container.");
  }

  const arrays: NpyArray[] = [];
  const entries = Object.values(zip.files).filter((f) => !f.dir && /\.npy$/i.test(f.name));
  if (entries.length === 0) {
    throw new Error("NPZ contains no .npy arrays.");
  }

  for (const entry of entries) {
    try {
      const buf = await entry.async("arraybuffer");
      const parsed = await loadNpy(buf);
      arrays.push({
        name: entry.name.replace(/\.npy$/i, ""),
        shape: parsed.shape,
        dtype: parsed.dtype,
        data: parsed.data as any,
      });
    } catch (e) {
      // Skip individual unreadable arrays rather than failing the whole archive
      console.warn(`Skipped unreadable array "${entry.name}":`, e);
    }
  }

  if (arrays.length === 0) {
    throw new Error("NPZ archive could not be decoded (all arrays unreadable).");
  }

  return arrays;
}

/**
 * Decide whether an NPY array looks like a point cloud:
 *   - 2D, second dim is 3 (XYZ) or 4 (XYZI)
 *   - dtype float32 or float64
 */
export function isPointCloudCandidate(arr: NpyArray): boolean {
  if (!arr.shape || arr.shape.length !== 2) return false;
  const cols = arr.shape[1];
  if (cols !== 3 && cols !== 4) return false;
  const dt = (arr.dtype || "").toLowerCase();
  return dt === "f4" || dt === "f8" || dt === "float32" || dt === "float64";
}

export function findPointCloudCandidates(arrays: NpyArray[]): NpyArray[] {
  return arrays.filter(isPointCloudCandidate);
}

/** Convert any supported NPY array (already validated) into normalized point data. */
export function toPointCloud(arr: NpyArray): PointCloudArray {
  if (!isPointCloudCandidate(arr)) {
    throw new Error(`Array "${arr.name}" is not a valid point-cloud layout.`);
  }
  const [n, cols] = arr.shape;
  const src = arr.data as Float32Array | Float64Array;
  const positions = new Float32Array(n * 3);
  let intensities: Float32Array | undefined;
  if (cols === 4) intensities = new Float32Array(n);

  let minI = Infinity;
  let maxI = -Infinity;

  for (let i = 0; i < n; i++) {
    const base = i * cols;
    positions[i * 3] = src[base];
    positions[i * 3 + 1] = src[base + 1];
    positions[i * 3 + 2] = src[base + 2];
    if (intensities) {
      const v = src[base + 3];
      intensities[i] = v;
      if (v < minI) minI = v;
      if (v > maxI) maxI = v;
    }
  }

  // Normalize intensities to [0,1] if present
  if (intensities && isFinite(minI) && isFinite(maxI) && maxI > minI) {
    const range = maxI - minI;
    for (let i = 0; i < n; i++) intensities[i] = (intensities[i] - minI) / range;
  }

  return {
    name: arr.name,
    shape: arr.shape,
    dtype: arr.dtype,
    positions,
    intensities,
    pointCount: n,
  };
}