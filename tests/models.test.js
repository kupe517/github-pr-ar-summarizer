const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const cases = [
  [undefined, "gpt-6-luna", "none"],
  ["gpt-5.6-sol", "gpt-6-astra", "low"],
  ["gpt-5.6-terra", "gpt-6.1-sol", "low"],
  ["gpt-5.6-luna", "gpt-6-luna", "none"],
  ["gpt-6-astra", "gpt-6-astra", "low"],
  ["gpt-6.1-sol", "gpt-6.1-sol", "low"],
  ["gpt-6-luna", "gpt-6-luna", "none"],
];

test("both summary paths use migrated models and supported reasoning", async () => {
  for (const action of ["summarizeDiff", "summarizeDiffFromPR"]) {
    for (const [stored, expected, effort] of cases) {
      let listener;
      let request;
      const context = {
        chrome: {
          runtime: { onMessage: { addListener(fn) { listener = fn; } } },
          storage: { sync: { get(keys, callback) {
            callback({ model: stored, openai_api_key: "test-key", github_token: "test-token", max_tokens: 1200 });
          } } },
        },
        importScripts(file) { vm.runInNewContext(read(file), context); },
        async fetch(url, options) {
          if (url.startsWith("https://api.github.com/")) {
            return { ok: true, text: async () => "test diff" };
          }
          assert.equal(url, "https://api.openai.com/v1/responses");
          request = JSON.parse(options.body);
          return { json: async () => ({ output: [{ content: [{ type: "output_text", text: "Summary" }] }] }) };
        },
      };
      vm.runInNewContext(read("background.js"), context);
      const response = await new Promise((resolve) => {
        assert.equal(listener({ action, diff: "test diff", owner: "owner", repo: "repo", pullNumber: 1 }, {}, resolve), true);
      });
      assert.equal(response.summary, "Summary");
      assert.equal(request.model, expected);
      assert.equal(request.reasoning.effort, effort);
      assert.equal(request.max_output_tokens, 1200);
      assert.match(request.input[0].content, /test diff/);
    }
  }
});

test("options load and save the migrated selection without losing settings", () => {
  const html = read("options.html");
  assert.ok(html.indexOf('src="models.js"') < html.indexOf('src="options.js"'));
  const choices = [...html.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
  for (const [stored, expected] of cases) {
    const elements = Object.fromEntries(["save", "apiKey", "githubToken", "model", "maxTokens", "status"].map((id) => [id, {
      value: "",
      addEventListener(event, fn) { this.click = fn; },
    }]));
    let saved;
    const context = {
      document: { getElementById: (id) => elements[id] },
      setTimeout() {},
      chrome: { storage: { sync: {
        get(keys, callback) { callback({ model: stored, openai_api_key: "test-key", github_token: "test-token", max_tokens: "1200" }); },
        set(data, callback) { saved = data; callback(); },
      } } },
    };
    vm.runInNewContext(read("models.js"), context);
    vm.runInNewContext(read("options.js"), context);
    assert.equal(elements.model.value, expected);
    assert.ok(choices.includes(expected));
    elements.save.click();
    assert.equal(saved.model, expected);
    assert.equal(saved.openai_api_key, "test-key");
    assert.equal(saved.github_token, "test-token");
    assert.equal(saved.max_tokens, "1200");
  }
});
