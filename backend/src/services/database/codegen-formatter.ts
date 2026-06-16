import { RawColumnMetadata, RawRelationshipMetadata, RawEnumMetadata, RawRpcMetadata } from './codegen-introspection.service';

export class CodegenFormatter {
  private mapPgTypeToTs(udtName: string): string {
    const cleanName = udtName.startsWith('_') ? udtName.substring(1) : udtName;
    let tsType = 'unknown';

    switch (cleanName) {
      case 'int2':
      case 'int4':
      case 'numeric':
      case 'real':
      case 'float4':
      case 'float8':
      case 'double precision':
        tsType = 'number';
        break;
      case 'int8':
        tsType = 'number; // Note: Bigint mapping caution';
        break;
      case 'text':
      case 'varchar':
      case 'bpchar':
      case 'uuid':
      case 'timestamp':
      case 'timestamptz':
      case 'date':
      case 'time':
      case 'timetz':
        tsType = 'string';
        break;
      case 'bool':
        tsType = 'boolean';
        break;
      case 'json':
      case 'jsonb':
        tsType = 'Json';
        break;
      default:
        tsType = 'string'; // Default fallback for custom enums
    }

    if (udtName.startsWith('_')) {
      tsType = `${tsType}[]`;
    }
    return tsType;
  }

  generateTypeScript(
    schemas: string[],
    enums: RawEnumMetadata[],
    columns: RawColumnMetadata[],
    relations: RawRelationshipMetadata[],
    rpcs: RawRpcMetadata[]
  ): string {
    let output = `// Auto-generated using InsForge CLI Gen Types Engine — Deterministic Output\n\n`;
    output += `export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];\n\n`;
    output += `export interface Database {\n`;

    // Alphabetize schemas list
    const sortedSchemas = [...schemas].sort();

    for (const schema of sortedSchemas) {
      output += `  ${schema}: {\n`;
      
      // Handle Enums under Schema Layer
      output += `    Enums: {\n`;
      const schemaEnums = enums.reduce((acc, curr) => {
        if (!acc[curr.enum_name]) acc[curr.enum_name] = [];
        acc[curr.enum_name].push(`'${curr.enum_value}'`);
        return acc;
      }, {} as Record<string, string[]>);

      Object.keys(schemaEnums).sort().forEach(enumName => {
        output += `      ${enumName}: ${schemaEnums[enumName].join(' | ')};\n`;
      });
      output += `    };\n`;

      // Handle Tables Data Layer
      output += `    Tables: {\n`;
      const schemaColumns = columns.filter(c => c.schema === schema);
      const uniqueTableNames = Array.from(new Set(schemaColumns.map(c => c.table_name))).sort();

      for (const tableName of uniqueTableNames) {
        output += `      ${tableName}: {\n`;
        const tableCols = schemaColumns.filter(c => c.table_name === tableName).sort((a, b) => a.column_name.localeCompare(b.column_name));
        
        // 1. Row Definitions
        output += `        Row: {\n`;
        tableCols.forEach(col => {
          const typeStr = this.mapPgTypeToTs(col.udt_name);
          output += `          ${col.column_name}: ${typeStr}${col.is_nullable ? ' | null' : ''};\n`;
        });
        output += `        };\n`;

        // 2. Insert Definitions
        output += `        Insert: {\n`;
        tableCols.forEach(col => {
          const isOptional = col.is_nullable || col.column_default !== null || col.is_identity || col.is_generated;
          const typeStr = this.mapPgTypeToTs(col.udt_name);
          output += `          ${col.column_name}${isOptional ? '?' : ''}: ${typeStr}${col.is_nullable ? ' | null' : ''};\n`;
        });
        output += `        };\n`;

        // 3. Update Definitions
        output += `        Update: {\n`;
        tableCols.forEach(col => {
          const typeStr = this.mapPgTypeToTs(col.udt_name);
          output += `          ${col.column_name}?: ${typeStr}${col.is_nullable ? ' | null' : ''};\n`;
        });
        output += `        };\n`;

        // 4. FK Relationship Array Mappings (Matching Supabase's Schema structure exactly)
        output += `        Relationships: [\n`;
        const tableRels = relations.filter(r => r.table_name === tableName).sort((a, b) => a.foreign_key_name.localeCompare(b.foreign_key_name));
        tableRels.forEach(rel => {
          output += `          {\n`;
          output += `            foreignKeyName: "${rel.foreign_key_name}";\n`;
          output += `            columns: ["${rel.column_name}"];\n`;
          output += `            referencedRelation: "${rel.referenced_table}";\n`;
          output += `            referencedColumns: ["${rel.referenced_column}"];\n`;
          output += `          },\n`;
        });
        output += `        ];\n`;

        output += `      };\n`;
      }
      output += `    };\n`; // End Tables

      // Handle Views Placeholder (Can be naturally expanded following the Table design layout pattern)
      output += `    Views: {};\n`;

      // Handle Functions/RPC Blocks
      output += `    Functions: {\n`;
      const sortedRpcs = [...rpcs].sort((a, b) => a.function_name.localeCompare(b.function_name));
      sortedRpcs.forEach(rpc => {
        output += `      ${rpc.function_name}: {\n`;
        output += `        Args: {\n`;
        if (rpc.argument_names && rpc.argument_types) {
          // Look at arguments catalog items array cleanly
          const typesArr = rpc.argument_types.split(', ');
        //   rpc.argument_names.forEach((argName, index) => {
        //     output += `          ${argName}: ${this.mapPgTypeToTs(typesArr[index].trim())};\n`;
        //   });
          rpc.argument_names.forEach((argName, index) => {
            const rawType = typesArr[index] ? typesArr[index].trim() : 'any';
            output += `          ${argName}: ${this.mapPgTypeToTs(rawType)};\n`;
          });
        }
        output += `        };\n`;
        output += `        Returns: ${this.mapPgTypeToTs(rpc.return_type)}${rpc.is_set_returning ? '[]' : ''};\n`;
        output += `      };\n`;
      });
      output += `    };\n`; // End Functions

      output += `  };\n`; // End Schema
    }

    output += `}\n`; // End Database Interface
    return output;
  }
}