const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "background.js"),
  "utf8"
);
const context = {
  chrome: { runtime: { onMessage: { addListener() {} } } },
};

vm.runInNewContext(source, context);

assert.equal(typeof context.extractResponseText, "function");
assert.equal(
  context.extractResponseText({
    output: [{ type: "message", content: [{ type: "output_text", text: "Summary" }] }],
  }),
  "Summary"
);

let response;
context.sendOpenAIResponse(
  { error: { message: "The selected model is unavailable." } },
  (value) => {
    response = value;
  }
);
assert.equal(response.error, "The selected model is unavailable.");

context.sendOpenAIResponse(
  { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } },
  (value) => {
    response = value;
  }
);
assert.equal(response.error, "OpenAI response was incomplete: max_output_tokens");
assert.equal(
  context.extractResponseText({
    output: [
      { type: "reasoning", summary: [] },
      { type: "message", content: [{ type: "output_text", text: "Summary" }] },
    ],
  }),
  "Summary"
);

console.log("background response parsing tests passed");
