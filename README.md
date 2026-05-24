# Miniharness

Miniharness is a proof of concept for an ultra-mini GPT harness.

It is a tiny Node.js CLI that sends a prompt to an OpenAI chat model, keeps a message history, and lets the model call a small set of local tools:

- `Read`: read a local file
- `Write`: write a local file
- `Bash`: execute a shell command

This project is intentionally small. It is meant for experimentation and learning, not for production use.

## Setup

Install dependencies:

```sh
npm install
```

Create a local `.env` file from the example:

```sh
cp .env.exemple .env
```

Then set your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
```

`OPENAI_BASE_URL` is optional and should only be set when using an OpenAI-compatible endpoint.

## Usage

Run a single prompt:

```sh
node app/main.js -p "Read package.json and summarize the project"
```

Keep the harness open for multiple prompts:

```sh
node app/main.js -p "You are working in this repository" --keep-open
```

Inside interactive mode, type `/exit` or `/quit` to stop.

## Safety

The `Write` and `Bash` tools can modify files and execute commands on your machine. Only run this harness in a trusted local workspace.
