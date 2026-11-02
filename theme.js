const THEME_STORAGE_KEY = "master-league-theme";
const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
const initialTheme = savedTheme === "dark" ? "dark" : "light";

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.setAttribute("aria-checked", String(theme === "dark"));
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#0e1421" : "#f7f9fc",
  );
}

setTheme(initialTheme);

document.addEventListener("DOMContentLoaded", () => {
  setTheme(document.documentElement.dataset.theme);
  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      setTheme(theme);
    });
  });
});

window.addEventListener("storage", (event) => {
  if (event.key !== THEME_STORAGE_KEY) return;
  setTheme(event.newValue === "dark" ? "dark" : "light");
});
