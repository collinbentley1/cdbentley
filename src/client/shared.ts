/** Site-wide behavior: colophon dialog + copy-to-clipboard buttons. */

const colophon = document.getElementById("colophon");

if (colophon instanceof HTMLDialogElement) {
  for (const opener of document.querySelectorAll("[data-colophon-open]")) {
    opener.addEventListener("click", () => colophon.showModal());
  }
  colophon.addEventListener("click", (event) => {
    if (event.target === colophon) {
      colophon.close();
    }
  });
}

export function wireCopy(button: Element, text: () => string): void {
  button.addEventListener("click", () => {
    void navigator.clipboard
      .writeText(text())
      .then(() => flashCopied(button))
      .catch(() => flashCopied(button, "select + copy"));
  });
}

function flashCopied(button: Element, label = "copied!"): void {
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const original = button.textContent ?? "";
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1400);
}
