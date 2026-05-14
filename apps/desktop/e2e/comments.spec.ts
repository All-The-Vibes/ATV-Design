/**
 * UAT: CommentsPanel.
 *
 * Comments require an active design session with at least one snapshot.
 * All tests in this file are skipped in Cycle 2 — they are placeholders
 * for Cycle 3 once we have a workspace bootstrapping helper that can
 * create a real design session end-to-end.
 */

import { testOnboarded as test } from './fixtures/electron-app';

test.skip('comments panel renders', async () => {
  // Skipped: CommentsPanel (CommentsPanel.tsx) is only visible in workspace
  // view when a design is selected AND the comments IPC is registered.
  // Bootstrapping a full design session requires either:
  //   a) A real generation run (touches network — not suitable for UAT)
  //   b) Direct DB seeding of the snapshots SQLite DB (out of scope Cycle 2)
  // Will revisit in Cycle 3 with a DB-seeding fixture.
});

test.skip('comments panel shows empty state with no comments', async () => {
  // Same constraint as above.
});
