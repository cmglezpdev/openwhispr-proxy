/**
 * Extracts audio duration (seconds) from a raw audio buffer by parsing the
 * container headers directly. No external dependencies — covers the formats
 * OpenWhispr sends: WebM/Opus, OGG, MP4/M4A, MP3 and WAV.
 *
 * Returns the duration in seconds, or `null` when the buffer is empty or the
 * format is not recognized.
 */

export function getAudioDurationSeconds(buffer: Buffer): number | null {
  if (!buffer || buffer.length === 0) return null;

  const fmt = detectFormat(buffer);
  switch (fmt) {
    case 'wav':
      return parseWavDuration(buffer);
    case 'webm':
      return parseWebmDuration(buffer);
    case 'ogg':
      return parseOggDuration(buffer);
    case 'mp4':
      return parseMp4Duration(buffer);
    case 'mp3':
      return parseMp3Duration(buffer);
    default:
      return null;
  }
}

type AudioFormat = 'wav' | 'webm' | 'ogg' | 'mp4' | 'mp3' | null;

function detectFormat(buffer: Buffer): AudioFormat {
  // WAV: RIFF....WAVE
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return 'wav';
  }

  // WebM: EBML magic (1A 45 DF A3)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'webm';
  }

  // OGG: "OggS" magic
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
    return 'ogg';
  }

  // MP4/M4A: box size + "ftyp"
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'mp4';
  }

  // MP3: ID3 tag or frame sync (11 1 1 1 ... 0xE0FF mask)
  if (buffer.length >= 3) {
    if (buffer.toString('ascii', 0, 3) === 'ID3') return 'mp3';
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3';
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* WAV                                                                 */
/* duration = data chunk size / byte rate                              */
/* ------------------------------------------------------------------ */

function parseWavDuration(buffer: Buffer): number | null {
  let off = 12; // skip RIFF header
  let byteRate = 0;
  let dataSize = 0;

  while (off + 8 <= buffer.length) {
    const id = buffer.toString('ascii', off, off + 4);
    const size = buffer.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      if (off + 16 + 4 <= buffer.length) {
        byteRate = buffer.readUInt32LE(off + 16);
      }
    } else if (id === 'data') {
      dataSize = size;
    }
    off += 8 + size + (size % 2);
  }

  if (byteRate > 0 && dataSize > 0) return dataSize / byteRate;
  return null;
}

/* ------------------------------------------------------------------ */
/* WebM (EBML)                                                         */
/* Header `Duration` when present; otherwise last Cluster timestamp +  */
/* last block duration + codec delay.                                  */
/* ------------------------------------------------------------------ */

const WEBM_IDS = {
  SEGMENT: 0x18538067,
  INFO: 0x1549a966,
  TIMECODE_SCALE: 0x2ad7b1,
  DURATION: 0x4489,
  TRACKS: 0x1654ae6b,
  TRACK_ENTRY: 0xae,
  CODEC_DELAY: 0x56aa,
  CLUSTER: 0x1f43b675,
  CLUSTER_TIMESTAMP: 0xe7,
  SIMPLE_BLOCK: 0xa3,
  BLOCK_GROUP: 0xa0,
  BLOCK: 0xa1,
  BLOCK_DURATION: 0x9b,
} as const;

function readVintLength(buffer: Buffer, off: number): number {
  const b = buffer[off];
  let len = 1;
  for (let mask = 0x80; mask > 0 && (b & mask) === 0; mask >>= 1) len++;
  return len;
}

function readVintValue(buffer: Buffer, off: number, length: number): number {
  let value = 0;
  for (let i = 0; i < length; i++) {
    value = value * 256 + buffer[off + i];
  }
  return value;
}

function readIdValue(
  buffer: Buffer,
  off: number,
): { value: number; length: number } {
  const length = readVintLength(buffer, off);
  return { value: readVintValue(buffer, off, length), length };
}

function readSizeValue(
  buffer: Buffer,
  off: number,
): { value: number; length: number } {
  const b = buffer[off];
  let mask = 0x80;
  let length = 1;
  while (length < 8 && (b & mask) === 0) {
    mask >>= 1;
    length++;
  }
  let value = b & (mask - 1);
  for (let i = 1; i < length; i++) {
    value = value * 256 + buffer[off + i];
  }
  return { value, length };
}

