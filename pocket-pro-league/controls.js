/* Pocket Pro League — virtual joystick + action buttons (touch, mouse, keyboard) */
(function (root) {
  'use strict';
  function create(host, opts) {
    opts = opts || {};
    const buttons = opts.buttons || []; // [{id,label,hint}]
    const wrap = document.createElement('div'); wrap.className = 'ctl';
    wrap.innerHTML = `<div class="ctl-stick" id="ctl-stick"><div class="ctl-base"><div class="ctl-knob"></div></div><span class="ctl-hint">drag to move</span></div>
      <div class="ctl-btns">${buttons.map(b => `<button type="button" class="ctl-btn ctl-${b.id}" data-act="${b.id}"><span>${b.label}</span><small>${b.hint || ''}</small></button>`).join('')}</div>`;
    host.appendChild(wrap);
    const state = { x: 0, y: 0, active: false, pressed: {}, charge: {} };
    const listeners = { down: [], up: [] };
    const stickEl = wrap.querySelector('.ctl-stick'), base = wrap.querySelector('.ctl-base'), knob = wrap.querySelector('.ctl-knob');
    const R = 44; let pid = null, cx = 0, cy = 0;
    const setVec = (dx, dy) => { const d = Math.hypot(dx, dy) || 1; const k = Math.min(1, d / R); state.x = dx / d * k; state.y = dy / d * k; knob.style.transform = `translate(${dx / d * Math.min(d, R)}px, ${dy / d * Math.min(d, R)}px)`; };
    stickEl.addEventListener('pointerdown', e => { if (pid !== null) return; pid = e.pointerId; stickEl.setPointerCapture(pid); const r = stickEl.getBoundingClientRect(); cx = e.clientX; cy = e.clientY; base.style.left = (cx - r.left) + 'px'; base.style.top = (cy - r.top) + 'px'; base.classList.add('on'); state.active = true; setVec(0, 0); e.preventDefault(); });
    stickEl.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; setVec(e.clientX - cx, e.clientY - cy); });
    const end = e => { if (e.pointerId !== pid) return; pid = null; state.active = false; state.x = 0; state.y = 0; knob.style.transform = ''; base.classList.remove('on'); };
    stickEl.addEventListener('pointerup', end); stickEl.addEventListener('pointercancel', end);
    wrap.querySelectorAll('.ctl-btn').forEach(b => {
      const id = b.dataset.act;
      const down = e => { e.preventDefault(); if (state.pressed[id]) return; state.pressed[id] = performance.now(); b.classList.add('on'); listeners.down.forEach(f => f(id)); };
      const up = e => { if (!state.pressed[id]) return; const held = (performance.now() - state.pressed[id]) / 1000; state.pressed[id] = 0; b.classList.remove('on'); listeners.up.forEach(f => f(id, held)); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    // keyboard (computer): arrows / WASD move, Space shoot, P pass, Z skill
    const keys = {}; const keyMap = { ' ': 'shoot', 'p': 'pass', 'z': 'skill' };
    const touch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (!touch) {
      wrap.classList.add('kbd');
      const legend = document.createElement('div'); legend.className = 'ctl-legend';
      legend.innerHTML = `<span><b>WASD</b> / <b>arrows</b> move</span>${buttons.map(b => `<span><b>${b.id === 'shoot' ? 'SPACE' : b.id === 'pass' ? 'P' : 'Z'}</b> ${b.label.toLowerCase()}</span>`).join('')}<button type="button" class="ctl-toggle">show touch controls</button>`;
      wrap.appendChild(legend);
      legend.querySelector('.ctl-toggle').onclick = () => { wrap.classList.toggle('kbd'); legend.querySelector('.ctl-toggle').textContent = wrap.classList.contains('kbd') ? 'show touch controls' : 'hide touch controls'; };
    }
    const kd = e => { const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = true; e.preventDefault(); kv(); } const act = keyMap[k]; if (act && buttons.some(b => b.id === act) && !(e.target && /input|select|textarea/i.test(e.target.tagName))) { e.preventDefault(); if (!state.pressed[act]) { state.pressed[act] = performance.now(); listeners.down.forEach(f => f(act)); } } };
    const ku = e => { const k = e.key.toLowerCase(); if (keys[k]) { keys[k] = false; kv(); } const act = keyMap[k]; if (act && state.pressed[act]) { const held = (performance.now() - state.pressed[act]) / 1000; state.pressed[act] = 0; listeners.up.forEach(f => f(act, held)); } };
    function kv() { if (pid !== null) return; let x = 0, y = 0; if (keys.arrowleft || keys.a) x -= 1; if (keys.arrowright || keys.d) x += 1; if (keys.arrowup || keys.w) y -= 1; if (keys.arrowdown || keys.s) y += 1; const d = Math.hypot(x, y) || 1; state.x = x / d; state.y = y / d; state.active = !!(x || y); }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return { state, onDown: f => listeners.down.push(f), onUp: f => listeners.up.push(f), el: wrap,
      destroy() { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); wrap.remove(); },
      setLabel(id, label, hint) { const b = wrap.querySelector('.ctl-' + id); if (b) { b.querySelector('span').textContent = label; if (hint !== undefined) b.querySelector('small').textContent = hint; } } };
  }
  root.PPL_CONTROLS = { create };
})(typeof window !== 'undefined' ? window : globalThis);
