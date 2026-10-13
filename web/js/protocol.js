// Akai MPK Mini Play mk3 — Protocol & Preset Codec

export const AKAI_MANUFACTURER_ID = 0x47;
export const AKAI_BROADCAST_DEVICE_ID = 0x7F;
export const MPK_MINI_PLAY_MK3_MODEL_ID = 0x50; // Codename AD21

export const CMD_SET_KEY_CURVE = 0x13;
export const CMD_SEND_FAVORITE = 0x64;
export const CMD_REQUEST_FAVORITE = 0x66;
export const CMD_RECEIVE_FAVORITE = 0x67;

export const SOUND_NAMES = [
  "Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano",
  "Electric Piano 1 (Rhodes)", "Electric Piano 2 (Chorused)", "Harpsichord", "Clavinet",
  "Celesta", "Glockenspiel", "Music Box", "Vibraphone",
  "Marimba", "Xylophone", "Tubular Bells", "Dulcimer",
  "Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ",
  "Reed Organ", "Accordion", "Harmonica", "Tango Accordion",
  "Acoustic Guitar (nylon)", "Acoustic Guitar (steel)", "Electric Guitar (jazz)", "Electric Guitar (clean)",
  "Electric Guitar (muted)", "Overdriven Guitar", "Distortion Guitar", "Guitar Harmonics",
  "Acoustic Bass", "Electric Bass (finger)", "Electric Bass (pick)", "Fretless Bass",
  "Slap Bass 1", "Slap Bass 2", "Synth Bass 1", "Synth Bass 2",
  "Violin", "Viola", "Cello", "Contrabass",
  "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani",
  "String Ensemble 1", "String Ensemble 2", "Synth Strings 1", "Synth Strings 2",
  "Choir Aahs", "Voice Oohs", "Synth Voice", "Orchestra Hit",
  "Trumpet", "Trombone", "Tuba", "Muted Trumpet",
  "French Horn", "Brass Section", "Synth Brass 1", "Synth Brass 2",
  "Soprano Sax", "Alto Sax", "Tenor Sax", "Baritone Sax",
  "Oboe", "English Horn", "Bassoon", "Clarinet",
  "Piccolo", "Flute", "Recorder", "Pan Flute",
  "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina",
  "Lead 1 (square)", "Lead 2 (sawtooth)", "Lead 3 (calliope)", "Lead 4 (chiff)",
  "Lead 5 (charang)", "Lead 6 (voice)", "Lead 7 (fifths)", "Lead 8 (bass+lead)",
  "Pad 1 (new age)", "Pad 2 (warm)", "Pad 3 (polysynth)", "Pad 4 (choir)",
  "Pad 5 (bowed)", "Pad 6 (metallic)", "Pad 7 (halo)", "Pad 8 (sweep)",
  "FX 1 (rain)", "FX 2 (soundtrack)", "FX 3 (crystal)", "FX 4 (atmosphere)",
  "FX 5 (brightness)", "FX 6 (goblins)", "FX 7 (echoes)", "FX 8 (sci-fi)",
  "Sitar", "Banjo", "Shamisen", "Koto",
  "Kalimba", "Bag pipe", "Fiddle", "Shanai",
  "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock",
  "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal",
  "Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet",
  "Telephone Ring", "Helicopter", "Applause", "Gunshot"
];

export const DRUM_KIT_NAMES = [
  "Standard Kit", "Room Kit", "Power Kit", "Electronic Kit", "TR-808 Kit",
  "Jazz Kit", "Brush Kit", "Orchestra Kit", "SFX Kit", "Custom / MPC Kit"
];

export const TIME_DIVISIONS = ["1/4", "1/4T", "1/8", "1/8T", "1/16", "1/16T", "1/32", "1/32T"];
export const ARP_MODES = ["Up", "Down", "Exclusive", "Inclusive", "Order", "Random"];
export const AFTERTOUCH_MODES = ["Off", "Channel", "Polyphonic"];
export const JOYSTICK_MODES = ["Pitchbend", "Single CC", "Dual CC"];

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiNoteToName(midiNote) {
  const octave = Math.floor(midiNote / 12) - 2;
  const name = NOTE_NAMES[midiNote % 12];
  return `${name}${octave}`;
}

