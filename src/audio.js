/* Pukka Sahib — audio. Presentation only; no game rules, no rng that the logic
   consumes. Two modes, chosen at runtime:

   1. Recording mode — if the build injected window.PUKKA_AUDIO_SAMPLES (hosted
      deploys with freely-licensed recordings dropped into audio/), the ambience
      bed is a looped real recording per season, crossfaded at season changes.
   2. Synthesis mode (default, and the fallback while a recording loads or if
      it fails) — plucked strings by Karplus-Strong synthesis rendered into
      buffers: a delay-line string with a jawari-style nonlinearity for the
      sitar's buzz, fed through a small bank of sympathetic-string resonators
      (taraf), under a tanpura whose long strings get the characteristic slow
      harmonic bloom from a swept bandpass. Phrases come from the season's raga
      (config.audio.ragas); notes are often approached by meend (a pitch slide
      into the note) via playback-rate ramps.

   Default off; a toggle in the UI starts it inside a real gesture. All of it
   is wrapped so it can never throw into the game. */
(function (global) {
  "use strict";

  function createAudio(config) {
    config = config || {};
    var TONIC = config.tonic || 196.0;                 // Sa
    var MASTER = config.master || 0.16;                // ambience is quiet
    var RAGAS = config.ragas || { cold: [0, 2, 4, 7, 9], hot: [0, 2, 5, 7, 10], monsoon: [0, 2, 3, 5, 7, 10] };
    var AC = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);
    var SAMPLES = (typeof window !== "undefined" && window.PUKKA_AUDIO_SAMPLES) || null;

    var ctx = null, master = null, sitarBus = null, enabled = false, timer = null, seasonKey = "cold";
    var bufCache = {};
    var sampleBufs = {}, sampleFailed = {}, sampleSrc = null, sampleGain = null, sampleUrl = null;
    function rnd() { return Math.random(); } // audio may use rng freely; it feeds nothing deterministic

    function ensure() {
      if (ctx || !AC) return ctx;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0;
        // A gentle warmth filter on the whole bed: everything above ~2.4 kHz
        // rolls off, which is where the "mosquito" lived. Real sitar recordings
        // heard across a verandah lose the same top.
        var warmth = ctx.createBiquadFilter();
        warmth.type = "lowpass"; warmth.frequency.value = 2400; warmth.Q.value = 0.5;
        master.connect(warmth); warmth.connect(ctx.destination);
        // The taraf: every sitar pluck also excites a small bank of feedback
        // combs tuned to Sa, Pa and the octave — the sympathetic strings that
        // make a sitar ring on after the note. Kept dark and faint: it is a
        // halo, not a whine.
        sitarBus = ctx.createGain(); sitarBus.gain.value = 1;
        sitarBus.connect(master);
        [TONIC, TONIC * Math.pow(2, 7 / 12), TONIC * 2].forEach(function (f) {
          var d = ctx.createDelay(0.1); d.delayTime.value = 1 / f;
          var fb = ctx.createGain(); fb.gain.value = 0.8;
          var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
          var wet = ctx.createGain(); wet.gain.value = 0.04;
          sitarBus.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d);
          d.connect(wet); wet.connect(master);
        });
        try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {} // iOS: survive the ringer switch
      } catch (e) { ctx = null; }
      return ctx;
    }
    function note(semi) { return TONIC * Math.pow(2, semi / 12); }

    /* ---------- Karplus-Strong string rendering ---------- */

    // Render a plucked string into a buffer: a noise-burst excitation
    // circulating in a delay line with averaging damping (pure Karplus-Strong,
    // so the loop is passive and the decay guaranteed), with a soft
    // even-harmonic waveshaper on the output tap standing in for the jawari
    // (the sitar's flat buzzing bridge) — outside the loop, so the buzz rides
    // the attack and fades with the string instead of feeding back. bright
    // sets the excitation's spectral tilt; the decay is tuned so the tail
    // dies just before the buffer ends.
    function renderString(freq, dur, bright, jawari) {
      var sr = ctx.sampleRate;
      var key = freq.toFixed(2) + "|" + dur + "|" + bright + "|" + jawari;
      if (bufCache[key]) return bufCache[key];
      var len = Math.floor(sr * dur);
      var buf = ctx.createBuffer(1, len, sr);
      var out = buf.getChannelData(0);
      var N = Math.max(2, Math.round(sr / freq));
      var line = new Float32Array(N);
      var ex = 0;
      for (var i = 0; i < N; i++) { ex = bright * (rnd() * 2 - 1) + (1 - bright) * ex; line[i] = ex; }
      // Damping is felt once per round trip of the string (period), not per
      // sample: tune rho for ~-60 dB across the buffer; the averaging filter
      // adds its own damping on top, which is the safety margin at the end.
      var rho = Math.pow(10, -3 / (freq * dur));
      // A decaying sine at the fundamental under the string: the resonating
      // gourd. Without it the whole tone is edge and no body.
      var om = 2 * Math.PI * freq / sr, bodyK = -5 / len;
      var idx = 0, dc = 0, peak = 0;
      for (i = 0; i < len; i++) {
        var v = rho * 0.5 * (line[idx] + line[(idx + 1) % N]);
        line[idx] = v;
        idx = (idx + 1) % N;
        var w = v + jawari * 0.5 * v * v;      // even harmonics: the buzz
        dc = dc * 0.995 + w * 0.005; w -= dc;  // and a DC blocker to pay for them
        w += 0.45 * Math.sin(om * i) * Math.exp(bodyK * i);
        out[i] = w;
        var a = w < 0 ? -w : w; if (a > peak) peak = a;
      }
      if (peak > 0) { var s = 0.95 / peak; for (i = 0; i < len; i++) out[i] *= s; }
      bufCache[key] = buf;
      return buf;
    }

    // Play a rendered string. A meend (opts.glide, in scale semitones) slides
    // into the note by ramping the playback rate up to true pitch.
    function pluck(freq, opts) {
      if (!ctx || !master) return;
      opts = opts || {};
      try {
        var t = ctx.currentTime + (opts.at || 0);
        var dur = opts.dur || 2.2;
        var src = ctx.createBufferSource();
        src.buffer = renderString(freq, dur, opts.bright == null ? 0.6 : opts.bright, opts.jawari == null ? 0.22 : opts.jawari);
        if (opts.glide != null) {
          var r0 = Math.max(0.5, Math.min(2, note(opts.glide) / freq));
          if (Math.abs(r0 - 1) > 0.01) {
            src.playbackRate.setValueAtTime(r0, t);
            src.playbackRate.exponentialRampToValueAtTime(1, t + 0.22);
          }
        }
        var g = ctx.createGain(); g.gain.value = opts.gain || 0.35;
        src.connect(g); g.connect(opts.out || sitarBus || master);
        src.start(t);
      } catch (e) {}
    }

    // One tanpura string: a long low-damping pluck whose harmonics bloom and
    // recede through a swept bandpass — the jawari's slow flowering, which is
    // most of what makes a tanpura sound like a tanpura and not an organ.
    function tanpuraString(freq, at, gain) {
      if (!ctx || !master) return;
      try {
        var t = ctx.currentTime + at, dur = 5.2;
        var src = ctx.createBufferSource();
        src.buffer = renderString(freq, dur, 0.4, 0.3);
        var dry = ctx.createGain(); dry.gain.value = gain * 0.7;
        // The bloom stays low and broad: sweeping it to the 7th harmonic with a
        // narrow band was the other half of the whine.
        var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 2.5;
        bp.frequency.setValueAtTime(freq * 1.2, t);
        bp.frequency.exponentialRampToValueAtTime(freq * 3.5, t + dur * 0.55);
        bp.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
        var wet = ctx.createGain(); wet.gain.value = gain * 0.5;
        src.connect(dry); dry.connect(master);
        src.connect(bp); bp.connect(wet); wet.connect(master);
        src.start(t);
      } catch (e) {}
    }

    // The tanpura cycle: Pa (low), sa, sa, Sa (low) — slow and overlapping.
    function droneCycle(at) {
      tanpuraString(note(7) / 2, at, 0.26);
      tanpuraString(TONIC, at + 1.3, 0.20);
      tanpuraString(TONIC, at + 2.55, 0.20);
      tanpuraString(TONIC / 2, at + 3.7, 0.25);
    }

    // A sparse phrase from the season's raga: a directional walk along the
    // scale rather than uniform dice, often arriving by meend, and resolving
    // toward Sa or Pa half the time — closer to alap than to a random doodle.
    function phrase(at) {
      var scale = RAGAS[seasonKey] || RAGAS.cold;
      var n = 2 + Math.floor(rnd() * 4);
      var oct = rnd() < 0.25 ? 12 : 0; // mostly the middle octave; the upper is an excursion, not a home
      var pos = Math.floor(rnd() * scale.length);
      var dir = rnd() < 0.5 ? 1 : -1;
      var prev = null, t = at;
      for (var i = 0; i < n; i++) {
        if (rnd() < 0.25) dir = -dir;
        pos += dir;
        if (pos < 0) { pos = 0; dir = 1; }
        if (pos >= scale.length) { pos = scale.length - 1; dir = -1; }
        var semi = scale[pos] + oct;
        if (i === n - 1 && rnd() < 0.5) semi = (rnd() < 0.7 ? 0 : 7) + oct;
        pluck(note(semi), {
          at: t, dur: 1.8 + rnd() * 1.2, gain: 0.36,
          glide: (prev != null && rnd() < 0.6) ? prev : null
        });
        prev = semi;
        t += 0.45 + rnd() * 0.7;
      }
    }

    /* ---------- recording mode (hosted deploys with audio/ files) ---------- */

    function sampleUrlFor(k) { return (SAMPLES && (SAMPLES[k] || SAMPLES.all)) || null; }
    function sampleActive() { return !!sampleSrc; }
    function swapSample(buf, url) {
      try {
        var t = ctx.currentTime;
        if (sampleSrc) {
          var old = sampleSrc, og = sampleGain;
          og.gain.cancelScheduledValues(t); og.gain.setValueAtTime(og.gain.value, t);
          og.gain.linearRampToValueAtTime(0, t + 1.6);
          try { old.stop(t + 1.7); } catch (e) {}
        }
        sampleSrc = ctx.createBufferSource();
        sampleSrc.buffer = buf; sampleSrc.loop = true;
        sampleGain = ctx.createGain();
        sampleGain.gain.setValueAtTime(0.0001, t);
        sampleGain.gain.linearRampToValueAtTime(1, t + 1.6);
        sampleSrc.connect(sampleGain); sampleGain.connect(master);
        sampleSrc.start(t);
        sampleUrl = url;
      } catch (e) {}
    }
    // Fetch/decode is lazy and forgiving: while it loads (or if it fails, or
    // offline in the single-file build) the synthesis carries the ambience.
    function playSample(k) {
      if (!SAMPLES || !ctx) return;
      var url = sampleUrlFor(k);
      if (!url || sampleFailed[url] || url === sampleUrl) return;
      if (sampleBufs[url]) { swapSample(sampleBufs[url], url); return; }
      try {
        fetch(url).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.arrayBuffer();
        }).then(function (ab) {
          return ctx.decodeAudioData(ab);
        }).then(function (buf) {
          sampleBufs[url] = buf;
          if (enabled) swapSample(buf, url);
        }).catch(function () { sampleFailed[url] = true; });
      } catch (e) { sampleFailed[url] = true; }
    }
    function stopSample() {
      if (!sampleSrc) return;
      try { sampleSrc.stop(); } catch (e) {}
      sampleSrc = null; sampleGain = null; sampleUrl = null;
    }

    /* ---------- the ambience loop ---------- */

    function tick() {
      if (!enabled || !ctx) return;
      if (sampleActive()) return; // the recording is the ambience
      droneCycle(0.05);
      if (rnd() < 0.6) phrase(1.2 + rnd() * 1.8);
    }

    function start() {
      if (!ensure()) return;
      try { if (ctx.state === "suspended") ctx.resume(); } catch (e) {}
      enabled = true;
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(MASTER, now + 1.2);
      playSample(seasonKey);
      tick();
      if (timer) clearInterval(timer);
      timer = setInterval(tick, 5000);
    }
    function stop() {
      enabled = false;
      if (timer) { clearInterval(timer); timer = null; }
      stopSample();
      if (ctx && master) {
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0, now + 0.6);
      }
    }

    // A stamp thunk on a choice: a low resonant thump plus a short filtered click.
    function stamp() {
      if (!enabled || !ensure() || !master) return;
      try {
        var t = ctx.currentTime;
        var o = ctx.createOscillator(); o.type = "sine";
        o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(68, t + 0.12);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
        var len = Math.floor(ctx.sampleRate * 0.05);
        var nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * (1 - i / len);
        var ns = ctx.createBufferSource(); ns.buffer = nb;
        var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.8;
        var ng = ctx.createGain(); ng.gain.value = 0.16;
        ns.connect(bp); bp.connect(ng); ng.connect(master); ns.start(t);
      } catch (e) {}
    }

    // A short cadence on the verdict: rising for an honour, falling otherwise.
    // The caller says which it is (the honours ladder is chapter data).
    function ending(key, honour) {
      if (!enabled || !ensure()) return;
      var seq = honour ? [0, 4, 7, 12] : [12, 10, 7, 3];
      for (var i = 0; i < seq.length; i++)
        pluck(note(seq[i]), { at: 0.05 + i * 0.5, dur: 2.6, gain: 0.36, glide: i > 0 ? seq[i - 1] : null });
    }

    function season(k) {
      if (RAGAS[k]) seasonKey = k;
      if (enabled) playSample(seasonKey);
    }

    // iOS interrupted / suspended state: resume on any later gesture or return.
    function rearm() { if (enabled && ctx && ctx.state !== "running") { try { ctx.resume(); } catch (e) {} } }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", rearm);
      ["touchstart", "pointerdown", "keydown"].forEach(function (ev) { document.addEventListener(ev, rearm, { passive: true }); });
    }

    return {
      supported: !!AC,
      setEnabled: function (on) { try { on ? start() : stop(); } catch (e) {} },
      get enabled() { return enabled; },
      season: season, stamp: stamp, ending: ending
    };
  }

  var API = { create: createAudio };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.PukkaAudio = API;
})(typeof window !== "undefined" ? window : globalThis);
