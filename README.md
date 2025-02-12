# GitHub PR AI Summarizer

A Chrome extension that uses OpenAI's API to generate concise summaries of GitHub Pull Request changes. The extension adds a convenient AI summary button to GitHub's PR interface, making it easier to understand changes at a glance.

## Features

- 🤖 AI-powered summaries of PR changes
- ⚙️ Configurable OpenAI model and token settings
- 🔒 Secure API key storage
- 💫 Native GitHub UI integration
- 📦 Ignores package-lock.json files by default

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/kupe517/github-pr-ar-summarizer.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the cloned repository folder

## Configuration

1. Click the extension's options icon in Chrome's extension menu
2. Enter your OpenAI API key
3. (Optional) Adjust the model and max tokens settings
   - Default model: `gpt-3.5-turbo`
   - Default max tokens: 250

## Usage

1. Navigate to any GitHub Pull Request's "Files changed" tab
2. Click the ✨ button in the action bar
3. Wait for the AI to generate a summary
4. The summary will be automatically inserted into the PR description

## Requirements

- Chrome browser
- OpenAI API key
- GitHub access

## Privacy Note

Your OpenAI API key is stored securely in Chrome's storage sync and is only used for communicating with the OpenAI API to generate summaries.

## Contributing

Feel free to open issues or submit pull requests for any improvements you'd like to suggest.

## License

MIT License
