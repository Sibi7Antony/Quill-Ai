const form = document.getElementById("research-form");
const topicInput = document.getElementById("topic");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const getStartedBtn = document.getElementById("get-started-btn");
const attachBtn = document.getElementById("attach-btn");
const fileInput = document.getElementById("file-input");
const fileNameDisplay = document.getElementById("file-name-display");

const overviewHeading = document.getElementById("overview-heading");
const easyHeading = document.getElementById("easy-heading");
const overviewEl = document.getElementById("overview");
const easyExplanationEl = document.getElementById("easy-explanation");
const keyPointsEl = document.getElementById("key-points");
const mainContentsEl = document.getElementById("main-contents");
const sourcesEl = document.getElementById("sources");

/* ───── Get Started → scroll to the composer ───── */
getStartedBtn.addEventListener("click", () => {
  const composer = document.querySelector(".composer");
  composer.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => topicInput.focus(), 500);
});

/* ───── Plus icon → open file picker ───── */
attachBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    const name = fileInput.files[0].name;
    fileNameDisplay.textContent = name;
    fileNameDisplay.title = name;
  } else {
    fileNameDisplay.textContent = "";
    fileNameDisplay.title = "";
  }
});

/* ───── Helpers ───── */
function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderList(element, items) {
  if (!items?.length) {
    element.innerHTML = "<li>No items found.</li>";
    return;
  }
  element.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderMainContents(items) {
  if (!items?.length) {
    mainContentsEl.innerHTML = "<p>No detailed sections found.</p>";
    return;
  }
  mainContentsEl.innerHTML = items
    .map(
      (item) => `
        <div class="main-content-item">
          <h3>${escapeHtml(item.heading)}</h3>
          <p>${escapeHtml(item.details)}</p>
        </div>
      `
    )
    .join("");
}

function renderSources(items) {
  if (!items?.length) {
    sourcesEl.innerHTML = "<li>No source links available.</li>";
    return;
  }
  sourcesEl.innerHTML = items
    .map(
      (item) => `
        <li>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
          ${item.snippet ? `<br/><small>${escapeHtml(item.snippet)}</small>` : ""}
        </li>
      `
    )
    .join("");
}

/* ───── Form submit ───── */
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const topic = topicInput.value.trim();

  if (topic.length < 3) {
    statusEl.textContent = "Please enter at least 3 characters.";
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = "Ai is Researching .";
  resultsEl.classList.add("hidden");

  try {
    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic })
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Request failed.");
    }

    const result = payload.data;

    // Make headings match the input topic better!
    overviewHeading.textContent = `Definition of ${topic}`;
    easyHeading.textContent = `Simplified insight of ${topic}`;

    overviewEl.textContent = result.definition || "";
    easyExplanationEl.textContent = result.simplified_insight || "";
    renderList(keyPointsEl, result.key_points || []);
    renderMainContents(result.main_contents || []);
    renderSources(result.sources || []);

    resultsEl.classList.remove("hidden");

    // Shorter done message
    statusEl.textContent = `✓ Done.`;

    resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    statusEl.textContent = error?.message || "Something went wrong while generating the research summary.";
  } finally {
    submitBtn.disabled = false;
  }
});

/* ───── Clean Spline shadow DOM: remove borders, outlines & watermark ───── */
(function cleanSplineViewer() {
  let attempts = 0;
  const maxAttempts = 60;

  const interval = setInterval(() => {
    attempts++;
    const viewer = document.querySelector("spline-viewer");

    if (viewer?.shadowRoot) {
      /* 1. Inject a global style sheet into the shadow DOM to nuke all borders */
      if (!viewer.shadowRoot.querySelector("#quill-spline-fix")) {
        const style = document.createElement("style");
        style.id = "quill-spline-fix";
        style.textContent = `
          *, *::before, *::after {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
          }
          canvas {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
            display: block;
          }
          iframe {
            outline: none !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          #logo, a[href*="spline"], [id*="logo"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `;
        viewer.shadowRoot.appendChild(style);
      }

      /* 2. Also directly hide logo/watermark elements */
      const logo = viewer.shadowRoot.querySelector("#logo")
        || viewer.shadowRoot.querySelector("[id*='logo']")
        || viewer.shadowRoot.querySelector("a[href*='spline']");
      if (logo) {
        logo.style.display = "none";
        logo.style.visibility = "hidden";
        logo.style.opacity = "0";
        logo.style.pointerEvents = "none";
      }

      /* 3. Hide "Built with Spline" text divs */
      viewer.shadowRoot.querySelectorAll("a").forEach((a) => {
        if (a.href?.includes("spline")) {
          a.style.display = "none";
          a.style.visibility = "hidden";
        }
      });

      viewer.shadowRoot.querySelectorAll("div").forEach((div) => {
        const text = div.textContent?.toLowerCase() || "";
        if ((text.includes("built with spline") || text.includes("spline")) &&
            div.children.length <= 2 && text.length < 80) {
          div.style.display = "none";
          div.style.visibility = "hidden";
        }
      });

      /* Style sheet injected — we're done */
      clearInterval(interval);
    }

    if (attempts >= maxAttempts) clearInterval(interval);
  }, 200);
})();
