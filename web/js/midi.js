// Akai MPK Mini Play mk3 — Web MIDI & Audio Feedback Engine

import {
  AKAI_MANUFACTURER_ID,
  MPK_MINI_PLAY_MK3_MODEL_ID,
  CMD_SEND_FAVORITE,
  CMD_REQUEST_FAVORITE,
  CMD_RECEIVE_FAVORITE,
  buildRequestFavoriteSysEx,
  buildSendFavoriteSysEx,
  buildSendKeyCurveSysEx,
  midiNoteToName
} from "./protocol.js";

export class MidiManager {
  constructor() {
    this.midiAccess = null;
    this.selectedInput = null;
    this.selectedOutput = null;
    this.onStatusChange = null;
    this.onMessageLog = null;
    this.onMidiEvent = null; // Callback for live MIDI stream monitoring
    this.pendingRequests = new Map(); // slotIndex -> { resolve, reject, timeout }
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      throw new Error("Web MIDI API is not supported in this browser. Please use Google Chrome, Microsoft Edge, Brave, or Opera.");
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
    } catch (err) {
      if (err.name === "SecurityError") {
        throw new Error("SysEx permissions were denied. Please grant MIDI SysEx permissions in your browser address bar.");
      }
      throw err;
    }

    this.midiAccess.onstatechange = (e) => this.handleStateChange(e);
    this.autoSelectDevice();
    return this.getConnectionInfo();
  }

  getInputs() {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.inputs.values());
  }

  getOutputs() {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.outputs.values());
  }

  autoSelectDevice() {
    const inputs = this.getInputs();
    const outputs = this.getOutputs();

    // Look for Akai MPK mini Play
    const playInput = inputs.find(i => i.name && i.name.toLowerCase().includes("mpk mini play")) || inputs[0] || null;
    const playOutput = outputs.find(o => o.name && o.name.toLowerCase().includes("mpk mini play")) || outputs[0] || null;

    this.selectInput(playInput ? playInput.id : null);
    this.selectOutput(playOutput ? playOutput.id : null);
  }

  selectInput(id) {
    if (this.selectedInput) {
      this.selectedInput.onmidimessage = null;
    }
    const input = id ? this.midiAccess?.inputs.get(id) : null;
    this.selectedInput = input;
    if (this.selectedInput) {
      this.selectedInput.onmidimessage = (e) => this.handleMidiMessage(e);
      this.log(`Selected MIDI In: ${this.selectedInput.name}`);
    }
    this.notifyStatus();
  }

  selectOutput(id) {
    const output = id ? this.midiAccess?.outputs.get(id) : null;
    this.selectedOutput = output;
    if (this.selectedOutput) {
      this.log(`Selected MIDI Out: ${this.selectedOutput.name}`);
    }
    this.notifyStatus();
  }

  handleStateChange(event) {
    this.log(`MIDI port state change: ${event.port.name} is ${event.port.state}`);
    if (event.port.state === "connected") {
      if (!this.selectedInput || !this.selectedOutput) {
        this.autoSelectDevice();
      }
    } else if (event.port.state === "disconnected") {
      if (this.selectedInput?.id === event.port.id) this.selectedInput = null;
      if (this.selectedOutput?.id === event.port.id) this.selectedOutput = null;
      this.autoSelectDevice();
    }
    this.notifyStatus();
  }

  notifyStatus() {
    if (this.onStatusChange) {
      this.onStatusChange(this.getConnectionInfo());
    }
  }

  getConnectionInfo() {
    return {
      connected: !!(this.selectedInput && this.selectedOutput),
      inputName: this.selectedInput?.name || "None",
      outputName: this.selectedOutput?.name || "None",
      inputs: this.getInputs(),
      outputs: this.getOutputs(),
    };
  }

  log(msg, type = "info") {
    if (this.onMessageLog) {
      this.onMessageLog(msg, type);
    }
  }

  sendRaw(bytes) {
    if (!this.selectedOutput) {
      throw new Error("No MIDI output device selected.");
    }
    this.selectedOutput.send(bytes);
    this.log(`Sent SysEx (${bytes.length} bytes): ${this.bytesToHex(bytes.slice(0, 10))}...`);
  }

  sendCc(controller, value, channel = 1) {
    if (!this.selectedOutput) return;
    const status = 0xB0 | ((channel - 1) & 0x0F);
    this.selectedOutput.send([status, controller & 0x7F, value & 0x7F]);
  }

  bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  }

  parseMidiMessage(data, timestamp = performance.now()) {
    const status = data[0];
    const highNibble = status & 0xF0;
    const channel = (status & 0x0F) + 1; // 1-16
    const rawHex = Array.from(data).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");

    const event = {
      timestamp,
      rawHex,
      bytes: Array.from(data),
      status,
      channel,
      type: "unknown",
      desc: "Unknown MIDI",
      details: ""
    };

    if (status === 0xF0) {
      event.type = "sysex";
      event.channel = null;
      if (data[1] === AKAI_MANUFACTURER_ID && data[3] === MPK_MINI_PLAY_MK3_MODEL_ID) {
        const cmd = data[4];
        let cmdName = `Cmd 0x${cmd.toString(16).toUpperCase()}`;
        if (cmd === CMD_SEND_FAVORITE) cmdName = "Send Favorite (0x64)";
        else if (cmd === CMD_REQUEST_FAVORITE) cmdName = "Request Favorite (0x66)";
        else if (cmd === CMD_RECEIVE_FAVORITE) cmdName = "Receive Favorite Response (0x67)";
        else if (cmd === 0x13) cmdName = "Set Keybed Curve (0x13)";
        event.desc = `Akai SysEx: ${cmdName}`;
        event.details = `${data.length} bytes`;
      } else {
        event.desc = `SysEx (${data.length} bytes)`;
        event.details = rawHex;
      }
      return event;
    }

    // System Real-time messages (0xF8 - 0xFF)
    if (status >= 0xF8) {
      event.channel = null;
      switch (status) {
        case 0xF8: event.type = "clock"; event.desc = "MIDI Clock"; break;
        case 0xFA: event.type = "start"; event.desc = "MIDI Start"; break;
        case 0xFB: event.type = "continue"; event.desc = "MIDI Continue"; break;
        case 0xFC: event.type = "stop"; event.desc = "MIDI Stop"; break;
        case 0xFE: event.type = "activesense"; event.desc = "Active Sensing"; break;
        case 0xFF: event.type = "reset"; event.desc = "Reset"; break;
      }
      return event;
    }

    switch (highNibble) {
      case 0x80: // Note Off
        event.type = "noteoff";
        event.note = data[1];
        event.noteName = midiNoteToName(data[1]);
        event.velocity = data[2];
        event.desc = `Note Off: ${event.noteName}`;
        event.details = `Note ${data[1]}, Vel ${data[2]}`;
        break;

      case 0x90: // Note On (or Note Off if velocity is 0)
        if (data[2] === 0) {
          event.type = "noteoff";
          event.note = data[1];
          event.noteName = midiNoteToName(data[1]);
          event.velocity = 0;
          event.desc = `Note Off: ${event.noteName}`;
          event.details = `Note ${data[1]}, Vel 0`;
        } else {
          event.type = "noteon";
          event.note = data[1];
          event.noteName = midiNoteToName(data[1]);
          event.velocity = data[2];
          event.desc = `Note On: ${event.noteName}`;
          event.details = `Note ${data[1]}, Vel ${data[2]}`;
        }
        break;

      case 0xA0: // Polyphonic Key Pressure
        event.type = "polyaftertouch";
        event.note = data[1];
        event.noteName = midiNoteToName(data[1]);
        event.pressure = data[2];
        event.desc = `Poly AT: ${event.noteName}`;
        event.details = `Pressure ${data[2]}`;
        break;

      case 0xB0: // Control Change (CC)
        event.type = "cc";
        event.controller = data[1];
        event.value = data[2];
        event.desc = `CC ${data[1]}`;
        event.details = `Val ${data[2]}`;
        break;

      case 0xC0: // Program Change
        event.type = "programchange";
        event.program = data[1];
        event.desc = `Program Change`;
        event.details = `Prog ${data[1]}`;
        break;

      case 0xD0: // Channel Pressure
        event.type = "aftertouch";
        event.pressure = data[1];
        event.desc = `Channel Aftertouch`;
        event.details = `Pressure ${data[1]}`;
        break;

      case 0xE0: // Pitch Bend
        event.type = "pitchbend";
        const bendValue = (data[2] << 7) | data[1]; // 0 - 16383
        const centered = bendValue - 8192; // -8192 to +8191
        event.pitchbend = centered;
        event.rawPitchbend = bendValue;
        event.desc = `Pitch Bend`;
        event.details = `${centered > 0 ? "+" : ""}${centered}`;
        break;
    }

    return event;
  }

  handleMidiMessage(event) {
    const data = event.data;
    if (!data || data.length === 0) return;

    const parsedEvent = this.parseMidiMessage(data, event.timeStamp);

    // Dispatch to event listener for UI visualization & stream monitoring
    if (this.onMidiEvent) {
      this.onMidiEvent(parsedEvent);
    }

    // Check for SysEx header
    if (data[0] === 0xF0 && data[1] === AKAI_MANUFACTURER_ID && data[3] === MPK_MINI_PLAY_MK3_MODEL_ID) {
      const cmd = data[4];
      this.log(`Received SysEx from MPK: Cmd 0x${cmd.toString(16).toUpperCase()} (${data.length} bytes)`);

      if (cmd === CMD_RECEIVE_FAVORITE || cmd === CMD_SEND_FAVORITE) {
        // Device responded with preset payload!
        // Format: F0 47 00 50 67 01 58 <slot> <215 bytes payload> F7
        const slot = data[7];
        const payload = data.slice(8, data.length - 1);
        this.log(`Received Preset data for Slot ${slot + 1} (${payload.length} bytes)`);

        if (this.pendingRequests.has(slot)) {
          const req = this.pendingRequests.get(slot);
          clearTimeout(req.timeout);
          this.pendingRequests.delete(slot);
          req.resolve({ slot, payload });
        }
      }
    }
  }

  async requestFavorite(slotIndex) {
    if (!this.selectedOutput) {
      throw new Error("Please connect your Akai MPK mini Play mk3 first.");
    }

    return new Promise((resolve, reject) => {
      // 2500 ms timeout for reliable USB handshake
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(slotIndex);
        reject(new Error(`Timeout: Device did not respond for Favorite ${slotIndex + 1} within 2500ms.`));
      }, 2500);

      this.pendingRequests.set(slotIndex, { resolve, reject, timeout });

      const msg = buildRequestFavoriteSysEx(slotIndex);
      this.sendRaw(msg);
    });
  }

  sendFavorite(slotIndex, payloadBytes) {
    const msg = buildSendFavoriteSysEx(slotIndex, payloadBytes);
    this.sendRaw(msg);
    this.log(`Sent Favorite ${slotIndex + 1} to Hardware Flash Memory.`);
  }

  sendToRam(payloadBytes) {
    const msg = buildSendFavoriteSysEx(0x08, payloadBytes); // 0x08 = Target RAM
    this.sendRaw(msg);
    this.log(`Sent Preset to Hardware Active RAM.`);
  }

  sendKeyCurve(p1, p2, p3, p4, blackBalance) {
    const msg = buildSendKeyCurveSysEx(p1, p2, p3, p4, blackBalance);
    this.sendRaw(msg);
    this.log(`Sent Keybed Velocity Sensitivity Curve to Hardware.`);
  }
}

// Web Audio API Synth Preview for interactive auditioning in browser
export class AudioPreview {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playNote(midiNote, duration = 0.4, velocity = 0.8) {
    this.init();
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.3 * velocity, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  playDrum(padIndex) {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Dynamic pitch based on pad
    const baseFreq = 80 + (padIndex % 8) * 25;
    osc.frequency.setValueAtTime(baseFreq * 2, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.12);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }
}