// Fixed byte offsets in the 2,123-byte native .mpkminiplaymk3 file
export const MPK_OFFSETS = {
  PRESET_NAME: 0x24,
  PAD_CHANNEL: 0x4C,
  KEYS_CHANNEL: 0x65,
  OCTAVE: 0x7E,
  TRANSPOSE: 0x97,
  ARP_ON: 0xB0,
  ARP_TEMPO: 0xC9,
  ARP_TIME_DIV: 0xE2,
  ARP_SWING: 0xFB,
  ARP_OCTAVE: 0x114,
  ARP_MODE: 0x12D,
  ARP_LATCH: 0x146,
  ARP_TAPS: 0x15F,
  ARP_CLOCK: 0x178,
  JOY_X_MODE: 0x192,
  JOY_X_CC1: 0x1AB,
  JOY_X_CC2: 0x1C4,
  JOY_Y_MODE: 0x1DD,
  JOY_Y_CC1: 0x1F6,
  JOY_Y_CC2: 0x20F,
  PAD_AFTERTOUCH: 0x228,
  // 16 Pads (offsets spaced by 25 bytes)
  PAD_NOTES_BASE: 0x241,
  // 8 Knobs (CC, Min, Max, Name)
  KNOBS_BASE: 0x3D1,
  KNOB_STRIDE: 0x73, // 115 bytes between knobs
  // Sounds & FX
  KBD_SOUND: 0x769,
  PAD_SOUND: 0x782,
  FX_FILTER: 0x79B,
  FX_RESO: 0x7B4,
  FX_ATTACK: 0x7CD,
  FX_RELEASE: 0x7E6,
  FX_REVERB: 0x7FF,
  FX_CHORUS: 0x818,
  FX_EQ_LOW: 0x831,
  FX_EQ_HIGH: 0x84A,
};

// Create a clean default preset state
export function createDefaultPresetState() {
  const pads = [
    36, // Pad 1: C1
    38, // Pad 2: D1
    40, // Pad 3: E1
    41, // Pad 4: F1
    43, // Pad 5: G1
    45, // Pad 6: A1
    47, // Pad 7: B1
    48, // Pad 8: C2
    // Bank B (Pads 9-16)
    50, // Pad 9:  D2
    52, // Pad 10: E2
    53, // Pad 11: F2
    55, // Pad 12: G2
    57, // Pad 13: A2
    59, // Pad 14: B2
    60, // Pad 15: C3
    62  // Pad 16: D3
  ];

  const knobs = [];
  for (let i = 0; i < 8; i++) {
    knobs.push({
      cc: 70 + i,
      min: 0,
      max: 127,
      name: `Q-Link ${i + 1}`,
    });
  }

  return {
    name: "FAV: Custom",
    padChannel: 9,      // Channel 10 (0-indexed 9)
    keysChannel: 0,     // Channel 1 (0-indexed 0)
    octave: 0,          // -4 to +4
    transpose: 0,       // -12 to +12
    aftertouch: 1,      // 0=Off, 1=Channel, 2=Poly
    arp: {
      on: 0,
      tempo: 120,
      timeDiv: 0,       // 1/4
      swing: 0,         // 50%
      octave: 0,        // 1 Oct
      mode: 0,          // Up
      latch: 0,         // Off
      taps: 2,          // 2 taps
      clock: 0,         // Internal
    },
    joystick: {
      xMode: 0,         // Pitchbend
      xCc1: 1,
      xCc2: 2,
      yMode: 1,         // Single CC
      yCc1: 1,          // Mod Wheel
      yCc2: 2,
    },
    pads,
    knobs,
    sound: {
      keyboard: 0,      // Acoustic Grand Piano
      pad: 0,           // Standard Drum Kit
      filter: 127,
      resonance: 0,
      attack: 0,
      release: 0,
      reverb: 0,
      chorus: 32,
      eqLow: 64,        // Flat
      eqHigh: 64,       // Flat
    },
    keyCurve: {
      p1: 3000,
      p2: 6000,
      p3: 10000,
      p4: 14000,
      blackBalance: 64, // 1.0 ratio
    }
  };
}

