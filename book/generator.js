(() => {
  const form = document.getElementById("story-form");
  if (!form || !window.StorylightStory) return;

  const nameInput = document.getElementById("story-name");
  const heroInput = document.getElementById("story-hero");
  const themeInput = document.getElementById("story-theme");
  const result = document.getElementById("generator-result");
  const resultTitle = document.getElementById("result-title");
  const resultTeaser = document.getElementById("result-teaser");
  const storyLink = document.getElementById("story-link");
  const openBook = document.getElementById("open-book");
  const copyButton = document.getElementById("copy-link");

  function updateChipState(active) {
    document.querySelectorAll(".theme-chip").forEach((chip) => {
      chip.classList.toggle("is-selected", chip.dataset.theme === active);
    });
  }

  document.querySelectorAll(".theme-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      themeInput.value = chip.dataset.theme;
      updateChipState(chip.dataset.theme);
      themeInput.focus();
    });
  });

  themeInput.addEventListener("input", () => updateChipState(themeInput.value.trim()));

  function buildLink(story) {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("name", story.character.name);
    url.searchParams.set("hero", story.character.species);
    url.searchParams.set("theme", story.theme.label);
    return url.toString();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const story = window.StorylightStory.buildStory({
      name: nameInput.value,
      hero: heroInput.value,
      theme: themeInput.value,
    });
    const link = buildLink(story);
    resultTitle.textContent = story.title;
    resultTeaser.textContent = `${story.character.name} отправляется в ${story.theme.label}. Ссылка уже готова — можно отправить её близким.`;
    storyLink.value = link;
    openBook.href = link;
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(storyLink.value);
      copyButton.textContent = "Скопировано ✓";
    } catch (error) {
      storyLink.select();
      document.execCommand("copy");
      copyButton.textContent = "Скопировано ✓";
    }
    window.setTimeout(() => {
      copyButton.textContent = "Скопировать";
    }, 1800);
  });
})();
