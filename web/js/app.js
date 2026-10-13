// Akai MPK Mini Play mk3 — Main Web Application Controller

import { FACTORY_PRESETS } from "./factory-presets.js";
import {
  SOUND_NAMES,
  DRUM_KIT_NAMES,
  TIME_DIVISIONS,
  ARP_MODES,
  AFTERTOUCH_MODES,
  JOYSTICK_MODES,
  midiNoteToName,
  createDefaultPresetState,
  parseMpkFile,
  serializeMpkFile,
  parseHardwareSysExPayload,
  serializeHardwareSysExPayload,
  buildSendFavoriteSysEx
} from "./protocol.js";
import { MidiManager, AudioPreview } from "./midi.js";

// Helper: Decode Base64 string to Uint8Array
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

// App State
class AppController {
  constructor() {
    this.midiManager = new MidiManager();
    this.audio = new AudioPreview();

    // Decode factory preset templates
    this.templates = {};
    for (const [key, b64] of Object.entries(FACTORY_PRESETS)) {
      this.templates[key] = base64ToBytes(b64);
    }

    // Initialize with default diatonic state (Pads: C1 36, D1 38, E1 40, F1 41, G1 43, A1 45, B1 47, C2 48)
    this.currentTemplate = new Uint8Array(this.templates["preset1"]);
    this.state = createDefaultPresetState();
    this.currentTemplate = serializeMpkFile(this.state, this.currentTemplate);

    this.selectedSlot = 0; // Hardware Favorite 1-8 (0-indexed)
    this.activePadBank = "A"; // Bank A (Pads 1-8) or Bank B (Pads 9-16)
    this.liveRamEnabled = false;

    this.initDOM();
    this.populateDropdowns();
    this.renderPianoKeys();
    this.bindEvents();
    this.updateUIFromState();
  }

  initDOM() {
    // Header & MIDI
    this.connPill = document.getElementById("connPill");
    this.connStatusText = document.getElementById("connStatusText");
    this.midiInSelect = document.getElementById("midiInSelect");
    this.midiOutSelect = document.getElementById("midiOutSelect");
    this.connectMidiBtn = document.getElementById("connectMidiBtn");

    // Preset & Slots
    this.slotButtons = document.querySelectorAll(".slot-btn[data-slot]");
    this.presetNameInput = document.getElementById("presetNameInput");
    this.factoryPresetSelect = document.getElementById("factoryPresetSelect");
    this.sendRamBtn = document.getElementById("sendRamBtn");
    this.getDeviceBtn = document.getElementById("getDeviceBtn");
    this.sendDeviceBtn = document.getElementById("sendDeviceBtn");
    this.openFileBtn = document.getElementById("openFileBtn");
    this.saveFileBtn = document.getElementById("saveFileBtn");
    this.fileInput = document.getElementById("fileInput");

    // Sound & FX
    this.kbdSoundSelect = document.getElementById("kbdSoundSelect");
    this.padSoundSelect = document.getElementById("padSoundSelect");
    this.fxFilter = document.getElementById("fxFilter");
    this.fxFilterVal = document.getElementById("fxFilterVal");
    this.fxReso = document.getElementById("fxReso");
    this.fxResoVal = document.getElementById("fxResoVal");
    this.fxAttack = document.getElementById("fxAttack");
    this.fxAttackVal = document.getElementById("fxAttackVal");
    this.fxRelease = document.getElementById("fxRelease");
    this.fxReleaseVal = document.getElementById("fxReleaseVal");
    this.fxReverb = document.getElementById("fxReverb");
    this.fxReverbVal = document.getElementById("fxReverbVal");
    this.fxChorus = document.getElementById("fxChorus");
    this.fxChorusVal = document.getElementById("fxChorusVal");
    this.fxEqLow = document.getElementById("fxEqLow");
    this.fxEqLowVal = document.getElementById("fxEqLowVal");
    this.fxEqHigh = document.getElementById("fxEqHigh");
    this.fxEqHighVal = document.getElementById("fxEqHighVal");

    // Arp & Routing
    this.arpOn = document.getElementById("arpOn");
    this.arpTempo = document.getElementById("arpTempo");
    this.arpTimeDiv = document.getElementById("arpTimeDiv");
    this.arpSwing = document.getElementById("arpSwing");
    this.arpOctave = document.getElementById("arpOctave");
    this.arpMode = document.getElementById("arpMode");
    this.arpClock = document.getElementById("arpClock");
    this.keysChannel = document.getElementById("keysChannel");
    this.padChannel = document.getElementById("padChannel");
    this.aftertouchSelect = document.getElementById("aftertouchSelect");

    // Pads
    this.padsGrid = document.getElementById("padsGrid");
    this.bankTabA = document.getElementById("bankTabA");
    this.bankTabB = document.getElementById("bankTabB");

    // Knobs (all 8 rendered together)
    this.knobsGrid = document.getElementById("knobsGrid");

    // Piano & Transpose
    this.pianoKeysContainer = document.getElementById("pianoKeysContainer");
    this.octDownBtn = document.getElementById("octDownBtn");
    this.octUpBtn = document.getElementById("octUpBtn");
    this.octValDisplay = document.getElementById("octValDisplay");
    this.transDownBtn = document.getElementById("transDownBtn");
    this.transUpBtn = document.getElementById("transUpBtn");
    this.transValDisplay = document.getElementById("transValDisplay");

    // Joystick
    this.joystickPad = document.getElementById("joystickPad");
    this.joystickThumb = document.getElementById("joystickThumb");
    this.joyXMode = document.getElementById("joyXMode");
    this.joyXCc1 = document.getElementById("joyXCc1");
    this.joyXCc2 = document.getElementById("joyXCc2");
    this.joyYMode = document.getElementById("joyYMode");
    this.joyYCc1 = document.getElementById("joyYCc1");
    this.joyYCc2 = document.getElementById("joyYCc2");

    // Curve
    this.curveSvg = document.getElementById("curveSvg");
    this.curvePath = document.getElementById("curvePath");
    this.curveArea = document.getElementById("curveArea");
    this.cpP1 = document.getElementById("cpP1");
    this.cpP2 = document.getElementById("cpP2");
    this.cpP3 = document.getElementById("cpP3");
    this.cpP4 = document.getElementById("cpP4");
    this.curveP1 = document.getElementById("curveP1");
    this.curveP2 = document.getElementById("curveP2");
    this.curveP3 = document.getElementById("curveP3");
    this.curveP4 = document.getElementById("curveP4");
    this.curveBlackBal = document.getElementById("curveBlackBal");
    this.sendCurveBtn = document.getElementById("sendCurveBtn");

    // Header RX Indicator
    this.headerRxPill = document.getElementById("headerRxPill");
    this.headerRxDot = document.getElementById("headerRxDot");

    // Monitor Drawer & Event Stream
    this.rxLed = document.getElementById("rxLed");
    this.tabStreamBtn = document.getElementById("tabStreamBtn");
    this.tabSysExBtn = document.getElementById("tabSysExBtn");
    this.eventCounter = document.getElementById("eventCounter");
    this.streamView = document.getElementById("streamView");
    this.sysexView = document.getElementById("sysexView");
    this.streamTableBody = document.getElementById("streamTableBody");

    // Filters & Controls
    this.filterNotes = document.getElementById("filterNotes");
    this.filterCc = document.getElementById("filterCc");
    this.filterPitch = document.getElementById("filterPitch");
    this.filterAftertouch = document.getElementById("filterAftertouch");
    this.filterSysex = document.getElementById("filterSysex");
    this.filterClock = document.getElementById("filterClock");
    this.autoScrollCheck = document.getElementById("autoScrollCheck");
    this.soundPreviewOnRx = document.getElementById("soundPreviewOnRx");
    this.logTerminal = document.getElementById("logTerminal");
    this.clearLogBtn = document.getElementById("clearLogBtn");

    // Mode Notice Banner
    this.modeNoticeBanner = document.getElementById("modeNoticeBanner");
    this.closeNoticeBtn = document.getElementById("closeNoticeBtn");

    this.eventCount = 0;
    this.rxTimer = null;
    this.rxActive = false;

    // High-performance DOM caches & batching buffers (60fps stutter-free UI)
    this.knobDoms = [];
    this.ccToKnobMap = new Map();
    this.padDoms = [];
    this.pianoKeyDoms = new Map();
    this.dirtyKnobs = new Set();
    this.pendingStreamRows = [];
    this.rafPending = false;
    this.pendingEventCountUpdate = false;
  }

