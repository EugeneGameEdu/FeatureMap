import yaml from 'js-yaml';
import { z } from 'zod';

export function parseYamlWithSchema<T>(text: string, schema: z.ZodType<T>, label: string): T {
  const parsed = yaml.load(text, { schema: yaml.JSON_SCHEMA });
  const result = schema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid ${label}: ${issues}`);
  }

  return result.data;
}
