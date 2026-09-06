(function startSentryKoreanTranslation(scope) {
  "use strict";

  const dictionary = scope.SENTRY_KO_TRANSLATIONS;
  const core = scope.SentryKoTranslatorCore;
  const translatedAttributes = ["aria-label", "placeholder", "title"];
  const ownTextUpdates = new WeakMap();

  if (!dictionary || !core) return;

  function translateTextNode(node) {
    if (core.shouldSkipElement(node.parentElement)) return;
    const translated = core.translateExact(node.nodeValue, dictionary);
    if (translated !== node.nodeValue) {
      ownTextUpdates.set(node, translated);
      node.nodeValue = translated;
    }
  }

  function scheduleBatch(callback) {
    if (typeof scope.requestIdleCallback === "function") {
      scope.requestIdleCallback(callback, { timeout: 100 });
      return;
    }

    scope.setTimeout(callback, 0);
  }

  const batchProcessor = core.createBatchProcessor({
    maxBatchSize: 200,
    process: translateNode,
    schedule: scheduleBatch
  });

  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE || core.shouldSkipElement(node)) {
      return;
    }

    for (const attribute of translatedAttributes) {
      if (!node.hasAttribute(attribute)) continue;
      const current = node.getAttribute(attribute);
      const translated = core.translateExact(current, dictionary);
      if (translated !== current) node.setAttribute(attribute, translated);
    }

    for (const child of node.childNodes) {
      batchProcessor.enqueue(child);
    }
  }

  function translateMutation(mutation) {
    if (mutation.type === "characterData") {
      const translatedValue = ownTextUpdates.get(mutation.target);
      ownTextUpdates.delete(mutation.target);

      if (translatedValue !== mutation.target.nodeValue) {
        batchProcessor.enqueue(mutation.target);
      }
      return;
    }

    for (const node of mutation.addedNodes) {
      batchProcessor.enqueue(node);
    }
  }

  function boot() {
    document.documentElement.lang = "ko";

    new MutationObserver((mutations) => {
      for (const mutation of mutations) translateMutation(mutation);
    }).observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true
    });

    batchProcessor.enqueue(document.body);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(globalThis);
