// ---------------------------------------------------------------------------
// Template management provider — local in-memory
//
// Stores reusable content templates with variable substitution.
// For production, swap with a database-backed store or integrate with
// tools like Canva, Loomly, or Notion templates.
// ---------------------------------------------------------------------------

import type { TemplateProvider, Template, PlatformName } from "../../types.js";
import crypto from "node:crypto";

export class LocalTemplateProvider implements TemplateProvider {
  readonly name = "local";

  private templates = new Map<string, Template>();

  async createTemplate(input: Omit<Template, "id" | "createdAt">): Promise<Template> {
    const template: Template = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.templates.set(template.id, template);
    return { ...template };
  }

  async getTemplate(templateId: string): Promise<Template> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);
    return { ...template };
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<Omit<Template, "id" | "createdAt">>,
  ): Promise<Template> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    if (updates.name !== undefined) template.name = updates.name;
    if (updates.description !== undefined) template.description = updates.description;
    if (updates.content !== undefined) template.content = updates.content;
    if (updates.platforms !== undefined) template.platforms = updates.platforms;
    if (updates.variables !== undefined) template.variables = updates.variables;
    if (updates.tags !== undefined) template.tags = updates.tags;

    return { ...template };
  }

  async deleteTemplate(templateId: string): Promise<void> {
    if (!this.templates.has(templateId)) throw new Error(`Template ${templateId} not found`);
    this.templates.delete(templateId);
  }

  async listTemplates(filters?: { platform?: PlatformName; tags?: string[] }): Promise<Template[]> {
    let templates = [...this.templates.values()];
    if (filters?.platform) {
      templates = templates.filter((t) => t.platforms.includes(filters.platform!));
    }
    if (filters?.tags?.length) {
      templates = templates.filter((t) =>
        filters.tags!.some((tag) => t.tags?.includes(tag)),
      );
    }
    return templates;
  }

  async renderTemplate(templateId: string, variables: Record<string, string>): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    let rendered = template.content;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replaceAll(`{{${key}}}`, value);
    }

    // Warn about unresolved variables
    const unresolved = rendered.match(/\{\{(\w+)\}\}/g);
    if (unresolved) {
      throw new Error(`Unresolved template variables: ${unresolved.join(", ")}`);
    }

    return rendered;
  }
}
