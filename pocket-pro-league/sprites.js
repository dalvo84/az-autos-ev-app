/* Pocket Pro League — pixel character models and club kits */
(function (root) {
  'use strict';
  const SKIN = ['#f6d7b8', '#e9b98f', '#c98f5f', '#a4703f', '#734727', '#40281a'];
  const HAIR_COLORS = ['#1c1410', '#4a2c15', '#8b5a2b', '#d9a441', '#c7c7c7', '#b3261e', '#e4e4e4', '#2b5fd9'];
  const HAIR_STYLES = ['Short', 'Buzz', 'Afro', 'Long', 'Spiky', 'Top knot', 'Curtains'];
  const BOOTS = ['#111111', '#f4f4f4', '#ff4d4d', '#39c96b', '#3b82f6', '#ffd23f', '#ff7ac8'];
  const BUILDS = ['Slim', 'Athletic', 'Stocky'];
  const rnd = n => Math.floor(Math.random() * n);

  function randomLook() {
    return { skin: rnd(SKIN.length), hair: rnd(HAIR_STYLES.length), hairColor: rnd(6), beard: Math.random() < 0.25, boots: rnd(BOOTS.length), build: rnd(BUILDS.length) };
  }
  function defaultLook() { return { skin: 1, hair: 0, hairColor: 1, beard: false, boots: 0, build: 1 }; }

  // ---- kits ----
  const KNOWN = {
    'Manchester City': ['#6cabdd', '#ffffff'], 'Liverpool': ['#c8102e', '#c8102e'], 'Arsenal': ['#ef0107', '#ffffff'], 'Chelsea': ['#034694', '#034694'],
    'Manchester United': ['#da291c', '#ffffff'], 'Tottenham Hotspur': ['#ffffff', '#132257'], 'Newcastle United': ['#241f20', '#241f20'], 'Aston Villa': ['#95bfe5', '#ffffff'],
    'Everton': ['#003399', '#ffffff'], 'West Ham United': ['#7a263a', '#ffffff'], 'Leeds United': ['#ffffff', '#ffffff'], 'Real Madrid': ['#ffffff', '#ffffff'],
    'Barcelona': ['#a50044', '#004d98'], 'Atlético Madrid': ['#cb3524', '#262e62'], 'Bayern Munich': ['#dc052d', '#dc052d'], 'Borussia Dortmund': ['#fde100', '#000000'],
    'Paris Saint-Germain': ['#004170', '#004170'], 'Marseille': ['#ffffff', '#ffffff'], 'Juventus': ['#ffffff', '#000000'], 'Inter': ['#0b1c3f', '#000000'],
    'AC Milan': ['#fb090b', '#ffffff'], 'Napoli': ['#12a0d7', '#ffffff'], 'Roma': ['#8e1f2f', '#8e1f2f'], 'Al Nassr': ['#ffdd00', '#1b3a8f'], 'Al Hilal': ['#1e5bc6', '#ffffff'],
    'Al Ittihad': ['#000000', '#ffd400'], 'Inter Miami': ['#f7b5cd', '#f7b5cd'], 'LA Galaxy': ['#ffffff', '#ffffff'], 'LAFC': ['#000000', '#000000'], 'QPR': ['#1d5ba4', '#ffffff'],
    'Leicester City': ['#0053a0', '#ffffff'], 'Southampton': ['#d71920', '#000000'], 'Sunderland': ['#eb172b', '#000000'], 'Wrexham': ['#cc0000', '#ffffff'],
  };
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; };
  function hsl(h, s, l) { return `hsl(${h} ${s}% ${l}%)`; }
  function hueOf(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return null;
    const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b); if (max - min < 0.12) return null; // greys/white/black
    let h; if (max === r) h = ((g - b) / (max - min)) % 6; else if (max === g) h = (b - r) / (max - min) + 2; else h = (r - g) / (max - min) + 4;
    return (h * 60 + 360) % 360;
  }
  function baseKit(name) {
    if (KNOWN[name]) return { shirt: KNOWN[name][0], shorts: KNOWN[name][1] };
    const h = hash(name); const hue = h % 360; const dark = (h >> 3) % 3 === 0;
    return { shirt: hsl(hue, 70, dark ? 28 : 45), shorts: (h >> 5) % 2 ? '#ffffff' : hsl(hue, 60, 22) };
  }
  // Two kits that read as different: away side changes if it clashes with home
  function kitsFor(homeName, awayName) {
    const home = baseKit(homeName); let away = baseKit(awayName);
    const hh = hueOf(home.shirt), ah = hueOf(away.shirt);
    const clash = (hh === null && ah === null) || (hh !== null && ah !== null && Math.abs(((hh - ah + 540) % 360) - 180) > 140);
    if (clash) away = hh !== null && Math.abs(hh - 50) < 60 ? { shirt: '#f4f4f4', shorts: '#222222' } : { shirt: '#f4c542', shorts: '#222222' };
    if (hh === null && ah === null) away = { shirt: '#ff5a36', shorts: '#222222' };
    return { home, away };
  }

  // ---- drawing (pixel blocks; u = pixels per block) ----
  function drawFigure(ctx, x, y, u, look, kit, o) {
    o = o || {};
    const skin = SKIN[look.skin] || SKIN[1], hairC = HAIR_COLORS[look.hairColor] || HAIR_COLORS[1], boots = BOOTS[look.boots] || BOOTS[0];
    const wide = look.build === 2 ? 1 : 0, slim = look.build === 0 ? 1 : 0;
    const px = (bx, by, bw, bh, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + bx * u), Math.round(y + by * u), Math.ceil(bw * u), Math.ceil(bh * u)); };
    const bob = o.step ? Math.round(Math.sin(o.step) * 1) : 0;
    const cheer = o.pose === 'cheer', kneel = o.pose === 'kneel', suit = o.pose === 'suit' || o.suit;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y + 0.5 * u, 4.5 * u, 1.6 * u, 0, 0, Math.PI * 2); ctx.fill();
    const top = -18 + (o.slide ? 6 : 0) + (kneel ? 5 : 0);
    // legs (animated)
    const lp = o.step ? Math.sin(o.step) * 1.2 : 0;
    if (kneel) { px(-5, top + 12, 4 + wide, 2.2, skin); px(2, top + 12.5, 4 + wide, 2, skin); px(-6, top + 13.6, 2.5, 1.5, boots); px(5.5 + wide, top + 13.6, 2.5, 1.5, boots); }
    else if (suit) { px(-3 + lp, top + 13, 2 + wide, 3.5, '#1c1c24'); px(1 - lp, top + 13, 2 + wide, 3.5, '#1c1c24'); px(-3.5 + lp, top + 16, 3 + wide, 1.6, '#111'); px(0.6 - lp, top + 16, 3 + wide, 1.6, '#111'); }
    else { px(-3 + lp, top + 13, 2 + wide, 3.5, skin); px(1 - lp, top + 13, 2 + wide, 3.5, skin);
    px(-3.5 + lp, top + 16, 3 + wide, 1.6, boots); px(0.6 - lp, top + 16, 3 + wide, 1.6, boots); }
    // shorts and shirt
    px(-4 - wide + slim * 0.5, top + 10, 8 + wide * 2 - slim, 3.4, suit ? '#1c1c24' : kit.shorts);
    px(-4 - wide + slim * 0.5, top + 5 + bob, 8 + wide * 2 - slim, 5.4, suit ? '#23233a' : kit.shirt);
    if (suit) { px(-1, top + 5 + bob, 2, 5, '#f4f4f4'); px(-0.5, top + 5.6 + bob, 1, 3.6, o.tie || '#b3261e'); }
    if (kit.pattern === 'stripes' && kit.shirt2) { for (let i = -3 - wide; i < 4 + wide; i += 2) px(i + slim * 0.5, top + 5 + bob, 1, 5.4, kit.shirt2); }
    else if (kit.pattern === 'hoops' && kit.shirt2) { px(-4 - wide + slim * 0.5, top + 6.4 + bob, 8 + wide * 2 - slim, 1, kit.shirt2); px(-4 - wide + slim * 0.5, top + 8.6 + bob, 8 + wide * 2 - slim, 1, kit.shirt2); }
    else if (kit.pattern === 'sash' && kit.shirt2) { for (let i = 0; i < 5; i++) px(-3.5 + i * 1.5 - wide, top + 5 + i * 1.05 + bob, 1.6, 1.1, kit.shirt2); }
    if (o.number !== undefined) { ctx.fillStyle = kit.shirt === '#ffffff' || kit.shirt === '#f4f4f4' ? '#222' : '#fff'; ctx.font = `bold ${Math.max(6, 3.2 * u)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(o.number), x, y + (top + 8 + bob) * u); }
    // arms (up when cheering)
    const armC = suit ? '#23233a' : kit.shirt;
    if (cheer) { px(-5.5 - wide, top + 0.5 + bob, 1.6, 5, armC); px(3.9 + wide, top + 0.5 + bob, 1.6, 5, armC); px(-5.5 - wide, top - 1 + bob, 1.6, 1.5, skin); px(3.9 + wide, top - 1 + bob, 1.6, 1.5, skin); }
    else { px(-5.5 - wide, top + 5.5 + bob, 1.6, 4, armC); px(3.9 + wide, top + 5.5 + bob, 1.6, 4, armC);
    px(-5.5 - wide, top + 9.3 + bob, 1.6, 1.4, skin); px(3.9 + wide, top + 9.3 + bob, 1.6, 1.4, skin); }
    // head
    px(-3, top + bob, 6, 5.4, skin);
    if (look.beard) px(-2.4, top + 3.9 + bob, 4.8, 1.5, hairC);
    // eyes
    px(-1.8, top + 2.2 + bob, 1, 1, '#1a1a1a'); px(0.8, top + 2.2 + bob, 1, 1, '#1a1a1a');
    // hair
    switch (look.hair) {
      case 0: px(-3.2, top - 0.8 + bob, 6.4, 1.8, hairC); px(-3.2, top + 1 + bob, 1, 2, hairC); px(2.2, top + 1 + bob, 1, 2, hairC); break;
      case 1: px(-3, top - 0.4 + bob, 6, 1, hairC); break;
      case 2: px(-4, top - 2.2 + bob, 8, 3.6, hairC); px(-4, top + 1 + bob, 1.2, 3, hairC); px(2.8, top + 1 + bob, 1.2, 3, hairC); break;
      case 3: px(-3.4, top - 1 + bob, 6.8, 2, hairC); px(-3.6, top + 1 + bob, 1.4, 5, hairC); px(2.2, top + 1 + bob, 1.4, 5, hairC); break;
      case 4: px(-3, top - 1 + bob, 6, 1.4, hairC); px(-2.6, top - 2.6 + bob, 1.2, 1.8, hairC); px(-0.6, top - 3 + bob, 1.2, 2.2, hairC); px(1.4, top - 2.6 + bob, 1.2, 1.8, hairC); break;
      case 5: px(-3, top - 0.6 + bob, 6, 1.4, hairC); px(-1, top - 2.6 + bob, 2, 2, hairC); break;
      default: px(-3.4, top - 1 + bob, 6.8, 1.8, hairC); px(-3.4, top + 0.6 + bob, 1.6, 2.4, hairC); px(1.8, top + 0.6 + bob, 1.6, 2.4, hairC);
    }
    if (o.gloves) { px(-5.5 - wide, top + 9.3 + bob, 1.6, 1.4, '#ffe066'); px(3.9 + wide, top + 9.3 + bob, 1.6, 1.4, '#ffe066'); }
    // accessories (o.acc = { slot: {type, color} })
    const acc = o.acc || {};
    const col = a => a.color === 'club' ? kit.shirt : a.color;
    if (acc.arm && acc.arm.type === 'tattoo') { px(-5.5 - wide, top + 5.5 + bob, 1.6, 4, col(acc.arm)); }
    if (acc.wrist && acc.wrist.type === 'tape') { px(-5.5 - wide, top + 8.6 + bob, 1.6, 0.9, col(acc.wrist)); px(3.9 + wide, top + 8.6 + bob, 1.6, 0.9, col(acc.wrist)); }
    if (acc.wrist && acc.wrist.type === 'watch') { px(3.9 + wide, top + 8.6 + bob, 1.6, 1, '#222'); px(4.2 + wide, top + 8.7 + bob, 1, 0.8, col(acc.wrist)); }
    if (acc.hands && acc.hands.type === 'gloves') { px(-5.5 - wide, top + 9.3 + bob, 1.6, 1.4, col(acc.hands)); px(3.9 + wide, top + 9.3 + bob, 1.6, 1.4, col(acc.hands)); }
    if (acc.neck && acc.neck.type === 'chain') { px(-2, top + 5.2 + bob, 4, 0.7, col(acc.neck)); px(-0.5, top + 5.8 + bob, 1, 0.8, col(acc.neck)); }
    if (acc.face && acc.face.type === 'shades') { px(-2.6, top + 1.9 + bob, 5.2, 1.4, col(acc.face)); }
    if (acc.face && acc.face.type === 'earring') { px(2.9, top + 3 + bob, 0.8, 0.8, col(acc.face)); }
    if (acc.head && acc.head.type === 'band') { px(-3.2, top + 0.9 + bob, 6.4, 1.1, col(acc.head)); }
    if (acc.head && acc.head.type === 'beanie') { px(-3.4, top - 2 + bob, 6.8, 3.2, col(acc.head)); px(-3.4, top + 0.6 + bob, 6.8, 0.8, '#ffffff'); }
    if (acc.head && acc.head.type === 'cap') { px(-3.4, top - 1.6 + bob, 6.8, 2.4, col(acc.head)); px(1.5, top + 0.4 + bob, 4, 1, col(acc.head)); }
  }

  function drawTrophy(ctx, x, y, u, kind) {
    const px = (bx, by, bw, bh, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + bx * u), Math.round(y + by * u), Math.ceil(bw * u), Math.ceil(bh * u)); };
    if (kind === 'ball') { ctx.fillStyle = '#f3c34f'; ctx.beginPath(); ctx.arc(x, y - 6 * u, 5 * u, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c9962b'; ctx.beginPath(); ctx.arc(x + 1.5 * u, y - 4.5 * u, 2 * u, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff6c9'; ctx.fillRect(x - 3 * u, y - 9 * u, 1.5 * u, 1.5 * u); px(-4, 0, 8, 2, '#3a3a3a'); return; }
    if (kind === 'boot') { px(-5, -4, 7, 4, '#f3c34f'); px(-6, -1, 11, 2.5, '#c9962b'); px(-2, -6, 4, 2, '#f3c34f'); px(-4, 1.5, 9, 1.5, '#3a3a3a'); return; }
    if (kind === 'plaque') { px(-6, -10, 12, 12, '#2c3e50'); px(-5, -9, 10, 10, '#f3c34f'); px(-3, -6, 6, 1, '#2c3e50'); px(-3, -4, 6, 1, '#2c3e50'); return; }
    // cup
    px(-5, -12, 10, 6, '#f3c34f'); px(-6, -13, 12, 2, '#ffe08a'); px(-3, -6, 6, 3, '#f3c34f'); px(-1.5, -3, 3, 2, '#f3c34f'); px(-4, -1, 8, 2, '#3a3a3a');
    px(-8, -11, 2, 4, '#f3c34f'); px(6, -11, 2, 4, '#f3c34f'); px(-8, -7, 3, 1.2, '#f3c34f'); px(5, -7, 3, 1.2, '#f3c34f');
    px(-3, -11, 1.2, 3, '#fff6c9');
  }

  root.PPL_SPRITES = { drawTrophy, SKIN, HAIR_COLORS, HAIR_STYLES, BOOTS, BUILDS, randomLook, defaultLook, kitsFor, baseKit, drawFigure };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PPL_SPRITES;
})(typeof window !== 'undefined' ? window : globalThis);
