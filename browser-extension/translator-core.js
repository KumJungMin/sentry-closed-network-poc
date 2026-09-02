(function registerTranslatorCore(scope) {
  "use strict";

  const SKIPPED_TAGS = new Set([
    "CODE",
    "INPUT",
    "PRE",
    "SCRIPT",
    "STYLE",
    "TEXTAREA"
  ]);

  function translateExact(value, dictionary) {
    if (typeof value !== "string") return value;

    const leading = value.match(/^\s*/u)?.[0] ?? "";
    const trailing = value.match(/\s*$/u)?.[0] ?? "";
    const normalized = value.trim();
    const translated = dictionary[normalized];

    return translated ? `${leading}${translated}${trailing}` : value;
  }

  function shouldSkipElement(element) {
    if (!element) return true;
    return (
      SKIPPED_TAGS.has(element.tagName) ||
      element.isContentEditable === true ||
      element.closest?.("[contenteditable='true']") !== null
    );
  }

  scope.SentryKoTranslatorCore = Object.freeze({
    SKIPPED_TAGS,
    shouldSkipElement,
    translateExact
  });
})(globalThis);
