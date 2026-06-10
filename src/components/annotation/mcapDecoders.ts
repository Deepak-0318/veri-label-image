
export interface DecodeResult {
  url: string;
  format: string;
}

export interface DecodeFailure {
  reason: string;
}

export interface CompressedVideoMessage {
  data: Uint8Array;
  timestamp: number; // seconds
}

export interface DecodedVideoFrame {
  timestamp: number;
  source: ImageBitmap;
  width: number;
  height: number;
}

export interface DecodedVideoFrameLite {
  timestamp: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface DecodedVideoFramesResult {
  frames: DecodedVideoFrame[];
  liteFrames: DecodedVideoFrameLite[];
  firstError?: string;
  detectedFormat?: string;
}

export interface DecodeCompressedVideoOptions {
  maxFrames?: number;
  onFrame?: (frame: DecodedVideoFrame, index: number) => void;
  onLiteFrame?: (frame: DecodedVideoFrameLite, index: number) => void;
  onProgress?: (progress: { decoded: number; total: number }) => void;
  signal?: AbortSignal;
  hardwareAcceleration?: "prefer-hardware" | "prefer-software" | "no-preference";
  yieldInterval?: number;
  lowMemory?: boolean;
}

export function isDecodeFailure(r: DecodeResult | DecodeFailure): r is DecodeFailure {
  return "reason" in r;
}

export function isCompressedVideoSchema(schemaName: string): boolean {
  const l = schemaName.toLowerCase();
  return l.includes("compressedvideo") || l.includes("compressed_video");
}

// Image decoding  (single frame, returns an object-URL or data-URL)

export function decodeImageMessage(
  data: Uint8Array,
  schemaName: string,
  schemaEncoding?: string,
): DecodeResult | DecodeFailure {
  try {
    const lower = schemaName.toLowerCase();

    if (lower === "foxglove.compressedimage") return decodeFoxgloveCompressedImage(data);
    if (lower === "foxglove.rawimage")         return decodeFoxgloveRawImage(data);

    if (lower.includes("compressedimage") || lower.includes("compressed_image"))
      return decodeRos2CompressedImage(data);

    if (lower.includes("sensor_msgs") && lower.includes("image") && !lower.includes("compressed"))
      return decodeRos2RawImage(data);

    return decodeMagicBytes(data);
  } catch (e: any) {
    return { reason: e?.message ?? "Unknown decode error" };
  }
}

// Video decoding  (batch, WebCodecs)

export async function decodeCompressedVideoFrames(
  messages: CompressedVideoMessage[],
  schemaEncoding?: string,
  options: DecodeCompressedVideoOptions = {},
): Promise<DecodedVideoFramesResult> {
  const empty: DecodedVideoFramesResult = { frames: [], liteFrames: [] };

  if (typeof VideoDecoder === "undefined" || typeof EncodedVideoChunk === "undefined") {
    return { ...empty, firstError: "Browser does not support WebCodecs" };
  }
  if (options.signal?.aborted) {
    return { ...empty, firstError: "Cancelled before start" };
  }
  if (messages.length === 0) {
    return { ...empty, firstError: "No messages" };
  }

  // 1. Parse every message into { payload, format, timestamp }
  const parsed: Array<{ payload: Uint8Array; format: string; timestamp: number }> = [];
  let firstParseError: string | undefined;

  for (const msg of messages) {
    const r = parseVideoMessage(msg.data, schemaEncoding);
    if ("reason" in r) { firstParseError = firstParseError ?? r.reason; continue; }
    parsed.push({ ...r, timestamp: msg.timestamp });
  }

  if (parsed.length === 0) {
  return { ...empty, firstError: firstParseError ?? "No payloads parsed" };
}

parsed.sort((a, b) => a.timestamp - b.timestamp);
let lastSeenTs = -Infinity;
const dedupedParsed: typeof parsed = [];
for (const p of parsed) {
  if (p.timestamp > lastSeenTs) {
    dedupedParsed.push(p);
    lastSeenTs = p.timestamp;
  }
}
parsed.length = 0;
parsed.push(...dedupedParsed);

const detectedFormat = parsed[0].format.toLowerCase().trim();

  // 2. Derive WebCodecs codec string
  const codec = deriveCodec(detectedFormat, parsed[0].payload);
  if (!codec) {
    return { ...empty, firstError: `Unsupported codec: ${detectedFormat}`, detectedFormat };
  }

  // 3. For H.264 AVCC streams build the extradata description
  const description = buildDescription(detectedFormat, parsed);

  const hwPref = options.hardwareAcceleration ?? "prefer-hardware";
  const accelerations: Array<"prefer-hardware" | "prefer-software" | "no-preference"> =
    hwPref === "prefer-hardware"
      ? ["prefer-hardware", "prefer-software", "no-preference"]
      : hwPref === "prefer-software"
      ? ["prefer-software", "prefer-hardware", "no-preference"]
      : ["no-preference"];

  let result = empty;
  for (const accel of accelerations) {
    result = await runDecoder(parsed, codec, description, detectedFormat, accel, options);
    const hasFrames = result.frames.length > 0 || result.liteFrames.length > 0;
    if (hasFrames || options.signal?.aborted) break;
    console.warn(`[mcapDecoders] ${accel} failed (${result.firstError}), trying next…`);
  }
  return result;
}

async function runDecoder(
  parsed: Array<{ payload: Uint8Array; format: string; timestamp: number }>,
  codec: string,
  description: BufferSource | undefined,
  detectedFormat: string,
  hwAccel: "prefer-hardware" | "prefer-software" | "no-preference",
  options: DecodeCompressedVideoOptions,
): Promise<DecodedVideoFramesResult> {
  const {
    maxFrames = Infinity,
    onFrame,
    onLiteFrame,
    onProgress,
    signal,
    yieldInterval = 8,
    lowMemory = false,
  } = options;

  const config: VideoDecoderConfig = {
    codec,
    hardwareAcceleration: hwAccel,
    optimizeForLatency: false,
    ...(description ? { description } : {}),
  };

  let support: VideoDecoderSupport;
  try {
    support = await VideoDecoder.isConfigSupported(config);
  } catch {
    return { frames: [], liteFrames: [], firstError: `isConfigSupported threw for ${codec}`, detectedFormat };
  }
  if (!support.supported) {
    return { frames: [], liteFrames: [], firstError: `${codec} not supported (${hwAccel})`, detectedFormat };
  }

  const decodedFrames: Array<DecodedVideoFrame | undefined> = [];
  const liteFrames:    Array<DecodedVideoFrameLite | undefined> = [];
  const outputPromises: Promise<void>[] = [];

  let frameCount    = 0;   // number of frames received from decoder (sync counter)
  let skipped       = 0;
  let decoderError: string | undefined;
  let decoderClosed = false;

  let lmCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
  let lmCtx:    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
  let lmChain:  Promise<void> = Promise.resolve();

  // --- decoder ---
  const decoder = new VideoDecoder({
    output(frame) {
      if (decoderClosed) { frame.close(); return; }

      const idx = frameCount++;
      const ts  = frame.timestamp / 1_000_000; // back to seconds
      const w   = frame.displayWidth  || frame.codedWidth;
      const h   = frame.displayHeight || frame.codedHeight;

      if (lowMemory) {
        const p = lmChain.then(async () => {
          try {
            if (!lmCanvas || lmCanvas.width !== w || lmCanvas.height !== h) {
              if (typeof OffscreenCanvas !== "undefined") {
                lmCanvas = new OffscreenCanvas(w, h);
                lmCtx    = lmCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
              } else {
                const c  = document.createElement("canvas");
                c.width  = w; c.height = h;
                lmCanvas = c;
                lmCtx    = c.getContext("2d");
              }
            }
            if (!lmCtx) { skipped++; return; }

            lmCtx.clearRect(0, 0, w, h);
            lmCtx.drawImage(frame, 0, 0);

            let dataUrl: string;
            if (lmCanvas instanceof OffscreenCanvas) {
              const blob = await lmCanvas.convertToBlob({ type: "image/jpeg", quality: 0.80 });
              dataUrl = await blobToDataUrl(blob);
            } else {
              dataUrl = (lmCanvas as HTMLCanvasElement).toDataURL("image/jpeg", 0.80);
            }

            const lf: DecodedVideoFrameLite = { timestamp: ts, dataUrl, width: w, height: h };
            liteFrames[idx] = lf;
            onLiteFrame?.(lf, idx);
            onProgress?.({ decoded: idx + 1, total: parsed.length });
          } catch (e) {
            skipped++;
            console.warn("[mcapDecoders] lite frame conversion failed", e);
          } finally {
            frame.close();
          }
        });
        lmChain = p.catch(() => undefined);
        outputPromises.push(p);

      } else {
        const p = createImageBitmap(frame)
          .then((source) => {
            const df: DecodedVideoFrame = { timestamp: ts, source, width: w, height: h };
            decodedFrames[idx] = df;
            onFrame?.(df, idx);
            onProgress?.({ decoded: idx + 1, total: parsed.length });
          })
          .catch((e) => {
            skipped++;
            console.warn("[mcapDecoders] createImageBitmap failed", e);
          })
          .finally(() => frame.close());
        outputPromises.push(p);
      }
    },

    error(e) {
      decoderError = decoderError ?? (e.message || "VideoDecoder error");
    },
  });

  // --- feed frames ---
  try {
    decoder.configure(support.config ?? config);

    let seenKeyframe = false;

let decoderErrorCount = 0;
let lastKeyframeIdx = -1;

for (let i = 0; i < parsed.length; i++) {
  if (signal?.aborted) break;
  if (decoderErrorCount > 10) break;
      if (frameCount >= maxFrames)         break;
      if (decoderClosed)                   break;

      const msg  = parsed[i];
      const isH264 = detectedFormat === "h264";

      // Normalise payload to Annex-B for H.264
      const payload = isH264 ? toAnnexB(msg.payload) : msg.payload;

      // Determine chunk type
      const chunkType = getChunkType(payload, detectedFormat, i === 0);
    if (chunkType === "key") {
      seenKeyframe = true;
      lastKeyframeIdx = i;
      decoderErrorCount = 0; // reset on keyframe — decoder can recover
    }
    if (!seenKeyframe) continue;
    if (decoderErrorCount > 0 && chunkType !== "key") continue;

      try {
        const ts = Math.round(msg.timestamp * 1_000_000);

        decoder.decode(new EncodedVideoChunk({
          type: chunkType,
          timestamp: ts,
          data: payload,
        }));
      } catch (e: any) {
        skipped++;
        console.warn("[mcapDecoders] decode() threw", e?.message);
        continue;
      }

      if (i % yieldInterval === 0) {
        await new Promise<void>(r => setTimeout(r, 0));
      }

      if (lowMemory) {
        while (!signal?.aborted && !decoderError && decoder.decodeQueueSize > 16) {
          await new Promise<void>(r => setTimeout(r, 4));
        }
      }
    }

    if (!signal?.aborted && !decoderError && !decoderClosed) {
      try { await decoder.flush(); } catch { /* ignore */ }
    }

    await lmChain.catch(() => undefined);
    await Promise.allSettled(outputPromises);

  } catch (e: any) {
    decoderError = decoderError ?? (e?.message ?? "Unknown error in decode loop");
  } finally {
    if (!decoderClosed) {
      try { decoder.close(); } catch { /* ignore */ }
      decoderClosed = true;
    }
  }

  if (skipped > 0) {
    console.warn(`[mcapDecoders] Skipped ${skipped}/${parsed.length} frames (${hwAccel})`);
  }

  return {
    frames:    decodedFrames.filter(Boolean) as DecodedVideoFrame[],
    liteFrames: liteFrames.filter(Boolean) as DecodedVideoFrameLite[],
    firstError: decoderError,
    detectedFormat,
  };
}

function deriveCodec(format: string, firstPayload: Uint8Array): string | null {
  switch (format) {
    case "h264": return deriveH264Codec(firstPayload) ?? "avc1.42001E";
    case "h265": return "hev1.1.6.L93.B0";
    case "vp9":  return "vp09.00.10.08";
    case "av1":  return "av01.0.08M.08";
    default:     return null;
  }
}

function deriveH264Codec(payload: Uint8Array): string | null {
  const annexB = toAnnexB(payload);
  for (const nal of extractNalUnits(annexB)) {
    if ((nal[0] & 0x1f) === 7 && nal.length >= 4) { // SPS
      const h = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
      return `avc1.${h(nal[1])}${h(nal[2])}${h(nal[3])}`;
    }
  }
  return null;
}


function buildDescription(
  format: string,
  parsed: Array<{ payload: Uint8Array }>,
): ArrayBuffer | undefined {
  if (format !== "h264") return undefined;


  if (hasAnnexBStartCode(parsed[0].payload)) return undefined;

  let sps: Uint8Array | undefined;
  let pps: Uint8Array | undefined;

  for (const { payload } of parsed) {
    for (const nal of extractNalUnits(toAnnexB(payload))) {
      const t = nal[0] & 0x1f;
      if (t === 7 && !sps) sps = nal;
      if (t === 8 && !pps) pps = nal;
      if (sps && pps) break;
    }
    if (sps && pps) break;
  }

  if (!sps || !pps) return undefined;

  const buf  = new ArrayBuffer(6 + 2 + sps.length + 1 + 2 + pps.length);
  const view = new DataView(buf);
  const arr  = new Uint8Array(buf);
  let o = 0;

  view.setUint8(o++, 1);       // configurationVersion
  view.setUint8(o++, sps[1]);  // AVCProfileIndication
  view.setUint8(o++, sps[2]);  // profile_compatibility
  view.setUint8(o++, sps[3]);  // AVCLevelIndication
  view.setUint8(o++, 0xff);    // lengthSizeMinusOne = 3
  view.setUint8(o++, 0xe1);    // numSPS = 1
  view.setUint16(o, sps.length); o += 2;
  arr.set(sps, o);               o += sps.length;
  view.setUint8(o++, 1);       // numPPS = 1
  view.setUint16(o, pps.length); o += 2;
  arr.set(pps, o);

  return buf;
}

function getChunkType(
  payload: Uint8Array,
  format: string,
  isFirst: boolean,
): EncodedVideoChunkType {
  if (format === "h264") {
    for (const nal of extractNalUnits(payload)) {
      const t = nal[0] & 0x1f;
      if (t === 5 || t === 7) return "key"; // IDR or SPS
    }
    return isFirst ? "key" : "delta";
  }
  if (format === "h265") {
    for (const nal of extractNalUnits(payload)) {
      const t = (nal[0] >> 1) & 0x3f;
      if (t >= 16 && t <= 21) return "key";
    }
    return isFirst ? "key" : "delta";
  }
  return isFirst ? "key" : "delta";
}


function toAnnexB(payload: Uint8Array): Uint8Array {
  if (hasAnnexBStartCode(payload)) return payload;

  // Assume AVCC: each NAL is prefixed with a 4-byte big-endian length
  const out: Uint8Array[] = [];
  let offset = 0;
  while (offset + 4 <= payload.length) {
    const len =
      (payload[offset] << 24) |
      (payload[offset + 1] << 16) |
      (payload[offset + 2] << 8) |
      payload[offset + 3];
    offset += 4;
    if (len <= 0 || offset + len > payload.length) break;
    out.push(new Uint8Array([0, 0, 0, 1]));
    out.push(payload.subarray(offset, offset + len));
    offset += len;
  }

  if (out.length === 0) {
    // Not AVCC either — prepend a single start code and hope for the best
    const fallback = new Uint8Array(4 + payload.length);
    fallback[2] = 0; fallback[3] = 1; // 0x00 0x00 0x00 0x01
    fallback.set(payload, 4);
    return fallback;
  }

  const total  = out.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const chunk of out) { result.set(chunk, pos); pos += chunk.length; }
  return result;
}

