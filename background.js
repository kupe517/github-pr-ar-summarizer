// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "summarizeDiff") {
    const diff = message.diff;
    const prompt = `Please summarize the following GitHub pull request. Add an overview section and a list of changes. Format the response as a markdown. Do not include the "\`\`\`markdown" wrapper as part of the response. Include the following sections with headings for each section:
- Overview
- List of changes
The diff is:\n\n${diff}`;

    // Retrieve the stored settings from chrome.storage
    chrome.storage.sync.get(["openai_api_key", "model", "max_tokens"], (data) => {
      const openaiApiKey = data.openai_api_key;
      if (!openaiApiKey) {
        sendResponse({
          error: "No API key set. Please set your OpenAI API key in the extension options.",
        });
        return;
      }

      // Use user-specified values or defaults
      const model = data.model || "gpt-3.5-turbo";
      const maxTokens = parseInt(data.max_tokens, 10) || 150;

      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          const summary = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          sendResponse({ summary });
        })
        .catch((error) => {
          console.error("Error calling OpenAI API:", error);
          sendResponse({ error: error.toString() });
        });
    });

    // Return true to indicate that sendResponse will be called asynchronously.
    return true;
  }

  if (message.action === "summarizeDiffFromPR") {
    const { owner, repo, pullNumber } = message;

    // Retrieve both API keys from storage
    chrome.storage.sync.get(["github_token", "openai_api_key", "model", "max_tokens"], (data) => {
      const githubToken = data.github_token;
      const openaiApiKey = data.openai_api_key;

      if (!githubToken) {
        sendResponse({
          error: "No GitHub token set. Please set your GitHub token in the extension options.",
        });
        return;
      }

      if (!openaiApiKey) {
        sendResponse({
          error: "No OpenAI API key set. Please set your OpenAI API key in the extension options.",
        });
        return;
      }

      // Fetch the PR diff from GitHub API
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3.diff",
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
          }
          return response.text();
        })
        .then((diff) => {
          const prompt = `Please summarize the following GitHub pull request. Add an overview section and a list of changes. Format the response as a markdown. Do not include the "\`\`\`markdown" wrapper as part of the response. Include the following sections with headings for each section:
- Overview
- List of changes
The diff is:\n\n${diff}`;

          // Use user-specified values or defaults
          const model = data.model || "gpt-3.5-turbo";
          const maxTokens = parseInt(data.max_tokens, 10) || 150;

          return fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
              max_tokens: maxTokens,
              temperature: 0.7,
            }),
          });
        })
        .then((response) => response.json())
        .then((data) => {
          const summary = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          sendResponse({ summary });
        })
        .catch((error) => {
          console.error("Error:", error);
          sendResponse({ error: error.toString() });
        });
    });

    // Return true to indicate that sendResponse will be called asynchronously.
    return true;
  }
});