  log(msg, type = "info") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${msg}`;
    this.logTerminal.appendChild(entry);
    this.logTerminal.scrollTop = this.logTerminal.scrollHeight;
  }

  triggerRxIndicator() {
    if (!this.rxActive) {
      this.rxActive = true;
      this.headerRxPill?.classList.add("active");
      this.rxLed?.classList.add("active");
    }
    clearTimeout(this.rxTimer);
    this.rxTimer = setTimeout(() => {
      this.rxActive = false;
      this.headerRxPill?.classList.remove("active");
      this.rxLed?.classList.remove("active");
    }, 120);
  }

  handleIncomingMidi(ev) {
    this.triggerRxIndicator();
    this.eventCount++;
    this.pendingEventCountUpdate = true;

    // Hardware to UI visual reflection
    this.handleHardwareUiFeedback(ev);

    // Stream filtering
    let shouldStream = true;
    if (ev.type === "noteon" || ev.type === "noteoff") {
      if (!this.filterNotes?.checked) shouldStream = false;
    } else if (ev.type === "cc") {
      if (!this.filterCc?.checked) shouldStream = false;
    } else if (ev.type === "pitchbend") {
      if (!this.filterPitch?.checked) shouldStream = false;
    } else if (ev.type === "aftertouch" || ev.type === "polyaftertouch") {
      if (!this.filterAftertouch?.checked) shouldStream = false;
    } else if (ev.type === "sysex") {
      if (!this.filterSysex?.checked) shouldStream = false;
    } else if (ev.type === "clock") {
      if (!this.filterClock?.checked) shouldStream = false;
    }

    if (shouldStream) {
      this.renderStreamRow(ev);
    }

    this.requestRafFlush();
  }

  handleHardwareUiFeedback(ev) {
    const isPadChannel = ev.channel === this.state.padChannel + 1;

    if (ev.type === "noteon") {
      if (isPadChannel) {
        // Exclusively Drum Pad (using cached DOM array)
        this.state.pads.forEach((padNote, idx) => {
          if (padNote === ev.note) {
            const padEl = this.padDoms[idx];
            if (padEl) padEl.classList.add("hw-hit");
          }
        });

        // Sound audition preview on RX for Drum Pad
        if (this.soundPreviewOnRx?.checked) {
          const matchIdx = this.state.pads.indexOf(ev.note);
          this.audio.playDrum(matchIdx !== -1 ? matchIdx : 0);
        }
      } else {
        // Exclusively Piano Keybed (using cached Map)
        const pianoKey = this.pianoKeyDoms.get(ev.note);
        if (pianoKey) pianoKey.classList.add("hw-pressed");

        // Sound audition preview on RX for Piano Key
        if (this.soundPreviewOnRx?.checked) {
          this.audio.playNote(ev.note, 0.35, ev.velocity / 127);
        }
      }
    } else if (ev.type === "noteoff") {
      if (isPadChannel) {
        this.state.pads.forEach((padNote, idx) => {
          if (padNote === ev.note) {
            const padEl = this.padDoms[idx];
            if (padEl) padEl.classList.remove("hw-hit");
          }
        });
      } else {
        const pianoKey = this.pianoKeyDoms.get(ev.note);
        if (pianoKey) pianoKey.classList.remove("hw-pressed");
      }
    } else if (ev.type === "cc") {
      // Check if matches any of the 8 knobs (O(1) Map lookup - no DOM traversal)
      const matchedIndices = this.ccToKnobMap.get(ev.controller);
      if (matchedIndices) {
        for (const idx of matchedIndices) {
          const k = this.state.knobs[idx];
          if (k) {
            k.currentVal = ev.value;
            this.dirtyKnobs.add(idx);
            const dom = this.knobDoms[idx];
            if (dom) {
              if (dom.turningTimer) clearTimeout(dom.turningTimer);
              dom.dial.classList.add("hw-turning");
              dom.turningTimer = setTimeout(() => {
                dom.dial.classList.remove("hw-turning");
                dom.turningTimer = null;
              }, 150);
            }
          }
        }
        this.requestRafFlush();
      }

      // Check if matches Joystick CC
      const joy = this.state.joystick;
      const isXCc = (joy.xMode !== 0 && (ev.controller === joy.xCc1 || ev.controller === joy.xCc2));
      const isYCc = (joy.yMode !== 0 && (ev.controller === joy.yCc1 || ev.controller === joy.yCc2)) || ev.controller === 1;

      if (isXCc) {
        if (ev.value === 0) {
          this.joystickThumb.style.left = "50%";
        } else if (joy.xMode === 2 && ev.controller === joy.xCc2) {
          const xPct = 50 - (ev.value / 127) * 40;
          this.joystickThumb.style.left = `${xPct}%`;
        } else {
          const xPct = 50 + (ev.value / 127) * 40;
          this.joystickThumb.style.left = `${xPct}%`;
        }
      }

      if (isYCc) {
        if (ev.value === 0) {
          this.joystickThumb.style.top = "50%";
        } else if (joy.yMode === 2 && ev.controller === joy.yCc2) {
          const yPct = 50 + (ev.value / 127) * 40;
          this.joystickThumb.style.top = `${yPct}%`;
        } else {
          const yPct = 50 - (ev.value / 127) * 40;
          this.joystickThumb.style.top = `${yPct}%`;
        }
      }
    } else if (ev.type === "pitchbend") {
      const norm = ev.pitchbend / 8192; // -1 to +1
      const isCenter = Math.abs(norm) < 0.05;

      if (isCenter) {
        this.joystickThumb.style.left = "50%";
        if (this.state.joystick.yMode === 0) {
          this.joystickThumb.style.top = "50%";
        }
      } else {
        if (this.state.joystick.xMode === 0) {
          const xPct = 50 + norm * 40;
          this.joystickThumb.style.left = `${xPct}%`;
        }
        if (this.state.joystick.yMode === 0) {
          const yPct = 50 - norm * 40;
          this.joystickThumb.style.top = `${yPct}%`;
        }
      }
    }
  }

  renderStreamRow(ev) {
    if (!this.streamTableBody) return;

    const row = document.createElement("div");
    row.className = "stream-row";
    if (ev.type === "noteon") row.classList.add("highlight-note");

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now.getMilliseconds().toString().padStart(3, "0")}`;