function hasAnnexBStartCode(p: Uint8Array): boolean {
  for (let i = 0; i < Math.min(p.length - 3, 64); i++) {
    if (p[i] === 0 && p[i + 1] === 0 &&
        (p[i + 2] === 1 || (p[i + 2] === 0 && p[i + 3] === 1))) return true;
  }
  return false;
}

function extractNalUnits(annexB: Uint8Array): Uint8Array[] {
  const units: Uint8Array[] = [];
  let start = -1;

  for (let i = 0; i < annexB.length - 3; i++) {
    const is3 = annexB[i] === 0 && annexB[i + 1] === 0 && annexB[i + 2] === 1;
    const is4 = annexB[i] === 0 && annexB[i + 1] === 0 && annexB[i + 2] === 0 && annexB[i + 3] === 1;
    if (!is3 && !is4) continue;
    const scLen = is4 ? 4 : 3;
    if (start >= 0) units.push(annexB.subarray(start, i));
    start = i + scLen;
    if (is4) i++; // skip extra zero byte
  }
  if (start >= 0 && start < annexB.length) units.push(annexB.subarray(start));
  return units;
}

function parseVideoMessage(
  data: Uint8Array,
  schemaEncoding?: string,
): { payload: Uint8Array; format: string } | DecodeFailure {
  // Try protobuf first (foxglove.CompressedVideo over protobuf)
  if (!schemaEncoding || schemaEncoding === "protobuf") {
    const r = parseVideoProto(data);
    if (!("reason" in r)) return r;
  }
  // Try CDR (ROS2 / foxglove over CDR)
  if (!schemaEncoding || schemaEncoding === "cdr") {
    const r = parseVideoCdr(data);
    if (!("reason" in r)) return r;
  }
  // Fallback: try both regardless of declared encoding
  const a = parseVideoProto(data);
  if (!("reason" in a)) return a;
  const b = parseVideoCdr(data);
  if (!("reason" in b)) return b;

  return { reason: "Could not parse CompressedVideo message" };
}

