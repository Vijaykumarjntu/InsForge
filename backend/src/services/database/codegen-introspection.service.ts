import { Client } from 'pg';

export interface RawColumnMetadata {
  schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: boolean;
  column_default: string | null;
  is_identity: boolean;
  is_generated: boolean;
}

export interface RawRelationshipMetadata {
  table_name: string;
  foreign_key_name: string;
  column_name: string;
  referenced_table: string;
  referenced_column: string;
}

export interface RawEnumMetadata {
  enum_name: string;
  enum_value: string;
}

export interface RawRpcMetadata {
  function_name: string;
  argument_names: string[] | null;
  argument_types: string[] | null;
  return_type: string;
  is_set_returning: boolean;
}

export class CodegenIntrospectionService {
  private client: Client;

  constructor(connectionUrl: string) {
    this.client = new Client({ connectionString: connectionUrl });
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.end();
  }

  async getEnums(schemas: string[]): Promise<RawEnumMetadata[]> {
    const query = `
      SELECT t.typname as enum_name, e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = ANY($1)
      ORDER BY t.typname, e.enumsortorder;
    `;
    const res = await this.client.query(query, [schemas]);
    return res.rows;
  }

  async getColumns(schemas: string[]): Promise<RawColumnMetadata[]> {
    const query = `
      SELECT 
        table_schema as schema,
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable = 'YES' as is_nullable,
        column_default,
        is_identity = 'YES' as is_identity,
        generation_expression IS NOT NULL as is_generated
      FROM information_schema.columns
      WHERE table_schema = ANY($1)
      ORDER BY table_name, ordinal_position;
    `;
    const res = await this.client.query(query, [schemas]);
    return res.rows;
  }

  async getRelationships(schemas: string[]): Promise<RawRelationshipMetadata[]> {
    const query = `
      SELECT
        kcu.table_name,
        tc.constraint_name as foreign_key_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = ANY($1);
    `;
    const res = await this.client.query(query, [schemas]);
    return res.rows;
  }

  async getRpcs(schemas: string[]): Promise<RawRpcMetadata[]> {
    const query = `
      SELECT 
        p.proname as function_name,
        proargnames as argument_names,
        oidvectortypes(p.proargtypes) as argument_types,
        pg_catalog.format_type(p.prorettype, NULL) as return_type,
        p.proretset as is_set_returning
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = ANY($1);
    `;
    const res = await this.client.query(query, [schemas]);
    return res.rows;
  }
}