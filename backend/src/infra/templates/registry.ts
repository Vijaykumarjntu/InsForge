import { TemplateBlueprint } from './types';

export const TEMPLATE_REGISTRY: Record<string, TemplateBlueprint> = {
  'saas-starter': {
    id: 'saas-starter',
    name: 'SaaS Multi-Tenant Starter Kit',
    description: 'Boilerplate layout initializing user billing profiles, subscription product tiers, and private document buckets.',
    
    schemaSql: `
      -- Create a modern profiles linkage schema 
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
        full_name TEXT,
        billing_tier TEXT DEFAULT 'free',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Turn on Row Level Security
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

      -- Inject clean, reliable RLS testing guidelines
      CREATE POLICY "Users can view own profile matching token context" 
        ON public.profiles FOR SELECT 
        USING (auth.uid() = id);
    `,

    seedSql: `
      -- Seed reference tables or baseline subscription variables if necessary
      COMMENT ON TABLE public.profiles IS 'Managed by SaaS Starter Template';
    `,

    storageBuckets: [
      {
        id: 'user-invoices',
        public: false,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['application/pdf', 'image/png']
      }
    ],

    functions: [
      {
        name: 'stripe-webhook',
        runtime: 'deno',
        codeStub: `// Deno Edge Function: Process SaaS Tier Mutations\nDeno.serve(async (req) => {\n  return new Response("Webhook Stream Live", { status: 200 });\n});`
      }
    ],

    clientExample: {
      filename: 'InsForgeSaaSContext.ts',
      language: 'typescript',
      code: `import { createClient } from '@insforge/sdk';\n\nexport const initSaaSWorkspace = async () => {\n  const forge = createClient();\n  const { data } = await forge.from('profiles').select('*');\n  return data;\n};`
    },

    cleanupSql: `
      DROP POLICY IF EXISTS "Users can view own profile matching token context" ON public.profiles;
      DROP TABLE IF EXISTS public.profiles CASCADE;
    `
  }
};