function parseVideoProto(data: Uint8Array): { payload: Uint8Array; format: string } | DecodeFailure {
  try {
    const fields = new Map<number, Uint8Array[]>();
    let offset = 0;
    while (offset < data.length) {
      const tag    = readVarint(data, offset); offset = tag.next;
      const field  = tag.value >>> 3;
      const wire   = tag.value & 0x7;
      if (wire === 2) {
        const len = readVarint(data, offset); offset = len.next;
        fields.set(field, [...(fields.get(field) ?? []), data.subarray(offset, offset + len.value)]);
        offset += len.value;
      } else if (wire === 0) { const v = readVarint(data, offset); offset = v.next; }
      else if (wire === 1)   { offset += 8; }
      else if (wire === 5)   { offset += 4; }
      else break;
    }

    const payload = fields.get(3)?.[0] ?? largestField(fields);
    const fmtBytes = fields.get(4)?.[0] ?? knownFormatField(fields);
    const format   = fmtBytes ? new TextDecoder().decode(fmtBytes).toLowerCase().trim() : "";

    if (!payload?.length) return { reason: "Proto: empty payload" };
    if (!format)           return { reason: "Proto: missing format" };
    return { payload, format };
  } catch {
    return { reason: "Proto parse failed" };
  }
}

function parseVideoCdr(data: Uint8Array): { payload: Uint8Array; format: string } | DecodeFailure {
  try {
    const r       = new CdrReader(data);
    r.skipHeader();
    const payload = r.byteSequence();
    const format  = r.string().toLowerCase().trim();
    if (!payload.length) return { reason: "CDR: empty payload" };
    if (!format) {
      if (hasAnnexBStartCode(payload)) return { payload, format: "h264" };
      return { reason: "CDR: missing format" };
    }
    const knownVideo = new Set(["h264", "h265", "vp9", "av1", "h264_constrained_baseline"]);
    if (!knownVideo.has(format)) return { reason: `CDR: not a video format: ${format}` };
    return { payload, format };
  } catch {
    return { reason: "CDR parse failed" };
  }
}