// Parse native 2,123-byte .mpkminiplaymk3 file buffer into a preset state object
export function parseMpkFile(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length !== 2123) {
    throw new Error(`Invalid file size: expected 2123 bytes, received ${bytes.length} bytes.`);
  }

  const decoder = new TextDecoder("latin1");

  // Read string helper
  const readString = (offset, length) => {
    const raw = decoder.decode(bytes.slice(offset, offset + length));
    const nullIdx = raw.indexOf("\0");
    return (nullIdx !== -1 ? raw.substring(0, nullIdx) : raw).trim();
  };

  const name = readString(MPK_OFFSETS.PRESET_NAME, 16);
  const padChannel = bytes[MPK_OFFSETS.PAD_CHANNEL];
  const keysChannel = bytes[MPK_OFFSETS.KEYS_CHANNEL];
  // Handle signed octave and transpose
  let octave = bytes[MPK_OFFSETS.OCTAVE];
  if (octave > 127) octave -= 256;
  let transpose = bytes[MPK_OFFSETS.TRANSPOSE];
  if (transpose > 127) transpose -= 256;

  const aftertouch = bytes[MPK_OFFSETS.PAD_AFTERTOUCH];

  const arp = {
    on: bytes[MPK_OFFSETS.ARP_ON],
    tempo: bytes[MPK_OFFSETS.ARP_TEMPO],
    timeDiv: bytes[MPK_OFFSETS.ARP_TIME_DIV],
    swing: bytes[MPK_OFFSETS.ARP_SWING],
    octave: bytes[MPK_OFFSETS.ARP_OCTAVE],
    mode: bytes[MPK_OFFSETS.ARP_MODE],
    latch: bytes[MPK_OFFSETS.ARP_LATCH],
    taps: bytes[MPK_OFFSETS.ARP_TAPS],
    clock: bytes[MPK_OFFSETS.ARP_CLOCK],
  };

  const joystick = {
    xMode: bytes[MPK_OFFSETS.JOY_X_MODE],
    xCc1: bytes[MPK_OFFSETS.JOY_X_CC1],
    xCc2: bytes[MPK_OFFSETS.JOY_X_CC2],
    yMode: bytes[MPK_OFFSETS.JOY_Y_MODE],
    yCc1: bytes[MPK_OFFSETS.JOY_Y_CC1],
    yCc2: bytes[MPK_OFFSETS.JOY_Y_CC2],
  };

  const pads = [];
  for (let i = 0; i < 16; i++) {
    pads.push(bytes[MPK_OFFSETS.PAD_NOTES_BASE + i * 25]);
  }

  const knobs = [];
  for (let i = 0; i < 8; i++) {
    const knobBase = MPK_OFFSETS.KNOBS_BASE + i * MPK_OFFSETS.KNOB_STRIDE;
    knobs.push({
      cc: bytes[knobBase],
      min: bytes[knobBase + 25],
      max: bytes[knobBase + 50],
      name: readString(knobBase + 75, 16),
    });
  }

  const sound = {
    keyboard: bytes[MPK_OFFSETS.KBD_SOUND],
    pad: bytes[MPK_OFFSETS.PAD_SOUND],
    filter: bytes[MPK_OFFSETS.FX_FILTER],
    resonance: bytes[MPK_OFFSETS.FX_RESO],
    attack: bytes[MPK_OFFSETS.FX_ATTACK],
    release: bytes[MPK_OFFSETS.FX_RELEASE],
    reverb: bytes[MPK_OFFSETS.FX_REVERB],
    chorus: bytes[MPK_OFFSETS.FX_CHORUS],
    eqLow: bytes[MPK_OFFSETS.FX_EQ_LOW],
    eqHigh: bytes[MPK_OFFSETS.FX_EQ_HIGH],
  };

  return {
    name,
    padChannel,
    keysChannel,
    octave,
    transpose,
    aftertouch,
    arp,
    joystick,
    pads,
    knobs,
    sound,
    keyCurve: {
      p1: 3000,
      p2: 6000,
      p3: 10000,
      p4: 14000,
      blackBalance: 64,
    }
  };
}

