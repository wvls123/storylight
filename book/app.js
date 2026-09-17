/* Лучик — Медвежонок Миша и упавшая звёздочка */
(() => {
  const PAGE_COUNT = 4;
  let TABLE_TOP = 1.12;
  const BOOK_TILT = -0.06;
  const CAM = { x: 1.4, y: 7.7, z: 10.6, lx: 0.1, ly: 3.2, lz: 0.2 };
  const ROOM_BG = 0xc9a57a;
  const PAGE_W = 2.35;
  const PAGE_D = 3.05;
  const CURL_SEGS = 48;

  const state = {
    book: null,
    pageIndex: 0,
    mode: "idle",
    volume: 1,
    wordEls: [],
    speaking: false,
    paused: false,
    cardZoom: false,
    camZoom: 1,
    starsCollected: 0,
    skyRestored: false,
    helpedBunny: false,
    drag: null,
    flipT: 0,
    flipping: false,
  };

  const canvas = document.getElementById("scene");
  const sparkleCanvas = document.getElementById("sparkles");
  const sparkleCtx = sparkleCanvas.getContext("2d");
  const storyEl = document.getElementById("story");
  const titleEl = document.getElementById("page-title");
  const kickerEl = document.getElementById("page-kicker");
  const hintEl = document.getElementById("hint");
  const starsEl = document.getElementById("stars");
  const vocabEl = document.getElementById("vocab");
  const toastEl = document.getElementById("toast");
  const cardEl = document.getElementById("card");
  const pauseBtn = document.getElementById("pause");

  let renderer, scene, camera, clock;
  let bookRoot, pageLeft, flipPage, flipPivot, pageShadow, popupRoot;
  let interactables = [];
  let textures = {};
  let models = { bear: null, lantern: null, bed: null, nightstand: null, books: null };
  let mixers = [];
  let lampLight, hemi, keyLight;
  let pointer = new THREE.Vector2();
  let raycaster = new THREE.Raycaster();
  let sparkles = [];
  let fireflies3d = [];
  let audioCtx = null;
  let activeAudio = null;
  let karaokeToken = 0;
  let ruVoice = null;

  function $(id) {
    return document.getElementById(id);
  }

  function currentPage() {
    return state.book.pages[state.pageIndex];
  }

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function whoosh() {
    ensureAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.45);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08 * state.volume, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  function chime() {
    ensureAudio();
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(990, t + 0.14);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06 * state.volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  function pickVoice() {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    const ru = voices.filter((v) => /^ru(-|$)/i.test(v.lang));
    ruVoice =
      ru.find((v) => /female|irina|milena|elena|svetlana|ksenia|женский/i.test(v.name)) ||
      ru[0] ||
      null;
  }

  function stopSpeech() {
    karaokeToken += 1;
    state.speaking = false;
    state.paused = false;
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }
    if (window.speechSynthesis) speechSynthesis.cancel();
    pauseBtn.hidden = true;
    pauseBtn.textContent = "Пауза";
    clearHighlight();
  }

  function playFile(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(false);
        return;
      }
      const a = new Audio(url);
      a.volume = state.volume;
      activeAudio = a;
      a.onended = () => {
        if (activeAudio === a) activeAudio = null;
        resolve(true);
      };
      a.onerror = () => {
        if (activeAudio === a) activeAudio = null;
        resolve(false);
      };
      a.play().catch(() => resolve(false));
    });
  }

  function speakSynth(text, opts) {
    const options = opts || {};
    if (!window.speechSynthesis || !text) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ru-RU";
      u.rate = options.rate || 0.9;
      u.pitch = options.pitch || 1.05;
      u.volume = state.volume;
      if (ruVoice) u.voice = ruVoice;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }

  async function speakText(text, fileUrl, opts) {
    ensureAudio();
    const ok = await playFile(fileUrl);
    if (!ok) await speakSynth(text, opts);
  }

  function clearHighlight() {
    state.wordEls.forEach((el) => el.classList.remove("active"));
  }

  function highlightWord(index) {
    clearHighlight();
    const el = state.wordEls[index];
    if (el) el.classList.add("active");
  }

  function renderStars() {
    starsEl.innerHTML = "";
    for (let i = 0; i < PAGE_COUNT; i += 1) {
      const star = document.createElement("div");
      star.className = "star" + (i <= state.pageIndex ? " on" : "");
      star.innerHTML =
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2.4l2.7 6.1 6.6.6-5 4.5 1.5 6.5L12 16.7 6.2 20.1 7.7 13.6 2.7 9.1l6.6-.6z"/></svg>';
      starsEl.appendChild(star);
    }
  }

  function renderCard() {
    const page = currentPage();
    kickerEl.textContent = "Страница " + page.id + " из 4";
    titleEl.textContent = page.title;
    hintEl.textContent = page.hint;
    storyEl.innerHTML = "";
    state.wordEls = [];
    page.words.forEach((word, index) => {
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = word.t;
      span.addEventListener("click", (ev) => {
        ev.stopPropagation();
        tapWord(index);
      });
      storyEl.appendChild(span);
      state.wordEls.push(span);
      storyEl.appendChild(document.createTextNode((word.p || "") + " "));
    });
    renderStars();
  }

  function tapWord(index) {
    const word = currentPage().words[index];
    if (!word) return;
    stopSpeech();
    highlightWord(index);
    speakText(word.t, null, { rate: 0.84, pitch: 1.1 });
    burst(window.innerWidth * 0.28, window.innerHeight * 0.42);
  }

  function showVocab(obj) {
    $("vocab-img").src = obj.icon;
    $("vocab-img").alt = obj.label;
    $("vocab-word").textContent = obj.label;
    vocabEl.hidden = false;
    window.clearTimeout(showVocab._t);
    showVocab._t = window.setTimeout(() => {
      vocabEl.hidden = true;
    }, 2400);
  }

  function showToast(text) {
    toastEl.hidden = false;
    toastEl.textContent = text;
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 1800);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function readAloud() {
    const page = currentPage();
    const token = karaokeToken;
    state.mode = "read";
    state.speaking = true;
    state.paused = false;
    pauseBtn.hidden = false;
    pauseBtn.textContent = "Пауза";
    ensureAudio();
    pickVoice();

    const timingPromise = (async () => {
      for (let i = 0; i < page.words.length; i += 1) {
        if (token !== karaokeToken) return;
        while (state.paused && token === karaokeToken) await wait(80);
        if (token !== karaokeToken) return;
        highlightWord(i);
        await wait(page.words[i].d * 1000);
      }
    })();

    const voicePromise = (async () => {
      const ok = await playFile(page.audio);
      if (!ok) await speakSynth(page.readText, { rate: 0.88 });
    })();

    await Promise.all([voicePromise, timingPromise]);
    if (token === karaokeToken) {
      state.speaking = false;
      pauseBtn.hidden = true;
      clearHighlight();
    }
  }

  function loadTexture(url) {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 8;
          resolve(tex);
        },
        undefined,
        reject
      );
    });
  }

  async function loadAllTextures() {
    const urls = {
      wood: "assets/tex-wood.png",
      paper: "assets/tex-paper.png",
      floor: "assets/tex-floor.png",
      cover: "assets/cover-misha.png",
      p1: "assets/page-1-bedroom.png",
      p2: "assets/page-2-garden.png",
      p3: "assets/page-3-meadow.png",
      p4: "assets/page-4-home.png",
      wall1: "assets/wall-bedroom.png",
      wall2: "assets/wall-garden.png",
      wall3: "assets/wall-meadow.png",
      wall4: "assets/wall-home.png",
      bear: "assets/icon-bear.png",
      bunny: "assets/icon-bunny.png",
      lantern: "assets/icon-lantern.png",
      bed: "assets/icon-bed.png",
      pillow: "assets/icon-pillow.png",
      scarf: "assets/icon-scarf.png",
      window: "assets/icon-window.png",
      firefly: "assets/icon-firefly.png",
      star: "assets/icon-star.png",
    };
    const entries = await Promise.all(
      Object.entries(urls).map(async ([key, url]) => {
        try {
          return [key, await loadTexture(url)];
        } catch (err) {
          console.warn("texture miss", url, err);
          return [key, null];
        }
      })
    );
    entries.forEach(([key, tex]) => {
      if (tex) textures[key] = tex;
    });
    ["floor", "wood"].forEach((key) => {
      if (!textures[key]) return;
      textures[key].wrapS = textures[key].wrapT = THREE.RepeatWrapping;
    });
    if (textures.floor) textures.floor.repeat.set(3.2, 3.2);
  }

  function mat(map, extras) {
    return new THREE.MeshStandardMaterial(
      Object.assign({ map, roughness: 0.86, metalness: 0.02 }, extras || {})
    );
  }

  function makeLeftPageMaterial() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 1280;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#f3e3c8";
    ctx.fillRect(0, 0, c.width, c.height);
    if (textures.paper && textures.paper.image) {
      ctx.drawImage(textures.paper.image, 0, 0, c.width, c.height);
    }
    const gutter = ctx.createLinearGradient(c.width * 0.72, 0, c.width, 0);
    gutter.addColorStop(0, "rgba(70,36,16,0)");
    gutter.addColorStop(1, "rgba(36,16,8,0.45)");
    ctx.fillStyle = gutter;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "rgba(132,86,48,0.25)";
    ctx.lineWidth = 8;
    ctx.strokeRect(48, 56, c.width - 120, c.height - 112);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return mat(tex, { side: THREE.DoubleSide, roughness: 0.93 });
  }

  function makeWallTexture() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 1024);
    g.addColorStop(0, "#f3d7b2");
    g.addColorStop(1, "#d9ad7a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = "rgba(180,110,60,0.08)";
    for (let x = 0; x < 1024; x += 48) ctx.fillRect(x, 0, 12, 1024);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1.35);
    return tex;
  }

  function makeRoom() {
    const room = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      mat(textures.floor || null, { color: textures.floor ? 0xffffff : 0x8a6240, roughness: 0.92 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    room.add(floor);

    const wallMat = mat(makeWallTexture(), { roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(24, 9.2), wallMat);
    back.position.set(0, 4.55, -7.1);
    back.receiveShadow = true;
    room.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(24, 9.2), wallMat);
    left.position.set(-9.4, 4.55, 0);
    left.rotation.y = Math.PI / 2;
    room.add(left);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(24, 9.2), wallMat.clone());
    right.position.set(9.4, 4.55, 0);
    right.rotation.y = -Math.PI / 2;
    room.add(right);
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0xf0dcc0, roughness: 1 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 8.4;
    room.add(ceiling);

    const night = new THREE.Mesh(
      new THREE.PlaneGeometry(2.7, 2.2),
      new THREE.MeshStandardMaterial({
        color: 0x1c2748,
        emissive: 0x15203c,
        emissiveIntensity: 0.4,
        roughness: 0.65,
      })
    );
    night.position.set(-1.6, 4.4, -7.04);
    night.name = "roomWindow";
    room.add(night);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.96, 2.46, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x7a4a28, roughness: 0.55 })
    );
    frame.position.set(-1.6, 4.4, -7.07);
    room.add(frame);
    [-3.1, -0.1].forEach((x) => {
      const curtain = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 4.7),
        new THREE.MeshStandardMaterial({ color: 0xb85a48, roughness: 0.72, side: THREE.DoubleSide })
      );
      curtain.position.set(x, 3.55, -6.95);
      room.add(curtain);
    });
    scene.add(room);
  }

  function loadGltf(url) {
    return new window.GLTFLoader().loadAsync(url);
  }

  function enableShadows(root) {
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }

  function modelSize(root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    return { box, size: box.getSize(new THREE.Vector3()) };
  }

  function scaleByWidth(root, width) {
    const { size } = modelSize(root);
    root.scale.multiplyScalar(width / Math.max(size.x, 0.001));
  }

  function scaleByHeight(root, height) {
    const { size } = modelSize(root);
    root.scale.multiplyScalar(height / Math.max(size.y, 0.001));
  }

  function sitOnY(root, y) {
    const { box } = modelSize(root);
    root.position.y += y - box.min.y;
  }

  function tagMeshes(root, data) {
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.userData = Object.assign({}, data);
        interactables.push(obj);
      }
    });
  }

  function cloneLantern() {
    return models.lantern ? models.lantern.clone(true) : null;
  }

  async function loadFurniture() {
    const tableGltf = await loadGltf("assets/models/WoodenTable_01/WoodenTable_01_1k.gltf");
    const table = tableGltf.scene;
    table.name = "WoodenTable_01";
    scaleByWidth(table, 9.05);
    sitOnY(table, 0);
    table.position.x = 0.1;
    enableShadows(table);
    TABLE_TOP = modelSize(table).box.max.y;
    tagMeshes(table, { id: "table", label: "стол", speak: "стол", icon: "assets/tex-wood.png" });
    scene.add(table);

    const lampGltf = await loadGltf("assets/models/vintage_oil_lamp/vintage_oil_lamp_1k.gltf");
    const lamp = lampGltf.scene;
    scaleByHeight(lamp, 0.95);
    lamp.position.set(-3.15, 0, 1.22);
    sitOnY(lamp, TABLE_TOP);
    enableShadows(lamp);
    tagMeshes(lamp, { id: "lamp", label: "лампа", speak: "лампа", icon: "assets/icon-lantern.png" });
    scene.add(lamp);
    const lampBox = modelSize(lamp).box;
    lampLight = new THREE.PointLight(0xffcc88, 9.5, 12, 1.5);
    lampLight.position.set(lamp.position.x, lampBox.max.y - 0.05, lamp.position.z);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(1024, 1024);
    lampLight.shadow.bias = -0.003;
    scene.add(lampLight);

    const lanternGltf = await loadGltf("assets/models/wooden_lantern_01/wooden_lantern_01_1k.gltf");
    models.lantern = lanternGltf.scene;
    const tableLantern = cloneLantern();
    scaleByHeight(tableLantern, 0.62);
    tableLantern.position.set(3.25, 0, 1.18);
    sitOnY(tableLantern, TABLE_TOP);
    enableShadows(tableLantern);
    tagMeshes(tableLantern, {
      id: "lantern",
      label: "фонарик",
      speak: "фонарик",
      icon: "assets/icon-lantern.png",
    });
    scene.add(tableLantern);

    try {
      const bedGltf = await loadGltf("assets/models/GothicBed_01/GothicBed_01_1k.gltf");
      models.bed = bedGltf.scene;
    } catch (e) {
      console.warn(e);
    }
    try {
      const ns = await loadGltf(
        "assets/models/ClassicNightstand_01/ClassicNightstand_01_1k.gltf"
      );
      models.nightstand = ns.scene;
    } catch (e) {
      console.warn(e);
    }
    try {
      const books = await loadGltf(
        "assets/models/book_encyclopedia_set_01/book_encyclopedia_set_01_1k.gltf"
      );
      models.books = books.scene;
    } catch (e) {
      console.warn(e);
    }

    try {
      const bearGltf = await loadGltf("assets/models/plush_bear/plush_bear.glb");
      models.bear = bearGltf.scene;
      enableShadows(models.bear);
    } catch (e) {
      console.warn("bear load", e);
    }
  }

  function seatBookOnTable() {
    const held = popupRoot && popupRoot.parent ? popupRoot : null;
    if (held) bookRoot.remove(held);
    bookRoot.updateMatrixWorld(true);
    const table = scene.getObjectByName("WoodenTable_01");
    let top = TABLE_TOP;
    if (table) {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(bookRoot.position.x, TABLE_TOP + 4, bookRoot.position.z),
        new THREE.Vector3(0, -1, 0)
      );
      const hits = ray.intersectObject(table, true);
      if (hits.length) top = hits[0].point.y;
    }
    const box = new THREE.Box3().setFromObject(bookRoot);
    bookRoot.position.y += top + 0.001 - box.min.y;
    TABLE_TOP = top;
    if (held) bookRoot.add(held);
  }

  function makeCurlGeometry(width, depth) {
    const geo = new THREE.PlaneGeometry(width, depth, CURL_SEGS, 12);
    geo.rotateX(-Math.PI / 2);
    geo.translate(width / 2, 0, 0);
    const orig = Float32Array.from(geo.attributes.position.array);
    geo.userData.orig = orig;
    geo.userData.w = width;
    geo.userData.d = depth;
    return geo;
  }

  function applyCurl(geo, t, forward) {
    const p = Math.min(1, Math.max(0, t));
    const pos = geo.attributes.position;
    const orig = geo.userData.orig;
    const w = geo.userData.w;
    const sign = forward ? 1 : -1;
    const apex = Math.sin(p * Math.PI);
    for (let i = 0; i < pos.count; i += 1) {
      const ox = orig[i * 3];
      const oz = orig[i * 3 + 2];
      const u = Math.max(0, Math.min(1, ox / w));
      const localAngle = sign * p * Math.PI * Math.pow(u, 0.82);
      let x = ox * Math.cos(localAngle);
      let y = Math.abs(ox) * Math.sin(Math.abs(localAngle));
      y += Math.sin(u * Math.PI) * apex * 0.14;
      const cone = 1 + (oz / (geo.userData.d || PAGE_D)) * 0.04 * apex;
      x *= cone;
      pos.setXYZ(i, x, y, oz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function makeFlipPageMaterial(pageId) {
    const frontMap = textures["p" + pageId] || textures.paper;
    const front = mat(frontMap, { side: THREE.FrontSide, roughness: 0.88 });
    const back = mat(textures.paper, { side: THREE.BackSide, roughness: 0.92, color: 0xf2e2c8 });
    return [front, back];
  }

  function setFlipTexture(pageId) {
    if (!flipPage) return;
    const map = textures["p" + pageId] || textures.paper;
    if (Array.isArray(flipPage.material)) {
      flipPage.material[0].map = map;
      flipPage.material[0].needsUpdate = true;
    } else {
      flipPage.material.map = map;
      flipPage.material.needsUpdate = true;
    }
  }

  function makeBook() {
    bookRoot = new THREE.Group();
    bookRoot.position.set(0.12, TABLE_TOP + 0.01, 0.12);
    bookRoot.rotation.x = BOOK_TILT;

    const block = new THREE.Mesh(
      new THREE.BoxGeometry(PAGE_W * 2 + 0.5, 0.08, PAGE_D + 0.2),
      new THREE.MeshStandardMaterial({ color: 0x3f1d14, roughness: 0.72 })
    );
    block.position.set(0, 0.04, 0);
    block.castShadow = true;
    block.receiveShadow = true;
    bookRoot.add(block);

    const coverMat = mat(textures.cover, { roughness: 0.6 });
    const coverLeft = new THREE.Mesh(
      new THREE.BoxGeometry(PAGE_W + 0.12, 0.09, PAGE_D + 0.12),
      coverMat
    );
    coverLeft.position.set(-(PAGE_W / 2 + 0.1), 0.12, 0);
    coverLeft.castShadow = true;
    bookRoot.add(coverLeft);

    const coverRight = new THREE.Mesh(
      new THREE.BoxGeometry(PAGE_W + 0.12, 0.09, PAGE_D + 0.12),
      new THREE.MeshStandardMaterial({ color: 0x6e3424, roughness: 0.6 })
    );
    coverRight.position.set(PAGE_W / 2 + 0.1, 0.12, 0);
    coverRight.castShadow = true;
    bookRoot.add(coverRight);

    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.1, PAGE_D + 0.1),
      new THREE.MeshStandardMaterial({ color: 0x5c2418, roughness: 0.55 })
    );
    spine.position.set(0, 0.05, 0);
    bookRoot.add(spine);

    pageLeft = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_D), makeLeftPageMaterial());
    pageLeft.rotation.x = -Math.PI / 2;
    pageLeft.position.set(-(PAGE_W / 2 + 0.1), 0.175, 0);
    pageLeft.receiveShadow = true;
    bookRoot.add(pageLeft);

    flipPivot = new THREE.Group();
    flipPivot.position.set(0, 0.178, 0);
    const curlGeo = makeCurlGeometry(PAGE_W, PAGE_D);
    const mats = makeFlipPageMaterial(1);
    // Double-sided single material for curl mesh normals
    flipPage = new THREE.Mesh(
      curlGeo,
      mat(textures.p1 || textures.paper, { side: THREE.DoubleSide, roughness: 0.88 })
    );
    flipPage.castShadow = true;
    flipPage.receiveShadow = true;
    flipPivot.add(flipPage);

    pageShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(PAGE_W * 0.95, PAGE_D * 0.95),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    pageShadow.rotation.x = -Math.PI / 2;
    pageShadow.position.set(PAGE_W * 0.48, 0.002, 0);
    flipPivot.add(pageShadow);
    bookRoot.add(flipPivot);

    popupRoot = new THREE.Group();
    popupRoot.position.set(0.55, 0.18, 0);
    bookRoot.add(popupRoot);

    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 3.8),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0.12, TABLE_TOP + 0.001, 0.08);
    scene.add(contactShadow);

    scene.add(bookRoot);
    seatBookOnTable();
    applyCurl(flipPage.geometry, 0, true);
  }

  function clearPopups() {
    mixers.forEach((m) => m.stopAllAction());
    mixers = [];
    fireflies3d = [];
    interactables = interactables.filter((obj) => !obj.userData || !obj.userData.popup);
    while (popupRoot.children.length) {
      const child = popupRoot.children[0];
      popupRoot.remove(child);
      child.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
  }

  function markHit(mesh, data) {
    mesh.userData = Object.assign({ popup: true }, data);
    mesh.castShadow = true;
    interactables.push(mesh);
    return mesh;
  }

  function sprite(map, w, h) {
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        map,
        transparent: true,
        alphaTest: 0.1,
        roughness: 0.45,
        metalness: 0,
        side: THREE.DoubleSide,
      })
    );
  }

  function backdrop(map, w, h, z) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(map, { roughness: 0.78, side: THREE.DoubleSide }));
    wall.position.set(0.25, h / 2, z);
    wall.receiveShadow = true;
    popupRoot.add(wall);
    return wall;
  }

  function placeBear(x, y, z, height) {
    const hit = {
      id: "misha",
      label: "Миша",
      speak: "медвежонок Миша",
      icon: "assets/icon-bear.png",
      audio: "audio/word-misha.mp3",
    };
    if (models.bear) {
      const bear = models.bear.clone(true);
      scaleByHeight(bear, height);
      bear.position.set(x, 0, z);
      sitOnY(bear, y);
      bear.rotation.y = Math.PI - 0.25;
      enableShadows(bear);
      bear.traverse((obj) => {
        if (obj.isMesh) {
          // Soften materials for plush look
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              if (m.roughness !== undefined) m.roughness = 0.92;
              if (m.metalness !== undefined) m.metalness = 0;
              if (m.color) m.color.setHex(0xe0b07a);
              m.needsUpdate = true;
            });
          }
          markHit(obj, hit);
        }
      });
      popupRoot.add(bear);
      return bear;
    }
    // Soft procedural fallback (no angular fox)
    const g = makeSoftBear();
    g.position.set(x, y, z);
    g.rotation.y = Math.PI - 0.25;
    g.scale.setScalar(height / 1.6);
    popupRoot.add(g);
    return g;
  }

  function makeSoftBear() {
    const g = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: 0xc48c59, roughness: 0.95, metalness: 0 });
    const belly = new THREE.MeshStandardMaterial({ color: 0xebd2af, roughness: 0.92, metalness: 0 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 22), fur);
    body.position.y = 0.45;
    g.add(body);
    const tum = new THREE.Mesh(new THREE.SphereGeometry(0.28, 22, 18), belly);
    tum.position.set(0, 0.42, 0.22);
    g.add(tum);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 22), fur);
    head.position.set(0, 1.05, 0.05);
    g.add(head);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 14), belly);
    snout.position.set(0, 0.95, 0.32);
    g.add(snout);
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), fur);
      ear.position.set(0.24 * s, 1.3, 0);
      g.add(ear);
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), fur);
      arm.scale.set(0.85, 1.25, 0.85);
      arm.position.set(0.48 * s, 0.55, 0.05);
      g.add(arm);
      const leg = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), fur);
      leg.scale.set(0.9, 1.15, 0.95);
      leg.position.set(0.22 * s, 0.14, 0.05);
      g.add(leg);
    });
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.06, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xc84646, roughness: 0.7 })
    );
    scarf.position.set(0, 0.78, 0.05);
    scarf.rotation.x = Math.PI / 2;
    g.add(scarf);
    enableShadows(g);
    g.traverse((obj) => {
      if (obj.isMesh) {
        markHit(obj, {
          id: "misha",
          label: "Миша",
          speak: "медвежонок Миша",
          icon: "assets/icon-bear.png",
          audio: "audio/word-misha.mp3",
        });
      }
    });
    return g;
  }

  function makeBunny() {
    const g = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: 0xf0e6dc, roughness: 0.94 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xf5b8c4, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 18), fur);
    body.position.y = 0.32;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), fur);
    head.position.set(0, 0.68, 0.04);
    g.add(head);
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), fur);
      ear.scale.set(0.85, 2.4, 0.7);
      ear.position.set(0.1 * s, 1.0, 0);
      g.add(ear);
      const inn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), pink);
      inn.scale.set(0.7, 2.0, 0.5);
      inn.position.set(0.1 * s, 1.0, 0.03);
      g.add(inn);
    });
    enableShadows(g);
    g.traverse((obj) => {
      if (obj.isMesh) {
        markHit(obj, {
          id: "bunny",
          label: "зайчонок",
          speak: "зайчонок",
          icon: "assets/icon-bunny.png",
          audio: "audio/word-zaichonok.mp3",
          bunny: true,
        });
      }
    });
    return g;
  }

  function makeBush(x, z) {
    const g = new THREE.Group();
    const matG = new THREE.MeshStandardMaterial({ color: 0x3f7a45, roughness: 0.85 });
    for (let i = 0; i < 4; i += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.22 + i * 0.04, 14, 12), matG);
      s.position.set((i % 2) * 0.15 - 0.05, 0.2 + i * 0.05, (i % 3) * 0.08);
      g.add(s);
    }
    g.position.set(x, 0, z);
    enableShadows(g);
    return g;
  }

  function buildPopups() {
    clearPopups();
    state.helpedBunny = false;
    state.starsCollected = 0;
    const builders = { 1: buildBedroom, 2: buildGarden, 3: buildMeadow, 4: buildHome };
    (builders[currentPage().id] || buildBedroom)();
    popupRoot.userData.t = 0;
    popupRoot.userData.fold = 0;
    popupRoot.scale.set(1, 0.05, 1);
    setFlipTexture(currentPage().id);
  }

  function buildBedroom() {
    backdrop(textures.wall1 || textures.p1, 3.9, 1.75, -1.18);
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.03, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x7a4e2e, roughness: 0.85 })
    );
    floor.position.set(0.2, 0.015, 0.05);
    floor.receiveShadow = true;
    popupRoot.add(floor);

    // Cozy children's bed (soft forms — not gothic box horror)
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.22, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.75, map: textures.wood || null })
    );
    frame.position.set(-0.2, 0.18, 0.15);
    frame.castShadow = true;
    markHit(frame, { id:"bed", label:"кровать", speak:"кровать", icon:"assets/icon-bed.png", audio:"audio/word-krovat.mp3" });
    popupRoot.add(frame);
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.14, 0.82),
      new THREE.MeshStandardMaterial({ color: 0xf3e4c8, roughness: 0.9 })
    );
    mattress.position.set(-0.2, 0.34, 0.15);
    popupRoot.add(mattress);
    const quilt = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.1, 0.72),
      new THREE.MeshStandardMaterial({ color: 0xd96b5c, roughness: 0.85 })
    );
    quilt.position.set(0.05, 0.42, 0.15);
    quilt.castShadow = true;
    popupRoot.add(quilt);
    const headboard = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.55, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x7a4a2e, roughness: 0.7, map: textures.wood || null })
    );
    headboard.position.set(-0.2, 0.5, -0.3);
    popupRoot.add(headboard);

    if (models.nightstand) {
      const ns = models.nightstand.clone(true);
      scaleByHeight(ns, 0.48);
      ns.position.set(1.25, 0, 0.3);
      sitOnY(ns, 0.03);
      enableShadows(ns);
      popupRoot.add(ns);
    }

    // Dim night star on shelf
    const shelfStar = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 18, 14),
      new THREE.MeshStandardMaterial({
        color: 0x8890a8,
        emissive: 0x334466,
        emissiveIntensity: 0.15,
        roughness: 0.45,
      })
    );
    shelfStar.position.set(1.35, 0.62, 0.35);
    markHit(shelfStar, {
      id: "starlight",
      label: "звёздочка",
      speak: "ночная звёздочка",
      icon: "assets/icon-star.png",
      audio: "audio/word-zvezdochka.mp3",
    });
    popupRoot.add(shelfStar);

    const pillow = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xf2ddc0, roughness: 0.9 })
    );
    pillow.scale.set(1.5, 0.55, 1.1);
    pillow.position.set(-0.55, 0.55, 0.25);
    markHit(pillow, {
      id: "pillow",
      label: "подушка",
      speak: "подушка",
      icon: "assets/icon-pillow.png",
      audio: "audio/word-podushka.mp3",
    });
    popupRoot.add(pillow);

    placeBear(0.35, 0.42, 0.45, 0.95);
  }

  function buildGarden() {
    backdrop(textures.wall2 || textures.p2, 4.0, 1.7, -1.18);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 28),
      new THREE.MeshStandardMaterial({ color: 0x3f6a3a, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0.2, 0.01, 0.1);
    ground.receiveShadow = true;
    popupRoot.add(ground);
    popupRoot.add(makeBush(-1.3, -0.2));
    popupRoot.add(makeBush(1.4, -0.15));
    popupRoot.add(makeBush(1.1, 0.5));
    placeBear(-0.35, 0.05, 0.55, 1.0);

    const scarf = sprite(textures.scarf || textures.bear, 0.45, 0.28);
    scarf.position.set(-0.45, 0.72, 0.55);
    markHit(scarf, {
      id: "scarf",
      label: "шарфик",
      speak: "красный шарфик",
      icon: "assets/icon-scarf.png",
      audio: "audio/word-sharfik.mp3",
    });
    popupRoot.add(scarf);

    for (let i = 0; i < 6; i += 1) {
      const ff = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 14, 12),
        new THREE.MeshStandardMaterial({
          color: 0xfff2a0,
          emissive: 0xffd866,
          emissiveIntensity: 1.5,
          roughness: 0.25,
        })
      );
      ff.position.set(0.1 + i * 0.2, 0.4 + (i % 3) * 0.1, 0.25 + Math.sin(i) * 0.15);
      markHit(ff, {
        id: "firefly-" + i,
        label: "светлячок",
        speak: "светлячок",
        icon: "assets/icon-firefly.png",
        audio: "audio/word-svetlyachok.mp3",
        drag: true,
        x: ff.position.x,
        y: ff.position.y,
        z: ff.position.z,
      });
      ff.add(new THREE.PointLight(0xffe08a, 0.5, 1.1));
      popupRoot.add(ff);
      fireflies3d.push(ff);
    }
  }

  function buildMeadow() {
    backdrop(textures.wall3 || textures.p3, 4.0, 1.7, -1.18);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 32),
      new THREE.MeshStandardMaterial({ color: 0x4f7d45, roughness: 0.88 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0.2, 0.01, 0.15);
    ground.receiveShadow = true;
    popupRoot.add(ground);
    placeBear(-0.85, 0.05, 0.5, 0.95);

    const bunny = makeBunny();
    bunny.position.set(0.7, 0, 0.35);
    bunny.rotation.y = Math.PI - 0.2;
    popupRoot.add(bunny);
    // yarn tangle
    const yarn = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.035, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xd45c6a, roughness: 0.65 })
    );
    yarn.position.set(0.7, 0.18, 0.45);
    yarn.rotation.x = 0.8;
    popupRoot.add(yarn);

    const star = sprite(textures.star, 0.42, 0.42);
    star.position.set(0.15, 0.32, 0.55);
    star.material.emissive = new THREE.Color(0x665522);
    star.material.emissiveIntensity = 0.3;
    markHit(star, {
      id: "star-main",
      label: "звёздочка",
      speak: "спасибо",
      icon: "assets/icon-star.png",
      audio: "audio/word-spasibo.mp3",
      star: true,
      collected: false,
    });
    popupRoot.add(star);
    const glow = new THREE.PointLight(0xffe6a0, 0.45, 1.2);
    glow.position.copy(star.position);
    popupRoot.add(glow);
  }

  function buildHome() {
    backdrop(textures.wall4 || textures.p4, 4.0, 1.75, -1.18);
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.03, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x7a4e2e, roughness: 0.85 })
    );
    floor.position.set(0.2, 0.015, 0.05);
    floor.receiveShadow = true;
    popupRoot.add(floor);

    const frameH = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.22, 0.92),
      new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.75, map: textures.wood || null })
    );
    frameH.position.set(-0.2, 0.18, 0.15);
    popupRoot.add(frameH);
    const matH = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.14, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xf3e4c8, roughness: 0.9 })
    );
    matH.position.set(-0.2, 0.34, 0.15);
    popupRoot.add(matH);
    const quiltH = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.1, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xd96b5c, roughness: 0.85 })
    );
    quiltH.position.set(0.0, 0.42, 0.15);
    popupRoot.add(quiltH);

    if (models.nightstand) {
      const ns = models.nightstand.clone(true);
      scaleByHeight(ns, 0.5);
      ns.position.set(1.25, 0, 0.3);
      sitOnY(ns, 0.03);
      enableShadows(ns);
      popupRoot.add(ns);
    }

    const shelfStar = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 20, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffe29a,
        emissive: 0xffc878,
        emissiveIntensity: state.skyRestored ? 1.4 : 0.25,
        roughness: 0.35,
      })
    );
    shelfStar.position.set(1.3, 0.65, 0.35);
    shelfStar.userData.skyStar = true;
    markHit(shelfStar, {
      id: "starlight",
      label: "звёздочка",
      speak: "колыбельная",
      icon: "assets/icon-star.png",
      audio: "audio/word-kolybelnaya.mp3",
      wake: true,
    });
    popupRoot.add(shelfStar);
    shelfStar.add(new THREE.PointLight(0xffd890, state.skyRestored ? 2.2 : 0.4, 2.5));

    const pillow = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xf2ddc0, roughness: 0.9 })
    );
    pillow.scale.set(1.5, 0.55, 1.1);
    pillow.position.set(-0.5, 0.55, 0.25);
    markHit(pillow, {
      id: "pillow",
      label: "подушка",
      speak: "подушка",
      icon: "assets/icon-pillow.png",
      audio: "audio/word-podushka.mp3",
    });
    popupRoot.add(pillow);

    placeBear(0.3, 0.42, 0.4, 0.95);
  }

  function animatePopups(dt) {
    popupRoot.userData.t = (popupRoot.userData.t || 0) + dt;
    const fold = popupRoot.userData.fold || 0;
    if (fold > 0) {
      const k = Math.min(1, fold);
      popupRoot.scale.set(1, Math.max(0.05, 1 - k), 1);
      return;
    }
    const t = Math.min(1, popupRoot.userData.t / 0.75);
    const ease = 1 - Math.pow(1 - t, 3);
    popupRoot.scale.set(1, 0.08 + 0.92 * ease, 1);

    fireflies3d.forEach((ff, i) => {
      if (ff.userData.dragOffset) {
        ff.position.x = ff.userData.baseX + ff.userData.dragOffset.x;
        ff.position.y = ff.userData.baseY + ff.userData.dragOffset.y;
        ff.position.z = ff.userData.baseZ + ff.userData.dragOffset.z;
      } else {
        const base = ff.userData;
        ff.position.y = (base.y || ff.position.y) + Math.sin(performance.now() / 400 + i) * 0.04;
      }
    });

    if (state.skyRestored) {
      popupRoot.traverse((obj) => {
        if (obj.userData && obj.userData.skyStar && obj.material) {
          obj.material.emissiveIntensity = 1.3 + Math.sin(performance.now() / 300 + obj.id) * 0.4;
        }
      });
    }
  }

  async function initThree() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    const boot = viewportSize();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(boot.w, boot.h, true);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(ROOM_BG);
    scene.fog = new THREE.Fog(ROOM_BG, 18, 34);

    camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.position.set(CAM.x, CAM.y, CAM.z);
    camera.lookAt(CAM.lx, CAM.ly, CAM.lz);
    clock = new THREE.Clock();

    hemi = new THREE.HemisphereLight(0xffe8cc, 0x7a5a3c, 0.98);
    scene.add(hemi);
    keyLight = new THREE.DirectionalLight(0xffe2b8, 1.08);
    keyLight.position.set(4.2, 8.2, 5.4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -8;
    scene.add(keyLight);
    const fill = new THREE.DirectionalLight(0xd8ecff, 0.3);
    fill.position.set(-5, 4.8, -3);
    scene.add(fill);

    makeRoom();
    await loadFurniture();
    makeBook();
    buildPopups();
    seatBookOnTable();
    applyCamera();
    window.addEventListener("resize", onResize);
  }

  function applyCamera(pointerNudge) {
    const nudge = pointerNudge || { x: 0, y: 0 };
    const zoom = state.camZoom;
    const from = new THREE.Vector3(CAM.x, CAM.y, CAM.z);
    const look = new THREE.Vector3(CAM.lx, CAM.ly, CAM.lz);
    const pos = from.clone().lerp(look, 1 - 1 / zoom);
    camera.position.set(pos.x + nudge.x, pos.y + nudge.y, pos.z);
    camera.lookAt(CAM.lx, CAM.ly, CAM.lz);
  }

  function bumpZoom(delta) {
    state.camZoom = Math.min(1.85, Math.max(0.88, state.camZoom + delta));
    applyCamera();
  }

  function viewportSize() {
    const w = Math.max(320, Math.min(window.innerWidth || 1280, 1920));
    const h = Math.max(240, Math.min(window.innerHeight || 720, 1080));
    return { w, h };
  }

  function onResize() {
    const { w, h } = viewportSize();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, true);
    sparkleCanvas.width = w;
    sparkleCanvas.height = h;
    sparkleCanvas.style.width = w + 'px';
    sparkleCanvas.style.height = h + 'px';
  }

  function ndcFromEvent(ev) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function hitsFromEvent(ev) {
    ndcFromEvent(ev);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(interactables, true);
  }

  function onPointerDown(ev) {
    if (ev.target.closest(".card, .dock, .topbar, .vocab")) return;
    if (state.flipping) return;
    const hits = hitsFromEvent(ev);
    if (!hits.length) return;
    const mesh = hits[0].object;
    const data = mesh.userData || {};
    if (data.drag) {
      state.drag = { mesh, startX: ev.clientX, startY: ev.clientY };
      mesh.userData.baseX = mesh.userData.x ?? mesh.position.x;
      mesh.userData.baseY = mesh.userData.y ?? mesh.position.y;
      mesh.userData.baseZ = mesh.userData.z ?? mesh.position.z;
      mesh.userData.dragOffset = { x: 0, y: 0, z: 0 };
      canvas.setPointerCapture(ev.pointerId);
      return;
    }
    handleTap(mesh, ev);
  }

  function onPointerMove(ev) {
    const nx = (ev.clientX / window.innerWidth - 0.5) * 0.4;
    const ny = (ev.clientY / window.innerHeight - 0.5) * 0.2;
    applyCamera({ x: nx, y: -ny });
    trail(ev.clientX, ev.clientY);
    if (!state.drag) return;
    const dx = (ev.clientX - state.drag.startX) / 220;
    const dy = (ev.clientY - state.drag.startY) / 220;
    state.drag.mesh.userData.dragOffset = { x: dx, y: -dy, z: 0 };
  }

  function onPointerUp(ev) {
    if (!state.drag) return;
    const mesh = state.drag.mesh;
    const off = mesh.userData.dragOffset || { x: 0, y: 0, z: 0 };
    if (Math.hypot(off.x, off.y) > 0.18) {
      showToast("Иди за нами!");
      speakText("иди за нами", "audio/word-svetlyachok.mp3");
      burst(ev.clientX, ev.clientY);
      flyFirefly(mesh);
    } else {
      handleTap(mesh, ev);
    }
    canvas.releasePointerCapture(ev.pointerId);
    state.drag = null;
  }

  function flyFirefly(mesh) {
    const start = performance.now();
    const from = mesh.position.clone();
    function step(now) {
      const k = Math.min(1, (now - start) / 900);
      mesh.position.x = from.x + k * 0.9;
      mesh.position.y = from.y + k * 0.8;
      mesh.position.z = from.z - k * 0.5;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function handleTap(mesh, ev) {
    const data = mesh.userData || {};
    if (!data.label) return;
    burst(ev.clientX, ev.clientY);
    showVocab(data);
    chime();

    if (data.bunny) {
      state.helpedBunny = true;
      speakText("спасибо, Миша", data.audio);
      showToast("Зайчонок свободен!");
      return;
    }

    if (data.star && !data.collected) {
      if (currentPage().id === 3 && !state.helpedBunny) {
        showToast("Сначала помоги зайчонку");
        speakText("зайчонок", "audio/word-zaichonok.mp3");
        return;
      }
      data.collected = true;
      mesh.visible = false;
      state.starsCollected += 1;
      speakText("спасибо", data.audio);
      showToast("Звёздочка снова тёплая!");
      if (state.starsCollected >= 1) showToast("Можно нести её домой!");
      return;
    }

    if (data.wake) {
      state.skyRestored = true;
      hemi.intensity = 1.25;
      hemi.color.set(0xffe6c8);
      if (keyLight) keyLight.intensity = 1.3;
      const win = scene.getObjectByName("roomWindow");
      if (win) {
        win.material.color.set(0x2a3a70);
        win.material.emissive.set(0x8899cc);
        win.material.emissiveIntensity = 0.85;
      }
      speakText("колыбельная", data.audio);
      showToast("Спокойных снов, Миша!");
      return;
    }

    speakText(data.speak || data.label, data.audio);
  }

  function burst(x, y) {
    for (let i = 0; i < 14; i += 1) {
      sparkles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.9) * 4,
        life: 1,
        r: 2 + Math.random() * 3,
      });
    }
  }

  function trail(x, y) {
    if (Math.random() > 0.4) return;
    sparkles.push({ x, y, vx: (Math.random() - 0.5) * 0.6, vy: -0.6, life: 0.7, r: 1.4 });
  }

  function drawSparkles(dt) {
    sparkleCtx.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);
    sparkles = sparkles.filter((p) => p.life > 0);
    sparkles.forEach((p) => {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt * 1.6;
      sparkleCtx.fillStyle = "rgba(255,230,120," + Math.max(0, p.life) + ")";
      sparkleCtx.beginPath();
      sparkleCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      sparkleCtx.fill();
    });
  }

  async function goPage(nextIndex) {
    if (nextIndex < 0 || nextIndex >= PAGE_COUNT || nextIndex === state.pageIndex) return;
    if (state.flipping) return;
    stopSpeech();
    state.flipping = true;
    document.body.classList.add("turning");
    whoosh();
    const forward = nextIndex > state.pageIndex;

    // 1) fold diorama away
    const foldStart = performance.now();
    await new Promise((resolve) => {
      function step(now) {
        const k = Math.min(1, (now - foldStart) / 380);
        popupRoot.userData.fold = k;
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
    popupRoot.visible = false;

    // 2) curled page turn
    setFlipTexture(currentPage().id);
    const flipStart = performance.now();
    const duration = 1100;
    await new Promise((resolve) => {
      function step(now) {
        const k = Math.min(1, (now - flipStart) / duration);
        const ease = 1 - Math.pow(1 - k, 2.4);
        applyCurl(flipPage.geometry, ease, forward);
        if (pageShadow) {
          pageShadow.material.opacity = 0.1 + Math.sin(ease * Math.PI) * 0.28;
          pageShadow.position.x = PAGE_W * (0.48 - ease * 0.9 * (forward ? 1 : -0.2));
          pageShadow.scale.set(1 - ease * 0.35, 1, 1);
        }
        bookRoot.rotation.y = Math.sin(ease * Math.PI) * (forward ? -0.07 : 0.07);
        bookRoot.rotation.z = Math.sin(ease * Math.PI) * 0.015;
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });

    state.pageIndex = nextIndex;
    state.skyRestored = false;
    applyCurl(flipPage.geometry, 0, true);
    if (pageShadow) {
      pageShadow.material.opacity = 0.18;
      pageShadow.position.x = PAGE_W * 0.48;
      pageShadow.scale.set(1, 1, 1);
    }
    bookRoot.rotation.y = 0;
    bookRoot.rotation.z = 0;
    buildPopups();
    popupRoot.visible = true;
    popupRoot.userData.fold = 0;
    renderCard();
    document.body.classList.remove("turning");
    state.flipping = false;
  }

  function tick() {
    const dt = clock.getDelta();
    mixers.forEach((m) => m.update(dt));
    animatePopups(dt);
    if (lampLight) lampLight.intensity = 8.8 + Math.sin(performance.now() / 520) * 0.7;
    drawSparkles(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  function bindUi() {
    $("read-to-me").addEventListener("click", () => {
      stopSpeech();
      readAloud();
    });
    $("ill-read").addEventListener("click", () => {
      stopSpeech();
      state.mode = "self";
      showToast("Читай сам. Нажимай на слова.");
    });
    pauseBtn.addEventListener("click", () => {
      if (!state.speaking) return;
      state.paused = !state.paused;
      if (activeAudio) {
        if (state.paused) activeAudio.pause();
        else activeAudio.play();
      } else if (window.speechSynthesis) {
        if (state.paused) speechSynthesis.pause();
        else speechSynthesis.resume();
      }
      pauseBtn.textContent = state.paused ? "Дальше" : "Пауза";
    });
    $("prev").addEventListener("click", () => goPage(state.pageIndex - 1));
    $("next").addEventListener("click", () => goPage(state.pageIndex + 1));
    $("zoom-in").addEventListener("click", () => bumpZoom(0.14));
    $("zoom-out").addEventListener("click", () => bumpZoom(-0.14));
    canvas.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        bumpZoom(ev.deltaY > 0 ? -0.08 : 0.08);
      },
      { passive: false }
    );
    $("volume").addEventListener("input", (ev) => {
      state.volume = Number(ev.target.value);
      if (activeAudio) activeAudio.volume = state.volume;
    });
    cardEl.addEventListener("click", (ev) => {
      if (ev.target.classList.contains("word")) return;
      state.cardZoom = !state.cardZoom;
      cardEl.classList.toggle("zoomed", state.cardZoom);
      bumpZoom(state.cardZoom ? 0.22 : -0.22);
    });
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    if (window.speechSynthesis) {
      speechSynthesis.addEventListener("voiceschanged", pickVoice);
      pickVoice();
    }
  }

  window.__storylight = {
    goPage: (i) => goPage(i),
    getPage: () => state.pageIndex,
    shot: () => document.getElementById('scene').toDataURL('image/jpeg', 0.88),
  };

  async function main() {
    const bootUi = viewportSize();
    sparkleCanvas.width = bootUi.w;
    sparkleCanvas.height = bootUi.h;
    const res = await fetch("pages.json");
    state.book = await res.json();
    $("book-title").textContent = state.book.title;
    document.title = state.book.title + " — Лучик";
    renderCard();
    await loadAllTextures();
    await initThree();
    bindUi();
    tick();
  }

  main().catch((err) => {
    document.body.innerHTML =
      "<p style='color:#fff;padding:24px;font:18px sans-serif'>Не вышло открыть книгу: " +
      String(err) +
      "</p>";
  });
})();
