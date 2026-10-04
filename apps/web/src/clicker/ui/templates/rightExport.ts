export const renderRightExport = () => `
  <div class="sidebar-sticky-footer">
    <details id="slicerExportSettings" style="margin-bottom:8px;">
      <summary style="cursor:pointer;padding:6px 0;">3MF export settings</summary>
      <div style="max-height:220px;overflow:auto;padding:4px 0;">
        <label for="exportSlicer">Slicer</label>
        <select id="exportSlicer" style="width:100%;margin:4px 0 8px;">
          <option value="bambu">Bambu Studio</option>
          <option value="flashforge">Flashforge Studio / Orca-Flashforge</option>
        </select>
        <label for="exportTopOrientation">Top / image print orientation</label>
        <select id="exportTopOrientation" style="width:100%;margin:4px 0 8px;">
          <option value="auto">Automatic (raised artwork faces up)</option>
          <option value="face-up">Image facing up</option>
          <option value="face-down">Image facing down</option>
        </select>
        <label for="exportSupports">Slicer supports</label>
        <select id="exportSupports" style="width:100%;margin:4px 0 8px;">
          <option value="auto">Automatic for relief / cap stems</option>
          <option value="on">Enabled</option>
          <option value="off">Disabled</option>
        </select>
        <p id="exportSlicerHint" class="hint-text" style="margin:4px 0;line-height:1.4;"></p>
      </div>
    </details>
    <div style="display: flex; gap: 8px; width: 100%; margin-bottom: 8px;">
      <button class="primary" id="export" style="flex: 1; padding: 10px 4px; font-size: 13px;">Download 3MF</button>
      <button class="primary" id="exportStl" style="flex: 1; padding: 10px 4px; font-size: 13px; background-color: #10b981; color: #ffffff; border: none;">Download STL ZIP</button>
    </div>
    <p id="exportModeHint" class="hint-text" style="margin: 0 0 10px; line-height: 1.4;"></p>
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
