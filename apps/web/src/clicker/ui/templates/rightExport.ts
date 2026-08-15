export const renderRightExport = () => `
  <div class="sidebar-sticky-footer">
    <div style="display: flex; gap: 8px; width: 100%; margin-bottom: 8px;">
      <button class="primary" id="export" style="flex: 1; padding: 10px 4px; font-size: 13px;">Download 3MF</button>
      <button class="primary" id="exportStl" style="flex: 1; padding: 10px 4px; font-size: 13px; background-color: #10b981; color: #ffffff; border: none;">Download STL</button>
    </div>
    <div id="projectSettingsContainer">
      <div class="btn-row">
        <button id="saveProj" class="secondary utility-btn" type="button"><span>Save project</span></button>
        <button id="loadProj" class="secondary utility-btn" type="button"><span>Load project</span></button>
        <input type="file" id="projFile" accept="application/json" hidden />
      </div>
      <div class="btn-row footer-utility-row">
        <button id="helpToggle" class="secondary utility-btn" type="button"><span>Help</span></button>
        <button id="themeToggle" class="secondary utility-btn" type="button"><span id="themeLabel">Dark mode</span></button>
      </div>
    </div>
  </div>
`;
