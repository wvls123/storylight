# Storylight

Скилл для агента: **собрать новую интерактивную 3D-книгу по запросу пользователя** (сюжет, герой, жесты, озвучка). Не повторять эталонную сказку, если человек просит другую.

`book/` — движок (комната, стол, pop-up, караоке, TTS) плюс один живой пример «Медвежонок Миша…». Пример нужен, чтобы понять технику, не как готовый ответ на любой запрос.

## Персональный генератор

Откройте `book/` через Vercel или обычный HTTP-сервер: главная страница покажет форму имени, героя и темы. После отправки создаётся переносимая ссылка вида `?name=...&hero=...&theme=...`; по ней книга сразу открывается с новым сюжетом и browser TTS. Данные не сохраняются на сервере — история восстанавливается из ссылки.

Публичный репозиторий: <https://git.sr.ht/~horosheff/storylight>

Клонирование:

```bash
git clone https://git.sr.ht/~horosheff/storylight
# или
git clone git@git.sr.ht:~horosheff/storylight
```

## Запустить пример движка (сказка про Мишу)

```bash
cd book
python -m http.server 8871
```

Открыть http://127.0.0.1:8871/

Нужен обычный браузер с WebGL. `file://` не подойдёт.

## Скилл для агента

Этот репозиторий — Cursor skill (`SKILL.md` в корне).

```bash
git clone https://git.sr.ht/~horosheff/storylight ~/.cursor/skills/storylight
```

Windows:

```powershell
git clone https://git.sr.ht/~horosheff/storylight $env:USERPROFILE\.cursor\skills\storylight
```

Агент читает `SKILL.md` и делает книгу **из запроса**. Схема движка — `reference.md`, сценарии — `examples.md`.

## Что в комплекте

- Весь веб-рантайм: `book/index.html`, `book/app.js`, `book/style.css`, `book/pages.json`
- Озвучка страниц и слов (mp3 + wav) и `book/audio/manifest.json`
- Текстуры, иконки, плюшевый Миша, CC0-мебель Poly Haven
- Скрипты генерации речи/арта и повторной загрузки моделей — **без API-ключей**

## Озвучка с нуля

Ключи не нужны. Fallback — Microsoft `edge-tts`.

```bash
pip install edge-tts
python book/scripts/generate_tts.py
```

Локальный Qwen3-TTS VoiceDesign (если модель уже скачана):

```bash
set QWEN3_TTS_ROOT=C:\path\to\qwen3-tts
python book/scripts/generate_tts.py
```

Не кладите ключи, токены и живой `.env` в git. Перед пушем:

```bash
python scripts/scan_secrets.py
python scripts/validate_kit.py
```

## Лицензии

Код — MIT. Модели стола/лампы/кровати и т.п. — CC0, Powered by Poly Haven. Подробности в `LICENSE` и `book/assets/models/credits.json`.