    let badgeClass = "badge-other";
    let badgeText = ev.type.toUpperCase();
    if (ev.type === "noteon") { badgeClass = "badge-noteon"; badgeText = "NOTE ON"; }
    else if (ev.type === "noteoff") { badgeClass = "badge-noteoff"; badgeText = "NOTE OFF"; }
    else if (ev.type === "cc") { badgeClass = "badge-cc"; badgeText = "CC"; }
    else if (ev.type === "pitchbend") { badgeClass = "badge-pitchbend"; badgeText = "PITCH BEND"; }
    else if (ev.type === "aftertouch") { badgeClass = "badge-aftertouch"; badgeText = "AFTERTOUCH"; }
    else if (ev.type === "polyaftertouch") { badgeClass = "badge-polyaftertouch"; badgeText = "POLY AT"; }
    else if (ev.type === "sysex") { badgeClass = "badge-sysex"; badgeText = "SYSEX"; }
    else if (ev.type === "clock") { badgeClass = "badge-clock"; badgeText = "CLOCK"; }

    let targetDesc = ev.desc || "-";
    if (ev.type === "cc") {
      const matchedIndices = this.ccToKnobMap.get(ev.controller);
      if (matchedIndices && matchedIndices.length > 0) {
        const k = this.state.knobs[matchedIndices[0]];
        if (k) targetDesc = `CC ${ev.controller} [${k.name}]`;
      }
    }

    row.innerHTML = `
      <span class="col-time">${timeStr}</span>
      <span class="col-type"><span class="badge ${badgeClass}">${badgeText}</span></span>
      <span class="col-ch">${ev.channel ? "Ch " + ev.channel : "-"}</span>
      <span class="col-target">${targetDesc}</span>
      <span class="col-val">${ev.details || "-"}</span>
      <span class="col-hex">${ev.rawHex}</span>
    `;