function decodeFoxgloveCompressedImage(data: Uint8Array): DecodeResult | DecodeFailure {
  try {
    const r      = new CdrReader(data);
    r.skipHeader();
    const format = r.string();
    const bytes  = r.byteSequence();
    return bytesToObjectUrl(bytes, mimeFor(format));
  } catch {
    return decodeMagicBytes(data);
  }
}

function decodeFoxgloveRawImage(data: Uint8Array): DecodeResult | DecodeFailure {
  try {
    const r        = new CdrReader(data);
    r.skipHeader();
    const width    = r.uint32();
    const height   = r.uint32();
    const encoding = r.string();
    const step     = r.uint32();
    const pixels   = r.byteSequence();
    return rawPixelsToUrl(width, height, encoding, step, pixels);
  } catch {
    return { reason: "Could not decode foxglove.RawImage" };
  }
}

function decodeRos2CompressedImage(data: Uint8Array): DecodeResult | DecodeFailure {
  try {
    const r      = new CdrReader(data);
    r.skipHeader();
    const format = r.string();
    const bytes  = r.byteSequence();
    if (!bytes.length) return { reason: "Empty compressed image" };
    return bytesToObjectUrl(bytes, mimeFor(format));
  } catch {
    return decodeMagicBytes(data);
  }
}

