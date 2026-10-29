#!/usr/bin/env node
/**
 * Antigravity Local OpenAI-Compatible Bridge for Mesh Editor
 *
 * Bridges OpenAI-compatible `/v1/models` and `/v1/chat/completions` requests
 * from the Mesh Editor AI Agent directly to the local Antigravity CLI (`agy`),
 * using the user's authenticated Antigravity account without requiring an API key.
 *
 * Used automatically by:
 * 1. `webpack-dev-server` at `/api/antigravity/v1/*` (`npm run dev` / `npm run prod`)
 * 2. Standalone bridge server at `http://localhost:8787/v1/*` (`npm run ai:bridge`)
 * 3. Electron desktop app (`electron/main.js`)
 */

const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const DEFAULT_AGY_MODELS = [
  'gemini-3.8-flash-medium',
  'gemini-3.8-flash-high',
  'gemini-3.8-flash-low',
  'gemini-4-argon-medium',
  'gemini-4-argon-high',
  'gemini-4-argon-low',
  'claude-sonnet-5-5-medium',
  'claude-sonnet-5-5-high',
  'claude-sonnet-5-5-low',
  'claude-opus-5-5-medium',
  'claude-opus-5-5-high',
  'claude-opus-5-5-low',
  'gpt-oss-120b-medium',
];

let cachedModels = null;

/**
 * Resolves the path to the local `agy` binary.
 */
function resolveAgyBinary() {
  const home = os.homedir();
  const candidates = [
    process.env.AGY_BIN,
    path.join(home, '.gemini', 'bin', 'agy'),
    path.join(home, '.gemini', 'antigravity', 'bin', 'agy'),
    '/usr/local/bin/agy',
    '/opt/homebrew/bin/agy',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }
  return 'agy';
}

/**
 * Normalizes a requested model ID to a valid Antigravity CLI model ID.
 */
function normalizeAgyModel(requestedModel) {
  const raw = String(requestedModel || '').trim().toLowerCase();
  if (!raw) return 'gemini-3.8-flash-medium';

  if (DEFAULT_AGY_MODELS.includes(raw)) {
    return raw;
  }
  if (raw.includes('3.8-flash') || raw.includes('3-flash') || raw.includes('2.5-flash') || raw === 'gemini-flash') {
    if (raw.includes('high')) return 'gemini-3.8-flash-high';
    if (raw.includes('low')) return 'gemini-3.8-flash-low';
    return 'gemini-3.8-flash-medium';
  }
  if (raw.includes('argon') || raw.includes('3.1-pro') || raw.includes('2.5-pro') || raw.includes('gemini-pro')) {
    if (raw.includes('high')) return 'gemini-4-argon-high';
    if (raw.includes('low')) return 'gemini-4-argon-low';
    return 'gemini-4-argon-medium';
  }
  if (raw.includes('opus')) {
    if (raw.includes('high')) return 'claude-opus-5-5-high';
    if (raw.includes('low')) return 'claude-opus-5-5-low';
    return 'claude-opus-5-5-medium';
  }
  if (raw.includes('claude') || raw.includes('sonnet')) {
    if (raw.includes('high')) return 'claude-sonnet-5-5-high';
    if (raw.includes('low')) return 'claude-sonnet-5-5-low';
    return 'claude-sonnet-5-5-medium';
  }
  if (raw.includes('gpt-oss')) {
    return 'gpt-oss-120b-medium';
  }
  // Fallback for e.g. 'gpt-4o' when switching from OpenAI preset to Antigravity
  if (raw.startsWith('gpt-')) {
    return 'gemini-3.8-flash-medium';
  }
  return requestedModel;
}

/**
 * Runs a command and captures stdout/stderr.
 */