    // Queue row to be flushed on next animation frame
    this.pendingStreamRows.push(row);
  }

  requestRafFlush() {
    if (!this.rafPending) {
      this.rafPending = true;
      requestAnimationFrame(() => this.flushUiUpdates());
    }
  }

  flushUiUpdates() {
    this.rafPending = false;

    // 1. Flush dirty knob transforms & badges
    if (this.dirtyKnobs.size > 0) {
      for (const idx of this.dirtyKnobs) {
        const dom = this.knobDoms[idx];
        if (!dom) continue;
        const val = this.state.knobs[idx]?.currentVal;
        if (val !== undefined && dom.lastVal !== val) {
          dom.lastVal = val;
          const angle = -135 + (val / 127) * 270;
          dom.indicator.style.transform = `rotate(${angle}deg) translateZ(0)`;
          dom.valBadge.textContent = `Val: ${val}`;
        }
      }
      this.dirtyKnobs.clear();
    }

    // 2. Batch-append pending stream rows in a single fragment with 1 reflow
    if (this.pendingStreamRows.length > 0 && this.streamTableBody) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < this.pendingStreamRows.length; i++) {
        fragment.appendChild(this.pendingStreamRows[i]);
      }
      this.streamTableBody.appendChild(fragment);
      this.pendingStreamRows = [];

      // Prune excess rows beyond 200
      const excess = this.streamTableBody.children.length - 200;
      if (excess > 0) {
        for (let i = 0; i < excess; i++) {
          this.streamTableBody.removeChild(this.streamTableBody.firstElementChild);
        }
      }

      // Single synchronous scroll computation per display frame
      if (this.autoScrollCheck?.checked) {
        this.streamTableBody.scrollTop = this.streamTableBody.scrollHeight;
      }
    }

    // 3. Flush event counter text
    if (this.eventCounter && this.pendingEventCountUpdate) {
      this.eventCounter.textContent = `${this.eventCount} Events`;
      this.pendingEventCountUpdate = false;
    }
  }

  rebuildCcToKnobMap() {
    this.ccToKnobMap.clear();
    for (let i = 0; i < 8; i++) {
      const knob = this.state.knobs[i];
      if (knob && knob.cc !== undefined) {
        if (!this.ccToKnobMap.has(knob.cc)) {
          this.ccToKnobMap.set(knob.cc, []);
        }
        this.ccToKnobMap.get(knob.cc).push(i);
      }
    }
  }

  populateDropdowns() {
    // 128 Internal Sounds
    this.kbdSoundSelect.innerHTML = "";
    SOUND_NAMES.forEach((name, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `${(idx + 1).toString().padStart(3, "0")} — ${name}`;
      this.kbdSoundSelect.appendChild(opt);
    });

    // 10 Drum Kits
    this.padSoundSelect.innerHTML = "";
    DRUM_KIT_NAMES.forEach((name, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `Kit ${idx + 1}: ${name}`;
      this.padSoundSelect.appendChild(opt);
    });

    // Time divisions
    this.arpTimeDiv.innerHTML = "";
    TIME_DIVISIONS.forEach((td, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = td;
      this.arpTimeDiv.appendChild(opt);
    });

    // Swing (50% to 75%)
    this.arpSwing.innerHTML = "";
    for (let i = 0; i <= 25; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${50 + i}% ${i === 0 ? "(Off)" : ""}`;
      this.arpSwing.appendChild(opt);
    }

    // Arp Modes
    this.arpMode.innerHTML = "";
    ARP_MODES.forEach((mode, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = mode;
      this.arpMode.appendChild(opt);
    });

    // MIDI Channels 1-16
    [this.keysChannel, this.padChannel].forEach(sel => {
      sel.innerHTML = "";
      for (let ch = 0; ch < 16; ch++) {
        const opt = document.createElement("option");
        opt.value = ch;
        opt.textContent = `Channel ${ch + 1}`;
        sel.appendChild(opt);
      }
    });

    // Joystick Modes
    [this.joyXMode, this.joyYMode].forEach(sel => {
      sel.innerHTML = "";
      JOYSTICK_MODES.forEach((mode, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = mode;
        sel.appendChild(opt);
      });
    });
  }

  renderPianoKeys() {
    this.pianoKeysContainer.innerHTML = "";
    this.pianoKeyDoms.clear();
    // 25 Keys from C2 (MIDI 48) to C4 (MIDI 72)
    const baseNote = 48;
    const isBlackMap = [false, true, false, true, false, false, true, false, true, false, true, false];

    for (let i = 0; i <= 24; i++) {
      const note = baseNote + i;
      const isBlack = isBlackMap[note % 12];
      const key = document.createElement("div");
      key.className = `piano-key ${isBlack ? "black" : "white"}`;
      key.dataset.note = note;
      this.pianoKeyDoms.set(note, key);

      const label = document.createElement("span");
      label.className = "key-label";
      label.textContent = midiNoteToName(note);
      key.appendChild(label);

      // Play note on press
      const triggerKey = (e) => {
        e.preventDefault();
        key.classList.add("pressed");
        this.audio.playNote(note);
        setTimeout(() => key.classList.remove("pressed"), 200);
      };

      key.addEventListener("mousedown", triggerKey);
      key.addEventListener("touchstart", triggerKey, { passive: false });

      this.pianoKeysContainer.appendChild(key);
    }
  }

  renderPads() {
    this.padsGrid.innerHTML = "";
    this.padDoms = [];
    const offset = this.activePadBank === "A" ? 0 : 8;

    // Physical MPC 4x2 geometry:
    // Top Row:    Pads 5, 6, 7, 8   (rel indices 4, 5, 6, 7)
    // Bottom Row: Pads 1, 2, 3, 4   (rel indices 0, 1, 2, 3)
    const padOrder = [4, 5, 6, 7, 0, 1, 2, 3];

    for (const relIdx of padOrder) {
      const padIndex = offset + relIdx;
      const note = this.state.pads[padIndex];

      const pad = document.createElement("div");
      pad.className = "drum-pad";
      pad.dataset.padIndex = padIndex;
      this.padDoms[padIndex] = pad;

      // Top row
      const topRow = document.createElement("div");
      topRow.className = "pad-top-row";
      const numSpan = document.createElement("span");
      numSpan.className = "pad-num";
      numSpan.textContent = `PAD ${padIndex + 1}`;
      topRow.appendChild(numSpan);
      pad.appendChild(topRow);

      // Center Note Name
      const noteDisplay = document.createElement("div");
      noteDisplay.className = "pad-note-display";
      noteDisplay.textContent = midiNoteToName(note);
      pad.appendChild(noteDisplay);

      // Bottom Note Edit input
      const noteInput = document.createElement("input");
      noteInput.type = "number";
      noteInput.className = "pad-edit-input";
      noteInput.min = "0";
      noteInput.max = "127";
      noteInput.value = note;
      noteInput.title = `MIDI Note: ${note}`;
      noteInput.addEventListener("click", (e) => e.stopPropagation());
      noteInput.addEventListener("change", (e) => {
        const val = Math.max(0, Math.min(127, parseInt(e.target.value) || 0));
        this.state.pads[padIndex] = val;
        noteDisplay.textContent = midiNoteToName(val);
        this.sendToHardwareRamIfLive();
      });
      pad.appendChild(noteInput);

      // Audition on click
      pad.addEventListener("click", () => {
        pad.classList.add("hit");
        this.audio.playDrum(padIndex);
        setTimeout(() => pad.classList.remove("hit"), 150);
      });

      this.padsGrid.appendChild(pad);
    }
  }

  renderKnobs() {
    this.knobsGrid.innerHTML = "";
    this.knobDoms = [];

    for (let i = 0; i < 8; i++) {
      const knob = this.state.knobs[i];
      const isBankA = i < 4;
      const bankLabel = isBankA ? "Bank A" : "Bank B";
      const kNum = i + 1;

      const unit = document.createElement("div");
      unit.className = "knob-unit";
      unit.dataset.knobIndex = i;

      // Knob Header (K1-K8 and Bank badge)
      const header = document.createElement("div");
      header.className = "knob-header";
      header.innerHTML = `
        <span class="knob-num">K${kNum}</span>
        <span class="knob-bank-badge ${isBankA ? "bank-a" : "bank-b"}">${bankLabel}</span>
      `;
      unit.appendChild(header);

      // Editable Name
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "knob-name-input";
      nameInput.maxLength = 14;
      nameInput.value = knob.name;
      nameInput.title = "Knob Parameter Name (14 chars max)";
      nameInput.addEventListener("change", (e) => {
        knob.name = e.target.value.trim() || `Knob ${kNum}`;
      });
      unit.appendChild(nameInput);

      // Visual Rotary Dial
      const dial = document.createElement("div");
      dial.className = "knob-dial-visual";
      dial.title = "Click & drag up/down or roll mouse wheel. Double-click to reset.";
      const indicator = document.createElement("div");
      indicator.className = "knob-indicator";
      const currentVal = knob.currentVal !== undefined ? knob.currentVal : 0;
      const angle = -135 + (currentVal / 127) * 270;
      indicator.style.transform = `rotate(${angle}deg) translateZ(0)`;
      dial.appendChild(indicator);
      unit.appendChild(dial);

      // Live Value Display Badge
      const valBadge = document.createElement("div");
      valBadge.className = "knob-val-badge";
      valBadge.textContent = knob.currentVal !== undefined ? `Val: ${knob.currentVal}` : "Val: --";
      unit.appendChild(valBadge);

      // Interactive Pointer Dragging for UI Knob manipulation
      let isDragging = false;
      let startY = 0;
      let startVal = 0;

      const onPointerDown = (e) => {
        isDragging = true;
        startY = e.clientY;
        startVal = knob.currentVal !== undefined ? knob.currentVal : 0;
        dial.setPointerCapture(e.pointerId);
        dial.classList.add("active-drag");
        e.preventDefault();
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const deltaY = startY - e.clientY;
        const sensitivity = e.shiftKey ? 0.2 : 0.65;
        const rawVal = startVal + deltaY * sensitivity;
        const newVal = Math.max(0, Math.min(127, Math.round(rawVal)));

        if (newVal !== knob.currentVal) {
          knob.currentVal = newVal;
          const a = -135 + (newVal / 127) * 270;
          indicator.style.transform = `rotate(${a}deg) translateZ(0)`;
          valBadge.textContent = `Val: ${newVal}`;
          if (this.knobDoms[i]) this.knobDoms[i].lastVal = newVal;

          // Transmit MIDI CC live to controller/sound engine
          this.midiManager.sendCc(knob.cc, newVal, this.state.keysChannel + 1);
        }
      };

      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        try { dial.releasePointerCapture(e.pointerId); } catch (_) {}
        dial.classList.remove("active-drag");
        this.sendToHardwareRamIfLive();
      };

      dial.addEventListener("pointerdown", onPointerDown);
      dial.addEventListener("pointermove", onPointerMove);
      dial.addEventListener("pointerup", onPointerUp);
      dial.addEventListener("pointercancel", onPointerUp);

      // Mouse Wheel Support
      dial.addEventListener("wheel", (e) => {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 4;
        const delta = e.deltaY < 0 ? step : -step;
        const current = knob.currentVal !== undefined ? knob.currentVal : 0;
        const newVal = Math.max(0, Math.min(127, current + delta));
        if (newVal !== current) {
          knob.currentVal = newVal;
          const a = -135 + (newVal / 127) * 270;
          indicator.style.transform = `rotate(${a}deg) translateZ(0)`;
          valBadge.textContent = `Val: ${newVal}`;
          if (this.knobDoms[i]) this.knobDoms[i].lastVal = newVal;
          this.midiManager.sendCc(knob.cc, newVal, this.state.keysChannel + 1);
          this.sendToHardwareRamIfLive();
        }
      }, { passive: false });

      // Double-click to reset to min value
      dial.addEventListener("dblclick", () => {
        const newVal = knob.min !== undefined ? knob.min : 0;
        knob.currentVal = newVal;
        const a = -135 + (newVal / 127) * 270;
        indicator.style.transform = `rotate(${a}deg) translateZ(0)`;
        valBadge.textContent = `Val: ${newVal}`;
        if (this.knobDoms[i]) this.knobDoms[i].lastVal = newVal;
        this.midiManager.sendCc(knob.cc, newVal, this.state.keysChannel + 1);
        this.sendToHardwareRamIfLive();
      });

      // CC Number row
      const ccRow = document.createElement("div");
      ccRow.className = "knob-cc-row";
      ccRow.innerHTML = `<span>CC:</span>`;
      const ccInput = document.createElement("input");
      ccInput.type = "number";
      ccInput.className = "knob-cc-input";
      ccInput.min = "0";
      ccInput.max = "127";
      ccInput.value = knob.cc;
      ccInput.addEventListener("change", (e) => {
        const val = Math.max(0, Math.min(127, parseInt(e.target.value) || 0));
        knob.cc = val;
        this.rebuildCcToKnobMap();
        this.sendToHardwareRamIfLive();
      });
      ccRow.appendChild(ccInput);
      unit.appendChild(ccRow);

      // Range row (Min - Max)
      const rangeRow = document.createElement("div");
      rangeRow.className = "knob-cc-row";
      rangeRow.innerHTML = `
        <span style="font-size: 0.65rem;">Min: ${knob.min}</span>
        <span style="font-size: 0.65rem;">Max: ${knob.max}</span>
      `;
      unit.appendChild(rangeRow);

      this.knobsGrid.appendChild(unit);

      // Pre-cache DOM element references for O(1) instantaneous access
      this.knobDoms[i] = {
        unit,
        dial,
        indicator,
        valBadge,
        ccInput,
        nameInput,
        turningTimer: null,
        lastVal: currentVal
      };
    }

    this.rebuildCcToKnobMap();
  }

  updateCurveGraph() {
    const p1 = this.state.keyCurve.p1;
    const p2 = this.state.keyCurve.p2;
    const p3 = this.state.keyCurve.p3;
    const p4 = this.state.keyCurve.p4;

    // SVG coordinate space: 300 width, 140 height (y=140 is bottom/0, y=0 is top/16383)
    const mapY = (val) => 140 - (val / 16383) * 140;

    const y1 = mapY(p1);
    const y2 = mapY(p2);
    const y3 = mapY(p3);
    const y4 = mapY(p4);

    this.cpP1.setAttribute("cy", y1);
    this.cpP2.setAttribute("cy", y2);
    this.cpP3.setAttribute("cy", y3);
    this.cpP4.setAttribute("cy", y4);

    // Multi-segment smooth curve
    const pathD = `M 0 140 C 30 ${y1}, 60 ${y1}, 60 ${y1} S 120 ${y2}, 120 ${y2} S 180 ${y3}, 180 ${y3} S 240 ${y4}, 300 0`;
    this.curvePath.setAttribute("d", pathD);
    this.curveArea.setAttribute("d", `${pathD} L 300 140 L 0 140 Z`);
  }

  updateUIFromState() {
    this.presetNameInput.value = this.state.name;

    // Sound & FX
    this.kbdSoundSelect.value = this.state.sound.keyboard;
    this.padSoundSelect.value = this.state.sound.pad;

    this.fxFilter.value = this.state.sound.filter;
    this.fxFilterVal.textContent = this.state.sound.filter;

    this.fxReso.value = this.state.sound.resonance;
    this.fxResoVal.textContent = this.state.sound.resonance;

    this.fxAttack.value = this.state.sound.attack;
    this.fxAttackVal.textContent = this.state.sound.attack;

    this.fxRelease.value = this.state.sound.release;
    this.fxReleaseVal.textContent = this.state.sound.release;

    this.fxReverb.value = this.state.sound.reverb;
    this.fxReverbVal.textContent = this.state.sound.reverb;

    this.fxChorus.value = this.state.sound.chorus;
    this.fxChorusVal.textContent = this.state.sound.chorus;

    this.fxEqLow.value = this.state.sound.eqLow;
    this.fxEqLowVal.textContent = `${this.state.sound.eqLow - 64 > 0 ? "+" : ""}${this.state.sound.eqLow - 64} (${this.state.sound.eqLow})`;

    this.fxEqHigh.value = this.state.sound.eqHigh;
    this.fxEqHighVal.textContent = `${this.state.sound.eqHigh - 64 > 0 ? "+" : ""}${this.state.sound.eqHigh - 64} (${this.state.sound.eqHigh})`;

    // Arp & Routing
    this.arpOn.checked = !!this.state.arp.on;
    this.arpTempo.value = this.state.arp.tempo;
    this.arpTimeDiv.value = this.state.arp.timeDiv;
    this.arpSwing.value = this.state.arp.swing;
    this.arpOctave.value = this.state.arp.octave;
    this.arpMode.value = this.state.arp.mode;
    this.arpClock.value = this.state.arp.clock;
    this.keysChannel.value = this.state.keysChannel;
    this.padChannel.value = this.state.padChannel;
    this.aftertouchSelect.value = this.state.aftertouch;

    // Octave & Transpose
    this.octValDisplay.textContent = this.state.octave;
    this.transValDisplay.textContent = this.state.transpose;

    // Joystick
    this.joyXMode.value = this.state.joystick.xMode;
    this.joyXCc1.value = this.state.joystick.xCc1;
    this.joyXCc2.value = this.state.joystick.xCc2;
    this.joyYMode.value = this.state.joystick.yMode;
    this.joyYCc1.value = this.state.joystick.yCc1;
    this.joyYCc2.value = this.state.joystick.yCc2;

    // Curve
    this.curveP1.value = this.state.keyCurve.p1;
    this.curveP2.value = this.state.keyCurve.p2;
    this.curveP3.value = this.state.keyCurve.p3;
    this.curveP4.value = this.state.keyCurve.p4;
    this.curveBlackBal.value = this.state.keyCurve.blackBalance;

    this.renderPads();
    this.renderKnobs();
    this.updateCurveGraph();
  }

  async readConfigFromHardware(slot = this.selectedSlot, userInitiated = true) {
    if (!this.midiManager.selectedInput || !this.midiManager.selectedOutput) {
      if (userInitiated) {
        this.log("Cannot read configuration: MPK Mini Play is not connected.", "warn");
        alert("Please connect your MPK Mini Play mk3 first.");
      }
      return false;
    }

    try {
      this.log(`Reading configuration from hardware Favorite ${slot + 1} (SysEx 0x66)...`, "info");
      const res = await this.midiManager.requestFavorite(slot);
      this.log(`Received Favorite ${res.slot + 1} data from hardware (${res.payload.length} bytes)!`, "success");

      if (res.payload.length === 215) {
        this.state = parseHardwareSysExPayload(res.payload);
        try {
          this.currentTemplate = serializeMpkFile(this.state, this.currentTemplate);
        } catch (e) {}
      } else if (res.payload.length === 269) {
        this.currentTemplate.set(res.payload, 0x24);
        this.state = parseMpkFile(this.currentTemplate);
      } else {
        throw new Error(`Unexpected payload length: ${res.payload.length} bytes`);
      }

      this.selectedSlot = res.slot;
      this.slotButtons.forEach(btn => {
        btn.classList.toggle("active", parseInt(btn.dataset.slot) === res.slot);
      });
      this.updateUIFromState();
      this.log(`Hardware mapping synchronized: Pads [${this.state.pads.slice(0, 4).map(n => midiNoteToName(n)).join(", ")}...] | Knobs CC [${this.state.knobs.map(k => k.cc).join(", ")}]`, "success");
      return true;
    } catch (err) {
      if (userInitiated) {
        this.log(`Error reading from hardware: ${err.message}`, "warn");
        alert(`Could not read configuration from MPK: ${err.message}`);
      } else {
        this.log(`Hardware auto-read: ${err.message}. Using active preset profile.`, "info");
      }
      return false;
    }
  }

  sendToHardwareRamIfLive() {
    if (!this.liveRamEnabled) return;
    try {
      const payload = serializeHardwareSysExPayload(this.state);
      this.midiManager.sendToRam(payload);
    } catch (err) {
      console.warn("Live RAM update failed:", err.message);
    }
  }

  bindEvents() {
    // Live MIDI Stream monitoring callback
    this.midiManager.onMidiEvent = (ev) => this.handleIncomingMidi(ev);

    // MIDI Logging callback
    this.midiManager.onMessageLog = (msg, type) => this.log(msg, type);

    // MIDI Status callback
    this.midiManager.onStatusChange = (info) => {
      if (info.connected) {
        this.connPill.classList.add("connected");
        this.connStatusText.textContent = `Connected: ${info.inputName}`;
      } else {
        this.connPill.classList.remove("connected");
        this.connStatusText.textContent = "Disconnected";
      }

      // Update ports
      this.midiInSelect.innerHTML = "";
      info.inputs.forEach(port => {
        const opt = document.createElement("option");
        opt.value = port.id;
        opt.textContent = port.name;
        opt.selected = this.midiManager.selectedInput?.id === port.id;
        this.midiInSelect.appendChild(opt);
      });

      this.midiOutSelect.innerHTML = "";
      info.outputs.forEach(port => {
        const opt = document.createElement("option");
        opt.value = port.id;
        opt.textContent = port.name;
        opt.selected = this.midiManager.selectedOutput?.id === port.id;
        this.midiOutSelect.appendChild(opt);
      });
    };

    // Connect MIDI Button
    this.connectMidiBtn.addEventListener("click", async () => {
      try {
        this.log("Requesting Web MIDI API access with SysEx...", "info");
        await this.midiManager.init();
        this.log("Web MIDI initialized successfully!", "success");
        // Auto-read current hardware configuration from the keyboard
        await this.readConfigFromHardware(this.selectedSlot, false);
      } catch (err) {
        this.log(`MIDI Error: ${err.message}`, "warn");
        alert(err.message);
      }
    });

    this.midiInSelect.addEventListener("change", (e) => {
      this.midiManager.selectInput(e.target.value);
    });

    this.midiOutSelect.addEventListener("change", (e) => {
      this.midiManager.selectOutput(e.target.value);
    });

    // Slots buttons 1-8
    this.slotButtons.forEach(btn => {
      btn.addEventListener("click", async () => {
        this.slotButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.selectedSlot = parseInt(btn.dataset.slot) || 0;
        this.log(`Selected Hardware Favorite Slot ${this.selectedSlot + 1}`);
        if (this.midiManager.selectedInput && this.midiManager.selectedOutput) {
          await this.readConfigFromHardware(this.selectedSlot, false);
        }
      });
    });

    // Template Dropdown
    this.factoryPresetSelect.addEventListener("change", (e) => {
      const key = e.target.value;
      if (this.templates[key]) {
        this.currentTemplate = new Uint8Array(this.templates[key]);
        this.state = parseMpkFile(this.currentTemplate);
        this.updateUIFromState();
        this.log(`Loaded template: ${e.target.options[e.target.selectedIndex].text}`, "success");
        this.sendToHardwareRamIfLive();
      }
    });

    // Live RAM toggle
    this.sendRamBtn.addEventListener("click", () => {
      this.liveRamEnabled = !this.liveRamEnabled;
      if (this.liveRamEnabled) {
        this.sendRamBtn.classList.add("active");
        this.log("⚡ Live RAM audition mode ENABLED. Parameters will update hardware instantly.", "success");
        this.sendToHardwareRamIfLive();
      } else {
        this.sendRamBtn.classList.remove("active");
        this.log("Live RAM audition mode DISABLED.", "info");
      }
    });

    // Get Device (Cmd 0x66)
    this.getDeviceBtn.addEventListener("click", async () => {
      await this.readConfigFromHardware(this.selectedSlot, true);
    });

    // Send Device (Cmd 0x64 to Flash AND RAM)
    this.sendDeviceBtn.addEventListener("click", () => {
      try {
        const payload = serializeHardwareSysExPayload(this.state);
        // 1. Permanently write to Flash slot 1-8
        this.midiManager.sendFavorite(this.selectedSlot, payload);
        // 2. Immediately activate in Hardware RAM (updates sound engine with zero user intervention)
        this.midiManager.sendToRam(payload);

        this.log(`Favorite ${this.selectedSlot + 1} saved to Flash & activated in RAM!`, "success");
        alert(
          `Favorite ${this.selectedSlot + 1} sent to hardware!\n\n` +
          `• Saved to Flash Memory: Yes (written via SysEx without user intervention)\n` +
          `• Activated in Sound Engine: Yes (RAM updated via SysEx, live immediately)\n\n` +
          `Hardware Shortcuts (for standalone use):\n` +
          `• To recall a Favorite on hardware: Hold FAVORITES and press Pad 1–8.\n` +
          `• To save settings manually on hardware: Hold FAVORITES + INTERNAL SOUNDS and press Pad 1–8.`
        );
      } catch (err) {
        this.log(`Error sending preset: ${err.message}`, "warn");
        alert(err.message);
      }
    });

    // Open File
    this.openFileBtn.addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        this.currentTemplate = new Uint8Array(buffer);
        this.state = parseMpkFile(this.currentTemplate);
        this.updateUIFromState();
        this.log(`Opened preset file: "${file.name}" (${file.size} bytes)`, "success");
        this.sendToHardwareRamIfLive();
      } catch (err) {
        this.log(`Failed to open preset: ${err.message}`, "warn");
        alert(`Error: ${err.message}`);
      }
    });

    // Export File
    this.saveFileBtn.addEventListener("click", () => {
      try {
        const serialized = serializeMpkFile(this.state, this.currentTemplate);
        const blob = new Blob([serialized], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const cleanName = this.state.name.replace(/[^a-zA-Z0-9_\-]/g, "_") || "Preset";
        a.href = url;
        a.download = `${cleanName}.mpkminiplaymk3`;
        a.click();
        URL.revokeObjectURL(url);
        this.log(`Exported native preset file: "${cleanName}.mpkminiplaymk3" (2,123 bytes)`, "success");
      } catch (err) {
        this.log(`Export error: ${err.message}`, "warn");
      }
    });

    // Preset Name input
    this.presetNameInput.addEventListener("input", (e) => {
      this.state.name = e.target.value;
    });

    // FX Sliders
    const bindFx = (slider, display, key, suffix = "") => {
      slider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        this.state.sound[key] = val;
        display.textContent = `${val}${suffix}`;
        this.sendToHardwareRamIfLive();
      });
    };

    bindFx(this.fxFilter, this.fxFilterVal, "filter");
    bindFx(this.fxReso, this.fxResoVal, "resonance");
    bindFx(this.fxAttack, this.fxAttackVal, "attack");
    bindFx(this.fxRelease, this.fxReleaseVal, "release");
    bindFx(this.fxReverb, this.fxReverbVal, "reverb");
    bindFx(this.fxChorus, this.fxChorusVal, "chorus");

    this.fxEqLow.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      this.state.sound.eqLow = val;
      const diff = val - 64;
      this.fxEqLowVal.textContent = `${diff > 0 ? "+" : ""}${diff} (${val})`;
      this.sendToHardwareRamIfLive();
    });

    this.fxEqHigh.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      this.state.sound.eqHigh = val;
      const diff = val - 64;
      this.fxEqHighVal.textContent = `${diff > 0 ? "+" : ""}${diff} (${val})`;
      this.sendToHardwareRamIfLive();
    });

    // Sound Selectors
    this.kbdSoundSelect.addEventListener("change", (e) => {
      this.state.sound.keyboard = parseInt(e.target.value);
      this.sendToHardwareRamIfLive();
    });

    this.padSoundSelect.addEventListener("change", (e) => {
      this.state.sound.pad = parseInt(e.target.value);
      this.sendToHardwareRamIfLive();
    });

    // Arp & Channel Controls
    this.arpOn.addEventListener("change", (e) => {
      this.state.arp.on = e.target.checked ? 1 : 0;
      this.sendToHardwareRamIfLive();
    });

    this.arpTempo.addEventListener("change", (e) => {
      this.state.arp.tempo = Math.max(60, Math.min(240, parseInt(e.target.value) || 120));
      this.sendToHardwareRamIfLive();
    });

    this.arpTimeDiv.addEventListener("change", (e) => {
      this.state.arp.timeDiv = parseInt(e.target.value);
      this.sendToHardwareRamIfLive();
    });

    this.arpSwing.addEventListener("change", (e) => {
      this.state.arp.swing = parseInt(e.target.value);
      this.sendToHardwareRamIfLive();
    });

    this.arpOctave.addEventListener("change", (e) => {
      this.state.arp.octave = parseInt(e.target.value);
      this.sendToHardwareRamIfLive();
    });

    this.arpMode.addEventListener("change", (e) => {
      this.state.arp.mode = parseInt(e.target.value);
      this.sendToHardwareRamIfLive();
    });

    this.arpClock.addEventListener("change", (e) => {
      this.state.arp.clock = parseInt(e.target.value);
      this.sendToHardwareRamIfLive();
    });

    this.keysChannel.addEventListener("change", (e) => {
      this.state.keysChannel = parseInt(e.target.value);
      this.sendToHardwareRamIfLive();
    });

    this.padChannel.addEventListener("change", (e) => {
      this.state.padChannel = parseInt(e.target.value);
      this.sendToHardwareRamIfLive();
    });

    this.aftertouchSelect.addEventListener("change", (e) => {
      this.state.aftertouch = parseInt(e.target.value);
      this.sendToHardwareRamIfLive();
    });

    // Bank Tabs
    this.bankTabA.addEventListener("click", () => {
      this.activePadBank = "A";
      this.bankTabA.classList.add("active");
      this.bankTabB.classList.remove("active");
      this.renderPads();
    });

    this.bankTabB.addEventListener("click", () => {
      this.activePadBank = "B";
      this.bankTabB.classList.add("active");
      this.bankTabA.classList.remove("active");
      this.renderPads();
    });

    // Octave & Transpose +/-
    this.octDownBtn.addEventListener("click", () => {
      if (this.state.octave > -4) {
        this.state.octave--;
        this.octValDisplay.textContent = this.state.octave;
        this.sendToHardwareRamIfLive();
      }
    });

    this.octUpBtn.addEventListener("click", () => {
      if (this.state.octave < 4) {
        this.state.octave++;
        this.octValDisplay.textContent = this.state.octave;
        this.sendToHardwareRamIfLive();
      }
    });

    this.transDownBtn.addEventListener("click", () => {
      if (this.state.transpose > -12) {
        this.state.transpose--;
        this.transValDisplay.textContent = this.state.transpose;
        this.sendToHardwareRamIfLive();
      }
    });

    this.transUpBtn.addEventListener("click", () => {
      if (this.state.transpose < 12) {
        this.state.transpose++;
        this.transValDisplay.textContent = this.state.transpose;
        this.sendToHardwareRamIfLive();
      }
    });

    // Joystick Touchpad Drag with robust Pointer Events
    let isDraggingJoy = false;

    const sendJoyMidi = (normX, normY) => {
      // normX: -1 (left) to +1 (right)
      // normY: -1 (up) to +1 (down)
      if (!this.midiManager?.selectedOutput) return;
      const ch = (this.state.keysChannel & 0x0F);

      // X Axis
      if (this.state.joystick.xMode === 0) { // Pitchbend
        const bend = Math.round(normX * 8191) + 8192;
        this.midiManager.sendRaw([0xE0 | ch, bend & 0x7F, (bend >> 7) & 0x7F]);
      } else if (this.state.joystick.xMode === 1 && normX > 0) { // Single CC
        this.midiManager.sendRaw([0xB0 | ch, this.state.joystick.xCc1, Math.round(normX * 127)]);
      } else if (this.state.joystick.xMode === 2) { // Dual CC
        if (normX >= 0) {
          this.midiManager.sendRaw([0xB0 | ch, this.state.joystick.xCc1, Math.round(normX * 127)]);
        } else {
          this.midiManager.sendRaw([0xB0 | ch, this.state.joystick.xCc2, Math.round(-normX * 127)]);
        }
      }

      // Y Axis (up is negative normY in screen coordinates)
      const upAmount = Math.max(0, -normY);
      const downAmount = Math.max(0, normY);

      if (this.state.joystick.yMode === 0) { // Pitchbend
        const bend = Math.round(-normY * 8191) + 8192;
        this.midiManager.sendRaw([0xE0 | ch, bend & 0x7F, (bend >> 7) & 0x7F]);
      } else if (this.state.joystick.yMode === 1) { // Single CC (Modulation)
        this.midiManager.sendRaw([0xB0 | ch, this.state.joystick.yCc1, Math.round(upAmount * 127)]);
      } else if (this.state.joystick.yMode === 2) { // Dual CC
        if (upAmount > 0) {
          this.midiManager.sendRaw([0xB0 | ch, this.state.joystick.yCc1, Math.round(upAmount * 127)]);
        } else {
          this.midiManager.sendRaw([0xB0 | ch, this.state.joystick.yCc2, Math.round(downAmount * 127)]);
        }
      }
    };

    const resetJoyMidi = () => {
      if (!this.midiManager?.selectedOutput) return;
      const ch = (this.state.keysChannel & 0x0F);
      this.midiManager.sendRaw([0xE0 | ch, 0x00, 0x40]); // Pitchbend center
      if (this.state.joystick.xCc1) this.midiManager.sendRaw([0xB0 | ch, this.state.joystick.xCc1, 0]);
      if (this.state.joystick.xCc2) this.midiManager.sendRaw([0xB0 | ch, this.state.joystick.xCc2, 0]);
      if (this.state.joystick.yCc1) this.midiManager.sendRaw([0xB0 | ch, this.state.joystick.yCc1, 0]);
      if (this.state.joystick.yCc2) this.midiManager.sendRaw([0xB0 | ch, this.state.joystick.yCc2, 0]);
    };

    const handleJoyMove = (e) => {
      if (!isDraggingJoy) return;
      const rect = this.joystickPad.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      this.joystickThumb.style.left = `${x}px`;
      this.joystickThumb.style.top = `${y}px`;

      const normX = ((x / rect.width) - 0.5) * 2;
      const normY = ((y / rect.height) - 0.5) * 2;
      sendJoyMidi(normX, normY);
    };

    const handleJoyRelease = (e) => {
      if (isDraggingJoy) {
        isDraggingJoy = false;
        this.joystickPad.classList.remove("is-dragging");
        try {
          if (e && e.pointerId && this.joystickPad.hasPointerCapture(e.pointerId)) {
            this.joystickPad.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}

        // Snap back to original center position (50%, 50%)
        this.joystickThumb.style.left = "50%";
        this.joystickThumb.style.top = "50%";
        resetJoyMidi();
      }
    };

    this.joystickPad.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      isDraggingJoy = true;
      this.joystickPad.classList.add("is-dragging");
      try {
        this.joystickPad.setPointerCapture(e.pointerId);
      } catch (_) {}
      handleJoyMove(e);
    });

    this.joystickPad.addEventListener("pointermove", handleJoyMove);
    this.joystickPad.addEventListener("pointerup", handleJoyRelease);
    this.joystickPad.addEventListener("pointercancel", handleJoyRelease);
    this.joystickPad.addEventListener("lostpointercapture", handleJoyRelease);
    window.addEventListener("pointerup", handleJoyRelease);

    // Velocity Curve controls
    const bindCurveInput = (input, key) => {
      input.addEventListener("input", (e) => {
        this.state.keyCurve[key] = Math.max(0, Math.min(16383, parseInt(e.target.value) || 0));
        this.updateCurveGraph();
      });
    };

    bindCurveInput(this.curveP1, "p1");
    bindCurveInput(this.curveP2, "p2");
    bindCurveInput(this.curveP3, "p3");
    bindCurveInput(this.curveP4, "p4");

    this.curveBlackBal.addEventListener("input", (e) => {
      this.state.keyCurve.blackBalance = Math.max(0, Math.min(127, parseInt(e.target.value) || 64));
    });

    this.sendCurveBtn.addEventListener("click", () => {
      try {
        const { p1, p2, p3, p4, blackBalance } = this.state.keyCurve;
        this.midiManager.sendKeyCurve(p1, p2, p3, p4, blackBalance);
        this.log(`Keybed velocity sensitivity curve sent to hardware (Opcode 0x13).`, "success");
      } catch (err) {
        this.log(`Error sending curve: ${err.message}`, "warn");
        alert(err.message);
      }
    });

    // Monitor Drawer Tab Switching
    this.tabStreamBtn?.addEventListener("click", () => {
      this.tabStreamBtn.classList.add("active");
      this.tabSysExBtn.classList.remove("active");
      if (this.streamView) this.streamView.style.display = "block";
      if (this.sysexView) this.sysexView.style.display = "none";
    });

    this.tabSysExBtn?.addEventListener("click", () => {
      this.tabSysExBtn.classList.add("active");
      this.tabStreamBtn.classList.remove("active");
      if (this.sysexView) this.sysexView.style.display = "block";
      if (this.streamView) this.streamView.style.display = "none";
    });

    // Clear Monitor Logs
    this.clearLogBtn?.addEventListener("click", () => {
      if (this.streamTableBody) this.streamTableBody.innerHTML = "";
      if (this.logTerminal) this.logTerminal.innerHTML = "";
      this.eventCount = 0;
      if (this.eventCounter) this.eventCounter.textContent = "0 Events";
    });

    // Sound Audition Preview persistence
    if (this.soundPreviewOnRx) {
      const savedAudition = localStorage.getItem("akai_sound_preview_on_rx");
      if (savedAudition !== null) {
        this.soundPreviewOnRx.checked = savedAudition === "true";
      }
      this.soundPreviewOnRx.addEventListener("change", (e) => {
        localStorage.setItem("akai_sound_preview_on_rx", e.target.checked);
      });
    }

    // Mode Notice Banner dismiss logic
    if (this.closeNoticeBtn && this.modeNoticeBanner) {
      if (localStorage.getItem("akai_dismiss_mode_notice") === "true") {
        this.modeNoticeBanner.style.display = "none";
      }
      this.closeNoticeBtn.addEventListener("click", () => {
        this.modeNoticeBanner.style.opacity = "0";
        this.modeNoticeBanner.style.transform = "translateY(-6px)";
        setTimeout(() => {
          this.modeNoticeBanner.style.display = "none";
          localStorage.setItem("akai_dismiss_mode_notice", "true");
        }, 200);
      });
    }

    // Computer keyboard mapping for piano keys
    const keyMap = {
      "KeyA": 48, "KeyW": 49, "KeyS": 50, "KeyE": 51, "KeyD": 52,
      "KeyF": 53, "KeyT": 54, "KeyG": 55, "KeyY": 56, "KeyH": 57,
      "KeyU": 58, "KeyJ": 59, "KeyK": 60, "KeyO": 61, "KeyL": 62, "KeyP": 63, "Semicolon": 64
    };

    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (keyMap[e.code]) {
        const note = keyMap[e.code] + this.state.octave * 12 + this.state.transpose;
        const keyEl = this.pianoKeysContainer.querySelector(`[data-note="${keyMap[e.code]}"]`);
        if (keyEl && !keyEl.classList.contains("pressed")) {
          keyEl.classList.add("pressed");
          this.audio.playNote(note);
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      if (keyMap[e.code]) {
        const keyEl = this.pianoKeysContainer.querySelector(`[data-note="${keyMap[e.code]}"]`);
        if (keyEl) keyEl.classList.remove("pressed");
      }
    });
  }
}

// Instantiate on DOM load
window.addEventListener("DOMContentLoaded", () => {
  window.mpkApp = new AppController();
});

