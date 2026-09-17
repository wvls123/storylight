---
name: storylight
description: Builds and adapts the Storylight interactive 3D bedtime book — Three.js pop-up pages, karaoke read-aloud, word taps, Qwen3-TTS/edge-tts, Poly Haven room props. Use when the user asks for an interactive children's book, Storylight, Лучик, 3D-сказку, karaoke book, or to clone/extend «Медвежонок Миша и упавшая звёздочка».
---

# Storylight — интерактивная 3D-книга

Готовый кит лежит в `book/`. Не собирай сцену с нуля и не тащи Blender, пока пользователь сам не попросил. Клонируй кит, меняй `pages.json`, озвучку и pop-up страницы.

## Когда читать дальше

- Схема страниц, жесты, посадка книги: [reference.md](reference.md)
- Новый сюжет по шагам: [examples.md](examples.md)

## Быстрый запуск эталона

```bash
cd book
python -m http.server 8871
```

Открыть http://127.0.0.1:8871/

`file://` не использовать: ES-модули Three.js с importmap требуют HTTP.

## Что уже внутри `book/`

| Путь | Роль |
|------|------|
| `index.html` | Оболочка, CDN Three 0.160.1, режимы «Читать мне» / «Я сам» |
| `app.js` | Комната, стол, книга, curl-перелистывание, pop-up, karaoke, тапы |
| `style.css` | Карточка текста, dock, vocab |
| `pages.json` | Сюжет, слова с длительностями, объекты, жесты, пути к audio/art |
| `audio/` | Готовые mp3+wav страниц и слов + `manifest.json` |
| `assets/` | Текстуры страниц, иконки, CC0 glTF со стола Poly Haven, плюш Миши |
| `scripts/generate_tts.py` | Qwen3-TTS VoiceDesign или fallback `edge-tts` |
| `scripts/generate_art.py` | Pillow-заготовки страниц |
| `scripts/download_polyhaven.py` | CC0 glTF 1k, без ключей |

Эталон: 4 страницы, бренд «Лучик», сказка «Медвежонок Миша и упавшая звёздочка».

## Как делать новую книгу

1. Скопируй `book/` в целевой проект (или правь этот).
2. Перепиши `pages.json`: `title`, `readText`, `words[]`, `objects[]`, `gesture`, `audio`, `image`.
3. Длительности `words[].d` подгоняй под реальную озвучку (сумма ≈ длина mp3).
4. Сгенерируй речь: `python book/scripts/generate_tts.py` (см. ниже).
5. При новых иллюстрациях — `python book/scripts/generate_art.py`, затем положи файлы на пути из JSON.
6. В `app.js` добавь/замени `buildBedroom` / `buildGarden` / `buildMeadow` / `buildHome` под новые pop-up. Не ломай `seatBookOnTable`, `sitOnY`, тени и комнату.
7. Проверь: `python scripts/validate_kit.py` и живой проход в браузере.

Не выдумывай сюжет поверх эталона, если пользователь просит «эту книгу» — отдай как есть.

## Озвучка

Порядок движков:

1. Локальный Qwen3-TTS VoiceDesign, если задан `QWEN3_TTS_ROOT` (папка модели, не ключ).
2. Иначе `edge-tts` голос `ru-RU-SvetlanaNeural` — ключ не нужен.

```bash
# Windows PowerShell
$env:QWEN3_TTS_ROOT = "C:\path\to\qwen3-tts"
python book/scripts/generate_tts.py
```

Правила речи:

- Текст сказки — русский. Числа словами.
- Инструкция голоса уже в скрипте: тёплая «бабушка на ночь», не мультик.
- Файл страницы: `audio/page-<id>.mp3`. Слова: `audio/word-<slug>.mp3`.
- Karaoke идёт параллельно с mp3: подсветка по `words[].d`, не по Web Speech.
- Тап по слову = синтез этого слова. Тап по объекту в 3D = `object.audio` или `speak`.
- Если mp3 нет — `app.js` сам падает в `speechSynthesis` `ru-RU`. Это запасной путь, не основной.

## Секреты — жёстко

В репозиторий и в чат **нельзя** класть API-ключи, токены, `.env`, SSH-ключи, `credentials.json`.

- Ключей у этого кита нет. Poly Haven и edge-tts работают без секретов.
- Qwen живёт локально. Путь только через env, никогда хардкод домашнего каталога пользователя.
- Перед коммитом: `python scripts/scan_secrets.py`
- Если нашёл секрет — вычисти файл, не коммить, ключ считать скомпрометированным.

`.env.example` можно коммитить. Живой `.env` — нельзя.

## Качество кадра (не пропускать)

Из живой приёмки эталона:

- Книга **стоит на столешнице**, не тонет в столе. После мебели всегда `seatBookOnTable()`.
- Фон — комната (стены, пол, лампа), не чёрная пустота.
- Лампа и фонарь сидят на `TABLE_TOP` через `sitOnY`.
- Pop-up вырастает после перелистывания; на странице есть ударные объекты и жест.
- «Читать мне» подсвечивает слова в такт. «Я сам» не запускает всю страницу.
- Не подключай Blender MCP и не генерируй героя заново, если плюш уже в `assets/models/plush_bear/`.

## Запреты

- Не коммить секреты.
- Не требовать Blender для веб-книги.
- Не заменять Three.js на картинку-слайдер.
- Не писать латиницу в озвучке, кроме официальных имён, если пользователь так попросил.
- Не публиковать чужие ключи «чтобы завелось».
