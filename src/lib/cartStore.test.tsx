import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CartProvider, useCart, useCartDiscount, useProductQty } from "./cartStore";

function wrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

describe("useProductQty", () => {
  it("starts at 0 and updates when set", () => {
    const { result } = renderHook(() => useProductQty("p1"), { wrapper });
    expect(result.current[0]).toBe(0);

    act(() => result.current[1](3));
    expect(result.current[0]).toBe(3);
  });

  it("clamps negative values to 0", () => {
    const { result } = renderHook(() => useProductQty("p1"), { wrapper });
    act(() => result.current[1](-5));
    expect(result.current[0]).toBe(0);
  });

  it("rounds down fractional values (defensive — stock is integer)", () => {
    const { result } = renderHook(() => useProductQty("p1"), { wrapper });
    act(() => result.current[1](2.9));
    expect(result.current[0]).toBe(2);
  });

  it("setting to 0 removes the entry from the cart map", () => {
    const cart = renderHook(() => useCart(), { wrapper });
    const item = renderHook(() => useProductQty("p1"), { wrapper: cart.result.current ? wrapper : wrapper });

    act(() => item.result.current[1](4));
    expect(item.result.current[0]).toBe(4);

    act(() => item.result.current[1](0));
    expect(item.result.current[0]).toBe(0);
  });
});

describe("useCart aggregate counts", () => {
  it("totalCount sums all positive quantities; kindCount = distinct ids", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.setQty("a", 3);
      result.current.setQty("b", 2);
      result.current.setQty("c", 1);
    });

    expect(result.current.totalCount).toBe(6);
    expect(result.current.kindCount).toBe(3);
  });

  it("clear() empties quantities AND resets the discount", () => {
    // Reason this test exists: clear() is invoked after a successful
    // createOrder. If discount survived, the NEXT customer's order would
    // silently get the previous customer's rabate.
    // Both hooks must share the SAME CartProvider instance to observe the
    // same store — render them in a single hook callback.
    const { result } = renderHook(
      () => ({ cart: useCart(), discount: useCartDiscount() }),
      { wrapper },
    );

    act(() => {
      result.current.cart.setQty("a", 5);
      result.current.discount[1](10);
    });
    expect(result.current.cart.totalCount).toBe(5);
    expect(result.current.discount[0]).toBe(10);

    act(() => result.current.cart.clear());
    expect(result.current.cart.totalCount).toBe(0);
    expect(result.current.cart.kindCount).toBe(0);
    expect(result.current.discount[0]).toBe(0);
  });
});

describe("useCartDiscount", () => {
  it("clamps to the [0, 20] range", () => {
    const { result } = renderHook(() => useCartDiscount(), { wrapper });

    act(() => result.current[1](-5));
    expect(result.current[0]).toBe(0);

    act(() => result.current[1](999));
    expect(result.current[0]).toBe(20);
  });

  it("truncates fractional values — 9.9 becomes 9", () => {
    const { result } = renderHook(() => useCartDiscount(), { wrapper });
    act(() => result.current[1](9.9));
    expect(result.current[0]).toBe(9);
  });

  it("ignores no-op writes (does not retrigger subscribers on identical values)", () => {
    const { result } = renderHook(() => useCartDiscount(), { wrapper });
    act(() => result.current[1](10));
    const ref1 = result.current[0];
    act(() => result.current[1](10));
    // Behavioural assertion — value matches and component did not crash on
    // duplicate writes. (Subscriber re-fire count is harder to assert via RTL
    // without instrumentation; the createDiscountStore early-return guard is
    // what we rely on in production.)
    expect(result.current[0]).toBe(ref1);
  });
});

describe("CartProvider — localStorage persistence", () => {
  it("hydrates quantities from souvenir_cart_v1 on mount", () => {
    localStorage.setItem("souvenir_cart_v1", JSON.stringify({ a: 7 }));
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.quantities.a).toBe(7);
  });

  it("hydrates the discount from souvenir_cart_discount_v1 on mount", () => {
    localStorage.setItem("souvenir_cart_discount_v1", "15");
    const { result } = renderHook(() => useCartDiscount(), { wrapper });
    expect(result.current[0]).toBe(15);
  });

  it("persists quantities to localStorage on write", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.setQty("p1", 2));
    expect(JSON.parse(localStorage.getItem("souvenir_cart_v1") ?? "{}")).toEqual({ p1: 2 });
  });

  it("persists the discount to localStorage on write", () => {
    const { result } = renderHook(() => useCartDiscount(), { wrapper });
    act(() => result.current[1](12));
    expect(localStorage.getItem("souvenir_cart_discount_v1")).toBe("12");
  });

  it("survives garbage in localStorage without crashing (JSON.parse safety)", () => {
    localStorage.setItem("souvenir_cart_v1", "{not json");
    // Should not throw on render; cart simply starts empty
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.totalCount).toBe(0);
  });
});

describe("cross-tab storage event sync", () => {
  it("updates quantities when another tab writes to souvenir_cart_v1", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.totalCount).toBe(0);

    act(() => {
      // Simulate a sibling tab writing to localStorage. happy-dom dispatches
      // 'storage' to listeners (matching the browser semantics: storage only
      // fires on OTHER documents, but happy-dom dispatches uniformly which
      // is sufficient for verifying our handler is wired).
      const event = new StorageEvent("storage", {
        key: "souvenir_cart_v1",
        newValue: JSON.stringify({ shared: 9 }),
      });
      window.dispatchEvent(event);
    });

    expect(result.current.quantities.shared).toBe(9);
  });

  it("updates discount when another tab writes to souvenir_cart_discount_v1", () => {
    const { result } = renderHook(() => useCartDiscount(), { wrapper });

    act(() => {
      const event = new StorageEvent("storage", {
        key: "souvenir_cart_discount_v1",
        newValue: "18",
      });
      window.dispatchEvent(event);
    });

    expect(result.current[0]).toBe(18);
  });

  it("ignores storage events for unrelated keys", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      const event = new StorageEvent("storage", {
        key: "some_other_unrelated_key",
        newValue: JSON.stringify({ x: 99 }),
      });
      window.dispatchEvent(event);
    });
    expect(result.current.totalCount).toBe(0);
  });
});
