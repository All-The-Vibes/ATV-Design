/**
 * UAT: FilesPanel / FilesTabView.
 *
 * File browsing requires workspace mode with an active design that has
 * a bound workspace directory.  All tests are skipped in Cycle 2.
 */

import { testOnboarded as test } from './fixtures/electron-app';

test.skip('files panel renders', async () => {
  // Skipped: FilesPanel.tsx is mounted in workspace view inside the Sidebar.
  // It requires:
  //   1. Workspace view to be active (needs currentDesignId !== null)
  //   2. A bound workspace directory (design.workspacePath !== null)
  // Neither condition is met without a full design session.
  // Will revisit in Cycle 3 with design + workspace bootstrap fixture.
});

test.skip('files panel shows workspace tree', async () => {
  // Same constraint as above.
});