function decodeRos2RawImage(data: Uint8Array): DecodeResult | DecodeFailure {
  try {
    const r        = new CdrReader(data);
    r.skipHeader();
    const height   = r.uint32();
    const width    = r.uint32();
    const encoding = r.string();
    r.uint8();        // is_bigendian
    const step     = r.uint32();
    const pixels   = r.byteSequence();
    return rawPixelsToUrl(width, height, encoding, step, pixels);
  } catch {
    return { reason: "Could not decode sensor_msgs/Image" };
  }
}

function decodeMagicBytes(data: Uint8Array): DecodeResult | DecodeFailure {
  const limit = Math.min(data.length, 1024);
  for (let i = 0; i < limit; i++) {
    // JPEG: FF D8 FF
    if (data[i] === 0xff && data[i + 1] === 0xd8 && data[i + 2] === 0xff)
      return bytesToObjectUrl(data.subarray(i), "image/jpeg");
    // PNG: 89 50 4E 47
    if (data[i] === 0x89 && data[i + 1] === 0x50 && data[i + 2] === 0x4e && data[i + 3] === 0x47)
      return bytesToObjectUrl(data.subarray(i), "image/png");
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (data[i] === 0x52 && data[i + 1] === 0x49 && data[i + 2] === 0x46 && data[i + 3] === 0x46)
      return bytesToObjectUrl(data.subarray(i), "image/webp");
  }
  return { reason: "No recognizable image header" };
}

