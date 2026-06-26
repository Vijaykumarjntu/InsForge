export interface TemplateResourceSummary {
  tables: string[];
  buckets: string[];
  functions: string[];
  policies: string[];
}

export interface TemplateBlueprint {
  id: string;
  name: string;
  description: string;
  
  // 1. Structural DB migrations & seed mutations
  schemaSql: string;
  seedSql?: string;
  
  // 2. Storage layouts to provision metadata
  storageBuckets: {
    id: string;
    public: boolean;
    fileSizeLimit?: number;
    allowedMimeTypes?: string[];
  }[];

  // 3. Edge/Deno functions strings or configurations
  functions: {
    name: string;
    runtime: 'deno';
    codeStub: string;
  }[];

  // 4. Client Starter boilerplate guidelines
  clientExample: {
    filename: string;
    language: 'typescript' | 'javascript';
    code: string;
  };

  // 5. Explicit automated cleanup definitions
  cleanupSql: string;
}