export interface TechStackInfo {
  frameworks: Array<{ name: string; version?: string; usage?: string }>;
  buildTools: string[];
  languages: Array<{ name: string; percentage?: number }>;
  structure: {
    type: 'monorepo' | 'single-package' | 'multi-root';
    packages?: string[];
  };
  testing?: {
    frameworks: string[];
  };
}

export interface ConventionsInfo {
  naming?: {
    files?: Record<string, string>;
    exports?: Record<string, string>;
  };
  fileOrganization?: {
    pattern?: string;
    description?: string;
  };
  imports?: {
    style?: string;
    aliases?: Array<{ alias: string; path: string }>;
  };
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  rationale?: string;
  status?: string;
}

export interface Constraint {
  id: string;
  type: string;
  title: string;
  description: string;
  impact?: string;
}

export interface Overview {
  summary: string;
  purpose: string;
  architecture?: string;
  keyFeatures?: string[];
}