function rawPixelsToUrl(
  width: number,
  height: number,
  encoding: string,
  _step: number,
  pixels: Uint8Array,
): DecodeResult | DecodeFailure {
  if (width === 0 || height === 0) return { reason: `Invalid size ${width}x${height}` };

  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { reason: "No 2D canvas context" };

  const img = ctx.createImageData(width, height);
  const out = img.data;
  const enc = encoding.toLowerCase();

  if (enc === "rgb8") {
    for (let i = 0, j = 0; i < out.length; i += 4, j += 3) {
      out[i] = pixels[j]; out[i + 1] = pixels[j + 1]; out[i + 2] = pixels[j + 2]; out[i + 3] = 255;
    }
  } else if (enc === "bgr8") {
    for (let i = 0, j = 0; i < out.length; i += 4, j += 3) {
      out[i] = pixels[j + 2]; out[i + 1] = pixels[j + 1]; out[i + 2] = pixels[j]; out[i + 3] = 255;
    }
  } else if (enc === "rgba8") {
    out.set(pixels.subarray(0, out.length));
  } else if (enc === "bgra8") {
    for (let i = 0; i < out.length; i += 4) {
      out[i] = pixels[i + 2]; out[i + 1] = pixels[i + 1]; out[i + 2] = pixels[i]; out[i + 3] = pixels[i + 3];
    }
  } else if (enc === "mono8" || enc === "8uc1") {
    for (let i = 0, j = 0; i < out.length; i += 4, j++) {
      out[i] = out[i + 1] = out[i + 2] = pixels[j]; out[i + 3] = 255;
    }
  } else if (enc === "mono16" || enc === "16uc1") {
    const v16 = new Uint16Array(pixels.buffer, pixels.byteOffset, pixels.byteLength / 2);
    for (let i = 0, j = 0; i < out.length; i += 4, j++) {
      const v = (v16[j] >> 8) & 0xff;
      out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = 255;
    }
  } else if (enc.startsWith("bayer_")) {
    // Simple passthrough as grayscale
    for (let i = 0, j = 0; i < out.length; i += 4, j++) {
      out[i] = out[i + 1] = out[i + 2] = pixels[j]; out[i + 3] = 255;
    }
  } else {
    return { reason: `Unsupported pixel encoding: ${encoding}` };
  }

  ctx.putImageData(img, 0, 0);
  return { url: canvas.toDataURL("image/jpeg", 0.92), format: encoding };
}

