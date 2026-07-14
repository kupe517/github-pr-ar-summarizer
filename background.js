// background.js

const INSTRUCTIONS = `You are a code review assistant. I will provide you with a Git diff of a pull request.  
Your task is to:

1. **Provide an Overview** – Summarize what the pull request is doing in one or two sentences.  
2. **List Key Changes** – Bullet point the main changes, grouping them logically by file or feature.   

The diff will look like a standard \`git diff\`.  
Do **not** simply restate every line of the diff. Instead, focus on what functionality was changed and why.  

**Output format example:**
\`\`\`
## Overview
<high-level summary>

## Key Changes
- <file> – description of major change
- <file> – description of major change
\`\`\``;

const BASE_MODEL = "gpt-5.6-luna";
const BASE_MAX_TOKENS = 700;

function extractResponseText(response) {
  if (!Array.isArray(response?.output)) {
    return "";
  }

  return response.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter(
      (content) =>
        content.type === "output_text" && typeof content.text === "string"
    )
    .map((content) => content.text)
    .join("\n")
    .trim();
}

function sendOpenAIResponse(data, sendResponse) {
  if (data?.error) {
    console.error("OpenAI API error:", data.error);
    sendResponse({ error: data.error.message || "OpenAI API request failed." });
    return;
  }

  if (data?.status === "incomplete") {
    sendResponse({
      error: `OpenAI response was incomplete${
        data.incomplete_details?.reason
          ? `: ${data.incomplete_details.reason}`
          : "."
      }`,
    });
    return;
  }

  const summary = extractResponseText(data);
  if (!summary) {
    sendResponse({
      error: "OpenAI returned no summary. Check the extension service worker console for details.",
    });
    return;
  }

  sendResponse({ summary });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "summarizeDiff") {
    const diff = message.diff;

    // Retrieve the stored settings from chrome.storage
    chrome.storage.sync.get(
      ["openai_api_key", "model", "max_tokens"],
      (data) => {
        const openaiApiKey = data.openai_api_key;
        if (!openaiApiKey) {
          sendResponse({
            error:
              "No API key set. Please set your OpenAI API key in the extension options.",
          });
          return;
        }

        fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: data.model || BASE_MODEL,
            max_output_tokens: Number(data.max_tokens) || BASE_MAX_TOKENS,
            reasoning: { effort: "none" },
            instructions: INSTRUCTIONS,
            input: [
              {
                role: "user",
                content: `Here is the git diff to analyze:\n\n${diff}`,
              },
            ],
          }),
        })
          .then((response) => response.json())
          .then((data) => sendOpenAIResponse(data, sendResponse))
          .catch((error) => {
            console.error("Error calling OpenAI API:", error);
            sendResponse({ error: error.toString() });
          });
      }
    );

    // Return true to indicate that sendResponse will be called asynchronously.
    return true;
  }

  if (message.action === "summarizeDiffFromPR") {
    const { owner, repo, pullNumber } = message;

    // Retrieve both API keys from storage
    chrome.storage.sync.get(
      ["github_token", "openai_api_key", "model", "max_tokens"],
      (data) => {
        const githubToken = data.github_token;
        const openaiApiKey = data.openai_api_key;

        if (!githubToken) {
          sendResponse({
            error:
              "No GitHub token set. Please set your GitHub token in the extension options.",
          });
          return;
        }

        if (!openaiApiKey) {
          sendResponse({
            error:
              "No OpenAI API key set. Please set your OpenAI API key in the extension options.",
          });
          return;
        }

        // Fetch the PR diff from GitHub API
        fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
          {
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: "application/vnd.github.v3.diff",
            },
          }
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error(`GitHub API error: ${response.status}`);
            }
            return response.text();
          })
          .then((diff) => {
            return fetch("https://api.openai.com/v1/responses", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiApiKey}`,
              },
              body: JSON.stringify({
                model: data.model || BASE_MODEL,
                max_output_tokens: Number(data.max_tokens) || BASE_MAX_TOKENS,
                reasoning: { effort: "none" },
                instructions: INSTRUCTIONS,
                input: [
                  {
                    role: "user",
                    content: `Here is the git diff to analyze:\n\n${diff}`,
                  },
                ],
              }),
            });
          })
          .then((response) => response.json())
          .then((data) => sendOpenAIResponse(data, sendResponse))
          .catch((error) => {
            console.error("Error:", error);
            sendResponse({ error: error.toString() });
          });
      }
    );

    // Return true to indicate that sendResponse will be called asynchronously.
    return true;
  }
});