function execProcess(bin, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: options.cwd || os.tmpdir(),
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      reject(err);
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Queries `agy models` (with caching and fallback to DEFAULT_AGY_MODELS).
 */
async function listAgyModels() {
  if (cachedModels && cachedModels.length > 0) {
    return cachedModels;
  }
  try {
    const bin = resolveAgyBinary();
    const { code, stdout } = await execProcess(bin, ['models']);
    if (code === 0 && stdout) {
      const parsed = [];
      const lines = stdout.replace(/\r/g, '\n').split('\n');
      for (const line of lines) {
        const clean = line.replace(/^[\s⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]+/, '').trim();
        if (!clean || clean.startsWith('Fetching')) continue;
        const match = clean.match(/^([a-z0-9._-]+)\s{2,}(.+)$/i);
        if (match) {
          parsed.push(match[1].trim());
        }
      }
      if (parsed.length > 0) {
        cachedModels = Array.from(new Set([...parsed, ...DEFAULT_AGY_MODELS]));
        return cachedModels;
      }
    }
  } catch {
    // Fallback to default list
  }
  return DEFAULT_AGY_MODELS;
}

/**
 * Extracts a structured `{ content, tool_calls }` payload from the model's text response.
 */
function parseStructuredAgentResponse(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    return { content: '', toolCalls: [] };
  }

  const tryParseObj = (candidate) => {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object') {
        const toolCalls = Array.isArray(obj.tool_calls)
          ? obj.tool_calls
          : Array.isArray(obj.toolCalls)
            ? obj.toolCalls
            : [];
        const content =
          typeof obj.content === 'string'
            ? obj.content
            : typeof obj.message === 'string'
              ? obj.message
              : '';
        if (Array.isArray(toolCalls) && (toolCalls.length > 0 || typeof obj.content === 'string' || typeof obj.message === 'string')) {
          return { content, toolCalls };
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  // 1. Direct JSON object
  const direct = tryParseObj(trimmed);
  if (direct) return direct;

  // 2. ```json ... ``` fenced block
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = fenceRegex.exec(trimmed)) !== null) {
    const parsed = tryParseObj(match[1].trim());
    if (parsed) return parsed;
  }

  // 3. First { ... } block in text
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sub = trimmed.slice(firstBrace, lastBrace + 1);
    const parsed = tryParseObj(sub);
    if (parsed) return parsed;
  }

  return { content: trimmed, toolCalls: [] };
}

/**
 * Builds the prompt for `agy -p` from OpenAI `messages` and `tools`.
 */
