// content.js
(() => {
  const STORAGE_KEY_PREFIX = "scroll_marker_page_";

  // Create elements
  let marker = document.createElement("div");
  let handle = document.createElement("div");
  marker.id = "scroll-marker-line";
  handle.id = "scroll-marker-handle";

  // Default settings
  let settings = {
    enabled: false,
    mode: "auto", // 'auto' or 'manual'
    color: "#ff0000",
    thickness: 3, // px
    opacity: 0.9,
  };

  // Keep max scroll Y for auto mode
  let maxY = 0;

  // Helpers
  const getPageKey = () =>
    STORAGE_KEY_PREFIX + location.origin + location.pathname;

  function applyStyles() {
    // marker: a full-width horizontal bar at absolute position in document
    Object.assign(marker.style, {
      position: "absolute",
      left: "0",
      width: "100%",
      height: `${settings.thickness}px`,
      background: settings.color,
      opacity: settings.opacity,
      zIndex: 2147483647,
      pointerEvents: "none", // allow clicking through marker
      transition: "top 0.05s linear",
    });

    // handle: small draggable square at left edge of marker to adjust manually
    Object.assign(handle.style, {
      position: "absolute",
      left: "8px",
      width: "18px",
      height: "18px",
      background: settings.color,
      borderRadius: "3px",
      transform: "translateY(-7px)",
      zIndex: 2147483648,
      cursor: "ns-resize",
      display: settings.mode === "manual" ? "block" : "none",
      opacity: "1",
      boxShadow: "0 0 2px rgba(0,0,0,0.4)",
    });
  }

  function setMarkerTop(y) {
    // Ensure marker exists in document flow; position absolute relative to document
    if (!document.body.contains(marker)) {
      document.documentElement.appendChild(marker); // append to html so it covers full width reliably
    }
    if (!document.documentElement.contains(handle)) {
      document.documentElement.appendChild(handle);
    }
    const top = Math.max(
      0,
      Math.min(y, document.documentElement.scrollHeight - settings.thickness)
    );
    marker.style.top = top + "px";
    handle.style.top = top + "px";
  }

  function savePageState() {
    const key = getPageKey();
    const state = { maxY, markerTop: parseInt(marker.style.top || 0, 10) || 0 };
    const toSave = {};
    toSave[key] = state;
    chrome.storage.local.set(toSave);
  }

  function restorePageState(callback) {
    chrome.storage.local.get([getPageKey()], (res) => {
      const state = res[getPageKey()] || null;
      if (state) {
        maxY = state.maxY || 0;
        if (state.markerTop != null) setMarkerTop(state.markerTop);
      } else {
        // initial set - place marker at current scroll position
        const initial = window.scrollY + window.innerHeight / 2;
        setMarkerTop(initial);
        maxY = initial;
      }
      if (callback) callback(state);
    });
  }

  // Scroll listener for auto mode: update maxY and marker position
  function onScroll() {
    if (!settings.enabled) return;
    if (settings.mode !== "auto") return;
    const bottomSeen = window.scrollY + window.innerHeight;
    if (bottomSeen > maxY) {
      maxY = bottomSeen;
      // Place marker at the maxY coordinate (the furthest bottom reached)
      setMarkerTop(maxY - settings.thickness / 2);
      savePageState();
    }
  }

  // Dragging logic for manual mode (uses handle)
  let dragging = false;
  let startY = 0;
  function onPointerDown(e) {
    if (settings.mode !== "manual" || !settings.enabled) return;
    dragging = true;
    startY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    // Calculate desired top relative to page (clientY + scrollY)
    const desiredTop = e.clientY + window.scrollY;
    setMarkerTop(desiredTop);
  }
  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch (err) {}
    // Save manual marker position and treat markerTop as maxY for consistency
    const top = parseInt(marker.style.top || 0, 10) || 0;
    maxY = top + settings.thickness / 2;
    savePageState();
  }

  // Message listener for popup commands
  chrome.storage.sync.get(["scroll_marker_settings"], (res) => {
    const saved = res.scroll_marker_settings;
    if (saved) settings = Object.assign(settings, saved);
    applyStyles();
    restorePageState(() => {
      if (settings.enabled) {
        // Make sure marker visible if enabled
        marker.style.display = "block";
        handle.style.display = settings.mode === "manual" ? "block" : "none";
      } else {
        marker.style.display = "none";
        handle.style.display = "none";
      }
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });

  // attach elements and listeners
  document.documentElement.appendChild(marker);
  document.documentElement.appendChild(handle);

  handle.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  // Also listen for storage changes (popup updates settings)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.scroll_marker_settings) {
      settings = Object.assign(
        settings,
        changes.scroll_marker_settings.newValue
      );
      applyStyles();
      handle.style.display =
        settings.mode === "manual" && settings.enabled ? "block" : "none";
      marker.style.display = settings.enabled ? "block" : "none";
    }
  });

  // Save page state when unloading (so position persists)
  window.addEventListener("beforeunload", () => {
    savePageState();
  });

  // Ensure marker repositions if images load or layout changes (mutation/resize)
  const resizeObserver = new ResizeObserver(() => {
    // reapply to ensure marker stays where it should
    const currentTop = parseInt(marker.style.top || 0, 10) || 0;
    setMarkerTop(currentTop);
  });
  resizeObserver.observe(document.documentElement);
})();
