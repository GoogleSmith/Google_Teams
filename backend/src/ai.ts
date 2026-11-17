import type { DirectoryUser } from './types.ts';

export class AiServiceError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'AiServiceError';
    this.statusCode = statusCode;
  }
}

function buildSystemPrompt(directory: DirectoryUser[]): string {
  const directoryJson = JSON.stringify(
    directory.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      specialization: u.specialization,
      skills: u.skills,
    })),
    null,
    2
  );

  return `You are an AI project-planning extractor for NovaWorks Technologies.
Convert the provided meeting transcript into structured JSON for projects and tasks.

TEAM DIRECTORY (ONLY valid people in the company):
${directoryJson}

STRICT RULES:
1. Output ONLY valid JSON in the exact shape shown below. Do NOT wrap in markdown code fences and do NOT include any commentary or explanation.
2. Create one project per client engagement, and keep separate client engagements as separate projects. Do NOT merge distinct client projects or distinct tasks across projects.
3. Use ONLY user IDs from the TEAM DIRECTORY above:
   - managerId MUST be a user ID with role "MANAGER".
   - assigneeId MUST be a user ID with role "AGENT".
   - NEVER invent a person or user ID.
   - NEVER treat client contacts, external suppliers (e.g., Kamran), or end users as NovaWorks employees or assign work to them.
4. Follow the FINAL agreed decisions in the meeting:
   - If a project deadline, task deadline, estimated hours, scope, or task owner is revised, corrected, or replaced later in the discussion or in a final recap, use ONLY the final agreed value and ignore the superseded earlier value.
   - Ignore and exclude all rejected or out-of-scope features (such as real payments, payment gateways, inventory/stock integration, live maps, driver tracking, real email sending, ticketing integration, or separate native iOS/Android builds when a single Flutter demo is chosen). Do NOT create tasks for rejected features.
5. Keep separate tasks separated as decided in the meeting (do not merge tasks simply because they share the same owner).
6. estimatedHours must be a positive number representing developer effort hours only (not calendar days and not management hours).
7. Format all dates strictly as YYYY-MM-DD. Infer the year from the meeting date mentioned in the transcript (for example, 2026 if the meeting is in 2026).
8. If any required information (project name, clientName, managerId, project deadline, task title, assigneeId, task deadline, or estimatedHours) is missing, ambiguous, or refers to someone not in the directory, still return valid JSON matching the schema, and set that missing/unresolvable field to null so validation can report it.

EXACT OUTPUT JSON SHAPE:
{
  "projects": [
    {
      "name": "string",
      "clientName": "string",
      "description": "string",
      "managerId": "PM01",
      "deadline": "YYYY-MM-DD",
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "assigneeId": "DEV01",
          "deadline": "YYYY-MM-DD",
          "estimatedHours": 12
        }
      ]
    }
  ]
}`;
}

function extractJsonFromText(content: string): unknown {
  let cleaned = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();

  // Strip accidental markdown code fences
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: locate outermost JSON object braces if extra prose slipped in
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const slice = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(slice);
    }
    throw new Error('Could not find valid JSON object in model output.');
  }
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  signal: AbortSignal
): Promise<Response> {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'NovaWorks Project CRM',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages,
    }),
  });
}

export async function extractProjectsFromTranscript(
  transcript: string,
  directory: DirectoryUser[]
): Promise<unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const configuredModel = process.env.OPENROUTER_MODEL?.trim();
  const model =
    configuredModel && configuredModel !== 'your-chosen-model-id'
      ? configuredModel
      : 'openrouter/free';

  if (!apiKey || apiKey === 'your-openrouter-key-here') {
    throw new AiServiceError(
      'OPENROUTER_API_KEY is not configured. Please add OPENROUTER_API_KEY to your environment/Secrets and restart the server.',
      500
    );
  }

  const systemPrompt = buildSystemPrompt(directory);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    let response = await callOpenRouter(
      apiKey,
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
      controller.signal
    );

    // Some OpenRouter free models reject the system role; retry once merged into user prompt
    if (response.status === 400) {
      const errBody = await response.clone().text().catch(() => '');
      if (/system|developer instruction/i.test(errBody)) {
        response = await callOpenRouter(
          apiKey,
          model,
          [
            {
              role: 'user',
              content: `${systemPrompt}\n\nMEETING TRANSCRIPT:\n${transcript}`,
            },
          ],
          controller.signal
        );
      }
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let providerMessage = '';
      try {
        const parsedErr = JSON.parse(errorText) as { error?: { message?: string } };
        providerMessage = parsedErr.error?.message || '';
      } catch {
        providerMessage = errorText.slice(0, 200);
      }

      if (response.status === 429) {
        throw new AiServiceError(
          'The AI model is currently rate-limited by OpenRouter. Please wait a moment and try again, or switch to another model in OPENROUTER_MODEL.',
          429
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new AiServiceError(
          'OpenRouter rejected the API key. Verify OPENROUTER_API_KEY in your environment.',
          502
        );
      }
      if (response.status === 404) {
        throw new AiServiceError(
          `OpenRouter model "${model}" was not found or is unavailable. Check OPENROUTER_MODEL.`,
          502
        );
      }
      throw new AiServiceError(
        `OpenRouter request failed (${response.status})${providerMessage ? `: ${providerMessage}` : '.'}`,
        502
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      error?: { message?: string };
    };

    if (data.error?.message) {
      throw new AiServiceError(`OpenRouter error: ${data.error.message}`, 502);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new AiServiceError(
        'OpenRouter returned an empty response. Please try again.',
        502
      );
    }

    try {
      return extractJsonFromText(content);
    } catch {
      throw new AiServiceError(
        'AI response could not be parsed as valid JSON. No projects or tasks were saved. Please try again.',
        422
      );
    }
  } catch (err) {
    if (err instanceof AiServiceError) {
      throw err;
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiServiceError(
        'AI request timed out after 30 seconds. Nothing was saved. Please try again.',
        504
      );
    }
    throw new AiServiceError(
      `Failed to contact OpenRouter: ${err instanceof Error ? err.message : 'Unknown network error'}`,
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}
