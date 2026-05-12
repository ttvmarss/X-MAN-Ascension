export function openSettings() {
  const existing = document.getElementById("settings-overlay");
  if (existing) {
    existing.remove();
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "settings-overlay";
  overlay.style.cssText = [
    "position:fixed","top:50%","left:50%","transform:translate(-50%,-50%)",
    "background:rgba(0,0,0,0.92)","border:1px solid rgba(0,180,255,0.3)",
    "border-radius:12px","padding:24px","color:#fff","font-family:monospace",
    "font-size:14px","z-index:9999","min-width:320px","text-align:center",
  ].join(";");

  overlay.innerHTML = `
    <div style="color:#00b4ff;font-size:18px;margin-bottom:16px;letter-spacing:2px">J.A.R.V.I.S.</div>
    <div style="color:#888;font-size:12px;margin-bottom:20px">Voice AI Assistant</div>
    <div style="text-align:left;color:#aaa;font-size:12px;line-height:1.8">
      <div><span style="color:#00b4ff">Status:</span> Online</div>
      <div><span style="color:#00b4ff">Voice:</span> en-GB-RyanNeural</div>
      <div><span style="color:#00b4ff">Model:</span> Claude Haiku</div>
    </div>
    <button id="settings-close" style="margin-top:20px;background:rgba(0,180,255,0.15);border:1px solid rgba(0,180,255,0.4);color:#00b4ff;padding:8px 24px;border-radius:6px;cursor:pointer;font-family:monospace;font-size:13px">Close</button>
  `;

  document.body.appendChild(overlay);
  document.getElementById("settings-close")!.addEventListener("click", () => overlay.remove());
}

export function checkFirstTimeSetup() {
  fetch("/api/status")
    .then((r) => r.json())
    .then((data: Record<string, unknown>) => {
      console.log("[settings] server status:", data);
    })
    .catch(() => {
      console.warn("[settings] server not ready yet");
    });
}
