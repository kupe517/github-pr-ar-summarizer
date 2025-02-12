// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'summarizeDiff') {
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
          error: "No API key set. Please set your OpenAI API key in the extension options."
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
          "Authorization": `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.7
        })
      })
        .then(response => response.json())
        .then(data => {
          const summary =
            data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            data.choices[0].message.content;
          sendResponse({ summary });
        })
        .catch(error => {
          console.error("Error calling OpenAI API:", error);
          sendResponse({ error: error.toString() });
        });
    });

    // Return true to indicate that sendResponse will be called asynchronously.
    return true;
  }
});
