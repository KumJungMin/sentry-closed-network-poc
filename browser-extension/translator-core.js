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

  function createBatchProcessor({ maxBatchSize = 200, process, schedule }) {
    const queue = [];
    const queuedValues = new Set();
    let cursor = 0;
    let scheduled = false;

    function requestFlush() {
      if (scheduled) return;
      scheduled = true;
      schedule(flush);
    }

    function flush() {
      scheduled = false;
      const end = Math.min(cursor + maxBatchSize, queue.length);

      while (cursor < end) {
        const value = queue[cursor];
        cursor += 1;
        queuedValues.delete(value);
        process(value);
      }

      if (cursor === queue.length) {
        queue.length = 0;
        cursor = 0;
        return;
      }

      requestFlush();
    }

    function enqueue(value) {
      if (value == null || queuedValues.has(value)) return;
      queuedValues.add(value);
      queue.push(value);
      requestFlush();
    }

    return Object.freeze({ enqueue });
  }

  scope.SentryKoTranslatorCore = Object.freeze({
    SKIPPED_TAGS,
    createBatchProcessor,
    shouldSkipElement,
    translateExact
  });
})(globalThis);
