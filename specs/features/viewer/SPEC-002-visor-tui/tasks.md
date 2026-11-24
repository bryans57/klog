# Tasks — SPEC-002

TDD. El spike de compile va primero: si Ink no entra en `dist/klog`, no se construye la UI.

- [x] T-000 — Spike: Ink 6.8 compiló con Bun 1.3.13 sin workaround de yoga.wasm; `dist/klog --help` operativo (CA-016)
- [x] T-001 — `parse-line.ts` (CA-005, CA-006)
- [x] T-002 — `surface.ts` incluye `tail` (CA-001, CA-003, CA-015)
- [x] T-003 — `buffer.ts`: prefix y ring + `--viewer-limit` (CA-011, CA-012)
- [x] T-004 — `model.ts` grupos/colapso (CA-004)
- [x] T-005 — `state.ts`: teclado + eventos mouse sintéticos (CA-007, CA-008, CA-009, CA-019)
- [x] T-006 — `app.tsx` + ink-testing-library: lista, detalle, footer (CA-009)
- [x] T-007 — `mount.ts`: alternate screen, MouseProvider, unmount/restore idempotente (CA-010)
- [x] T-008 — `cli.ts`: search y tail alimentan el buffer; `--output-file` recibe todo (CA-013, CA-014)
- [x] T-009 — Pipe anti-ANSI + allowlist de dependencies (CA-002, CA-017)
- [x] T-010 — README + `bun run check && bun run build` + superficie kubectl + Fluid SAST/SCA (CA-016, CA-018)
