// content-new.js

// Function to create and add the "Summarize PR Changes" button.
function addSummarizeButton() {
  const button = document.createElement("button");

  // Set button type to "button" to avoid default submit behavior.
  button.setAttribute("type", "button");

  // Create SVG element with the sparkles icon
  const svgHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M9.6 2.279a.426.426 0 0 1 .8 0l.407 1.112a6.386 6.386 0 0 0 3.802 3.802l1.112.407a.426.426 0 0 1 0 .8l-1.112.407a6.386 6.386 0 0 0-3.802 3.802l-.407 1.112a.426.426 0 0 1-.8 0l-.407-1.112a6.386 6.386 0 0 0-3.802-3.802L4.279 8.4a.426.426 0 0 1 0-.8l1.112-.407a6.386 6.386 0 0 0 3.802-3.802L9.6 2.279Zm-4.267 8.837a.178.178 0 0 1 .334 0l.169.464a2.662 2.662 0 0 0 1.584 1.584l.464.169a.178.178 0 0 1 0 .334l-.464.169a2.662 2.662 0 0 0-1.584 1.584l-.169.464a.178.178 0 0 1-.334 0l-.169-.464a2.662 2.662 0 0 0-1.584-1.584l-.464-.169a.178.178 0 0 1 0-.334l.464-.169a2.662 2.662 0 0 0 1.584-1.584l.169-.464ZM2.8.14a.213.213 0 0 1 .4 0l.203.556a3.2 3.2 0 0 0 1.901 1.901l.556.203a.213.213 0 0 1 0 .4l-.556.203a3.2 3.2 0 0 0-1.901 1.901L3.2 5.86a.213.213 0 0 1-.4 0l-.203-.556A3.2 3.2 0 0 0 .696 3.403L.14 3.2a.213.213 0 0 1 0-.4l.556-.203A3.2 3.2 0 0 0 2.597.696L2.8.14Z"></path></svg>`;
  button.innerHTML = svgHTML;
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
    justifyContent: "center",
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
  }

  button.addEventListener("click", () => {
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

      // const fileHeader = file.querySelector('.file-info')
      //   ? file.querySelector('.file-header').innerText
      //   : '';
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
        // button.innerHTML = svgHTML;
      }
    );
  });
}

// Function to display the summary in the PR description
function showSummary(summary) {
  const prBody = document.querySelector("#pull_request_body");
  if (!prBody) {
    // Fallback to modal if PR body element not found
    console.warn("PR body element not found, showing modal instead");
    return;
  }

  // Append the summary to the PR description
  prBody.value = "## Summary of changes\n\n" + summary;
}

// Add the button when the script loads.
addSummarizeButton();
