// background.js

const INSTRUCTIONS = `Write a high-level, product-manager-friendly summary of this pull request using only the supplied changed files and diff.

Start with a 1–2 sentence plain-English overview of the outcome.

Then group related changes into meaningful sections based on their purpose, not the order of the diff. For example: “Local developer experience,” “Production deployment,” “Documentation,” or “Testing.”

Within each section, list every substantive created, modified, or deleted file in this format:

- \`path/to/file\` — 1–3 sentences explaining what changed and why it matters. Focus on the developer, operational, or product impact rather than implementation details.

Rules:
- Clearly identify new, modified, and deleted files where relevant.
- Use understandable language; briefly explain unavoidable technical terms.
- Do not describe changes line-by-line or repeat the diff.
- Do not speculate beyond the evidence in the diff.
- Omit incidental generated files, lockfiles, and formatting-only changes unless they materially affect the result.
- Keep related files together and avoid a separate section for a single trivial file.
- End with a short “Overall result” paragraph explaining what is safer, easier, faster, or more reliable after this PR.
`;

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
        content.type === "output_text" && typeof content.text === "string",
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
      error:
        "OpenAI returned no summary. Check the extension service worker console for details.",
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
      },
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
          },
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
      },
    );

    // Return true to indicate that sendResponse will be called asynchronously.
    return true;
  }
});
