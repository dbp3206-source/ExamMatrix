# Exam Matrix

Before editing, read `README.md` and these local handoff files when available:

- `docs/conventions.md`
- `docs/qa-handoff.md`
- `docs/prompt-antigravity.md`

The `docs/` directory is Git ignored. If the checkout lacks the handoff, flag that limitation and use this file, the README, and the existing source as guidance. Ask for the handoff before making broad UI or architecture changes.

- Use pnpm for the frontend. Run `pnpm lint` and `pnpm build` from `frontend/`, and run the relevant backend regression tests from `backend/`.
- Follow the current layout and shared UI primitives. Use `@/` for cross-folder imports in changed frontend code. Keep server state in TanStack Query and UI state in the existing local or Zustand store. Keep TypeScript strict and avoid `any`.
- Audit and list reproducible findings before editing. Keep changes within that list. Check the ordinary user workflow in a browser where possible and report skipped or blocked checks explicitly.
- Verify backend authorization, persistence and state changes on the server. Keep migration order and deployment configuration consistent. Keep secrets and local reports out of commits.
