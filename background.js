// background.js
importScripts("models.js");

const INSTRUCTIONS = `You are a senior software engineer responsible for writing clear, concise, and useful GitHub pull request descriptions.

Analyze the provided Git diff and generate a pull request description that explains the changes to other developers reviewing the code.

## Instructions

1. Analyze the entire diff to understand the overall purpose and scope of the changes.

2. Group related changes into logical categories rather than describing changes file by file.

3. Focus on what changed and why it matters, not implementation details that are obvious from reading the code.

4. Highlight significant architectural decisions, new functionality, bug fixes, refactoring, dependency updates, and behavior changes.

5. Identify any breaking changes, migrations, configuration changes, or potential compatibility concerns.

6. Mention changes to APIs, database schemas, environment variables, or external integrations when relevant.

7. Describe testing performed only when there is explicit evidence. Do not assume tests passed simply because test files were modified.

8. Do not speculate about motivations or functionality that cannot reasonably be determined from the diff.

9. Do not exaggerate the significance of changes.

## Writing Style

Follow ASD-STE100-inspired technical writing principles. Prioritize clarity, accuracy, and readability over strict compliance.

- Use clear, concise, and direct technical language.
- Prefer active voice and short, declarative sentences.
- Express one main idea per sentence and one action per instruction.
- Use simple, consistent terminology. Preserve exact technical identifiers and established domain terms.
- Avoid unnecessary jargon, filler, vague language, and complex sentence structures.
- Use precise verbs that describe observable changes, such as "adds," "removes," "updates," "replaces," or "fixes."
- Describe verified behavior accurately. Do not invent implementation details, motivations, or outcomes.
- Favor clarity and precision over brevity when they conflict.
- Write naturally. Do not sacrifice readability to enforce rigid sentence structures.

These principles are inspired by ASD-STE100 and do not imply formal compliance.

## Output Format

### Summary
Provide 2-3 sentences describing the overall purpose of the PR and its primary impact.

### Changes
Use bullet points grouped by logical functionality to describe the most meaningful changes.

### Technical Notes
Include only when relevant:
- Architectural or structural changes
- API or database changes
- New dependencies or configuration requirements
- Breaking changes or migration considerations
- Important implementation decisions

### Testing
Summarize tests added, updated, or removed.
Distinguish these from tests actually executed.
If test execution cannot be verified, say "Not verified."

## Additional Rules

- Omit sections that have no relevant information, except Summary and Changes.
- Prefer 3-7 meaningful bullets over exhaustive change lists.
- Do not repeat information across sections.
- Do not include generic statements like "improved code quality."
- Use Markdown headings and bullets to make the description easy to scan.
- Keep each bullet focused on one meaningful change or closely related group of changes.
- Output only the PR description in GitHub-flavored Markdown.
`;

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
        const model = resolveModel(data.model);
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
            model,
            max_output_tokens: Number(data.max_tokens) || BASE_MAX_TOKENS,
            reasoning: { effort: ["gpt-6-astra", "gpt-6.1-sol"].includes(model) ? "low" : "none" },
            instructions: INSTRUCTIONS,
            input: [
              {
                role: "user",
                content: `Here is the git diff to analyze: <diff>\n\n${diff}</diff>`,
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
        const model = resolveModel(data.model);

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
                model,
                max_output_tokens: Number(data.max_tokens) || BASE_MAX_TOKENS,
                reasoning: { effort: ["gpt-6-astra", "gpt-6.1-sol"].includes(model) ? "low" : "none" },
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
