// ---------------------------------------------------------------------------
// Content generation provider — OpenAI-compatible API
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

export class OpenAIContentProvider implements ContentGenerationProvider {
  readonly name = "openai";

  constructor(
    private apiKey: string,
    private model: string = "gpt-4o-mini",
  ) {}

  async generate(request: GenerateContentRequest): Promise<GeneratedContent> {
    const guidelines = PLATFORM_GUIDELINES[request.platform] ?? "";
    const toneDirective = request.tone ? `Tone: ${request.tone}.` : "Tone: professional but approachable.";
    const hashtagDirective = request.hashtags !== false
      ? "Include 2-4 relevant hashtags at the end."
      : "Do not include hashtags.";

    const systemPrompt = [
      "You are a social media content creator.",
      `Platform: ${request.platform}. ${guidelines}`,
      toneDirective,
      hashtagDirective,
      request.maxLength ? `Keep the post under ${request.maxLength} characters.` : "",
      "Return ONLY the post text, nothing else.",
    ].filter(Boolean).join(" ");

    const userPrompt = request.context
      ? `Write a post about: ${request.topic}\n\nAdditional context: ${request.context}`
      : `Write a post about: ${request.topic}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 512,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };

    const text = json.choices[0]?.message?.content?.trim() ?? "";
    const hashtags = (text.match(/#\w+/g) ?? []).map((h) => h.slice(1));

    return {
      text,
      hashtags,
      platform: request.platform,
      estimatedCharCount: text.length,
    };
  }
}