function buildAgyPromptFromOpenAI(messages, tools) {
  const tempImageFiles = [];
  const sections = [];

  const toolDefs = Array.isArray(tools)
    ? tools
        .map((t) => t && t.function)
        .filter(Boolean)
        .map((fn) => ({
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        }))
    : [];

  for (const msg of messages || []) {
    if (!msg) continue;
    if (msg.role === 'system') {
      sections.push(`=== SYSTEM INSTRUCTIONS ===\n${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`);
    } else if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        sections.push(`=== USER REQUEST ===\n${msg.content}`);
      } else if (Array.isArray(msg.content)) {
        const textParts = [];
        for (const part of msg.content) {
          if (part.type === 'text' && part.text) {
            textParts.push(part.text);
          } else if (part.type === 'image_url' && part.image_url?.url) {
            const url = part.image_url.url;
            const dataMatch = url.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (dataMatch) {
              const ext = dataMatch[1] === 'jpeg' ? 'jpg' : dataMatch[1];
              const tmpFile = path.join(os.tmpdir(), `mesheditor_ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`);
              try {
                fs.writeFileSync(tmpFile, Buffer.from(dataMatch[2], 'base64'));
                tempImageFiles.push(tmpFile);
                textParts.push(`[Attached Reference Image saved at: ${tmpFile}]`);
              } catch {
                // ignore image write failure
              }
            } else {
              textParts.push(`[Attached Reference Image URL: ${url}]`);
            }
          }
        }
        sections.push(`=== USER REQUEST ===\n${textParts.join('\n')}`);
      }
    } else if (msg.role === 'assistant') {
      const tcList = Array.isArray(msg.tool_calls)
        ? msg.tool_calls.map((tc) => ({
            id: tc.id,
            name: tc.function?.name,
            arguments: tc.function?.arguments,
          }))
        : [];
      sections.push(
        `=== PREVIOUS ASSISTANT TURN ===\n${msg.content ? `Text: ${msg.content}\n` : ''}${
          tcList.length > 0 ? `Executed Tool Calls: ${JSON.stringify(tcList)}` : ''
        }`
      );
    } else if (msg.role === 'tool') {
      sections.push(`=== TOOL EXECUTION RESULT (${msg.name || msg.tool_call_id}) ===\n${msg.content}`);
    }
  }

  if (toolDefs.length > 0) {
    sections.push(
      `=== AVAILABLE 3D MODELER TOOLS ===\n${JSON.stringify(toolDefs, null, 2)}`
    );
  }

  const imageInstruction =
    tempImageFiles.length > 0
      ? `You may ONLY call your internal read_file tool on [${tempImageFiles.join(', ')}] to inspect the user's reference image. Do NOT call any other internal CLI/workspace tools (no run_command, no edit_file, etc.).`
      : `CRITICAL: Do NOT call any internal CLI/workspace tools (do NOT call run_command, read_file, write_file, edit_file, etc.).`;

  sections.push(`=== OUTPUT FORMAT REQUIREMENT ===
${imageInstruction}
Instead, respond ONLY with a single valid JSON object (no markdown prose outside the JSON) with this exact structure:
{
  "content": "Brief message or explanation in English for the user",
  "tool_calls": [
    {
      "name": "modeler_...",
      "arguments": { ... }
    }
  ]
}
Rules for "tool_calls":
1. To create or modify 3D meshes in the scene, populate "tool_calls" with one or more calls to the AVAILABLE 3D MODELER TOOLS listed above (e.g. "modeler_create_primitive", "modeler_extrude_polygon", "modeler_create_lathe", "modeler_boolean_operation", "modeler_create_material", "modeler_build_voxel_mesh", "modeler_execute_babylon_code", etc.).
2. You can emit multiple tool_calls in a single turn to build all parts of the requested 3D model at once, or inspect results across turns.
3. If all required TOOL EXECUTION RESULTS are already present above and the 3D model is complete, set "tool_calls": [] and provide a concise final summary in "content".`);

  return {
    prompt: sections.join('\n\n'),
    tempImageFiles,
  };
}

/**
 * Executes a chat completion request via `agy` and returns an OpenAI-formatted response object.
 */
