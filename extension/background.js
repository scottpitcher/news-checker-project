const VERIFY_ENDPOINTS = [
  "http://localhost:5000/verify",
  "http://127.0.0.1:5000/verify",
  "http://localhost:5001/verify",
  "http://127.0.0.1:5001/verify",
  "http://localhost:8000/verify",
  "http://127.0.0.1:8000/verify",
];

const REQUEST_TIMEOUT_MS = 9000;

async function fetchVerify(payload) {
  let lastError = "No backend response.";

  for (const verifyUrl of VERIFY_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        lastError = `Endpoint ${verifyUrl} returned ${response.status}.`;
        continue;
      }

      const json = await response.json();
      return { ok: true, payload: json };
    } catch (err) {
      lastError = `Endpoint ${verifyUrl} failed: ${err?.message || "request error"}.`;
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: lastError };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "TWEETCHECK_VERIFY") {
    return false;
  }

  fetchVerify(message.payload || {})
    .then((result) => sendResponse(result))
    .catch((err) =>
      sendResponse({
        ok: false,
        error: err?.message || "Unexpected verify error.",
      })
    );

  return true;
});
