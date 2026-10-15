(() => {
  const LIMITS = { name: 32, hero: 36, theme: 48 };

  const THEME_PROFILES = [
    {
      match: /(море|океан|маяк|кораб|волна|берег)/i,
      place: "тихого морского берега",
      destination: "старого маяка",
      treasure: "ракушка с золотым звуком",
      titleTreasure: "золотой ракушки",
      helper: "любопытный краб",
      mood: "лунные волны",
      palette: { room: "#1d3046", fog: "#395875", accent: "#8ed9dd" },
    },
    {
      match: /(облак|небо|ветер|дожд|радуг|воздух)/i,
      place: "маленького облачного сада",
      destination: "радуги над крышами",
      treasure: "капля радостного дождя",
      titleTreasure: "капли дождя",
      helper: "сонный ветерок",
      mood: "мягкие облака",
      palette: { room: "#415a78", fog: "#7895ae", accent: "#f6d590" },
    },
    {
      match: /(космос|звезд|луна|планет|космич)/i,
      place: "лунной станции",
      destination: "серебряного кратера",
      treasure: "маленькая искра кометы",
      titleTreasure: "искры кометы",
      helper: "сонный спутник",
      mood: "далёкие звёзды",
      palette: { room: "#211b3e", fog: "#433c6d", accent: "#e1c4ff" },
    },
    {
      match: /(замок|рыцар|дракон|принц|волшеб|магич)/i,
      place: "старого волшебного замка",
      destination: "башни с медными часами",
      treasure: "крошечный огонёк храбрости",
      titleTreasure: "огонька храбрости",
      helper: "добрый дракончик",
      mood: "золотые башни",
      palette: { room: "#4a3046", fog: "#80606a", accent: "#f7c67d" },
    },
  ];

  const DEFAULT_PROFILE = {
    place: "волшебного леса",
    destination: "поляны старых фонариков",
    treasure: "светящийся листик",
    titleTreasure: "светящегося листика",
    helper: "маленький светлячок",
    mood: "зелёные тропинки",
    palette: { room: "#29433c", fog: "#557c68", accent: "#f5d68a" },
  };

  function clean(value, fallback, max) {
    const normalized = String(value || "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
    return normalized || fallback;
  }

  function profileFor(theme) {
    return THEME_PROFILES.find((profile) => profile.match.test(theme)) || DEFAULT_PROFILE;
  }

  function wordsFor(text) {
    const parts = String(text).match(/[^\s]+/g) || [];
    return parts.map((part) => {
      const match = part.match(/^([«“„—–-]*)(.+?)([,.!?…:;»”]*)$/u);
      const token = match ? match[2] : part;
      const punctuation = match ? match[3] : "";
      return {
        t: (match ? match[1] : "") + token,
        p: punctuation,
        d: Math.min(0.92, Math.max(0.22, token.length * 0.045)),
      };
    });
  }

  function page(id, title, text, hint, image) {
    return {
      id,
      title,
      image,
      audio: null,
      readText: text,
      hint,
      words: wordsFor(text),
      objects: [
        { id: "hero", label: "герой", speak: "герой", icon: "assets/icon-bear.png", audio: null },
        { id: "light", label: "огонёк", speak: "огонёк", icon: "assets/icon-star.png", audio: null },
      ],
      gesture: null,
    };
  }

  function buildStory(input) {
    const name = clean(input && input.name, "Ася", LIMITS.name);
    const hero = clean(input && input.hero, "маленький исследователь", LIMITS.hero);
    const theme = clean(input && input.theme, "волшебный лес", LIMITS.theme);
    const profile = profileFor(theme);
    const title = `${name} и секрет ${profile.titleTreasure}`;
    const pages = [
      page(
        1,
        "Там, где начинается чудо",
        `Однажды вечером ${name}, ${hero}, пришёл в ${profile.place}. Вокруг мерцали ${profile.mood}, но у домика исчезло маленькое сокровище — ${profile.treasure}. Без его света дорога к добрым снам стала совсем тёмной.`,
        "Нажми на героя и огонёк — они расскажут свои секреты.",
        "assets/page-1-bedroom.png"
      ),
      page(
        2,
        "Тихий зов вдали",
        `${name} услышал тихий зов издалека. ${profile.helper} показал путь к ${profile.destination}, где спряталась искра ${theme}. Чтобы добраться туда, нужно было не испугаться темноты и сделать первый шаг.`,
        "Потяни светлячка в сторону — он покажет дорогу.",
        "assets/page-2-garden.png"
      ),
      page(
        3,
        "Доброе сердце знает путь",
        `По дороге ${name} заметил того, кому нужна помощь: маленький друг запутался в серебряных нитях. ${name} остановился, распутал узел и поделился своим тёплым светом. Тогда ${profile.treasure} проснулся и засиял ярче всех.`,
        "Сначала помоги маленькому другу, а потом прикоснись к огоньку.",
        "assets/page-3-meadow.png"
      ),
      page(
        4,
        "Свет возвращается домой",
        `Вернувшись домой, ${name} бережно вернул ${profile.treasure} на своё место. Комната наполнилась мягким светом, ${profile.helper} пожелал спокойной ночи, а ${name} улыбнулся. С тех пор ${theme} всегда хранила для него маленькое чудо. Вот и сказке конец, а кто слушал — тому добрых снов.`,
        "Нажми на огонёк, чтобы разбудить спокойную колыбельную.",
        "assets/page-4-home.png"
      ),
    ];

    return {
      brand: "Лучик",
      title,
      subtitle: `Персональная сказка для ${name}`,
      audioEngine: "browser-speech",
      character: { name, species: hero },
      theme: { label: theme, profile, palette: profile.palette },
      pages,
    };
  }

  function fromLocation(location) {
    const params = new URLSearchParams(location.search);
    if (params.get("demo") === "1") return null;
    if (!["name", "hero", "theme"].some((key) => params.has(key))) return null;
    return buildStory({
      name: params.get("name"),
      hero: params.get("hero"),
      theme: params.get("theme"),
    });
  }

  window.StorylightStory = { buildStory, fromLocation, limits: LIMITS };
})();
