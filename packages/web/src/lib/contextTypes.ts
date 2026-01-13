import { z } from 'zod';

export const TechStackSchema = z
  .object({
    version: z.number(),
    source: z.literal('auto'),
    detectedAt: z.string(),
    frameworks: z.array(
      z.object({
        name: z.string(),
        version: z.string().optional(),
        usage: z.string().optional(),
      })
    ),
    dependencies: z
      .array(
        z.object({
          name: z.string(),
          version: z.string().optional(),
        })
      )
      .optional(),
    buildTools: z.array(z.string()),
    languages: z.array(
      z.object({
        name: z.string(),
        percentage: z.number().optional(),
      })
    ),
    structure: z.object({
      type: z.enum(['monorepo', 'single-package', 'multi-root']),
      packages: z.array(z.string()).optional(),
      entryPoints: z.array(z.string()).optional(),
    }),
    testing: z
      .object({
        frameworks: z.array(z.string()),
        patterns: z.array(z.string()),
      })
      .optional(),
  })
  .passthrough();

export const ConventionsSchema = z
  .object({
    version: z.number(),
    source: z.literal('auto'),
    detectedAt: z.string(),
    naming: z
      .object({
        files: z
          .object({
            components: z.string().optional(),
            utils: z.string().optional(),
            types: z.string().optional(),
          })
          .optional(),
        exports: z
          .object({
            components: z.string().optional(),
            functions: z.string().optional(),
            constants: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    fileOrganization: z
      .object({
        pattern: z.string().optional(),
        description: z.string().optional(),
      })
      .optional(),
    imports: z
      .object({
        style: z.enum(['relative', 'absolute', 'aliases', 'mixed']).optional(),
        aliases: z
          .array(
            z.object({
              alias: z.string(),
              path: z.string(),
            })
          )
          .optional(),
      })
      .optional(),
  })
  .passthrough();

export const StatisticsSchema = z
  .object({
    version: z.number(),
    source: z.literal('auto'),
    detectedAt: z.string(),
    counts: z.object({
      files: z.number(),
      clusters: z.number(),
      features: z.number(),
      edges: z.number(),
    }),
  })
  .passthrough();

export const StructureSchema = z
  .object({
    version: z.number(),
    source: z.literal('auto'),
    detectedAt: z.string(),
    workspace: z.object({
      type: z.enum(['monorepo', 'single-package', 'multi-root']),
      packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun', 'unknown']),
      packages: z.array(z.string()).optional(),
      workspaceGlobs: z.array(z.string()).optional(),
    }),
    subprojects: z.object({
      packageJson: z.array(z.string()),
      goModules: z.array(z.string()),
    }),
  })
  .passthrough();

export const TestingSchema = z
  .object({
    version: z.number(),
    source: z.literal('auto'),
    detectedAt: z.string(),
    frameworks: z.array(
      z.object({
        name: z.string(),
        version: z.string().optional(),
      })
    ),
    testFiles: z.object({
      total: z.number(),
      patterns: z.array(z.string()),
    }),
    coverage: z
      .object({
        reports: z.array(z.string()),
        tools: z.array(z.string()),
      })
      .optional(),
  })
  .passthrough();

export const DecisionsSchema = z
  .object({
    version: z.number(),
    source: z.literal('manual'),
    updatedAt: z.string(),
    decisions: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        rationale: z.string().optional(),
        date: z.string().optional(),
        status: z.enum(['active', 'superseded', 'deprecated']).optional(),
        supersededBy: z.string().optional(),
      })
    ),
  })
  .passthrough();

export const ConstraintsSchema = z
  .object({
    version: z.number(),
    source: z.literal('manual'),
    updatedAt: z.string(),
    constraints: z.array(
      z.object({
        id: z.string(),
        type: z.enum(['technical', 'business', 'compliance', 'performance']),
        title: z.string(),
        description: z.string(),
        impact: z.string().optional(),
      })
    ),
  })
  .passthrough();

export const OverviewSchema = z
  .object({
    version: z.number(),
    source: z.enum(['ai', 'manual']),
    generatedAt: z.string().optional(),
    updatedAt: z.string().optional(),
    summary: z.string(),
    purpose: z.string(),
    architecture: z.string().optional(),
    keyFeatures: z.array(z.string()).optional(),
    targetUsers: z.array(z.string()).optional(),
  })
  .refine((value) => value.generatedAt || value.updatedAt, {
    message: 'generatedAt or updatedAt is required',
    path: ['generatedAt'],
  })
  .passthrough();

export const DesignSystemSchema = z
  .object({
    version: z.number(),
    source: z.literal('manual'),
    updatedAt: z.string(),
    designPrinciples: z.array(z.string()).optional(),
    colors: z.record(z.string(), z.string()).optional(),
    typography: z.record(z.string(), z.string()).optional(),
    components: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export type TechStack = z.infer<typeof TechStackSchema>;
export type Conventions = z.infer<typeof ConventionsSchema>;
export type Statistics = z.infer<typeof StatisticsSchema>;
export type Structure = z.infer<typeof StructureSchema>;
export type Testing = z.infer<typeof TestingSchema>;
export type Decisions = z.infer<typeof DecisionsSchema>;
export type Constraints = z.infer<typeof ConstraintsSchema>;
export type Overview = z.infer<typeof OverviewSchema>;
export type DesignSystem = z.infer<typeof DesignSystemSchema>;

export type ContextStatus = 'present' | 'missing' | 'invalid';

export interface ContextFile<T> {
  status: ContextStatus;
  raw?: string;
  data?: T;
  error?: string;
}

export interface ContextData {
  statistics: ContextFile<Statistics>;
  structure: ContextFile<Structure>;
  testing: ContextFile<Testing>;
  techStack: ContextFile<TechStack>;
  conventions: ContextFile<Conventions>;
  decisions: ContextFile<Decisions>;
  constraints: ContextFile<Constraints>;
  overview: ContextFile<Overview>;
  designSystem: ContextFile<DesignSystem>;
}
