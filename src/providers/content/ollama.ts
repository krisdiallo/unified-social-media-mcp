// ---------------------------------------------------------------------------
// Content generation provider — Ollama (local LLM)
// ---------------------------------------------------------------------------

import type {
  ContentGenerationProvider,
  GenerateContentRequest,
  GeneratedContent,
} from "../../types.js";

const PLATFORM_GUIDELINES: Record<string, string> = {
  twitter: "Max 280 characters. Punchy, concise. Use hashtags sparingly.",
  bluesky: "Max 300 characters. Conversational tone. Hashtags optional.",
  linkedin: "Professional tone. Can be longer-form (up to 3000 chars). Use relevant hashtags.",
  facebook: "Conversational. Can include emojis. Medium length works best.",
};

export class OllamaContentProvider implements ContentGenerationProvider {
  readonly name = "ollama";

  constructor(
    private baseUrl: string = "http://localhost:11434",
    private model: string = "llama3",
  ) {}

  async generate(request: GenerateContentRequest): Promise<GeneratedContent> {
    const guidelines = PLATFORM_GUIDELINES[request.platform] ?? "";
    const toneDirective = request.tone ? `Tone: ${request.tone}.` : "Tone: professional but approachable.";
    const hashtagDirective = request.hashtags !== false
      ? "Include 2-4 relevant hashtags at the end."
      : "Do not include hashtags.";

    const prompt = [
      "You are a social media content creator.",
      `Platform: ${request.platform}. ${guidelines}`,
      toneDirective,
      hashtagDirective,
      request.maxLength ? `Keep the post under ${request.maxLength} characters.` : "",
      "Return ONLY the post text, nothing else.",
      "",
      request.context
        ? `Write a post about: ${request.topic}\n\nAdditional context: ${request.context}`
        : `Write a post about: ${request.topic}`,
    ].filter(Boolean).join("\n");

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${body}`);
    }

    const json = (await res.json()) as { response: string };
    const text = json.response?.trim() ?? "";
    const hashtags = (text.match(/#\w+/g) ?? []).map((h) => h.slice(1));

    return {
      text,
      hashtags,
      platform: request.platform,
      estimatedCharCount: text.length,
    };
  }
}