class CdrReader {
  private view:   DataView;
  private offset: number;

  constructor(data: Uint8Array) {
    this.view   = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.offset = 4;
  }

  skipHeader() {
    // sec
    this.align(4); this.offset += 4;
    // nanosec
    this.align(4); this.offset += 4;
    // frame_id string
    this.string();
  }

  private align(n: number) {
    const rem = this.offset % n;
    if (rem !== 0) this.offset += n - rem;
  }

  uint8(): number {
    return this.view.getUint8(this.offset++);
  }

  uint32(): number {
    this.align(4);
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  int32(): number {
    this.align(4);
    const v = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return v;
  }

  string(): string {
    const len = this.uint32();
    if (len === 0) return "";
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len - 1);
    this.offset += len;
    return new TextDecoder().decode(bytes);
  }

  byteSequence(): Uint8Array {
    const len = this.uint32();
    const out = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, len);
    this.offset += len;
    return out;
  }
}

function readVarint(data: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0, shift = 0, pos = offset;
  while (pos < data.length) {
    const b = data[pos++];
    if (shift < 32) {
      value |= (b & 0x7f) << shift;
    }
    if (!(b & 0x80)) return { value, next: pos };
    shift += 7;
    if (shift > 63) throw new Error("Varint too long");
  }
  throw new Error("Truncated varint");
}

function largestField(fields: Map<number, Uint8Array[]>): Uint8Array | undefined {
  let best: Uint8Array | undefined;
  for (const vals of fields.values())
    for (const v of vals)
      if (!best || v.length > best.length) best = v;
  return best;
}

function knownFormatField(fields: Map<number, Uint8Array[]>): Uint8Array | undefined {
  const known = new Set(["h264", "h265", "vp9", "av1"]);
  for (const vals of fields.values())
    for (const v of vals)
      if (known.has(new TextDecoder().decode(v).toLowerCase().trim())) return v;
  return undefined;
}


function bytesToObjectUrl(bytes: Uint8Array, mime: string): DecodeResult {
  const blob = new Blob([bytes.slice()], { type: mime });
  return { url: URL.createObjectURL(blob), format: mime };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result as string);
    fr.onerror   = reject;
    fr.readAsDataURL(blob);
  });
}

function mimeFor(format: string): string {
  const f = format.toLowerCase().trim();
  if (f === "jpeg" || f === "jpg") return "image/jpeg";
  if (f === "png")  return "image/png";
  if (f === "webp") return "image/webp";
  if (f === "bmp")  return "image/bmp";
  return "image/jpeg";
}