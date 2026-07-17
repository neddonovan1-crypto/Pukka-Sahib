/* Pukka Sahib — audio. Presentation only; no game rules, no rng that the logic
   consumes. A CSP-safe Artifact can't fetch or embed heavy samples, so the
   sitar/tanpura ambience is *synthesised* with the Web Audio API — zero page
   weight. A slow tanpura drone under sparse plucked phrases drawn from a
   season-appropriate raga (dawn Bhairav for the cold weather, a spare midday
   Sarang for the hot, a Malhar for the rains). Default off; a toggle in the UI
   starts it inside a real gesture. All of it is wrapped so it can never throw
   into the game. */
(function (global) {
  "use strict";

  function createAudio(config) {
    config = config || {};
    var TONIC = config.tonic || 196.0;                 // Sa
    var MASTER = config.master || 0.16;                // ambience is quiet
    var RAGAS = config.ragas || { cold: [0, 2, 4, 7, 9], hot: [0, 2, 5, 7, 10], monsoon: [0, 2, 3, 5, 7, 10] };
    var AC = (typeof window !== "undefined") && (window.AudioContext || window.webkitAudioContext);

    var ctx = null, master = null, enabled = false, timer = null, seasonKey = "cold";
    function rnd() { return Math.random(); } // audio may use rng freely; it feeds nothing deterministic

    function ensure() {
      if (ctx || !AC) return ctx;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {} // iOS: survive the ringer switch
      } catch (e) { ctx = null; }
      return ctx;
    }
    function note(semi) { return TONIC * Math.pow(2, semi / 12); }

    // A plucked, buzzing tone — the sitar voice: saw+triangle into a lowpass
    // that closes as the note decays, with an optional meend (glide in).
    function pluck(freq, opts) {
      if (!ctx || !master) return;
      opts = opts || {};
      var t = ctx.currentTime + (opts.at || 0);
      var dur = opts.dur || 2.2, peak = opts.gain || 0.4;
      try {
        var lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.Q.value = 1;
        lp.frequency.setValueAtTime(Math.min(6500, freq * 6), t);
        lp.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.4), t + dur * 0.6);
        var o1 = ctx.createOscillator(); o1.type = "sawtooth";
        var o2 = ctx.createOscillator(); o2.type = "triangle"; o2.detune.value = 5;
        var f0 = opts.glide != null ? note(opts.glide) : freq;
        o1.frequency.setValueAtTime(f0, t); o2.frequency.setValueAtTime(f0, t);
        if (opts.glide != null) {
          o1.frequency.exponentialRampToValueAtTime(freq, t + 0.18);
          o2.frequency.exponentialRampToValueAtTime(freq, t + 0.18);
        }
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
        o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
      } catch (e) {}
    }

    // Tanpura-ish drone: low Sa, Pa, Sa, Sa — slow and overlapping.
    function droneCycle(at) {
      var lowSa = TONIC / 2;
      pluck(lowSa, { at: at, dur: 3.8, gain: 0.20 });
      pluck(note(7) / 2, { at: at + 1.1, dur: 3.3, gain: 0.14 });
      pluck(lowSa, { at: at + 2.2, dur: 3.4, gain: 0.16 });
      pluck(lowSa, { at: at + 3.0, dur: 3.1, gain: 0.12 });
    }

    // A sparse melodic phrase from the season's raga, some notes glided into.
    function phrase(at) {
      var scale = RAGAS[seasonKey] || RAGAS.cold;
      var n = 2 + Math.floor(rnd() * 3), oct = rnd() < 0.5 ? 0 : 12;
      var prev = scale[Math.floor(rnd() * scale.length)];
      for (var i = 0; i < n; i++) {
        var deg = scale[Math.floor(rnd() * scale.length)];
        var glide = rnd() < 0.5 ? prev + oct : null;
        pluck(note(deg + oct), { at: at + i * (0.5 + rnd() * 0.55), dur: 1.6 + rnd(), gain: 0.24, glide: glide });
        prev = deg;
      }
    }

    function tick() {
      if (!enabled || !ctx) return;
      droneCycle(0.05);
      if (rnd() < 0.7) phrase(0.4);
    }

    function start() {
      if (!ensure()) return;
      try { if (ctx.state === "suspended") ctx.resume(); } catch (e) {}
      enabled = true;
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(MASTER, now + 1.2);
      tick();
      if (timer) clearInterval(timer);
      timer = setInterval(tick, 3600);
    }
    function stop() {
      enabled = false;
      if (timer) { clearInterval(timer); timer = null; }
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
    function ending(key) {
      if (!enabled || !ensure()) return;
      var honour = key === "kcsi" || key === "kcie" || key === "cie";
      var seq = honour ? [0, 4, 7, 12] : [12, 10, 7, 3];
      for (var i = 0; i < seq.length; i++)
        pluck(note(seq[i]), { at: 0.05 + i * 0.5, dur: 2.6, gain: 0.32, glide: i > 0 ? seq[i - 1] : null });
    }

    function season(k) { if (RAGAS[k]) seasonKey = k; }

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