async function runAgyChatCompletion(body) {
  const bin = resolveAgyBinary();
  const model = normalizeAgyModel(body?.model);
  const { prompt, tempImageFiles } = buildAgyPromptFromOpenAI(body?.messages || [], body?.tools || []);

  const args = ['--model', model, '--output-format', 'json', '--disable-slash-commands'];
  if (tempImageFiles.length > 0) {
    args.push('--add-dir', os.tmpdir(), '--dangerously-skip-permissions');
  }
  args.push('-p', prompt);

  try {
    const { code, stdout, stderr } = await execProcess(bin, args, { cwd: os.tmpdir() });

    // Parse last JSON line from agy stdout
    let agyResult = null;
    const lines = String(stdout || '')
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('{') && lines[i].endsWith('}')) {
        try {
          agyResult = JSON.parse(lines[i]);
          break;
        } catch {
          // continue searching
        }
      }
    }

    if (code !== 0 && (!agyResult || agyResult.status === 'ERROR')) {
      const errMsg = agyResult?.error || stderr || stdout || `agy exited with code ${code}`;
      throw new Error(errMsg.trim());
    }

    const rawResponseText = agyResult ? agyResult.response || '' : stdout;
    const { content, toolCalls } = parseStructuredAgentResponse(rawResponseText);

    const formattedToolCalls = (toolCalls || [])
      .filter((tc) => tc && typeof (tc.name || tc.function?.name) === 'string')
      .map((tc, idx) => {
        const fnName = tc.name || tc.function?.name;
        const fnArgs = tc.arguments ?? tc.function?.arguments ?? {};
        return {
          id: `call_agy_${Date.now()}_${idx}`,
          type: 'function',
          function: {
            name: fnName,
            arguments: typeof fnArgs === 'string' ? fnArgs : JSON.stringify(fnArgs),
          },
        };
      });

    return {
      id: `chatcmpl_agy_${agyResult?.conversation_id || Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content || (formattedToolCalls.length > 0 ? null : 'Done.'),
            ...(formattedToolCalls.length > 0 ? { tool_calls: formattedToolCalls } : {}),
          },
          finish_reason: formattedToolCalls.length > 0 ? 'tool_calls' : 'stop',
        },
      ],
      usage: agyResult?.usage || {},
    };
  } finally {
    for (const f of tempImageFiles) {
      try {
        fs.unlinkSync(f);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

/**
 * Express / webpack-dev-server middleware registration helper.
 */
function setupAntigravityBridgeRoutes(app) {
  app.use('/api/antigravity/v1', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    next();
  });

  app.get('/api/antigravity/v1/models', async (_req, res) => {
    try {
      const models = await listAgyModels();
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          object: 'list',
          data: models.map((id) => ({ id, object: 'model', owned_by: 'antigravity' })),
        })
      );
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: err.message || String(err) } }));
    }
  });

  const handleSkillsRequest = (_req, res) => {
    try {
      const { getDiscoveredSkills } = require('./sync-skills');
      const skills = getDiscoveredSkills();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(skills));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: err.message || String(err) } }));
    }
  };

  app.get('/api/skills', handleSkillsRequest);
  app.get('/api/antigravity/v1/skills', handleSkillsRequest);

  app.post('/api/antigravity/v1/chat/completions', (req, res) => {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(rawBody || '{}');
        const responsePayload = await runAgyChatCompletion(parsed);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(responsePayload));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: {
              message: `Antigravity Bridge Error: ${err.message || String(err)}`,
            },
          })
        );
      }
    });
  });
}

/**
 * Starts a standalone HTTP server for the Antigravity Bridge (default port 8787).
 */
function startStandaloneBridgeServer(port = Number(process.env.AGY_BRIDGE_PORT) || 8787) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const urlPath = (req.url || '').split('?')[0];

    if (req.method === 'GET' && (urlPath === '/v1/models' || urlPath === '/api/antigravity/v1/models' || urlPath === '/models')) {
      try {
        const models = await listAgyModels();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            object: 'list',
            data: models.map((id) => ({ id, object: 'model', owned_by: 'antigravity' })),
          })
        );
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message || String(err) } }));
      }
      return;
    }

    if (
      req.method === 'GET' &&
      (urlPath === '/v1/skills' || urlPath === '/api/antigravity/v1/skills' || urlPath === '/api/skills' || urlPath === '/skills')
    ) {
      try {
        const { getDiscoveredSkills } = require('./sync-skills');
        const skills = getDiscoveredSkills();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(skills));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message || String(err) } }));
      }
      return;
    }

    if (
      req.method === 'POST' &&
      (urlPath === '/v1/chat/completions' || urlPath === '/api/antigravity/v1/chat/completions' || urlPath === '/chat/completions')
    ) {
      let rawBody = '';
      req.on('data', (chunk) => {
        rawBody += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(rawBody || '{}');
          const result = await runAgyChatCompletion(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: {
                message: `Antigravity Bridge Error: ${err.message || String(err)}`,
              },
            })
          );
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `Not found: ${req.method} ${urlPath}` } }));
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[Antigravity Bridge] OpenAI-compatible server listening on http://localhost:${port}/v1`);
    console.log(`[Antigravity Bridge] Using agy binary: ${resolveAgyBinary()}`);
  });

  return server;
}

if (require.main === module) {
  startStandaloneBridgeServer();
}

module.exports = {
  DEFAULT_AGY_MODELS,
  resolveAgyBinary,
  normalizeAgyModel,
  listAgyModels,
  runAgyChatCompletion,
  setupAntigravityBridgeRoutes,
  startStandaloneBridgeServer,
};