// Serialize preset state into a 2,123-byte binary file Uint8Array
export function serializeMpkFile(state, templateBuffer = null) {
  // If no template is provided, start from a copy of a valid preset structure
  const out = new Uint8Array(2123);
  if (templateBuffer && templateBuffer.length === 2123) {
    out.set(new Uint8Array(templateBuffer));
  }

  const encoder = new TextEncoder();

  // Helper to write string with null padding
  const writeString = (offset, str, maxLen) => {
    const encoded = encoder.encode(str.substring(0, maxLen));
    out.fill(0, offset, offset + maxLen);
    out.set(encoded, offset);
  };

  writeString(MPK_OFFSETS.PRESET_NAME, state.name || "FAV: Custom", 16);
  out[MPK_OFFSETS.PAD_CHANNEL] = state.padChannel & 0x0F;
  out[MPK_OFFSETS.KEYS_CHANNEL] = state.keysChannel & 0x0F;
  out[MPK_OFFSETS.OCTAVE] = (state.octave < 0 ? state.octave + 256 : state.octave) & 0xFF;
  out[MPK_OFFSETS.TRANSPOSE] = (state.transpose < 0 ? state.transpose + 256 : state.transpose) & 0xFF;
  out[MPK_OFFSETS.PAD_AFTERTOUCH] = state.aftertouch & 0x03;

  out[MPK_OFFSETS.ARP_ON] = state.arp.on & 0xFF;
  out[MPK_OFFSETS.ARP_TEMPO] = state.arp.tempo & 0xFF;
  out[MPK_OFFSETS.ARP_TIME_DIV] = state.arp.timeDiv & 0x07;
  out[MPK_OFFSETS.ARP_SWING] = Math.max(0, Math.min(25, state.arp.swing));
  out[MPK_OFFSETS.ARP_OCTAVE] = state.arp.octave & 0x03;
  out[MPK_OFFSETS.ARP_MODE] = state.arp.mode % 6;
  out[MPK_OFFSETS.ARP_LATCH] = state.arp.latch ? 1 : 0;
  out[MPK_OFFSETS.ARP_TAPS] = Math.max(2, Math.min(4, state.arp.taps));
  out[MPK_OFFSETS.ARP_CLOCK] = state.arp.clock ? 1 : 0;

  out[MPK_OFFSETS.JOY_X_MODE] = state.joystick.xMode & 0x03;
  out[MPK_OFFSETS.JOY_X_CC1] = state.joystick.xCc1 & 0x7F;
  out[MPK_OFFSETS.JOY_X_CC2] = state.joystick.xCc2 & 0x7F;
  out[MPK_OFFSETS.JOY_Y_MODE] = state.joystick.yMode & 0x03;
  out[MPK_OFFSETS.JOY_Y_CC1] = state.joystick.yCc1 & 0x7F;
  out[MPK_OFFSETS.JOY_Y_CC2] = state.joystick.yCc2 & 0x7F;

  for (let i = 0; i < 16; i++) {
    out[MPK_OFFSETS.PAD_NOTES_BASE + i * 25] = state.pads[i] & 0x7F;
  }

  for (let i = 0; i < 8; i++) {
    const knobBase = MPK_OFFSETS.KNOBS_BASE + i * MPK_OFFSETS.KNOB_STRIDE;
    const knob = state.knobs[i] || { cc: 70 + i, min: 0, max: 127, name: `Knob ${i + 1}` };
    out[knobBase] = knob.cc & 0x7F;
    out[knobBase + 25] = knob.min & 0x7F;
    out[knobBase + 50] = knob.max & 0x7F;
    writeString(knobBase + 75, knob.name || `Knob ${i + 1}`, 16);
  }

  out[MPK_OFFSETS.KBD_SOUND] = state.sound.keyboard & 0x7F;
  out[MPK_OFFSETS.PAD_SOUND] = state.sound.pad % 10;
  out[MPK_OFFSETS.FX_FILTER] = state.sound.filter & 0x7F;
  out[MPK_OFFSETS.FX_RESO] = state.sound.resonance & 0x7F;
  out[MPK_OFFSETS.FX_ATTACK] = state.sound.attack & 0x7F;
  out[MPK_OFFSETS.FX_RELEASE] = state.sound.release & 0x7F;
  out[MPK_OFFSETS.FX_REVERB] = state.sound.reverb & 0x7F;
  out[MPK_OFFSETS.FX_CHORUS] = state.sound.chorus & 0x7F;
  out[MPK_OFFSETS.FX_EQ_LOW] = state.sound.eqLow & 0x7F;
  out[MPK_OFFSETS.FX_EQ_HIGH] = state.sound.eqHigh & 0x7F;

  return out;
}

