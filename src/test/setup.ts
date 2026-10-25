/**
 * Test environment shims (jsdom does not implement these).
 */

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are disabled: register RTL cleanup explicitly.
afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined") {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }

  if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
}
