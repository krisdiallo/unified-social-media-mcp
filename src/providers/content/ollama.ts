// ---------------------------------------------------------------------------
// Content generation provider — Ollama (local LLM)
// ---------------------------------------------------------------------------

import type {
  ContentGenerationProvider,
  GenerateContentRequest,
  GeneratedContent,
  RepurposeRequest,
  RepurposedContent,
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

    const text = await this.completion(prompt);
    const hashtags = (text.match(/#\w+/g) ?? []).map((h) => h.slice(1));

    return {
      text,
      hashtags,
      platform: request.platform,
      estimatedCharCount: text.length,
    };
  }

  async repurpose(request: RepurposeRequest): Promise<RepurposedContent[]> {
    const toneDirective = request.tone ? `Tone: ${request.tone}.` : "";
    const platformList = request.targetPlatforms
      .map((p) => `${p}: ${PLATFORM_GUIDELINES[p] ?? ""}`)
      .join("\n");

    const prompt = [
      "You are a social media content repurposing expert.",
      "Given a post originally written for one platform, adapt it for each target platform.",
      "Each adaptation should feel native to that platform, not just copy-pasted.",
      toneDirective,
      "Return a JSON array of objects with fields: platform, text.",
      "Return ONLY the JSON array, no markdown fences or explanation.",
      "",
      `Original platform: ${request.sourcePlatform}`,
      `Original post:\n${request.originalText}`,
      "",
      `Adapt for these platforms:\n${platformList}`,
    ].filter(Boolean).join("\n");

    const raw = await this.completion(prompt);

    let parsed: { platform: string; text: string }[];
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Failed to parse repurposed content from AI response");
      parsed = JSON.parse(jsonMatch[0]);
    }

    return parsed.map((item) => {
      const hashtags = (item.text.match(/#\w+/g) ?? []).map((h: string) => h.slice(1));
      return {
        platform: item.platform as RepurposedContent["platform"],
        text: item.text,
        hashtags,
        estimatedCharCount: item.text.length,
      };
    });
  }

  private async completion(prompt: string): Promise<string> {
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
    return json.response?.trim() ?? "";
  }
}