// Builds SysEx message to request a favorite from the hardware (Opcode 0x66)
export function buildRequestFavoriteSysEx(slotIndex) {
  return [
    0xF0,
    AKAI_MANUFACTURER_ID,
    AKAI_BROADCAST_DEVICE_ID,
    MPK_MINI_PLAY_MK3_MODEL_ID,
    CMD_REQUEST_FAVORITE,
    0x00, 0x01, // Length = 1 byte
    slotIndex & 0x07,
    0xF7
  ];
}

// Parse 215-byte hardware SysEx payload into a preset state object
export function parseHardwareSysExPayload(bytes) {
  let p = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Strip header & footer if full 224-byte message passed
  if (p.length === 224 && p[0] === 0xF0) {
    p = p.subarray(8, 223);
  }
  if (p.length !== 215) {
    throw new Error(`Invalid hardware payload size: expected 215 bytes, received ${p.length} bytes.`);
  }

  const decoder = new TextDecoder("latin1");
  const readString = (offset, length) => {
    const raw = decoder.decode(p.subarray(offset, offset + length));
    const nullIdx = raw.indexOf("\0");
    return (nullIdx !== -1 ? raw.substring(0, nullIdx) : raw).trim();
  };

  const name = readString(0, 16);
  const padChannel = p[16] & 0x0F;
  const keysChannel = p[17] & 0x0F;
  // Keybed octave and transpose have fixed offsets (+4 and +12)
  const octave = (p[19] & 0xFF) - 4;
  const transpose = (p[20] & 0xFF) - 12;

  const arp = {
    on: p[21] & 0x01,
    clock: p[22] & 0x01,
    mode: p[23] % 6,
    timeDiv: p[24] & 0x07,
    swing: p[25],
    octave: p[26] & 0x03,
    taps: Math.max(2, Math.min(4, p[27] || 3)),
    latch: p[28] & 0x01,
    tempo: p[29],
  };

  const joystick = {
    xMode: p[30] & 0x03,
    xCc1: p[31] & 0x7F,
    xCc2: p[32] & 0x7F,
    yMode: p[33] & 0x03,
    yCc1: p[34] & 0x7F,
    yCc2: p[35] & 0x7F,
  };

  const aftertouch = p[36] & 0x03;

  const pads = [];
  for (let i = 0; i < 16; i++) {
    pads.push(p[37 + i] & 0x7F);
  }

  const knobs = [];
  for (let i = 0; i < 8; i++) {
    const knobBase = 53 + i * 19;
    knobs.push({
      cc: p[knobBase] & 0x7F,
      min: p[knobBase + 1] & 0x7F,
      max: p[knobBase + 2] & 0x7F,
      name: readString(knobBase + 3, 16),
      currentVal: undefined
    });
  }

  const sound = {
    keyboard: p[205] & 0x7F,
    pad: p[206] % 10,
    filter: p[207] & 0x7F,
    resonance: p[208] & 0x7F,
    attack: p[209] & 0x7F,
    release: p[210] & 0x7F,
    reverb: p[211] & 0x7F,
    chorus: p[212] & 0x7F,
    eqLow: p[213] & 0x7F,
    eqHigh: p[214] & 0x7F,
  };

  return {
    name,
    padChannel,
    keysChannel,
    octave,
    transpose,
    aftertouch,
    arp,
    joystick,
    pads,
    knobs,
    sound,
    keyCurve: {
      p1: 3000,
      p2: 6000,
      p3: 10000,
      p4: 14000,
      blackBalance: 64,
    }
  };
}

