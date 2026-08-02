import { getAudioDurationSeconds } from './audio-duration';

/** Builds a minimal valid WAV buffer with a known duration (seconds). */
const buildWav = (seconds: number): Buffer => {
  const sampleRate = 8000;
  const channels = 1;
  const bitsPerSample = 16;
  const dataSize =
    Math.floor(seconds * sampleRate) * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
};

/**
 * Builds a minimal WebM/Opus buffer without the Info `Duration` element,
 * mirroring what OpenWhispr/MediaRecorder produces. The duration is derivable
 * only from the last Cluster's SimpleBlock timestamp + its frame duration +
 * the track's codec delay.
 */
const buildWebm = (
  lastClusterTimestamp: number,
  lastBlockRelative: number,
  codecDelayNs = 6_500_000,
): Buffer => {
  const vint = (v: number, minLen = 1): Buffer => {
    let len = 1;
    while (v >= 1 << (7 * len)) len++;
    if (len < minLen) len = minLen;
    const bytes = Buffer.alloc(len);
    for (let i = 0; i < len; i++) bytes[len - 1 - i] = (v >> (7 * i)) & 0x7f;
    bytes[0] |= 0x80 >> (len - 1);
    return bytes;
  };
  const uint = (v: number): Buffer => {
    const bytes: number[] = [];
    let t = v;
    while (t > 0) {
      bytes.unshift(t & 0xff);
      t >>= 8;
    }
    if (bytes.length === 0) bytes.push(0);
    return Buffer.from(bytes);
  };
  // EBML "unknown size": all value bits set to 1. MediaRecorder writes the
  // Segment and every Cluster with this marker.
  const unknownSize = (): Buffer =>
    Buffer.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  const id = (v: number): Buffer => uint(v);
  const str = (s: string): Buffer => Buffer.from(s, 'ascii');
  const elem = (idVal: number, content: Buffer): Buffer =>
    Buffer.concat([id(idVal), vint(content.length), content]);

  const simpleBlock = (rel: number, payload: Buffer): Buffer => {
    const relb = Buffer.alloc(2);
    relb.writeInt16BE(rel);
    return elem(
      0xa3,
      Buffer.concat([vint(1), relb, Buffer.from([0x00]), payload]),
    );
  };
  // Opus TOC config 16 = 20ms fullband mono (0x80)
  const opus20ms = (): Buffer =>
    Buffer.concat([Buffer.from([0x80]), Buffer.from([1, 2, 3, 4, 5, 6, 7])]);

  const ebmlContent = Buffer.concat([
    elem(0x4286, uint(1)),
    elem(0x42f7, uint(1)),
    elem(0x42f2, uint(4)),
    elem(0x42f3, uint(8)),
    elem(0x4282, str('webm')),
    elem(0x4287, uint(2)),
    elem(0x4285, uint(2)),
  ]);
  const ebml = Buffer.concat([
    id(0x1a45dfa3),
    vint(ebmlContent.length),
    ebmlContent,
  ]);

  const infoContent = Buffer.concat([
    elem(0x2ad7b1, uint(1_000_000)), // TimecodeScale = 1ms
    elem(0x4d80, str('test')),
    elem(0x5741, str('test')),
    // NOTE: no 0x4489 Duration element — the case we must handle
  ]);
  const info = elem(0x1549a966, infoContent);

  const trackContent = Buffer.concat([
    elem(0xd7, uint(1)),
    elem(0x73c5, uint(1)),
    elem(0x83, uint(2)),
    elem(0x86, str('A_OPUS')),
    elem(0x56aa, uint(codecDelayNs)),
  ]);
  const tracks = elem(0x1654ae6b, elem(0xae, trackContent));

  const cluster = Buffer.concat([
    id(0x1f43b675),
    unknownSize(), // Cluster size is unknown, like MediaRecorder
    elem(0xe7, uint(lastClusterTimestamp)),
    simpleBlock(lastBlockRelative, opus20ms()),
  ]);

  const segContent = Buffer.concat([info, tracks, cluster]);
  const segment = Buffer.concat([
    id(0x18538067),
    unknownSize(), // Segment size is unknown, like MediaRecorder
    segContent,
  ]);
  return Buffer.concat([ebml, segment]);
};

