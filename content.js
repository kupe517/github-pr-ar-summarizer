// content.js

// Function to create and add the "Summarize PR Changes" button.
function addSummarizeButton() {
  
  // Check if button already exists to avoid duplicates
  if (document.querySelector('[aria-label="AI Summary"]')) {
    return;
  }
  
  const button = document.createElement("button");

  // Set button type to "button" to avoid default submit behavior.
  button.setAttribute("type", "button");

  // Create SVG element with the sparkles icon
  const aiIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M9.6 2.279a.426.426 0 0 1 .8 0l.407 1.112a6.386 6.386 0 0 0 3.802 3.802l1.112.407a.426.426 0 0 1 0 .8l-1.112.407a6.386 6.386 0 0 0-3.802 3.802l-.407 1.112a.426.426 0 0 1-.8 0l-.407-1.112a6.386 6.386 0 0 0-3.802-3.802L4.279 8.4a.426.426 0 0 1 0-.8l1.112-.407a6.386 6.386 0 0 0 3.802-3.802L9.6 2.279Zm-4.267 8.837a.178.178 0 0 1 .334 0l.169.464a2.662 2.662 0 0 0 1.584 1.584l.464.169a.178.178 0 0 1 0 .334l-.464.169a2.662 2.662 0 0 0-1.584 1.584l-.169.464a.178.178 0 0 1-.334 0l-.169-.464a2.662 2.662 0 0 0-1.584-1.584l-.464-.169a.178.178 0 0 1 0-.334l.464-.169a2.662 2.662 0 0 0 1.584-1.584l.169-.464ZM2.8.14a.213.213 0 0 1 .4 0l.203.556a3.2 3.2 0 0 0 1.901 1.901l.556.203a.213.213 0 0 1 0 .4l-.556.203a3.2 3.2 0 0 0-1.901 1.901L3.2 5.86a.213.213 0 0 1-.4 0l-.203-.556A3.2 3.2 0 0 0 .696 3.403L.14 3.2a.213.213 0 0 1 0-.4l.556-.203A3.2 3.2 0 0 0 2.597.696L2.8.14Z"></path></svg>`;

  const loadingIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2.75 1h10.5a.75.75 0 0 1 0 1.5h-.75v1.25a4.75 4.75 0 0 1-1.9 3.8l-.333.25a.25.25 0 0 0 0 .4l.333.25a4.75 4.75 0 0 1 1.9 3.8v1.25h.75a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5h.75v-1.25a4.75 4.75 0 0 1 1.9-3.8l.333-.25a.25.25 0 0 0 0-.4L5.4 7.55a4.75 4.75 0 0 1-1.9-3.8V2.5h-.75a.75.75 0 0 1 0-1.5ZM11 2.5H5v1.25c0 1.023.482 1.986 1.3 2.6l.333.25c.934.7.934 2.1 0 2.8l-.333.25a3.251 3.251 0 0 0-1.3 2.6v1.25h6v-1.25a3.251 3.251 0 0 0-1.3-2.6l-.333-.25a1.748 1.748 0 0 1 0-2.8l.333-.25a3.251 3.251 0 0 0 1.3-2.6Z"></path></svg>`;

  button.innerHTML = aiIcon;
  button.setAttribute("aria-label", "AI Summary");

  // Simple styling to keep the button visible in the viewport.
  Object.assign(button.style, {
    color: "var(--fgColor-muted)",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    float: "left",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  });

  // Add hover effects
  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor =
      "var(--control-transparent-bgColor-hover, var(--color-action-list-item-default-hover-bg))";
  });

  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "transparent";
  });

  document.body.appendChild(button);

  const actionBar = document.querySelector(".ActionBar-item-container");
  if (actionBar) {
    actionBar.prepend(button);
  } else {
    // Remove the button if we couldn't add it to the action bar
    button.remove();
    return;
  }

  button.addEventListener("click", () => {
    // Change the button to a loading icon
    button.innerHTML = loadingIcon;

    // Extract diff text from the page.
    let diffText = "";
    // GitHub PR file changes are usually rendered inside elements with the class "file".
    const diffContainers = document.querySelectorAll(".file");

    if (diffContainers.length === 0) {
      alert(
        "No diff found on this page. Please navigate to the 'Files changed' tab."
      );
      return;
    }

    const prBody = document.querySelector("#pull_request_body");
    if (prBody) {
      diffText += `
          PR description: ${prBody.value}\n\n
          `;
    }

    diffContainers.forEach((file) => {
      // Skip package-lock.json files
      const fileName = file
        .querySelector(".file-header")
        ?.getAttribute("data-path");
      if (fileName === "package-lock.json") return;

      const diffContent = file.querySelector(".diff-table")
        ? file.querySelector(".diff-table").innerText
        : "";
      diffText += `
          File name: ${fileName}\n\n
          ${diffContent}\n\n
          `;
    });

    // Send the diff text to the background script for summarization.
    chrome.runtime.sendMessage(
      { action: "summarizeDiff", diff: diffText },
      (response) => {
        if (response && response.summary) {
          showSummary(response.summary);
        } else if (response && response.error) {
          alert("Error summarizing: " + response.error);
        }
        // Restore the SVG after processing
        button.innerHTML = aiIcon;
      }
    );
  });
}

// Function to display the summary in the PR description
function showSummary(summary) {
  const prBody = document.querySelector("#pull_request_body");
  if (!prBody) {
    console.warn("PR body element not found, showing modal instead");
    return;
  }
  prBody.value = "## Summary of changes\n\n" + summary;
}

// Function to check if we're on a PR page
function isPRPage() {
  // Check if we're on a pull request page
  return window.location.pathname.includes('/pull/') || 
         document.querySelector('.js-pull-request-tab') !== null ||
         document.querySelector('.new-pr-form') !== null;
}

// Function to initialize the observer
function initMutationObserver() {
  // Create a MutationObserver to watch for changes to the DOM
  const observer = new MutationObserver((mutations) => {
    // Check if we're on a PR page
    if (isPRPage()) {
      // Look for the action bar
      const actionBar = document.querySelector(".ActionBar-item-container");
      // If action bar exists and our button doesn't, add it
      if (actionBar && !document.querySelector('[aria-label="AI Summary"]')) {
        addSummarizeButton();
      }
    }
  });

  // Start observing the document with the configured parameters
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

// Initial setup
function initialize() {
  
  // Add button if we're already on a PR page
  if (isPRPage()) {
    addSummarizeButton();
  }
  
  // Set up observer for future navigation
  initMutationObserver();
  
  // Also listen for URL changes
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (isPRPage()) {
        setTimeout(() => {
          addSummarizeButton();
        }, 1000); // Small delay to ensure DOM is updated
      }
    }
  }).observe(document, {subtree: true, childList: true});
}

// Initialize the extension when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