// Serialize preset state into a 215-byte hardware SysEx payload Uint8Array
export function serializeHardwareSysExPayload(state) {
  const p = new Uint8Array(215);
  const encoder = new TextEncoder();

  const writeString = (offset, str, maxLen) => {
    const encoded = encoder.encode((str || "").substring(0, maxLen));
    p.fill(0, offset, offset + maxLen);
    p.set(encoded, offset);
  };

  writeString(0, state.name || "FAV: Custom", 16);
  p[16] = state.padChannel & 0x0F;
  p[17] = state.keysChannel & 0x0F;
  p[18] = 0;
  p[19] = Math.max(0, Math.min(8, (state.octave || 0) + 4));
  p[20] = Math.max(0, Math.min(24, (state.transpose || 0) + 12));

  p[21] = state.arp.on ? 1 : 0;
  p[22] = state.arp.clock ? 1 : 0;
  p[23] = (state.arp.mode || 0) % 6;
  p[24] = (state.arp.timeDiv || 0) & 0x07;
  p[25] = Math.max(0, Math.min(25, state.arp.swing || 0));
  p[26] = (state.arp.octave || 0) & 0x03;
  p[27] = Math.max(2, Math.min(4, state.arp.taps || 3));
  p[28] = state.arp.latch ? 1 : 0;
  p[29] = Math.max(60, Math.min(240, state.arp.tempo || 120));

  p[30] = (state.joystick.xMode || 0) & 0x03;
  p[31] = (state.joystick.xCc1 || 0) & 0x7F;
  p[32] = (state.joystick.xCc2 || 0) & 0x7F;
  p[33] = (state.joystick.yMode || 0) & 0x03;
  p[34] = (state.joystick.yCc1 || 0) & 0x7F;
  p[35] = (state.joystick.yCc2 || 0) & 0x7F;

  p[36] = (state.aftertouch || 1) & 0x03;

  for (let i = 0; i < 16; i++) {
    p[37 + i] = (state.pads && state.pads[i] !== undefined ? state.pads[i] : 36 + i) & 0x7F;
  }

  for (let i = 0; i < 8; i++) {
    const knobBase = 53 + i * 19;
    const knob = (state.knobs && state.knobs[i]) || { cc: 70 + i, min: 0, max: 127, name: `Knob ${i + 1}` };
    p[knobBase] = knob.cc & 0x7F;
    p[knobBase + 1] = knob.min & 0x7F;
    p[knobBase + 2] = knob.max & 0x7F;
    writeString(knobBase + 3, knob.name || `Knob ${i + 1}`, 16);
  }

  p[205] = (state.sound.keyboard || 0) & 0x7F;
  p[206] = (state.sound.pad || 0) % 10;
  p[207] = (state.sound.filter ?? 127) & 0x7F;
  p[208] = (state.sound.resonance || 0) & 0x7F;
  p[209] = (state.sound.attack || 0) & 0x7F;
  p[210] = (state.sound.release || 0) & 0x7F;
  p[211] = (state.sound.reverb || 0) & 0x7F;
  p[212] = (state.sound.chorus || 0) & 0x7F;
  p[213] = (state.sound.eqLow ?? 64) & 0x7F;
  p[214] = (state.sound.eqHigh ?? 64) & 0x7F;

  return p;
}

// Builds SysEx message to send a favorite to hardware slot 0-7 or RAM 8 (Opcode 0x64)
export function buildSendFavoriteSysEx(targetSlot, payloadBytes) {
  // Length is 216 bytes (0x0158 in 7-bit MIDI: 1 slot byte + 215 payload bytes)
  return [
    0xF0,
    AKAI_MANUFACTURER_ID,
    AKAI_BROADCAST_DEVICE_ID,
    MPK_MINI_PLAY_MK3_MODEL_ID,
    CMD_SEND_FAVORITE,
    0x01, 0x58, // Length = 216 bytes
    targetSlot & 0x0F, // 0-7 for slots 1-8, or 0x08 for RAM
    ...payloadBytes,
    0xF7
  ];
}

// Builds SysEx message for Keybed Velocity Sensitivity Curve (Opcode 0x13)
export function buildSendKeyCurveSysEx(p1, p2, p3, p4, blackBalance) {
  return [
    0xF0,
    AKAI_MANUFACTURER_ID,
    AKAI_BROADCAST_DEVICE_ID,
    MPK_MINI_PLAY_MK3_MODEL_ID,
    CMD_SET_KEY_CURVE,
    0x09, // Length = 9 bytes
    (p1 >> 7) & 0x7F, p1 & 0x7F,
    (p2 >> 7) & 0x7F, p2 & 0x7F,
    (p3 >> 7) & 0x7F, p3 & 0x7F,
    (p4 >> 7) & 0x7F, p4 & 0x7F,
    blackBalance & 0x7F,
    0xF7
  ];
}
