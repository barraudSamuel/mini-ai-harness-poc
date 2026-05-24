import "dotenv/config";
import OpenAI from "openai";
import fs from "node:fs/promises";
import {execSync} from "node:child_process";
import readline from "node:readline/promises";

async function main() {
    const [, , flag, prompt, ...rest] = process.argv;
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;
    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    const keepOpen = rest.includes("--keep-open") || process.env.KEEP_OPEN === "1";

    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not set");
    }
    if (flag !== "-p" || !prompt) {
        throw new Error("error: -p flag is required");
    }

    const client = new OpenAI({
        apiKey: apiKey,
        ...(baseURL ? {baseURL} : {}),
    });

    await runAgent(client, model, prompt);

    if (keepOpen) {
        await keepHarnessOpen(client, model);
    }
}

async function runAgent(client, model, prompt) {
    messagesHistory.push({role: "user", content: prompt});

    //agent loop
    while (true) {
        const response = await sendPrompt(client, model);
        if (!response.choices || response.choices.length === 0) {
            throw new Error("no choices in response");
        }

        const message = response.choices[0].message;
        messagesHistory.push(message)

        if (!message.tool_calls || message.tool_calls.length === 0) {
            console.log(message.content);
            break;
        }

        // tools execution
        for (const toolCall of response.choices[0].message?.tool_calls) {
            const toolName = toolCall.function.name;
            const tool = toolsMap.get(toolName);
            if (!tool) {
                throw new Error(`Unknown tool: ${toolName}`);
            }

            const argument = JSON.parse(toolCall.function.arguments || "{}");
            // console.log("calling: ", toolName, argument);
            const resp = await tool(argument)
            messagesHistory.push({role: "tool", tool_call_id: toolCall.id, content: resp})
        }
    }
}

async function keepHarnessOpen(client, model) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    try {
        while (true) {
            const prompt = (await rl.question("> ")).trim();

            if (prompt === "/exit" || prompt === "/quit") {
                break;
            }
            if (!prompt) {
                continue;
            }

            await runAgent(client, model, prompt);
        }
    } finally {
        rl.close();
    }
}


// UTILS

const toolsMap = new Map([
    [
        "Read",
        async ({file_path}) => {
            return await fs.readFile(file_path, "utf8");
        },
    ],
    [
        "Write",
        async ({file_path, content}) => {
            await fs.writeFile(file_path, content, "utf8");
            return `Wrote ${content.length} characters to ${file_path}`;
        },
    ],
    [
        "Bash",
        async ({command}) => {
            return execSync(command, {encoding: 'utf-8'}).toString();
        }
    ]
])

const tools = [
    {
        "type": "function",
        "function": {
            "name": "Read",
            "description": "Read and return the contents of a file",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "The path to the file to read"
                    }
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "Write",
            "description": "Write content to a file",
            "parameters": {
                "type": "object",
                "required": ["file_path", "content"],
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "The path of the file to write to"
                    },
                    "content": {
                        "type": "string",
                        "description": "The content to write to the file"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "Bash",
            "description": "Execute a shell command",
            "parameters": {
                "type": "object",
                "required": ["command"],
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The command to execute"
                    }
                }
            }
        }
    }
]

const messagesHistory = [
    {
        role: "system",
        content: "You are a coding agent. Use tools when needed. Once the requested file changes are complete, stop calling tools and respond with a brief final answer.",
    },
]

const sendPrompt = (client, model) => {
    return client.chat.completions.create({
        model: model,
        messages: [
            ...messagesHistory,
        ],
        tools: tools,
    });
};

main();
