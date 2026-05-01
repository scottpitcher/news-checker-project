document.getElementById("open-demo")?.addEventListener("click", () => {
  const url = chrome.runtime.getURL("ui/panel.html?demo=1");
  chrome.tabs.create({ url });
});
