# Storylight — устройство движка

Читать после `SKILL.md`. Здесь техника. Сюжет всегда из запроса пользователя, не из примера про Мишу.

## `pages.json`

```json
{
  "brand": "Лучик",
  "title": "…",
  "subtitle": "…",
  "audioEngine": "qwen3-tts",
  "pages": [
    {
      "id": 1,
      "title": "Заголовок страницы",
      "image": "assets/page-1-bedroom.png",
      "audio": "audio/page-1.mp3",
      "readText": "Полный текст для диктора и fallback speechSynthesis.",
      "hint": "Подсказка жеста под карточкой.",
      "words": [{ "t": "В", "d": 0.22 }, { "t": "тёплой", "d": 0.48, "p": "." }],
      "objects": [
        {
          "id": "misha",
          "label": "Миша",
          "speak": "медвежонок Миша",
          "icon": "assets/icon-bear.png",
          "audio": "audio/word-misha.mp3"
        }
      ],
      "gesture": null
    }
  ]
}
```

| Поле | Смысл |
|------|--------|
| `words[].t` | Слово на карточке |
| `words[].d` | Секунды подсветки karaoke |
| `words[].p` | Пунктуация после слова (`"."`, `","`, `":"`) |
| `objects[].id` | Совпадает с `userData.id` меша в pop-up |
| `objects[].drag` | Можно тащить (светлячки) |
| `objects[].wake` | Жест «верни звёздочку» на последней странице |
| `gesture` | `null` \| `drag-firefly` \| `help-then-star` \| `return-star` |

`PAGE_COUNT` в `app.js` должен совпасть с числом страниц **новой** книги. Карту `buildPopups` перепиши: имена функций — под новые сцены, не оставляй `buildBedroom`, если спальни в сюжете нет.

## Сцена (`app.js`)

Порядок boot: `initThree` → `makeRoom` → `loadFurniture` → `makeBook` → `buildPopups` → `seatBookOnTable`.

### Комната (не pop-up)

- Пол 24×24, три стены, тёплый `ROOM_BG` `0xc9a57a`, fog.
- Стол `WoodenTable_01` шириной ~9.05, `TABLE_TOP = box.max.y`.
- Лампа слева и фонарь справа **на** столешнице (`sitOnY(..., TABLE_TOP)`).
- PointLight лампы чуть ниже верха стекла.

### Книга

- `bookRoot` с наклоном `BOOK_TILT = -0.06`.
- Левая страница — бумажная карточка (текст живёт в HTML, не на меше).
- Правая — curl-плоскость `CURL_SEGS = 48`, текстура текущей страницы.
- `seatBookOnTable()`: луч вниз в стол, низ книги = верх столешницы + 0.001. После любой смены мебели вызывать снова.

### Pop-up

`popupRoot` растёт по Y (0.05 → 1 за 0.75 с). На каждую страницу свой builder:

Ниже — **пример эталона**, не шаблон сюжета. В новой книге другие функции и жесты.

| id (пример) | Функция в эталоне | Жест в эталоне |
|-------------|-------------------|----------------|
| 1 | `buildBedroom` | тапы: кровать, подушка, звезда |
| 2 | `buildGarden` | `drag-firefly` |
| 3 | `buildMeadow` | сначала зайчонок, потом звезда |
| 4 | `buildHome` | `return-star` / `wake` |

Герой новой книги — из запроса. `plush_bear.glb` и `placeBear` оставляй только если герой правда медвежонок. Иначе другая модель или простой меш/спрайт + новые иконки.

Интерактив: `markHit(mesh, { id, label, speak, icon, audio, ... })`. Raycaster по `interactables`.

## Режимы UI

- **Читать мне** → `readAloud()`: mp3 страницы + karaoke по `words`.
- **Я сам** → тишина, ребёнок тапает слова и объекты.
- Пауза только во время `readAloud`.
- Громкость (`#volume`) множит и mp3, и WebAudio-whoosh/chime.
- Зум камеры 0.88–1.85; клик по карточке приближает текст.

## Мебель и лицензии

Скачать заново (без ключа):

```bash
python book/scripts/download_polyhaven.py
```

Источник: `https://api.polyhaven.com/files/<id>`, пакет `gltf/1k`. Credit: Powered by Poly Haven, CC0-1.0. Список id — в скрипте. Плюш Миши в кит уже положен, Poly Haven его не отдаёт.

## Камера эталона

```
CAM = { x: 1.4, y: 7.7, z: 10.6, lx: 0.1, ly: 3.2, lz: 0.2 }
```

Чуть сбоку-сверху: виден край стола и комната. Не ставь камеру в книгу и не обнуляй фон.

## Зависимости генерации

Озвучка fallback:

```bash
pip install edge-tts
```

Qwen (опционально, локально): пакет `qwen_tts`, модель VoiceDesign, CUDA желательна. Путь только `QWEN3_TTS_ROOT`.

Картинки:

```bash
pip install pillow
```

В рантайме книги pip не нужен — только браузер и HTTP.
