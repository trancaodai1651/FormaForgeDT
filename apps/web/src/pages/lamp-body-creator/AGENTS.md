# Lamp Body Creator

This folder owns the lamp body module embedded in the admin-only `/admin/tulip-creator` workspace.

- Keep the lamp body geometry, preview, export, and styles in this page boundary.
- Use the shared `LanguageProvider` through `useI18n()` so the page follows the VN/EN switch outside the admin dashboard.
- Do not import or mutate the Tulip Creator or Flex Lamp feature logic when extending this page.
- The STL contains the generated lamp body only; simulation hardware is preview-only.
