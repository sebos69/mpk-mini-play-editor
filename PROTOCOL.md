# Akai MPK Mini Play mk3 — MIDI SysEx Protocol & Parameter Specification

This document provides reverse-engineered specifications for communicating with the **Akai Professional MPK mini Play mk3** (hardware codename `AD21`) over USB MIDI System Exclusive (`SysEx`) messages. It covers live hardware tuning, reading and writing favorite presets (Slots 1–8 and active RAM), keybed velocity curve calibration, and the desktop `.mpkminiplaymk3` file format.

> 🎛️ **Live Web Application**: [**https://sebos69.github.io/mpk-mini-play-editor/**](https://sebos69.github.io/mpk-mini-play-editor/)

---

## 1. Hardware Identity & MIDI Transport

- **USB Interface**: Class-compliant USB MIDI (no proprietary drivers required).
- **USB Device Name**: `"MPK mini Play"` / `"MPK mini Play mk3"`
- **Web MIDI Access**: Requires `navigator.requestMIDIAccess({ sysex: true })`.

### SysEx Header Format

Every System Exclusive message sent to or received from the device follows this header structure:

| Byte Index | Hex Value | Description |
|:---|:---|:---|
| 0 | `0xF0` | SysEx Start |
| 1 | `0x47` | Manufacturer ID: **Akai Professional** |
| 2 | `0x7F` | Device ID: **Broadcast / All-Call** |
| 3 | `0x50` | Model ID: **MPK mini Play mk3** (Codename `AD21`) |
| 4 | `<cmd>` | Command Opcode |
| 5..6 | `<len_msb> <len_lsb>` | Big-endian 14-bit Payload Length |
| 7..N | `...` | Command-specific payload |
| Last | `0xF7` | End of Exclusive (EOX) |

---

## 2. Protocol Commands

### 2.1 Request / Read Favorite from Hardware (`0x66` & Response `0x67`)

Retrieves the settings of one of the 8 favorite slots stored in the keyboard's internal flash memory.

**Host Request:**
```
F0 47 7F 50 66 00 01 <preset_idx> F7
```

- **Opcode**: `0x66` (Request Preset)
- **Length**: `0x00 0x01` (1 byte payload)
- **`<preset_idx>`**: Target favorite slot (0-indexed):
  - `0x00` = Favorite 1
  - `0x01` = Favorite 2
  - `0x02` = Favorite 3
  - `0x03` = Favorite 4
  - `0x04` = Favorite 5
  - `0x05` = Favorite 6
  - `0x06` = Favorite 7
  - `0x07` = Favorite 8
  - `0x08` = Active RAM Buffer (Live sound engine state)

**Hardware Response:**
```
F0 47 00 50 67 01 58 <preset_idx> <payload_215_bytes...> F7
```

- **Response Opcode**: `0x67` (`CMD_RECEIVE_FAVORITE`)
- **Device ID**: `0x00` (Hardware replies with device ID `0x00`)
- **Length Field**: `0x01 0x58` = 216 bytes in 7-bit MIDI encoding ($1 \times 128 + 88 = 216$: 1 slot index byte + 215-byte parameter block)
- **Total Frame Size**: Exactly **224 bytes** (`0xF0` + 7 header bytes + 215 payload bytes + `0xF7`).
- **Response Latency**: The keyboard responds over USB in under 15 ms.

---

### 2.2 Send / Write Favorite to Hardware (`0x64`)

Uploads a complete favorite configuration either to a permanent flash memory slot (1–8) or temporarily into volatile RAM.

```
F0 47 7F 50 64 01 58 <preset_target> <payload_215_bytes...> F7
```

- **Opcode**: `0x64` (Send Preset)
- **Length**: `0x01 0x58` = 216 bytes (1 target byte + 215 payload bytes)
- **`<preset_target>`** (Byte 7):
  - `0x00` – `0x07`: Writes to permanent Favorite slot 1 – 8 in internal flash memory.
    > **Automated Flash Saving**: Writing to flash slots `0x00`–`0x07` via SysEx `0x64` commits the preset to the keyboard's internal EEPROM **directly without any user intervention**.
  - `0x08`: Writes to volatile **RAM** ("Send to RAM" / Live audition).
    > Immediately updates the active sound engine, instrument patch, drum kit, filters, and effects in the keyboard's RAM.
- **Immediate Preset Activation without Physical Buttons**:
  To both permanently save a preset AND activate it instantly in the keyboard's speaker with zero user intervention, the host software sends:
  1. `0x64` with target `<slot>` (permanently writes to Flash slot).
  2. `0x64` with target `0x08` (instantly activates the sound engine in RAM).
- **Hardware Button Shortcuts (For Standalone Use)**:
  - **Recall a Favorite from Hardware**: Hold `FAVORITES` and press `Pad 1–8`.
  - **Save Settings Manually to a Favorite on Hardware**: Hold `FAVORITES` + `INTERNAL SOUNDS` simultaneously and press `Pad 1–8`.
- **`<payload_215_bytes>`**: 215 bytes containing the contiguous linear parameter data block (see Section 4).
- **Total Frame Size**: Exactly **224 bytes**.

---

### 2.3 Send Keybed Velocity Curve Calibration (`0x13`)

Calibrates key sensitivity and response balance between black and white keys.

```
F0 47 7F 50 13 09 <P1_MSB> <P1_LSB> <P2_MSB> <P2_LSB> <P3_MSB> <P3_LSB> <P4_MSB> <P4_LSB> <BlackBalance> F7
```

- **Opcode**: `0x13` (Set Keybed Curve)
- **Length**: `0x09` (9 bytes)
- **Parameters**:
  - `P1_MSB`, `P1_LSB`: Point 1 (Low velocity reach, 14-bit integer, MSB: bits 13..7, LSB: bits 6..0)
  - `P2_MSB`, `P2_LSB`: Point 2 (14-bit integer)
  - `P3_MSB`, `P3_LSB`: Point 3 (14-bit integer)
  - `P4_MSB`, `P4_LSB`: Point 4 (High velocity reach, 14-bit integer)
  - `BlackBalance`: Black key sensitivity multiplier (0.5 to 2.0 scaled to 7-bit MIDI byte).
- **Total Frame Size**: 16 bytes.

---

## 3. Parameter Map (Complete 78-Parameter Schema)

The hardware preset model contains 78 distinct parameters:

### 3.1 Metadata & Routing (PIDs 40, 1–4, 20)

| Param ID | Parameter Name | Range | Default | Semantics |
|:---|:---|:---|:---|:---|
| **40** (`0x28`) | Preset Name | ASCII string | `"FAV: MPC"` | Up to 14 characters, null-terminated |
| **1** (`0x01`) | Pad MIDI Channel | `0` – `15` | `9` (Ch 10) | 0-indexed (`0` = Ch 1, `15` = Ch 16) |
| **2** (`0x02`) | Keybed & Controls Channel | `0` – `15` | `0` (Ch 1) | Shared by Keys, Knobs, Joystick |
| **3** (`0x03`) | Keyboard Octave Shift | `-4` – `+4` | `0` | Center = 0 |
| **4** (`0x04`) | Keyboard Transpose | `-12` – `+12` | `0` | Semitones |
| **20** (`0x14`) | Global Pad Aftertouch Mode | `0` – `2` | `1` (Channel) | `0` = Off, `1` = Channel, `2` = Polyphonic |

---

### 3.2 Arpeggiator (PIDs 5–13)

| Param ID | Parameter Name | Range | Default | Semantics |
|:---|:---|:---|:---|:---|
| **5** (`0x05`) | Arp On/Off | `0` – `1` | `0` | `0` = Off, `1` = On |
| **6** (`0x06`) | Arp Tempo | `60` – `240` | `120` | Beats Per Minute (BPM) |
| **7** (`0x07`) | Time Division | `0` – `7` | `0` (1/4) | `0`=1/4, `1`=1/4T, `2`=1/8, `3`=1/8T, `4`=1/16, `5`=1/16T, `6`=1/32, `7`=1/32T |
| **8** (`0x08`) | Arp Swing | `0` – `25` | `0` (50%) | Stored as offset from 50% (`0` = 50%, `25` = 75%) |
| **9** (`0x09`) | Arp Octave Range | `0` – `3` | `0` (1 Oct) | `0` = 1 Oct, `1` = 2 Oct, `2` = 3 Oct, `3` = 4 Oct |
| **10** (`0x0A`) | Arp Playback Mode | `0` – `5` | `0` (Up) | `0`=Up, `1`=Down, `2`=Exclusive, `3`=Inclusive, `4`=Order, `5`=Random |
| **11** (`0x0B`) | Arp Latch | `0` – `1` | `0` | `0` = Off, `1` = On |
| **12** (`0x0C`) | Tap Tempo Taps | `2` – `4` | `2` | Number of taps to compute tempo |
| **13** (`0x0D`) | Clock Source | `0` – `1` | `0` (Internal)| `0` = Internal, `1` = External (USB MIDI Clock) |

---

### 3.3 Joystick / X-Y Controller (PIDs 14–19)

| Param ID | Parameter Name | Range | Default | Semantics |
|:---|:---|:---|:---|:---|
| **14** (`0x0E`) | Joystick X-Axis Mode | `0` – `2` | `0` (Pitchbend) | `0` = Pitchbend, `1` = Single CC, `2` = Dual CC |
| **15** (`0x0F`) | Joystick X-Axis CC 1 | `0` – `127` | `1` | CC for Single CC or Dual CC positive direction |
| **16** (`0x10`) | Joystick X-Axis CC 2 | `0` – `127` | `2` | CC for Dual CC negative direction |
| **17** (`0x11`) | Joystick Y-Axis Mode | `0` – `2` | `0` (Pitchbend) | `0` = Pitchbend, `1` = Single CC, `2` = Dual CC |
| **18** (`0x12`) | Joystick Y-Axis CC 1 | `0` – `127` | `1` (Mod Wheel) | CC for Single CC or Dual CC positive direction |
| **19** (`0x13`) | Joystick Y-Axis CC 2 | `0` – `127` | `2` | CC for Dual CC negative direction |

---

### 3.4 Drum Pads (PIDs 21–36)

16 pads in total: 8 in Bank A, 8 in Bank B.

The physical Akai MPK Mini Play mk3 hardware features two 4×2 rows:
- **Top Row**: Pads 5, 6, 7, 8 (or 13, 14, 15, 16 in Bank B)
- **Bottom Row**: Pads 1, 2, 3, 4 (or 9, 10, 11, 12 in Bank B)

> [!NOTE]
> **Hardware Diatonic Scale vs. MPC Chromatic Template:**
> On the physical hardware (and internal sound generator), the factory default pad mapping follows the **Natural Diatonic Major Scale** (Pad 1 = C1, Pad 2 = D1, Pad 3 = E1, Pad 4 = F1...). However, some DAW templates (such as Factory Preset 1 / MPC) map pads chromatically (Pad 1 = C1, Pad 2 = C#1...).
> Querying the active hardware preset via SysEx `0x66` ensures the exact pad notes mapped on the device are always retrieved.

| Param ID | Pad Number | Hardware Default (Diatonic) | Note Name | MPC Preset 1 (Chromatic) | Note Name |
|:---|:---|:---:|:---:|:---:|:---:|
| **21** (`0x15`) | Pad 1 (Bank A) | `36` | C1 | `36` | C1 |
| **22** (`0x16`) | Pad 2 (Bank A) | `38` | D1 | `37` | C#1 |
| **23** (`0x17`) | Pad 3 (Bank A) | `40` | E1 | `38` | D1 |
| **24** (`0x18`) | Pad 4 (Bank A) | `41` | F1 | `39` | D#1 |
| **25** (`0x19`) | Pad 5 (Bank A) | `43` | G1 | `40` | E1 |
| **26** (`0x1A`) | Pad 6 (Bank A) | `45` | A1 | `41` | F1 |
| **27** (`0x1B`) | Pad 7 (Bank A) | `47` | B1 | `42` | F#1 |
| **28** (`0x1C`) | Pad 8 (Bank A) | `48` | C2 | `43` | G1 |
| **29** (`0x1D`) | Pad 9 (Bank B) | `50` | D2 | `44` | G#1 |
| **30** (`0x1E`) | Pad 10 (Bank B) | `52` | E2 | `45` | A1 |
| **31** (`0x1F`) | Pad 11 (Bank B) | `53` | F2 | `46` | A#1 |
| **32** (`0x20`) | Pad 12 (Bank B) | `55` | G2 | `47` | B1 |
| **33** (`0x21`) | Pad 13 (Bank B) | `57` | A2 | `48` | C2 |
| **34** (`0x22`) | Pad 14 (Bank B) | `59` | B2 | `49` | C#2 |
| **35** (`0x23`) | Pad 15 (Bank B) | `60` | C3 | `50` | D2 |
| **36** (`0x24`) | Pad 16 (Bank B) | `62` | D3 | `51` | D#2 |

---

### 3.5 Rotary Knobs (PIDs 37–68)

8 knobs in total: 4 in Bank A, 4 in Bank B. Each knob has 4 sub-parameters:

| Knob | CC Param ID | Min Param ID | Max Param ID | Name Param ID | Default CC | Default Name |
|:---|:---:|:---:|:---:|:---:|:---:|:---|
| Knob 1 (Bank A) | **37** (`0x25`) | **38** (`0x26`) | **39** (`0x27`) | **40** (`0x28`)* | `70` | `"Q-Link 1"` |
| Knob 2 (Bank A) | **41** (`0x29`) | **42** (`0x2A`) | **43** (`0x2B`) | **44** (`0x2C`) | `71` | `"Q-Link 2"` |
| Knob 3 (Bank A) | **45** (`0x2D`) | **46** (`0x2E`) | **47** (`0x2F`) | **48** (`0x30`) | `72` | `"Q-Link 3"` |
| Knob 4 (Bank A) | **49** (`0x31`) | **50** (`0x32`) | **51** (`0x33`) | **52** (`0x34`) | `73` | `"Q-Link 4"` |
| Knob 5 (Bank B) | **53** (`0x35`) | **54** (`0x36`) | **55** (`0x37`) | **56** (`0x38`) | `74` | `"Q-Link 5"` |
| Knob 6 (Bank B) | **57** (`0x39`) | **58** (`0x3A`) | **59** (`0x3B`) | **60** (`0x3C`) | `75` | `"Q-Link 6"` |
| Knob 7 (Bank B) | **61** (`0x3D`) | **62** (`0x3E`) | **63** (`0x3F`) | **64** (`0x40`) | `76` | `"Q-Link 7"` |
| Knob 8 (Bank B) | **65** (`0x41`) | **66** (`0x42`) | **67** (`0x43`) | **68** (`0x44`) | `77` | `"Q-Link 8"` |

*(Note: Knob Min defaults to `0`, Knob Max defaults to `127`).*

---

### 3.6 Internal Sound Engine & Sound FX (PIDs 69–78)

| Param ID | Parameter Name | Range | Default | Semantics |
|:---|:---|:---|:---|:---|
| **69** (`0x45`) | Keyboard Sound | `0` – `127` | `0` | 128 internal acoustic & synthesizer instruments |
| **70** (`0x46`) | Pad Sound (Drum Kit) | `0` – `9` | `2` | 10 built-in drum kits |
| **71** (`0x47`) | Filter Cutoff | `0` – `127` | `127` | Low-pass filter frequency cutoff |
| **72** (`0x48`) | Filter Resonance | `0` – `127` | `0` | Cutoff peak boost |
| **73** (`0x49`) | Attack Time | `0` – `127` | `0` | Envelope attack speed |
| **74** (`0x4A`) | Release Time | `0` – `127` | `0` | Envelope release duration |
| **75** (`0x4B`) | Reverb Amount | `0` – `127` | `0` | Internal reverb send |
| **76** (`0x4C`) | Chorus Amount | `0` – `127` | `32` | Stereo chorus effect depth |
| **77** (`0x4D`) | EQ Low Gain | `0` – `127` | `64` | Low frequency shelf (center/flat = 64) |
| **78** (`0x4E`) | EQ High Gain | `0` – `127` | `64` | High frequency shelf (center/flat = 64) |

---

## 4. Desktop File Format (`.mpkminiplaymk3`)

The Akai editor desktop application saves presets as a fixed-size 2,123-byte binary file containing the complete parameter tree.

### 4.1 Fixed Byte Offset Map

Because every `.mpkminiplaymk3` file has an identical fixed record structure, any parameter can be read or modified directly at its exact byte offset:

| Offset (Hex) | Offset (Dec) | Param ID | Type | Parameter Name | Range / Format |
|:---:|:---:|:---:|:---:|:---|:---|
| `0x24` | 36 | **0** | String | Preset Name | 16-byte buffer (14 chars + 2 nulls) |
| `0x4C` | 76 | **1** | Byte | Pad MIDI Channel | `0`–`15` (Ch 1–16) |
| `0x65` | 101 | **2** | Byte | Keybed & Controls Channel | `0`–`15` (Ch 1–16) |
| `0x7E` | 126 | **3** | Byte | Keybed Octave Shift | `-4`–`+4` (Stored as signed/unsigned byte) |
| `0x97` | 151 | **4** | Byte | Keybed Transpose | `-12`–`+12` semitones |
| `0xB0` | 176 | **5** | Byte | Arp On/Off | `0` = Off, `1` = On |
| `0xC9` | 201 | **6** | Byte | Arp Tempo | `60`–`240` BPM |
| `0xE2` | 226 | **7** | Byte | Arp Time Division | `0`–`7` (1/4 to 1/32T) |
| `0xFB` | 251 | **8** | Byte | Arp Swing | `0`–`25` (50% to 75%) |
| `0x114` | 276 | **9** | Byte | Arp Octave Range | `0`–`3` (1 to 4 Octaves) |
| `0x12D` | 301 | **10** | Byte | Arp Playback Mode | `0`–`5` (Up, Down, Excl, Incl, Order, Rand) |
| `0x146` | 326 | **11** | Byte | Arp Latch | `0` = Off, `1` = On |
| `0x15F` | 351 | **12** | Byte | Arp Tap Tempo Taps | `2`, `3`, or `4` |
| `0x178` | 376 | **13** | Byte | Arp Clock Source | `0` = Internal, `1` = External |
| `0x192` | 402 | **14** | Byte | Joystick X Axis Mode | `0` = Pitchbend, `1` = Single CC, `2` = Dual CC |
| `0x1AB` | 427 | **15** | Byte | Joystick X Axis CC1 | `0`–`127` |
| `0x1C4` | 452 | **16** | Byte | Joystick X Axis CC2 | `0`–`127` |
| `0x1DD` | 477 | **17** | Byte | Joystick Y Axis Mode | `0` = Pitchbend, `1` = Single CC, `2` = Dual CC |
| `0x1F6` | 502 | **18** | Byte | Joystick Y Axis CC1 | `0`–`127` (Default CC 1 Mod Wheel) |
| `0x20F` | 527 | **19** | Byte | Joystick Y Axis CC2 | `0`–`127` |
| `0x228` | 552 | **20** | Byte | Global Pad Aftertouch | `0` = Off, `1` = Channel, `2` = Poly |
| `0x241` | 577 | **21** | Byte | Pad 1 Note (Bank A) | `0`–`127` (Default 36 / C1) |
| `0x25A` | 602 | **22** | Byte | Pad 2 Note (Bank A) | `0`–`127` (Default 38 / D1) |
| `0x273` | 627 | **23** | Byte | Pad 3 Note (Bank A) | `0`–`127` (Default 40 / E1) |
| `0x28C` | 652 | **24** | Byte | Pad 4 Note (Bank A) | `0`–`127` (Default 41 / F1) |
| `0x2A5` | 677 | **25** | Byte | Pad 5 Note (Bank A) | `0`–`127` (Default 43 / G1) |
| `0x2BE` | 702 | **26** | Byte | Pad 6 Note (Bank A) | `0`–`127` (Default 45 / A1) |
| `0x2D7` | 727 | **27** | Byte | Pad 7 Note (Bank A) | `0`–`127` (Default 47 / B1) |
| `0x2F0` | 752 | **28** | Byte | Pad 8 Note (Bank A) | `0`–`127` (Default 48 / C2) |
| `0x309` | 777 | **29** | Byte | Pad 9 Note (Bank B) | `0`–`127` (Default 50 / D2) |
| `0x322` | 802 | **30** | Byte | Pad 10 Note (Bank B) | `0`–`127` (Default 52 / E2) |
| `0x33B` | 827 | **31** | Byte | Pad 11 Note (Bank B) | `0`–`127` (Default 53 / F2) |
| `0x354` | 852 | **32** | Byte | Pad 12 Note (Bank B) | `0`–`127` (Default 55 / G2) |
| `0x36D` | 877 | **33** | Byte | Pad 13 Note (Bank B) | `0`–`127` (Default 57 / A2) |
| `0x386` | 902 | **34** | Byte | Pad 14 Note (Bank B) | `0`–`127` (Default 59 / B2) |
| `0x39F` | 927 | **35** | Byte | Pad 15 Note (Bank B) | `0`–`127` (Default 60 / C3) |
| `0x3B8` | 952 | **36** | Byte | Pad 16 Note (Bank B) | `0`–`127` (Default 62 / D3) |
| `0x3D1` | 977 | **37** | Byte | Knob 1 CC (Bank A) | `0`–`127` (Default 70) |
| `0x3EA` | 1002 | **38** | Byte | Knob 1 Min (Bank A) | `0`–`127` (Default 0) |
| `0x403` | 1027 | **39** | Byte | Knob 1 Max (Bank A) | `0`–`127` (Default 127) |
| `0x41C` | 1052 | **40** | String | Knob 1 Name (Bank A) | 16-byte buffer (e.g. `"Q-Link 1"`) |
| `0x444` | 1092 | **41** | Byte | Knob 2 CC (Bank A) | `0`–`127` (Default 71) |
| `0x45D` | 1117 | **42** | Byte | Knob 2 Min (Bank A) | `0`–`127` (Default 0) |
| `0x476` | 1142 | **43** | Byte | Knob 2 Max (Bank A) | `0`–`127` (Default 127) |
| `0x48F` | 1167 | **44** | String | Knob 2 Name (Bank A) | 16-byte buffer (e.g. `"Q-Link 2"`) |
| `0x4B7` | 1207 | **45** | Byte | Knob 3 CC (Bank A) | `0`–`127` (Default 72) |
| `0x4D0` | 1232 | **46** | Byte | Knob 3 Min (Bank A) | `0`–`127` (Default 0) |
| `0x4E9` | 1257 | **47** | Byte | Knob 3 Max (Bank A) | `0`–`127` (Default 127) |
| `0x502` | 1282 | **48** | String | Knob 3 Name (Bank A) | 16-byte buffer (e.g. `"Q-Link 3"`) |
| `0x52A` | 1322 | **49** | Byte | Knob 4 CC (Bank A) | `0`–`127` (Default 73) |
| `0x543` | 1347 | **50** | Byte | Knob 4 Min (Bank A) | `0`–`127` (Default 0) |
| `0x55C` | 1372 | **51** | Byte | Knob 4 Max (Bank A) | `0`–`127` (Default 127) |
| `0x575` | 1397 | **52** | String | Knob 4 Name (Bank A) | 16-byte buffer (e.g. `"Q-Link 4"`) |
| `0x59D` | 1437 | **53** | Byte | Knob 5 CC (Bank B) | `0`–`127` (Default 74) |
| `0x5B6` | 1462 | **54** | Byte | Knob 5 Min (Bank B) | `0`–`127` (Default 0) |
| `0x5CF` | 1487 | **55** | Byte | Knob 5 Max (Bank B) | `0`–`127` (Default 127) |
| `0x5E8` | 1512 | **56** | String | Knob 5 Name (Bank B) | 16-byte buffer (e.g. `"Q-Link 5"`) |
| `0x610` | 1552 | **57** | Byte | Knob 6 CC (Bank B) | `0`–`127` (Default 75) |
| `0x629` | 1577 | **58** | Byte | Knob 6 Min (Bank B) | `0`–`127` (Default 0) |
| `0x642` | 1602 | **59** | Byte | Knob 6 Max (Bank B) | `0`–`127` (Default 127) |
| `0x65B` | 1627 | **60** | String | Knob 6 Name (Bank B) | 16-byte buffer (e.g. `"Q-Link 6"`) |
| `0x683` | 1667 | **61** | Byte | Knob 7 CC (Bank B) | `0`–`127` (Default 76) |
| `0x69C` | 1692 | **62** | Byte | Knob 7 Min (Bank B) | `0`–`127` (Default 0) |
| `0x6B5` | 1717 | **63** | Byte | Knob 7 Max (Bank B) | `0`–`127` (Default 127) |
| `0x6CE` | 1742 | **64** | String | Knob 7 Name (Bank B) | 16-byte buffer (e.g. `"Q-Link 7"`) |
| `0x6F6` | 1782 | **65** | Byte | Knob 8 CC (Bank B) | `0`–`127` (Default 77) |
| `0x70F` | 1807 | **66** | Byte | Knob 8 Min (Bank B) | `0`–`127` (Default 0) |
| `0x728` | 1832 | **67** | Byte | Knob 8 Max (Bank B) | `0`–`127` (Default 127) |
| `0x741` | 1857 | **68** | String | Knob 8 Name (Bank B) | 16-byte buffer (e.g. `"Q-Link 8"`) |
| `0x769` | 1897 | **69** | Byte | Keyboard Sound | `0`–`127` (128 internal sounds) |
| `0x782` | 1922 | **70** | Byte | Pad Sound (Drum Kit) | `0`–`9` (10 drum kits) |
| `0x79B` | 1947 | **71** | Byte | Sound FX: Filter Cutoff | `0`–`127` |
| `0x7B4` | 1972 | **72** | Byte | Sound FX: Resonance | `0`–`127` |
| `0x7CD` | 1997 | **73** | Byte | Sound FX: Attack Time | `0`–`127` |
| `0x7E6` | 2022 | **74** | Byte | Sound FX: Release Time | `0`–`127` |
| `0x7FF` | 2047 | **75** | Byte | Sound FX: Reverb Level | `0`–`127` |
| `0x818` | 2072 | **76** | Byte | Sound FX: Chorus Level | `0`–`127` |
| `0x831` | 2097 | **77** | Byte | Sound FX: EQ Low | `0`–`127` (Center flat = 64) |
| `0x84A` | 2122 | **78** | Byte | Sound FX: EQ High | `0`–`127` (Center flat = 64) |

---

### 4.2 Direct Hardware 215-Byte Linear SysEx Payload Map

While the desktop editor wraps each parameter in a 25-byte Juce envelope inside `.mpkminiplaymk3` files on disk, **the physical hardware communicates via an optimized, contiguous 215-byte linear byte array** across USB SysEx frames:

| Byte Offset | Length | Parameter | Semantics / Encoding |
|:---:|:---:|:---|:---|
| `0` .. `15` | 16 | **Preset Name** | ASCII string, null-terminated/padded (max 14 chars) |
| `16` | 1 | **Pad Channel** | 0-indexed (`0` = Ch 1, `9` = Ch 10, `15` = Ch 16) |
| `17` | 1 | **Keys / Controls Channel** | 0-indexed (`0` = Ch 1, `1` = Ch 2, etc.) |
| `18` | 1 | **Octave Raw Flag** | `0` |
| `19` | 1 | **Keybed Octave** | Center-offset by +4 (`4` = 0 Oct, `3` = -1, `5` = +1) |
| `20` | 1 | **Keybed Transpose** | Center-offset by +12 (`12` = 0, semitones) |
| `21` | 1 | **Arpeggiator On/Off** | `0` = Off, `1` = On |
| `22` | 1 | **Arpeggiator Clock** | `0` = Internal, `1` = External |
| `23` | 1 | **Arpeggiator Mode** | `0` = Up, `1` = Down, `2` = Excl, `3` = Incl, `4` = Order, `5` = Rand |
| `24` | 1 | **Arpeggiator Time Division** | `0` = 1/4, `1` = 1/4T, `2` = 1/8, `3` = 1/8T, `4` = 1/16, `5` = 1/16T, `6` = 1/32, `7` = 1/32T |
| `25` | 1 | **Arpeggiator Swing** | `0` to `25` (50% to 75%) |
| `26` | 1 | **Arpeggiator Octave** | `0` to `3` (1 to 4 Octaves) |
| `27` | 1 | **Tap Tempo Taps** | `2`, `3`, or `4` taps |
| `28` | 1 | **Arpeggiator Latch** | `0` = Off, `1` = On |
| `29` | 1 | **Arpeggiator Tempo** | `60` to `240` BPM |
| `30` | 1 | **Joystick X-Axis Mode** | `0` = Pitchbend, `1` = Single CC, `2` = Dual CC |
| `31` | 1 | **Joystick X-Axis CC 1** | `0` to `127` |
| `32` | 1 | **Joystick X-Axis CC 2** | `0` to `127` |
| `33` | 1 | **Joystick Y-Axis Mode** | `0` = Pitchbend, `1` = Single CC, `2` = Dual CC |
| `34` | 1 | **Joystick Y-Axis CC 1** | `0` to `127` (Default CC 1 Modulation) |
| `35` | 1 | **Joystick Y-Axis CC 2** | `0` to `127` |
| `36` | 1 | **Global Pad Aftertouch** | `0` = Off, `1` = Channel, `2` = Polyphonic |
| `37` .. `52` | 16 | **Pads 1–16 MIDI Notes** | 16 contiguous bytes for Bank A (1–8) and Bank B (9–16) |
| `53` .. `204` | 152 | **Knobs 1–8 Blocks** | 8 consecutive 19-byte structures (see below) |
| `205` | 1 | **Keyboard Sound** | `0` to `127` (Internal sound program) |
| `206` | 1 | **Pad Sound (Drum Kit)** | `0` to `9` (Internal drum kit) |
| `207` | 1 | **Filter Cutoff** | `0` to `127` |
| `208` | 1 | **Filter Resonance** | `0` to `127` |
| `209` | 1 | **Attack Time** | `0` to `127` |
| `210` | 1 | **Release Time** | `0` to `127` |
| `211` | 1 | **Reverb Level** | `0` to `127` |
| `212` | 1 | **Chorus Level** | `0` to `127` |
| `213` | 1 | **EQ Low** | `0` to `127` (Center flat = 64) |
| `214` | 1 | **EQ High** | `0` to `127` (Center flat = 64) |

#### Each 19-Byte Knob Sub-Structure (`53 + i * 19`):
- `+0`: CC Number (`0`–`127`)
- `+1`: Minimum Value (`0`–`127`)
- `+2`: Maximum Value (`0`–`127`)
- `+3` .. `+18`: Knob Name (16-byte ASCII null-terminated string)

---

## 5. JavaScript / Web MIDI Implementation Example

```javascript
// Request MIDI access with SysEx support
const midi = await navigator.requestMIDIAccess({ sysex: true });

// Find Akai MPK mini Play mk3 ports
const input = Array.from(midi.inputs.values()).find(i => i.name.includes("MPK mini Play"));
const output = Array.from(midi.outputs.values()).find(o => o.name.includes("MPK mini Play"));

if (!output) {
  console.error("Akai MPK mini Play mk3 not detected");
}

// 1. Request Favorite 1 (slot 0)
function requestFavorite(slotIndex = 0) {
  const req = [0xF0, 0x47, 0x7F, 0x50, 0x66, 0x00, 0x01, slotIndex, 0xF7];
  output.send(req);
}

// 2. Listen for response (Opcode 0x67)
input.onmidimessage = (event) => {
  const data = event.data;
  // Check Akai header and model AD21
  if (data[0] === 0xF0 && data[1] === 0x47 && data[3] === 0x50) {
    const cmd = data[4];
    if (cmd === 0x67 || cmd === 0x64) {
      console.log("Received Preset SysEx payload from keyboard!");
      const targetSlot = data[7];
      // 215-byte linear hardware payload
      const payload = data.slice(8, data.length - 1);
      console.log(`Slot ${targetSlot + 1} payload size: ${payload.length} bytes`);
    }
  }
};

// 3. Send Keybed Curve
function sendKeyCurve(p1 = 3000, p2 = 6000, p3 = 10000, p4 = 14000, blackBalance = 64) {
  const msg = [
    0xF0, 0x47, 0x7F, 0x50, 0x13, 0x09,
    (p1 >> 7) & 0x7F, p1 & 0x7F,
    (p2 >> 7) & 0x7F, p2 & 0x7F,
    (p3 >> 7) & 0x7F, p3 & 0x7F,
    (p4 >> 7) & 0x7F, p4 & 0x7F,
    blackBalance & 0x7F,
    0xF7
  ];
  output.send(msg);
}

// 4. Send to RAM (Audition live changes immediately)
function sendToRam(presetPayload215Bytes) {
  const msg = [
    0xF0, 0x47, 0x7F, 0x50, 0x64, 0x01, 0x58,
    0x08, // 0x08 = Target RAM
    ...presetPayload215Bytes,
    0xF7
  ];
  output.send(msg);
}
```

---

## 6. Real-Time MIDI Stream Monitoring

When plugged in via USB MIDI, the Akai MPK Mini Play mk3 transmits standard MIDI 1.0 channel messages concurrently with SysEx communications:

### 6.1 Hardware Event Mapping

| Hardware Control | MIDI Message Type | Channel | Data Bytes | Notes |
|:---|:---|:---|:---|:---|
| **25-Key Keybed** | Note On (`0x90`–`0x9F`), Note Off (`0x80`–`0x8F`) | `Keys Channel` (Default Ch 1) | Note: `0`–`127`, Velocity: `1`–`127` | Shifted by Octave and Transpose |
| **16 MPC Pads** | Note On (`0x90`–`0x9F`), Note Off (`0x80`–`0x8F`) | `Pad Channel` (Default Ch 10) | Note: `0`–`127` (Default C1 36 to D#2 51), Velocity: `1`–`127` | Bank A (Pads 1–8), Bank B (Pads 9–16) |
| **Pad Pressure** | Channel Aftertouch (`0xD0`–`0xDF`) or Polyphonic Aftertouch (`0xA0`–`0xAF`) | `Pad Channel` | Pressure: `0`–`127` | Configured by PID 20 (Off, Channel, or Polyphonic) |
| **8 Q-Link Knobs** | Control Change (`0xB0`–`0xBF`) | `Keys Channel` | CC Number (`0`–`127`), Value (`0`–`127`) | Bank A (Knobs 1–4), Bank B (Knobs 5–8) |
| **Joystick X-Axis** | Pitch Bend (`0xE0`–`0xEF`) or CC (`0xB0`–`0xBF`) | `Keys Channel` | Pitchbend 14-bit or CC1/CC2 | Mode 0 = Pitch Bend, Mode 1 = Single CC, Mode 2 = Dual CC |
| **Joystick Y-Axis** | CC (`0xB0`–`0xBF`) or Pitch Bend (`0xE0`–`0xEF`) | `Keys Channel` | Default CC 1 (Modulation Wheel) | Mode 0 = Pitch Bend, Mode 1 = Single CC, Mode 2 = Dual CC |
| **Arpeggiator Clock** | Timing Clock (`0xF8`), Start (`0xFA`), Stop (`0xFC`) | System Real-Time | None | Active when Clock Source is Internal and Arp is running |

### 6.2 Monitoring Implementation Example

```javascript
input.onmidimessage = (event) => {
  const [status, data1, data2] = event.data;
  const channel = (status & 0x0F) + 1;
  const msgType = status & 0xF0;

  if (msgType === 0x90 && data2 > 0) {
    console.log(`[Ch ${channel}] Note On: Note ${data1}, Velocity ${data2}`);
  } else if (msgType === 0x80 || (msgType === 0x90 && data2 === 0)) {
    console.log(`[Ch ${channel}] Note Off: Note ${data1}`);
  } else if (msgType === 0xB0) {
    console.log(`[Ch ${channel}] CC ${data1} Value: ${data2}`);
  } else if (msgType === 0xE0) {
    const pitch = ((data2 << 7) | data1) - 8192;
    console.log(`[Ch ${channel}] Pitch Bend: ${pitch}`);
  } else if (msgType === 0xD0) {
    console.log(`[Ch ${channel}] Channel Aftertouch: ${data1}`);
  }
};
```

---

### 6.3 Internal Sounds vs. MIDI Controller Mode Behavior

> [!WARNING]
> **Critical Operational Difference**: When the physical `INTERNAL SOUNDS` button is toggled **ON**, MIDI events transmitted over USB **do not match** the user's custom preset configuration. Specifically, the rotary knobs bypass user-configured CC numbers and Min/Max ranges to control internal synthesizer parameters.

#### 1. Hardware Architecture
The Akai MPK Mini Play mk3 integrates an internal synthesizer sound module powered by a Dream S.A.S. SAM2635 DSP engine (connected via internal serial UART to the keyboard's ARM microcontroller) driving the built-in speaker and 3.5mm audio headphone jack.

#### 2. Dual-Mode Functional Comparison

| Feature / Behavior | Mode 1: MIDI Controller Mode (`INTERNAL SOUNDS` OFF) | Mode 2: Internal Sounds Mode (`INTERNAL SOUNDS` ON) |
|:---|:---|:---|
| **Knob Functionality** | Assignable MIDI CC Encoders (Knobs 1–8 across Banks A & B) | Real-time Internal Synth Sound FX Parameter Encoders |
| **Knob CC Output over USB** | Transmits user-configured CC numbers (e.g., CC 70–77) | Transmits fixed Sound Engine FX parameters (Cutoff, Res, Reverb, Chorus, etc.) |
| **Knob Min/Max Constraints** | Strict enforcement of programmed Min and Max ranges (0–127) | **Ignored** (full internal synth parameter sweep) |
| **Keybed & Pads Audio** | Muted on hardware; triggers virtual instruments / DAW plugins | Plays through built-in speaker / 3.5mm headphone jack |
| **Keybed & Pads USB MIDI** | Transmits Note On/Off and Aftertouch on configured channels | Transmits Note On/Off and Aftertouch on configured channels (causes double-triggering if DAW is unmuted) |
| **Button Event over USB** | No event sent when toggling mode | No event sent when toggling mode |

#### 3. Knob Mappings in Internal Sounds Mode
When `INTERNAL SOUNDS` is engaged, the 4 physical knobs are intercepted by the internal tone generator:
- **Bank A**:
  - Knob 1: **Filter Cutoff**
  - Knob 2: **Resonance**
  - Knob 3: **Reverb Send Level**
  - Knob 4: **Chorus Depth**
- **Bank B**:
  - Knob 1: **Envelope Attack Time**
  - Knob 2: **Envelope Release Time**
  - Knob 3: **Low-Frequency EQ Shelf**
  - Knob 4: **High-Frequency EQ Shelf**

#### 4. Developer & Host Software Recommendations
- **Avoid User Confusion**: Software and Web MIDI applications should display a visible warning reminding users that **Internal Sounds must be toggled OFF on the physical keyboard** if they expect their custom CC numbers, knob names, and Min/Max ranges to be transmitted over USB.
- **Audition Prevention**: Host applications should provide a software mute toggle ("Sound Audition Preview") so users listening through the keyboard's built-in speaker can silence computer-generated audio without double-triggering sound.
