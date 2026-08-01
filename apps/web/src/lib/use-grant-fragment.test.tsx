import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  consumeGrantFragment,
  useGrantFragment,
} from "./use-grant-fragment";

afterEach(() => {
  cleanup();
  consumeGrantFragment(window.location.pathname);
});

describe("useGrantFragment", () => {
  it("captures a grant and immediately removes it from browser history", () => {
    window.history.replaceState(
      {},
      "",
      "/preview/access?source=staff#grant=secret-capability",
    );

    const hook = renderHook(() => useGrantFragment());

    expect(hook.result.current).toBe("secret-capability");
    expect(window.location.pathname).toBe("/preview/access");
    expect(window.location.search).toBe("?source=staff");
    expect(window.location.hash).toBe("");

    hook.rerender();
    expect(hook.result.current).toBe("secret-capability");

    consumeGrantFragment("/preview/access");
    hook.unmount();
    const consumed = renderHook(() => useGrantFragment());
    expect(consumed.result.current).toBe("");
  });

  it("does not reuse a cached grant on another pathname", () => {
    window.history.replaceState({}, "", "/g#grant=guest-capability");
    const first = renderHook(() => useGrantFragment());
    expect(first.result.current).toBe("guest-capability");
    first.unmount();

    window.history.replaceState({}, "", "/client/access");
    const second = renderHook(() => useGrantFragment());
    expect(second.result.current).toBe("");
  });
});
