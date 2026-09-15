/* Pocket Pro League — commentator voices (Web Speech API) and synthesised crowd/whistle (Web Audio) */
(function (root) {
  'use strict';
  const PREF_KEY = 'ppl_sound';
  let enabled = true;
  try { enabled = localStorage.getItem(PREF_KEY) !== 'off'; } catch (e) { /* ignore */ }
  let ctx = null, voices = [], voiceMap = null, unlocked = false;
  const synth = root.speechSynthesis || null;
  const queue = []; let speaking = false;

  function ac() {
    if (!ctx) { const AC = root.AudioContext || root.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function unlock() { unlocked = true; ac(); loadVoices(); }
  function loadVoices() {
    if (!synth) return;
    voices = synth.getVoices ? synth.getVoices() : [];
    if (!voices.length) return;
    const en = voices.filter(v => /^en/i.test(v.lang));
    const gb = en.filter(v => /GB|UK|IE|AU/i.test(v.lang) || /British|UK English|Daniel|Arthur|Kate|Serena|Moira|Fiona/i.test(v.name));
    const pool = gb.length >= 2 ? gb : en.length ? en : voices;
    const male = pool.find(v => /Daniel|Arthur|Oliver|George|Male|James|Rishi/i.test(v.name)) || pool[0];
    const female = pool.find(v => v !== male && /Kate|Serena|Moira|Fiona|Female|Martha|Sonia|Libby|Zira|Samantha|Victoria/i.test(v.name)) || pool.find(v => v !== male) || pool[0];
    voiceMap = { john: male, ally: female };
  }
  if (synth && typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices);

  // Turn commentary markup into speakable text: use the pronunciation guide where one is given
  function toSpeech(html) {
    let t = String(html)
      .replace(/<i>\s*\([^)]*\)\s*<\/i>/g, ' ')            // stage directions like (groans) are not spoken
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/(\d+)'/g, '$1 minutes.')                   // 67' -> 67 minutes
      .replace(/\b([\w'\-]+(?: [\w'\-]+)?) \(([^)]{2,40})\)/g, (m, name, pron) => /^[A-Za-z\-\s']+$/.test(pron) && /[A-Z]{2}|-/.test(pron) ? pron.replace(/-/g, ' ') : m)
      .replace(/\(([^)]*)\)/g, '$1')
      .replace(/[⏪⏩🎯🪶⚽📺🏟🏁📋★✍✋😴]/g, '')
      .replace(/G+O+A+L+/gi, 'Goal')
      .replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
    return t;
  }
  function speak(who, html, opts) {
    if (!enabled || !synth || !unlocked) return;
    const text = toSpeech(html);
    if (!text) return;
    const w = String(who).toLowerCase();
    if (w !== 'john' && w !== 'ally' && w !== 'scout') return;
    if (opts && opts.priority) { queue.length = 0; try { synth.cancel(); } catch (e) { /* ignore */ } speaking = false; }
    if (queue.length > 6) queue.splice(0, queue.length - 6);
    queue.push({ w, text });
    pump();
  }
  function pump() {
    if (speaking || !queue.length || !synth) return;
    const item = queue.shift();
    const u = new SpeechSynthesisUtterance(item.text);
    if (!voiceMap) loadVoices();
    const v = voiceMap && voiceMap[item.w === 'scout' ? 'john' : item.w];
    try { if (v) u.voice = v; } catch (e) { /* engine rejected the voice; default voice still speaks */ }
    try { u.lang = (v && v.lang) || 'en-GB'; } catch (e) { /* ignore */ }
    u.rate = item.w === 'ally' ? 1.08 : 1.0;
    u.pitch = item.w === 'ally' ? 1.25 : item.w === 'scout' ? 0.7 : 0.85;
    u.volume = 1;
    speaking = true;
    const done = () => { speaking = false; setTimeout(pump, 120); };
    u.onend = done; u.onerror = done;
    try { synth.speak(u); } catch (e) { done(); }
    // safety: some engines never fire onend
    setTimeout(() => { if (speaking && synth.speaking === false) done(); }, Math.min(20000, 400 + item.text.length * 90));
  }
  function stopSpeech() { queue.length = 0; speaking = false; if (synth) { try { synth.cancel(); } catch (e) { /* ignore */ } } }

  // ---- synthesised effects ----
  function noise(dur) {
    const c = ac(); if (!c) return null;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf; return src;
  }
  function env(node, c, t0, a, s, r, peak) {
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.setValueAtTime(peak, t0 + a + s); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + s + r);
    node.connect(g); g.connect(c.destination); return g;
  }
  function crowd(dur, peak, swell) {
    const c = ac(); if (!c) return; const t = c.currentTime;
    const n = noise(dur + 0.5); if (!n) return;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(swell ? 900 : 300, t + dur); f.Q.value = 0.6;
    n.connect(f); env(f, c, t, swell ? 0.25 : 0.05, dur * 0.4, dur * 0.6, peak); n.start(t); n.stop(t + dur + 0.6);
  }
  function whistle(times) {
    const c = ac(); if (!c) return; let t = c.currentTime;
    for (let i = 0; i < (times || 1); i++) {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(2400, t); o.frequency.linearRampToValueAtTime(2700, t + 0.1);
      const m = c.createOscillator(); m.type = 'sine'; m.frequency.value = 38; const mg = c.createGain(); mg.gain.value = 300; m.connect(mg); mg.connect(o.frequency);
      env(o, c, t, 0.01, times > 1 && i === times - 1 ? 0.6 : 0.25, 0.08, 0.12); o.start(t); m.start(t); const end = t + (times > 1 && i === times - 1 ? 0.8 : 0.4); o.stop(end); m.stop(end);
      t += 0.45;
    }
  }
  function tone(freq, dur, type, peak, when) {
    const c = ac(); if (!c) return; const t = c.currentTime + (when || 0);
    const o = c.createOscillator(); o.type = type || 'square'; o.frequency.value = freq; env(o, c, t, 0.005, dur * 0.5, dur * 0.5, peak || 0.08); o.start(t); o.stop(t + dur + 0.05);
  }
  const SFX = {
    click: () => tone(880, 0.05, 'square', 0.04),
    goal: () => { whistle(1); crowd(2.2, 0.5, true); tone(660, 0.12, 'square', 0.06, 0.2); tone(880, 0.12, 'square', 0.06, 0.34); tone(1320, 0.25, 'square', 0.06, 0.48); },
    bad: () => { crowd(1.4, 0.25, false); tone(220, 0.3, 'sawtooth', 0.04, 0.1); tone(180, 0.4, 'sawtooth', 0.04, 0.4); },
    kickoff: () => { whistle(1); crowd(1.2, 0.18, true); },
    fulltime: () => { whistle(3); crowd(2.5, 0.3, true); },
    save: () => { crowd(1.2, 0.35, true); },
    cash: () => { tone(1200, 0.06, 'square', 0.05); tone(1600, 0.08, 'square', 0.05, 0.08); },
    ding: () => { tone(1046, 0.1, 'sine', 0.08); tone(1568, 0.2, 'sine', 0.08, 0.1); },
    chant: () => { const seq = [523, 523, 659, 523, 784, 698]; seq.forEach((f, i) => tone(f, 0.16, 'square', 0.05, i * 0.2)); crowd(2, 0.3, true); },
    rewind: () => { const c = ac(); if (!c) return; const t = c.currentTime; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.7); env(o, c, t, 0.02, 0.5, 0.2, 0.05); o.start(t); o.stop(t + 0.8); },
  };
  function sfx(name) { if (!enabled || !unlocked) return; const f = SFX[name]; if (f) { try { f(); } catch (e) { /* ignore */ } } }

  function setEnabled(v) { enabled = !!v; try { localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off'); } catch (e) { /* ignore */ } if (!enabled) stopSpeech(); }
  root.PPL_AUDIO = { speak, sfx, toSpeech, unlock, stopSpeech, setEnabled, isEnabled: () => enabled, hasSpeech: () => !!synth, voiceNames: () => voiceMap ? { john: voiceMap.john && voiceMap.john.name, ally: voiceMap.ally && voiceMap.ally.name } : null };
})(typeof window !== 'undefined' ? window : globalThis);
