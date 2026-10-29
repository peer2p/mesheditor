import { expect, test } from '@playwright/test';

test.describe('Mesh Editor E2E Tests', () => {
  test('1. boots the application, initializes WebGL scene, and registers <mesh-editor> Web Component', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/');

    // Verify core layout elements are visible
    await expect(page.locator('#top-toolbar')).toBeVisible();
    await expect(page.locator('#renderCanvas')).toBeVisible();
    await expect(page.locator('#dialog-outliner')).toBeVisible();
    await expect(page.locator('#bottom-bar')).toBeVisible();

    // Verify WebGL engine & custom element registration
    const isInitialized = await page.evaluate(() => {
      const app = (window as any).meshEditorApp;
      const customEl = customElements.get('mesh-editor');
      return Boolean(app && app.service && app.service.getScene() && customEl);
    });
    expect(isInitialized).toBe(true);
    expect(pageErrors).toHaveLength(0);
  });

  test('2. activates all tools by default on first run and creates a 3D primitive via Create Mesh dialog', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.locator('#statsMeshes')).toHaveText('0');

    // On first execution, all tool dialogs are activated by default
    const createDialog = page.locator('#dialog-create-primitive');
    await expect(createDialog).toBeVisible();
    await expect(page.locator('#dialog-csg')).toBeVisible();
    await expect(page.locator('#dialog-facet')).toBeVisible();
    await expect(page.locator('#dialog-scene')).toBeVisible();
    await expect(page.locator('#dialog-mesh')).toBeVisible();
    await expect(page.locator('#dialog-material')).toBeVisible();
    await expect(page.locator('#dialog-anim')).toBeVisible();
    await expect(page.locator('#dialog-textures')).toBeVisible();

    // Verify startup and Babylon scene 3D mesh loaders are present in DOM
    await expect(page.locator('#appStartupLoader')).toBeAttached();
    await expect(page.locator('#sceneInitLoader')).toBeAttached();

    // Click the dat.GUI "Spawn at Origin" button inside #gui-create-container
    await createDialog.locator('.cr.function', { hasText: 'Spawn at Origin' }).click();

    // Verify mesh count increases to 1 and appears in Outliner
    await expect(page.locator('#statsMeshes')).toHaveText('1');
    await expect(page.locator('#outlinerTreeContainer')).toContainText('New_Mesh');
  });

  test('3. deletes a selected mesh and restores it using Undo / Redo', async ({ page }) => {
    await page.goto('/');

    // Spawn a mesh via the editor API
    await page.evaluate(() => {
      (window as any).meshEditorApp.service.createPrimitive({
        shape: 'Box',
        name: 'E2E_Box',
        size: 1,
        width: 1,
        height: 1,
        depth: 1,
        subdivisions: 1,
        tessellation: 16,
        color: '#4f8cf6',
      });
    });

    await expect(page.locator('#statsMeshes')).toHaveText('1');
    await expect(page.locator('#outlinerTreeContainer')).toContainText('E2E_Box');

    // Delete via Actions -> Delete Selected
    await page.locator('#btnDropdownActions').click();
    await page.locator('#btnDeleteSelected').click();

    await expect(page.locator('#statsMeshes')).toHaveText('0');

    // Undo deletion via toolbar Undo button
    const btnUndo = page.locator('#btnUndo');
    await expect(btnUndo).toBeEnabled();
    await btnUndo.click();

    await expect(page.locator('#statsMeshes')).toHaveText('1');
    await expect(page.locator('#outlinerTreeContainer')).toContainText('E2E_Box');

    // Redo deletion via toolbar Redo button
    const btnRedo = page.locator('#btnRedo');
    await expect(btnRedo).toBeEnabled();
    await btnRedo.click();

    await expect(page.locator('#statsMeshes')).toHaveText('0');
  });

  test('4. switches layout modes (Floating vs Stackpanel) and Gizmo modes', async ({ page }) => {
    await page.goto('/');

    // Switch to Stackpanel mode via View menu
    await page.locator('#btnDropdownView').click();
    await page.locator('#btnLayoutStack').click();
    await expect(page.locator('#btnLayoutStack')).toHaveClass(/active/);

    // Switch back to Floating mode via View menu
    await page.locator('#btnDropdownView').click();
    await page.locator('#btnLayoutFloating').click();
    await expect(page.locator('#btnLayoutFloating')).toHaveClass(/active/);

    // Switch Gizmo buttons
    await page.locator('#btnGizmoRotate').click();
    await expect(page.locator('#btnGizmoRotate')).toHaveClass(/active/);

    await page.locator('#btnGizmoScale').click();
    await expect(page.locator('#btnGizmoScale')).toHaveClass(/active/);

    await page.locator('#btnGizmoTranslate').click();
    await expect(page.locator('#btnGizmoTranslate')).toHaveClass(/active/);
  });

  test('5. opens and closes the Help & Keyboard Shortcuts modal', async ({ page }) => {
    await page.goto('/');

    const helpModal = page.locator('#helpModal');
    await expect(helpModal).not.toBeVisible();

    await page.locator('#btnHelp').click();
    await expect(helpModal).toBeVisible();

    await page.locator('#btnHelpDone').click();
    await expect(helpModal).not.toBeVisible();
  });
});