/** Minimal OGG/Opus stream: an OpusHead page + one data page with a granule. */
const buildOgg = (granule: number): Buffer => {
  const page = (granulePos: number, segments: Buffer[]): Buffer => {
    const header = Buffer.alloc(27);
    header.write('OggS', 0);
    header[4] = 0; // version
    header[5] = 0; // header type
    header.writeBigUInt64LE(BigInt(granulePos), 6);
    header.writeUInt32LE(0x12345678, 14); // serial
    header.writeUInt32LE(0, 18); // sequence
    header.writeUInt32LE(0, 22); // crc
    const body = Buffer.concat(segments);
    const lacing: number[] = [];
    const acc = 0;
    for (let i = 0; i < body.length; i += 255) {
      const chunk = Math.min(255, body.length - i);
      if (chunk === 255 && i + 255 < body.length) {
        lacing.push(255);
      } else {
        lacing.push(chunk);
      }
    }
    void acc;
    header[26] = lacing.length;
    return Buffer.concat([header, Buffer.from(lacing), body]);
  };

  const opusHead = Buffer.concat([
    Buffer.from('OpusHead', 'ascii'),
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x80, 0xbb, 0x00, 0x00, 0x00, 0x00]),
  ]);
  const opusComment = Buffer.concat([
    Buffer.from('OpusTags', 'ascii'),
    Buffer.from([0x00]),
  ]);
  // Opus packet: TOC config 16 (20ms) + payload
  const dataPacket = Buffer.concat([
    Buffer.from([0x80]),
    Buffer.from([1, 2, 3, 4, 5, 6, 7]),
  ]);

  const bos = page(0, [opusHead]);
  bos[5] = 0x02; // BOS flag
  const comment = page(0, [opusComment]);
  const data = page(granule, [dataPacket]);
  return Buffer.concat([bos, comment, data]);
};

/** Minimal MP4/M4A: ftyp + moov(mvhd with timescale & duration). */
const buildMp4 = (timescale: number, duration: number): Buffer => {
  const box = (type: string, content: Buffer): Buffer =>
    Buffer.concat([
      (() => {
        const b = Buffer.alloc(4);
        b.writeUInt32BE(8 + content.length);
        return b;
      })(),
      Buffer.from(type, 'ascii'),
      content,
    ]);

  const mvhd = box(
    'mvhd',
    Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // version+flags
      Buffer.alloc(8), // creation/modification
      (() => {
        const b = Buffer.alloc(4);
        b.writeUInt32BE(timescale);
        return b;
      })(),
      (() => {
        const b = Buffer.alloc(4);
        b.writeUInt32BE(duration);
        return b;
      })(),
      Buffer.alloc(80),
    ]),
  );

  const ftyp = box('ftyp', Buffer.from('isomisom', 'ascii'));
  const moov = box('moov', mvhd);
  return Buffer.concat([ftyp, moov]);
};

/** Minimal MP3 (MPEG-1 Layer 3) with N frames at 128kbps / 44100Hz. */
const buildMp3 = (frames: number): Buffer => {
  const frame = (): Buffer => {
    const header = Buffer.from([0xff, 0xfb, 0x90, 0x00]); // 128kbps, 44100, no padding
    return Buffer.concat([header, Buffer.alloc(413)]); // 417-byte frame
  };
  return Buffer.concat(Array.from({ length: frames }, frame));
};

describe('getAudioDurationSeconds', () => {
  it('returns null for an empty buffer', () => {
    expect(getAudioDurationSeconds(Buffer.alloc(0))).toBeNull();
  });

  it('returns null for unparseable bytes', () => {
    expect(getAudioDurationSeconds(Buffer.from('not audio'))).toBeNull();
  });

  it('parses a WAV duration', () => {
    expect(getAudioDurationSeconds(buildWav(2))).toBeCloseTo(2, 5);
  });

  it('parses a WebM duration from cluster timestamps when the header omits it', () => {
    // last block at 1981ms + 20ms frame + 6.5ms codec delay
    const webm = buildWebm(1980, 1);
    const duration = getAudioDurationSeconds(webm);
    expect(duration).not.toBeNull();
    expect(duration as number).toBeCloseTo(2.0075, 3);
  });

  it('parses an OGG/Opus duration from the last granule', () => {
    const ogg = buildOgg(96_360); // ~2.0075s at 48kHz
    const duration = getAudioDurationSeconds(ogg);
    expect(duration).not.toBeNull();
    expect(duration as number).toBeCloseTo(96_360 / 48_000, 3);
  });

  it('parses an MP4/M4A duration from mvhd', () => {
    expect(getAudioDurationSeconds(buildMp4(1000, 2000))).toBe(2);
  });

  it('parses an MP3 duration from its frames', () => {
    // 417 bytes/frame, 1152 samples/frame @44100Hz
    const duration = getAudioDurationSeconds(buildMp3(50));
    expect(duration).not.toBeNull();
    expect(duration as number).toBeCloseTo((50 * 1152) / 44100, 2);
  });
});