/** Calls cb for every EBML element within [start, end). */
function walkEbml(
  buffer: Buffer,
  start: number,
  end: number,
  cb: (id: number, dataStart: number, dataEnd: number) => void,
): void {
  let off = start;
  while (off + 2 <= end) {
    const id = readIdValue(buffer, off);
    const size = readSizeValue(buffer, off + id.length);
    const dataStart = off + id.length + size.length;
    // EBML: all-ones size means "unknown / until the end of the parent".
    // MediaRecorder writes the Segment and each Cluster this way.
    const isUnknownSize = size.value === 2 ** (7 * size.length) - 1;
    if (isUnknownSize) {
      // Can't know where the element ends; skip its header so the walk can
      // continue with the siblings that follow it.
      off = dataStart;
      continue;
    }
    const dataEnd = dataStart + size.value;
    if (dataEnd > end) break;
    cb(id.value, dataStart, dataEnd);
    off = dataEnd;
  }
}

/**
 * Finds the byte offset of the next Cluster element (id 0x1f43b675) after
 * `start`, or -1 when there is none. Used to bound Clusters whose size is
 * unknown (the MediaRecorder case).
 */
function findNextClusterStart(
  buffer: Buffer,
  start: number,
  end: number,
): number {
  for (let i = start; i + 4 <= end; i++) {
    if (
      buffer[i] === 0x1f &&
      buffer[i + 1] === 0x43 &&
      buffer[i + 2] === 0xb6 &&
      buffer[i + 3] === 0x75
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Scans the children of a Cluster whose size is unknown (the MediaRecorder
 * case). Stops at the next Cluster id. Reports the absolute timestamp of the
 * last SimpleBlock/Block found, plus an estimated frame duration from the
 * Opus TOC byte.
 */
function scanCluster(
  buffer: Buffer,
  start: number,
  end: number,
  timecodeScale: number,
  onLastBlock: (found: { timestamp: number; durationMs: number }) => void,
): void {
  let off = start;
  let clusterTimestamp = 0;
  let lastTimestamp = -1;
  let lastDurationMs = 20;

  while (off + 2 <= end) {
    const id = readIdValue(buffer, off);
    const size = readSizeValue(buffer, off + id.length);
    const dataStart = off + id.length + size.length;

    // Reached the next Cluster (or the end of an unknown-size cluster).
    if (id.value === WEBM_IDS.CLUSTER || id.value === WEBM_IDS.INFO) break;

    const isUnknownSize = size.value === 2 ** (7 * size.length) - 1;
    if (isUnknownSize || dataStart + size.value > end) break;

    if (id.value === WEBM_IDS.CLUSTER_TIMESTAMP) {
      clusterTimestamp = readVintValue(buffer, dataStart, size.value);
    } else if (
      id.value === WEBM_IDS.SIMPLE_BLOCK ||
      id.value === WEBM_IDS.BLOCK
    ) {
      const trackLen = readVintLength(buffer, dataStart);
      const relative = buffer.readInt16BE(dataStart + trackLen);
      lastTimestamp = clusterTimestamp + relative;

      // SimpleBlock/Block layout: track vint, 2-byte rel timestamp, flags, payload
      const payloadStart = dataStart + trackLen + 2 + 1;
      const payloadLen = size.value - (trackLen + 2 + 1);
      if (payloadLen > 0) {
        // Opus TOC: bits 7-3 = config (frame size per RFC 6716 Table 2)
        const config = buffer[payloadStart] >> 3;
        lastDurationMs =
          config < 10 ? 10 : config < 20 ? 20 : config < 30 ? 40 : 60;
      }
    } else if (id.value === WEBM_IDS.BLOCK_DURATION) {
      lastDurationMs =
        (readVintValue(buffer, dataStart, size.value) * timecodeScale) / 1e6;
    }

    off = dataStart + size.value;
  }

  if (lastTimestamp >= 0) {
    onLastBlock({ timestamp: lastTimestamp, durationMs: lastDurationMs });
  }
}

function parseWebmDuration(buffer: Buffer): number | null {
  // Top-level: EBML header, then the Segment element.
  const ebmlId = readIdValue(buffer, 0);
  const ebmlSize = readSizeValue(buffer, ebmlId.length);
  const segStart = ebmlId.length + ebmlSize.length + ebmlSize.value;

  const segId = readIdValue(buffer, segStart);
  const segSize = readSizeValue(buffer, segStart + segId.length);
  const contentStart = segStart + segId.length + segSize.length;
  // EBML: a size with all value bits set to 1 means "unknown / until EOF".
  // MediaRecorder writes the Segment this way.
  const isUnknownSize = segSize.value === 2 ** (7 * segSize.length) - 1;
  const contentEnd = isUnknownSize
    ? buffer.length
    : contentStart + segSize.value;

  let timecodeScale = 1_000_000;
  let headerDuration: number | null = null;
  let codecDelayNs = 0;
  let lastBlockTimestamp = -1;
  let lastBlockDurationMs = 20;

  // Iterate the Segment's children by hand: MediaRecorder writes every Cluster
  // with an unknown (all-ones) size, so we must locate each Cluster's boundary
  // by scanning forward to the next Cluster id instead of trusting its size.
  let off = contentStart;
  while (off + 2 <= contentEnd) {
    const id = readIdValue(buffer, off);
    const size = readSizeValue(buffer, off + id.length);
    const dataStart = off + id.length + size.length;
    const isUnknownSize = size.value === 2 ** (7 * size.length) - 1;

    if (id.value === WEBM_IDS.INFO) {
      const infoEnd = dataStart + (isUnknownSize ? 0 : size.value);
      walkEbml(buffer, dataStart, infoEnd, (childId, childData, childEnd) => {
        if (childId === WEBM_IDS.TIMECODE_SCALE) {
          timecodeScale = readVintValue(
            buffer,
            childData,
            childEnd - childData,
          );
        } else if (
          childId === WEBM_IDS.DURATION &&
          childEnd - childData === 8
        ) {
          headerDuration = buffer.readDoubleBE(childData);
        }
      });
    } else if (id.value === WEBM_IDS.TRACKS) {
      const tracksEnd = dataStart + (isUnknownSize ? 0 : size.value);
      walkEbml(buffer, dataStart, tracksEnd, (trackId, trackData, trackEnd) => {
        if (trackId === WEBM_IDS.TRACK_ENTRY) {
          walkEbml(
            buffer,
            trackData,
            trackEnd,
            (fieldId, fieldData, fieldEnd) => {
              if (fieldId === WEBM_IDS.CODEC_DELAY) {
                codecDelayNs = readVintValue(
                  buffer,
                  fieldData,
                  fieldEnd - fieldData,
                );
              }
            },
          );
        }
      });
    } else if (id.value === WEBM_IDS.CLUSTER) {
      scanCluster(buffer, dataStart, contentEnd, timecodeScale, (found) => {
        lastBlockTimestamp = found.timestamp;
        lastBlockDurationMs = found.durationMs;
      });
      // scanCluster already advanced to the next Cluster id; skip past it.
      const next = findNextClusterStart(buffer, dataStart, contentEnd);
      if (next < 0) break;
      off = next;
      continue;
    }

    if (isUnknownSize) {
      break;
    }
    off = dataStart + size.value;
  }

  if (headerDuration !== null) {
    return (headerDuration * timecodeScale) / 1_000_000_000;
  }

  if (lastBlockTimestamp < 0) return null;
  return (lastBlockTimestamp + lastBlockDurationMs + codecDelayNs / 1e6) / 1000;
}

/* ------------------------------------------------------------------ */
/* OGG                                                                 */
/* Opus/Vorbis: last granule position / sample rate                    */
/* ------------------------------------------------------------------ */

function parseOggDuration(buffer: Buffer): number | null {
  let lastGranule = 0;
  let sampleRate = 48000; // Opus default
  let sawData = false;

  let off = 0;
  while (off + 27 <= buffer.length) {
    if (buffer.toString('ascii', off, off + 4) !== 'OggS') break;

    const segCount = buffer[off + 26];
    const segTableStart = off + 27;
    if (segTableStart + segCount > buffer.length) break;

    const granule = Number(buffer.readBigUInt64LE(off + 6));
    const bodyStart = segTableStart + segCount;
    let bodyLen = 0;
    let lacing = 0;
    for (let i = 0; i < segCount; i++) {
      lacing += buffer[segTableStart + i];
      if (buffer[segTableStart + i] < 255) {
        bodyLen += lacing;
        lacing = 0;
      }
    }
    bodyLen += lacing;

    if (granule !== 0 && granule < Number.MAX_SAFE_INTEGER) {
      lastGranule = granule;
      sawData = true;
    }

    if (bodyStart + 7 <= buffer.length) {
      const head = buffer.toString(
        'ascii',
        bodyStart,
        Math.min(bodyStart + 8, bodyStart + bodyLen),
      );
      // Vorbis identification header carries its own sample rate
      if (head.startsWith('\x01vorbis') && bodyStart + 28 <= buffer.length) {
        sampleRate = buffer.readUInt32LE(bodyStart + 12);
      }
    }

    off = bodyStart + bodyLen;
  }

  if (!sawData || lastGranule === 0) return null;
  return lastGranule / sampleRate;
}

/* ------------------------------------------------------------------ */
/* MP4 / M4A                                                           */
/* mvhd box: timescale + duration                                      */
/* ------------------------------------------------------------------ */

function parseMp4Duration(buffer: Buffer): number | null {
  let off = 0;
  while (off + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(off);
    const type = buffer.toString('ascii', off + 4, off + 8);
    if (size < 8 || size > buffer.length - off) break;

    if (type === 'moov') {
      const duration = findMvhd(buffer, off + 8, off + size);
      if (duration !== null) return duration;
    }
    off += size;
  }
  return scanMvhdAnywhere(buffer);
}

function findMvhd(buffer: Buffer, start: number, end: number): number | null {
  let off = start;
  while (off + 8 <= end) {
    const size = buffer.readUInt32BE(off);
    const type = buffer.toString('ascii', off + 4, off + 8);
    if (size < 8 || size > end - off) break;
    if (type === 'mvhd') {
      return readMvhd(buffer, off + 8);
    }
    off += size;
  }
  return null;
}

function scanMvhdAnywhere(buffer: Buffer): number | null {
  const len = buffer.length;
  for (let off = 0; off + 8 <= len; off++) {
    if (
      buffer[off] === 0 &&
      buffer[off + 1] === 0 &&
      buffer[off + 2] === 0 &&
      buffer.readUInt32BE(off) >= 100 &&
      buffer.toString('ascii', off + 4, off + 8) === 'moov'
    ) {
      const size = buffer.readUInt32BE(off);
      const duration = findMvhd(buffer, off + 8, off + size);
      if (duration !== null) return duration;
    }
  }
  return null;
}

function readMvhd(buffer: Buffer, dataStart: number): number | null {
  const version = buffer[dataStart];
  let timescale: number;
  let duration: number;
  if (version === 1) {
    timescale = buffer.readUInt32BE(dataStart + 20);
    duration = Number(buffer.readBigUInt64BE(dataStart + 24));
  } else {
    timescale = buffer.readUInt32BE(dataStart + 12);
    duration = buffer.readUInt32BE(dataStart + 16);
  }
  if (!timescale || timescale <= 0) return null;
  return duration / timescale;
}

/* ------------------------------------------------------------------ */
/* MP3                                                                 */
/* Parse frame headers and sum samples; works for CBR and VBR.         */
/* ------------------------------------------------------------------ */

const MP3_BITRATES = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const MP3_SAMPLE_RATES = [44100, 48000, 32000];

function parseMp3Duration(buffer: Buffer): number | null {
  let off = 0;
  if (buffer.toString('ascii', 0, 3) === 'ID3') {
    off = 10 + (buffer.readUInt32BE(4) & 0x0fffffff);
  }

  let totalSamples = 0;
  let frameSampleRate = 0;
  let frames = 0;

  while (off + 4 <= buffer.length) {
    if (buffer[off] === 0xff && (buffer[off + 1] & 0xe0) === 0xe0) {
      const versionBits = (buffer[off + 1] >> 3) & 0x3;
      const layerBits = (buffer[off + 1] >> 1) & 0x3;
      const bitrateIdx = (buffer[off + 2] >> 4) & 0xf;
      const sampleIdx = (buffer[off + 2] >> 2) & 0x3;
      const padding = (buffer[off + 2] >> 1) & 0x1;

      const sampleRates =
        versionBits === 3
          ? MP3_SAMPLE_RATES
          : versionBits === 2
            ? [22050, 24000, 16000]
            : [11025, 12000, 8000]; // MPEG 2.5
      const layer = 4 - layerBits;
      const bitrate = MP3_BITRATES[bitrateIdx];
      const sampleRate = sampleRates[sampleIdx];
      const samplesPerFrame =
        layer === 1 ? 384 : versionBits === 3 ? 1152 : 576;

      if (
        layer >= 1 &&
        layer <= 3 &&
        bitrate > 0 &&
        sampleRate > 0 &&
        versionBits !== 1
      ) {
        const frameSize = Math.floor(
          layer === 1
            ? (12 * bitrate * 1000) / sampleRate + padding
            : (144 * bitrate * 1000) / sampleRate + padding,
        );
        totalSamples += samplesPerFrame;
        frameSampleRate = sampleRate;
        frames++;
        off += frameSize;
        continue;
      }
    }
    off++;
  }

  if (frames === 0 || frameSampleRate === 0) return null;
  return totalSamples / frameSampleRate;
}
