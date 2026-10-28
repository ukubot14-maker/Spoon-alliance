(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const overlay = $("overlay");
  const overlayTitle = $("overlayTitle");
  const overlayText = $("overlayText");
  const startBtn = $("startBtn");

  const W = canvas.width, H = canvas.height;
  const world = { width: W, height: H };
  const keys = new Set();

  const bosses = [
    { name: "Forkling the First", title: "The Bent Beginner", hp: 90, speed: 74, size: 25, color: "#d8e0ec", damage: 9, attack: "jab", desc: "A tiny fork with a huge attitude. Watch for quick lunges." },
    { name: "The Soup Warden", title: "Keeper of the Ladle", hp: 135, speed: 65, size: 31, color: "#69c8dc", damage: 12, attack: "wave", desc: "Sends soup rings across the floor. Keep moving." },
    { name: "Count Crumb", title: "Duke of the Dusty Pantry", hp: 175, speed: 82, size: 29, color: "#bb8a63", damage: 13, attack: "crumb", desc: "Scatters crunchy crumbs that burst into danger." },
    { name: "The Tinfoil Titan", title: "Shiny and Unreasonable", hp: 220, speed: 58, size: 39, color: "#a7b5c8", damage: 16, attack: "slam", desc: "A heavy bruiser. Dash away when the floor flashes." },
    { name: "Lady Butterknife", title: "The Polished Duelist", hp: 255, speed: 102, size: 27, color: "#f4c65e", damage: 15, attack: "dash", desc: "Fast, sharp, and annoyingly elegant." },
    { name: "The Whisk Witch", title: "Storm of the Mixing Bowl", hp: 300, speed: 67, size: 33, color: "#ba8cff", damage: 17, attack: "orbit", desc: "Summons spinning whisk sparks. Don't get surrounded." },
    { name: "General Grater", title: "The Cheese Shredder", hp: 365, speed: 78, size: 35, color: "#f08a54", damage: 19, attack: "shards", desc: "Fires a fan of metal shards from a distance." },
    { name: "THE GRAND FORK", title: "Commander of the Fork Legion", hp: 500, speed: 88, size: 43, color: "#ff637c", damage: 22, attack: "finale", desc: "The last fork standing. End the cutlery conflict." }
  ];

  let running = false, paused = false, gameOver = false, victory = false;
  let lastTime = 0, elapsed = 0, soundOn = false, audioCtx = null;
  let bossIndex = -1, boss = null, shards = 0, defeated = 0, level = 1;
  let particles = [], projectiles = [], pickups = [], floorMarks = [];
  let shake = 0, message = "", messageTimer = 0, attackCooldown = 0, dashCooldown = 0;
  let hero = makeHero();

  function makeHero() {
    return { x: W / 2, y: H / 2, r: 17, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100,
      speed: 210, facingX: 1, facingY: 0, invuln: 0, dashTime: 0, attackTime: 0, flash: 0 };
  }

  function tone(freq = 440, duration = .07, type = "sine", volume = .025) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = type; osc.frequency.value = freq; gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function setStatus(text) { $("statusText").textContent = text; }
  function showOverlay(title, text, buttonText = "Continue") {
    overlayTitle.textContent = title; overlayText.textContent = text;
    startBtn.textContent = buttonText; overlay.classList.remove("hidden");
  }
  function hideOverlay() { overlay.classList.add("hidden"); }

  function resetGame() {
    running = false; paused = false; gameOver = false; victory = false;
    hero = makeHero(); bossIndex = -1; boss = null; shards = 0; defeated = 0; level = 1;
    particles = []; projectiles = []; pickups = []; floorMarks = []; elapsed = 0;
    attackCooldown = 0; dashCooldown = 0; message = ""; messageTimer = 0; shake = 0;
    $("pauseBtn").textContent = "Pause";
    updateUI();
    showOverlay("Pick up your spoon.", "The Fork Legion is marching. Defeat eight bosses, collect shiny spoons, and save the pantry.", "Start Adventure");
    setStatus("Ready when you are.");
    draw();
  }

  function spawnBoss(index) {
    bossIndex = index;
    const data = bosses[index];
    boss = { ...data, x: W * .72, y: H * .45, maxHp: data.hp, hp: data.hp, attackTimer: 1.2, windup: 0,
      hitFlash: 0, phase: 0, orbitAngle: 0, dashTargetX: 0, dashTargetY: 0, stunned: 0 };
    projectiles = []; floorMarks = [];
    message = data.name + " approaches!"; messageTimer = 2.2;
    $("bossName").textContent = data.name;
    $("bossDesc").textContent = data.desc;
    tone(210, .2, "triangle", .04);
    setStatus("Boss " + (index + 1) + " of " + bosses.length + " entered the pantry.");
    updateUI();
  }

  function startGame() {
    if (gameOver || victory) resetGame();
    running = true; paused = false; gameOver = false; victory = false;
    hideOverlay();
    if (!boss) spawnBoss(Math.min(defeated, bosses.length - 1));
    lastTime = performance.now();
    setStatus("Defeat the boss!");
    requestAnimationFrame(loop);
  }

  function pauseGame() {
    if (!running || gameOver || victory) return;
    paused = !paused;
    $("pauseBtn").textContent = paused ? "Resume" : "Pause";
    if (paused) {
      showOverlay("Taking a breather?", "Your spoon is safe for now. Press Resume or Esc to return to the pantry.", "Resume");
      setStatus("Paused.");
    } else {
      hideOverlay(); lastTime = performance.now(); setStatus("Back in the fight."); requestAnimationFrame(loop);
    }
  }

  function updateUI() {
    $("healthText").textContent = Math.ceil(hero.hp) + " / " + hero.maxHp;
    $("healthBar").style.width = Math.max(0, hero.hp / hero.maxHp * 100) + "%";
    $("staminaText").textContent = Math.ceil(hero.stamina) + " / " + hero.maxStamina;
    $("staminaBar").style.width = Math.max(0, hero.stamina / hero.maxStamina * 100) + "%";
    $("shards").textContent = shards;
    $("bossCount").textContent = defeated + " / " + bosses.length;
    $("heroLevel").textContent = "LEVEL " + level;
    $("bossStage").textContent = boss ? (bossIndex + 1) + " / " + bosses.length : "â";
    $("bossHealthText").textContent = boss ? Math.ceil(boss.hp) + " / " + boss.maxHp : "â";
    $("bossHealthBar").style.width = boss ? Math.max(0, boss.hp / boss.maxHp * 100) + "%" : "0%";
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function rand(min, max) { return min + Math.random() * (max - min); }

  function addBurst(x, y, color, count = 12, force = 140) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(force * .25, force);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.22, .65), maxLife: .65, r: rand(2, 5), color });
    }
  }

  function attack() {
    if (!running || paused || gameOver || victory || attackCooldown > 0 || hero.stamina < 12) return;
    attackCooldown = .34; hero.attackTime = .2; hero.stamina -= 12;
    tone(530, .055, "triangle", .035);
    const dx = boss ? boss.x - hero.x : hero.facingX, dy = boss ? boss.y - hero.y : hero.facingY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;
    hero.facingX = nx; hero.facingY = ny;
    particles.push({ type: "slash", x: hero.x + nx * 28, y: hero.y + ny * 28, angle: Math.atan2(ny, nx), life: .18, maxLife: .18, color: "#fff0b2" });
    if (boss && dist(hero, boss) < boss.size + 57 && (nx * (boss.x - hero.x) + ny * (boss.y - hero.y)) > 0) {
      const damage = 25 + level * 2;
      boss.hp -= damage; boss.hitFlash = .12; boss.stunned = .08;
      addBurst(boss.x, boss.y, "#ffe5a0", 7, 100);
      tone(170, .06, "square", .025);
      if (boss.hp <= 0) defeatBoss();
    }
  }

  function dash() {
    if (!running || paused || gameOver || victory || dashCooldown > 0 || hero.stamina < 25) return;
    let dx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    let dy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
    const len = Math.hypot(dx, dy);
    if (!len) { dx = hero.facingX; dy = hero.facingY; } else { dx /= len; dy /= len; }
    hero.facingX = dx; hero.facingY = dy; hero.dashTime = .18; hero.invuln = .28;
    hero.stamina -= 25; dashCooldown = .65;
    addBurst(hero.x, hero.y, "#78dce7", 8, 85); tone(300, .09, "sawtooth", .025);
  }

  function fireProjectile(x, y, angle, speed, damage, color, radius = 7) {
    projectiles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: radius, damage, color, life: 4 });
  }

  function bossAttack(dt) {
    if (!boss) return;
    boss.attackTimer -= dt;
    boss.phase += dt;
    if (boss.windup > 0) {
      boss.windup -= dt;
      if (boss.windup <= 0) {
        if (boss.attack === "wave" || boss.attack === "finale") {
          for (let i = 0; i < 12; i++) fireProjectile(boss.x, boss.y, i * Math.PI / 6 + boss.phase * .4, 125, boss.damage, "#75d7e8", 8);
          if (boss.attack === "finale") for (let i = 0; i < 8; i++) fireProjectile(boss.x, boss.y, i * Math.PI / 4 - boss.phase, 175, boss.damage, "#ff637c", 10);
        } else if (boss.attack === "crumb") {
          for (let i = 0; i < 9; i++) fireProjectile(boss.x, boss.y, i * Math.PI * 2 / 9, 110, boss.damage, "#c69a72", 9);
        } else if (boss.attack === "shards") {
          const a = Math.atan2(hero.y - boss.y, hero.x - boss.x);
          for (let i = -2; i <= 2; i++) fireProjectile(boss.x, boss.y, a + i * .19, 235, boss.damage, "#f7b45d", 6);
        } else if (boss.attack === "slam") {
          floorMarks.push({ x: boss.x, y: boss.y, r: 130, life: .8, maxLife: .8, damage: boss.damage });
          if (dist(hero, boss) < 130) hurtHero(boss.damage);
          shake = .18; addBurst(boss.x, boss.y, "#dce8f7", 24, 190);
        } else if (boss.attack === "orbit") {
          for (let i = 0; i < 6; i++) fireProjectile(boss.x, boss.y, boss.phase + i * Math.PI / 3, 145, boss.damage, "#bd8cff", 8);
        } else if (boss.attack === "dash") {
          boss.x = clamp(boss.x + (hero.x - boss.x) * .65, 35, W - 35);
          boss.y = clamp(boss.y + (hero.y - boss.y) * .65, 35, H - 35);
          if (dist(hero, boss) < hero.r + boss.size + 16) hurtHero(boss.damage);
          addBurst(boss.x, boss.y, boss.color, 14, 150);
        } else {
          if (dist(hero, boss) < hero.r + boss.size + 30) hurtHero(boss.damage);
          addBurst(boss.x, boss.y, boss.color, 14, 130);
        }
        boss.attackTimer = Math.max(.7, 1.65 - bossIndex * .08) + rand(0, .45);
      }
      return;
    }
    if (boss.attackTimer <= 0) {
      boss.windup = boss.attack === "slam" ? .75 : boss.attack === "finale" ? .55 : .4;
      if (boss.attack === "slam" || boss.attack === "finale") floorMarks.push({ x: boss.x, y: boss.y, r: 115, life: boss.windup, maxLife: boss.windup, warning: true });
      tone(95 + bossIndex * 18, .08, "sine", .018);
    }
  }

  function hurtHero(amount) {
    if (hero.invuln > 0 || gameOver || victory) return;
    hero.hp -= amount; hero.invuln = .65; hero.flash = .16; shake = .15;
    addBurst(hero.x, hero.y, "#ff7385", 10, 120); tone(105, .12, "sawtooth", .035);
    if (hero.hp <= 0) {
      hero.hp = 0; gameOver = true; running = false;
      showOverlay("The pantry has fallen.", "You defeated " + defeated + " of " + bosses.length + " bosses and gathered " + shards + " spoon shards. Take a breath, then try again.", "Try Again");
      setStatus("Run ended. The spoon lives to fight another day.");
    }
  }

  function defeatBoss() {
    const defeatedBoss = boss;
    defeated++;
    shards += 10 + bossIndex * 5;
    hero.hp = Math.min(hero.maxHp, hero.hp + 18);
    hero.maxHp += 4; hero.hp += 4; level++;
    addBurst(defeatedBoss.x, defeatedBoss.y, defeatedBoss.color, 34, 230);
    for (let i = 0; i < 3; i++) pickups.push({ x: defeatedBoss.x + rand(-35, 35), y: defeatedBoss.y + rand(-35, 35), r: 8, type: "shard", life: 10 });
    tone(660, .18, "triangle", .04); setTimeout(() => tone(880, .2, "triangle", .03), 100);
    boss = null; projectiles = []; floorMarks = [];
    updateUI();
    if (defeated >= bosses.length) {
      victory = true; running = false;
      showOverlay("THE SPOON ALLIANCE WINS!", "The Grand Fork has been defeated. The pantry is free, and your spoon shall be remembered forever. Final shards: " + shards + ".", "Play Again");
      setStatus("Victory! The cutlery kingdom is safe.");
    } else {
      showOverlay("Boss defeated!", defeatedBoss.name + " has been polished into submission. You earned shards and recovered some health. Next up: " + bosses[bossIndex + 1].name + ".", "Face Next Boss");
      setStatus("Boss defeated. Ready for the next challenger.");
    }
  }

  function update(dt) {
    elapsed += dt;
    attackCooldown = Math.max(0, attackCooldown - dt);
    dashCooldown = Math.max(0, dashCooldown - dt);
    hero.invuln = Math.max(0, hero.invuln - dt);
    hero.flash = Math.max(0, hero.flash - dt);
    hero.attackTime = Math.max(0, hero.attackTime - dt);
    hero.dashTime = Math.max(0, hero.dashTime - dt);
    hero.stamina = Math.min(hero.maxStamina, hero.stamina + 19 * dt);
    shake = Math.max(0, shake - dt);
    if (messageTimer > 0) messageTimer -= dt;

    let dx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    let dy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
    const len = Math.hypot(dx, dy);
    if (len) {
      dx /= len; dy /= len; hero.facingX = dx; hero.facingY = dy;
      const speed = hero.dashTime > 0 ? 600 : hero.speed;
      hero.x += dx * speed * dt; hero.y += dy * speed * dt;
    }
    hero.x = clamp(hero.x, 25, W - 25); hero.y = clamp(hero.y, 35, H - 25);

    if (boss) {
      const d = dist(hero, boss);
      if (d > boss.size + hero.r + 6 && boss.windup <= 0 && boss.stunned <= 0) {
        const bx = (hero.x - boss.x) / (d || 1), by = (hero.y - boss.y) / (d || 1);
        const moveSpeed = boss.speed * (boss.attack === "dash" ? 1.08 : 1);
        boss.x = clamp(boss.x + bx * moveSpeed * dt, boss.size + 8, W - boss.size - 8);
        boss.y = clamp(boss.y + by * moveSpeed * dt, boss.size + 35, H - boss.size - 8);
      }
      boss.hitFlash = Math.max(0, boss.hitFlash - dt);
      boss.stunned = Math.max(0, boss.stunned - dt);
      bossAttack(dt);
      if (dist(hero, boss) < hero.r + boss.size - 3) {
        const d2 = dist(hero, boss) || 1;
        hero.x = clamp(hero.x + (hero.x - boss.x) / d2 * 100 * dt, 25, W - 25);
        hero.y = clamp(hero.y + (hero.y - boss.y) / d2 * 100 * dt, 35, H - 25);
        if (Math.random() < dt * 1.5) hurtHero(Math.ceil(boss.damage * .45));
      }
    }

    projectiles = projectiles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (Math.hypot(p.x - hero.x, p.y - hero.y) < p.r + hero.r) {
        hurtHero(p.damage); addBurst(p.x, p.y, p.color, 5, 80); return false;
      }
      return p.life > 0 && p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20;
    });

    floorMarks = floorMarks.filter(m => {
      m.life -= dt;
      if (!m.warning && m.life > 0 && dist(hero, m) < m.r && !m.hit) { hurtHero(m.damage || 0); m.hit = true; }
      return m.life > 0;
    });

    pickups = pickups.filter(p => {
      p.life -= dt;
      if (dist(hero, p) < hero.r + p.r + 5) {
        shards += 1; addBurst(p.x, p.y, "#f4c65e", 6, 75); tone(760, .04, "sine", .02); return false;
      }
      return p.life > 0;
    });

    particles = particles.filter(p => {
      p.life -= dt;
      if (!p.type) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; }
      return p.life > 0;
    });
    updateUI();
  }

  function roundedRect(x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  }

  function drawFloor() {
    ctx.fillStyle = "#111f36"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#213451"; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = "#344d70"; ctx.lineWidth = 4; ctx.strokeRect(12, 12, W - 24, H - 24);
    for (let i = 0; i < 7; i++) {
      const x = 55 + i * 137, y = 75 + (i % 3) * 205;
      ctx.fillStyle = "#263d5b"; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawSpoon(x, y, angle, scale = 1, color = "#f4c65e") {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
    ctx.fillStyle = color; ctx.strokeStyle = "#fff0b5"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(8, 0, 9, 6.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-23, -2.2, 27, 4.4, 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawHero() {
    ctx.save(); ctx.translate(hero.x, hero.y);
    if (hero.invuln > 0 && Math.floor(elapsed * 22) % 2 === 0) ctx.globalAlpha = .48;
    ctx.fillStyle = "#07101f66"; ctx.beginPath(); ctx.ellipse(0, 11, 19, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6fc8d9"; ctx.strokeStyle = "#d2fbff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, hero.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#152b49"; ctx.beginPath(); ctx.arc(4, -2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff4d8"; ctx.beginPath(); ctx.arc(7, -5, 2.2, 0, Math.PI * 2); ctx.fill();
    drawSpoon(hero.facingX * 20, hero.facingY * 20, Math.atan2(hero.facingY, hero.facingX), .8);
    if (hero.attackTime > 0) {
      ctx.strokeStyle = "#fff0b2"; ctx.lineWidth = 4; ctx.globalAlpha = hero.attackTime / .2;
      ctx.beginPath(); ctx.arc(0, 0, 43, -1.1, 1.1); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoss() {
    if (!boss) return;
    ctx.save(); ctx.translate(boss.x, boss.y);
    ctx.fillStyle = "#050b1680"; ctx.beginPath(); ctx.ellipse(0, boss.size * .7, boss.size * 1.1, boss.size * .42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = boss.hitFlash > 0 ? "#fff8e8" : boss.color;
    ctx.strokeStyle = "#fff4d8"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, boss.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#202a40";
    ctx.beginPath(); ctx.arc(-boss.size * .32, -boss.size * .1, 4, 0, Math.PI * 2); ctx.arc(boss.size * .32, -boss.size * .1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#202a40"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, boss.size * .12, boss.size * .3, .15, Math.PI - .15); ctx.stroke();
    if (boss.attack === "jab" || boss.attack === "dash" || boss.attack === "finale") {
      ctx.strokeStyle = "#dce5f2"; ctx.lineWidth = 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(boss.size * .6, 0); ctx.lineTo(boss.size + 17, -boss.size * .8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(boss.size + 13, -boss.size * .95); ctx.lineTo(boss.size + 22, -boss.size * .65); ctx.stroke();
    }
    ctx.restore();
    if (boss.windup > 0) {
      ctx.strokeStyle = "#ff7180"; ctx.lineWidth = 3; ctx.globalAlpha = .5 + Math.sin(elapsed * 18) * .25;
      ctx.beginPath(); ctx.arc(boss.x, boss.y, boss.size + 15 + Math.sin(elapsed * 15) * 5, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    const bw = 90, bh = 6;
    roundedRect(boss.x - bw / 2, boss.y - boss.size - 19, bw, bh, 3, "#081326");
    roundedRect(boss.x - bw / 2, boss.y - boss.size - 19, bw * Math.max(0, boss.hp / boss.maxHp), bh, 3, "#ff637c");
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake * 18, shake * 18), rand(-shake * 18, shake * 18));
    drawFloor();
    for (const m of floorMarks) {
      ctx.globalAlpha = m.warning ? .3 + Math.sin(elapsed * 16) * .15 : Math.max(0, m.life / m.maxLife) * .35;
      ctx.fillStyle = m.warning ? "#ff637c" : "#f4c65e";
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (m.warning ? .8 + Math.sin(elapsed * 12) * .06 : 1), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = m.warning ? "#ff8795" : "#ffe3a1"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of pickups) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(elapsed * 2);
      ctx.fillStyle = "#f4c65e"; ctx.strokeStyle = "#fff0b2"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r * .75, 0); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * .75, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    for (const p of projectiles) {
      ctx.fillStyle = p.color; ctx.strokeStyle = "#fff4d8"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    drawBoss(); drawHero();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      if (p.type === "slash") {
        ctx.strokeStyle = p.color; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(p.x, p.y, 22, p.angle - .85, p.angle + .85); ctx.stroke();
      } else {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (messageTimer > 0) {
      ctx.font = "900 22px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = "#08132699"; ctx.fillText(message, W / 2 + 2, 42 + 2);
      ctx.fillStyle = "#fff4d8"; ctx.fillText(message, W / 2, 42);
    }
    ctx.restore();
  }

  function loop(now) {
    if (!running || paused || gameOver || victory) { draw(); return; }
    const dt = Math.min(.033, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt); draw();
    if (running && !paused) requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
    keys.add(key);
    if (key === " " || key === "spacebar") attack();
    if (key === "shift") dash();
    if (key === "escape") pauseGame();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
  startBtn.addEventListener("click", () => {
    if (paused) { paused = false; $("pauseBtn").textContent = "Pause"; hideOverlay(); lastTime = performance.now(); requestAnimationFrame(loop); return; }
    if (boss && !running && !gameOver && !victory && defeated > 0) { spawnBoss(defeated); running = true; hideOverlay(); lastTime = performance.now(); requestAnimationFrame(loop); return; }
    startGame();
  });
  $("pauseBtn").addEventListener("click", pauseGame);
  $("restartBtn").addEventListener("click", resetGame);
  $("soundBtn").addEventListener("click", () => {
    soundOn = !soundOn; $("soundBtn").textContent = "Sound: " + (soundOn ? "On" : "Off");
    $("soundBtn").setAttribute("aria-pressed", String(soundOn));
    if (soundOn) tone(520, .08, "triangle", .03);
  });

  // Keep the page playable when the player starts the next encounter.
  const originalShowOverlay = showOverlay;
  resetGame();
  const oldDefeatBoss = defeatBoss;
  defeatBoss = function() {
    oldDefeatBoss();
    if (!victory) {
      startBtn.onclick = null;
      startBtn.textContent = "Face Next Boss";
    }
  };
})();
