// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const enabledEl = document.getElementById("enabled");
  const modeEl = document.getElementById("mode");
  const colorEl = document.getElementById("color");
  const thicknessEl = document.getElementById("thickness");
  const resetBtn = document.getElementById("reset");

  const defaultSettings = {
    enabled: false,
    mode: "auto",
    color: "#ff0000",
    thickness: 3,
    opacity: 0.9,
  };

  function load() {
    chrome.storage.sync.get(["scroll_marker_settings"], (res) => {
      const s = Object.assign(
        {},
        defaultSettings,
        res.scroll_marker_settings || {}
      );
      enabledEl.checked = !!s.enabled;
      modeEl.value = s.mode;
      colorEl.value = s.color;
      thicknessEl.value = s.thickness;
    });
  }

  function save() {
    const s = {
      enabled: enabledEl.checked,
      mode: modeEl.value,
      color: colorEl.value,
      thickness: parseInt(thicknessEl.value, 10) || defaultSettings.thickness,
      opacity: defaultSettings.opacity,
    };
    chrome.storage.sync.set({ scroll_marker_settings: s }, () => {
      // notify current tab (storage.onChanged in content script will react)
      // also optionally send a direct message to the active tab to force immediate update
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: "apply_settings", settings: s },
            () => {}
          );
        }
      });
    });
  }

  // Reset per-page saved marker (clears stored page state)
  resetBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const key =
        "scroll_marker_page_" +
        new URL(tabs[0].url).origin +
        new URL(tabs[0].url).pathname;
      const toRemove = [key];
      chrome.storage.local.remove(toRemove, () => {
        // instruct content script to reposition marker to middle of viewport
        chrome.tabs.sendMessage(tabs[0].id, { type: "reset_marker" }, () => {});
      });
    });
  });

  // wire inputs
  enabledEl.addEventListener("change", save);
  modeEl.addEventListener("change", save);
  colorEl.addEventListener("input", save);
  thicknessEl.addEventListener("input", save);

  // initial load
  load();
});
