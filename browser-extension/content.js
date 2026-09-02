(function startSentryKoreanTranslation(scope) {
  "use strict";

  const dictionary = scope.SENTRY_KO_TRANSLATIONS;
  const core = scope.SentryKoTranslatorCore;
  const translatedAttributes = ["aria-label", "placeholder", "title"];

  if (!dictionary || !core) return;

  function translateTextNode(node) {
    if (core.shouldSkipElement(node.parentElement)) return;
    const translated = core.translateExact(node.nodeValue, dictionary);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  }

  function translateElement(element) {
    if (core.shouldSkipElement(element)) return;

    for (const attribute of translatedAttributes) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute);
      const translated = core.translateExact(current, dictionary);
      if (translated !== current) element.setAttribute(attribute, translated);
    }

    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) translateTextNode(child);
      if (child.nodeType === Node.ELEMENT_NODE) translateElement(child);
    }
  }

  function translateMutation(mutation) {
    if (mutation.type === "characterData") {
      translateTextNode(mutation.target);
      return;
    }

    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      if (node.nodeType === Node.ELEMENT_NODE) translateElement(node);
    }
  }

  function boot() {
    document.documentElement.lang = "ko";
    translateElement(document.body);

    new MutationObserver((mutations) => {
      for (const mutation of mutations) translateMutation(mutation);
    }).observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(globalThis);
