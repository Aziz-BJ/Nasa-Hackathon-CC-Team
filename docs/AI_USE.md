# Use of AI log

Every file generated or substantially written with AI assistance is listed here.

| Date | File | What was generated |
| --- | --- | --- |
| 2026-11-14 | README.md, docs/AI_USE.md, docs/REFERENCES.md, .gitignore additions | Initial repository scaffold (Claude) |
| 2026-11-14 | docs/superpowers/plans/2026-11-14-hotspot-calendar-demo.md, demo/README.md | Implementation plan for the web app UI (architecture, data contract proposal, all code and tests). Generated with Claude after research (Space Apps brand guide, library docs) and a throwaway spike that verified the code; to be reviewed by Aziz at each checkpoint |
| 2026-11-14 | demo/ (Checkpoint 1: index.html, vite.config.ts, src/config.ts, src/lib/*, src/test/setup.ts, scripts/*) | Engine code and tests generated with Claude from the plan by an executor subagent, checked file-by-file against the plan, then reviewed by an independent verifier subagent; its findings were fixed (see commits "engine fixes from the checkpoint 1 review") |
| 2026-11-14 | demo/ (Checkpoint 2: src/styles, src/main.tsx, src/App.tsx, src/state/appState.*, src/hooks/*, src/dataSource.ts, src/components/{Header,Footer,MockBanner,AboutPage,GlobeMap,AreaPanel,CoordinateForm,Legend,AreaSummary}.*) | Globe and area-selection UI generated with Claude from the plan by an executor subagent, checked file-by-file, walked through headless, and reviewed by an independent verifier subagent; its findings were fixed ("checkpoint 2 review fixes") |
