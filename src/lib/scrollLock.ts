// Shared body-scroll lock counter. Multiple overlapping modals (e.g.
// ConfirmDialog opened on top of ProductForm) would each save and restore
// document.body.style.overflow independently, which races: whichever one
// unmounted LAST re-applied its captured "hidden" value and left the page
// non-scrollable. A counter ensures overflow:hidden stays while at least
// one locker is mounted, and only clears when the last one unmounts.

let lockCount = 0;
let prevOverflow: string | null = null;

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (lockCount === 0) {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = prevOverflow ?? "";
      prevOverflow = null;
    }
  };
}
