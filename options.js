// options.js

// Save the API key, model, and max_tokens when the user clicks "Save"
document.getElementById("save").addEventListener("click", () => {
  const apiKey = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("model").value.trim();
  const maxTokens = document.getElementById("maxTokens").value.trim();

  chrome.storage.sync.set(
    { 
      openai_api_key: apiKey, 
      model: model || "gpt-3.5-turbo", 
      max_tokens: maxTokens || "250" 
    },
    () => {
      document.getElementById("status").textContent = "Settings saved.";
      setTimeout(() => {
        document.getElementById("status").textContent = "";
      }, 2000);
    }
  );
});

// Load the existing settings when the options page is opened
chrome.storage.sync.get(["openai_api_key", "model", "max_tokens"], (data) => {
  if (data.openai_api_key) {
    document.getElementById("apiKey").value = data.openai_api_key;
  }
  document.getElementById("model").value = data.model || "gpt-3.5-turbo";
  document.getElementById("maxTokens").value = data.max_tokens || "250";
});
