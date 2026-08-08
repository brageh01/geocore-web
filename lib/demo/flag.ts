/**
 * Demo mode flag.
 *
 * Everything under `lib/demo/` and every `if (DEMO_MODE)` branch elsewhere
 * exists to make a recordable demo video and is meant to be deleted in one
 * commit. When that happens: remove this directory, then grep for `DEMO_MODE`
 * and delete each branch, keeping the `else` / live path intact.
 *
 * Default is ON. The variable has to be explicitly "false" to get the live
 * path, so a fresh checkout with no `.env.local` still records.
 *
 * `process.env.NEXT_PUBLIC_DEMO_MODE` must stay written out in full — Next
 * substitutes the expression textually at build time, so a dynamic lookup
 * would not be inlined into the client bundle.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
