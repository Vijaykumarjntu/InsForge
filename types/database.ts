// Auto-generated using InsForge CLI Gen Types Engine — Deterministic Output

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface Database {
  public: {
    Enums: {
      notification_channel: 'EMAIL' | 'SMS' | 'PUSH';
      notification_status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
    };
    Tables: {
      messaging_logs: {
        Row: {
          body: string;
          channel: string;
          created_at: string | null;
          error_message: string | null;
          id: string;
          provider: string;
          provider_message_id: string | null;
          recipient_address: string;
          recipient_id: string;
          status: string | null;
          subject: string | null;
          updated_at: string | null;
        };
        Insert: {
          body: string;
          channel: string;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          provider: string;
          provider_message_id?: string | null;
          recipient_address: string;
          recipient_id: string;
          status?: string | null;
          subject?: string | null;
          updated_at?: string | null;
        };
        Update: {
          body?: string;
          channel?: string;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          provider?: string;
          provider_message_id?: string | null;
          recipient_address?: string;
          recipient_id?: string;
          status?: string | null;
          subject?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
        ];
      };
    };
    Views: {};
    Functions: {
      armor: {
        Args: {
        };
        Returns: string;
      };
      armor: {
        Args: {
        };
        Returns: string;
      };
      bytea_to_text: {
        Args: {
          data: string;
        };
        Returns: string;
      };
      crypt: {
        Args: {
        };
        Returns: string;
      };
      dearmor: {
        Args: {
        };
        Returns: string;
      };
      decrypt: {
        Args: {
        };
        Returns: string;
      };
      decrypt_iv: {
        Args: {
        };
        Returns: string;
      };
      digest: {
        Args: {
        };
        Returns: string;
      };
      digest: {
        Args: {
        };
        Returns: string;
      };
      encrypt: {
        Args: {
        };
        Returns: string;
      };
      encrypt_iv: {
        Args: {
        };
        Returns: string;
      };
      gen_random_bytes: {
        Args: {
        };
        Returns: string;
      };
      gen_random_uuid: {
        Args: {
        };
        Returns: string;
      };
      gen_salt: {
        Args: {
        };
        Returns: string;
      };
      gen_salt: {
        Args: {
        };
        Returns: string;
      };
      hmac: {
        Args: {
        };
        Returns: string;
      };
      hmac: {
        Args: {
        };
        Returns: string;
      };
      http: {
        Args: {
          request: string;
        };
        Returns: string;
      };
      http_delete: {
        Args: {
          uri: string;
        };
        Returns: string;
      };
      http_delete: {
        Args: {
          uri: string;
          content: string;
          content_type: string;
        };
        Returns: string;
      };
      http_get: {
        Args: {
          uri: string;
        };
        Returns: string;
      };
      http_get: {
        Args: {
          uri: string;
          data: Json;
        };
        Returns: string;
      };
      http_head: {
        Args: {
          uri: string;
        };
        Returns: string;
      };
      http_header: {
        Args: {
          field: string;
          value: string;
        };
        Returns: string;
      };
      http_headers: {
        Args: {
          args: string;
        };
        Returns: string;
      };
      http_list_curlopt: {
        Args: {
        };
        Returns: string[];
      };
      http_patch: {
        Args: {
          uri: string;
          content: string;
          content_type: string;
        };
        Returns: string;
      };
      http_post: {
        Args: {
          uri: string;
          data: Json;
        };
        Returns: string;
      };
      http_post: {
        Args: {
          uri: string;
          content: string;
          content_type: string;
        };
        Returns: string;
      };
      http_put: {
        Args: {
          uri: string;
          content: string;
          content_type: string;
        };
        Returns: string;
      };
      http_reset_curlopt: {
        Args: {
        };
        Returns: string;
      };
      http_set_curlopt: {
        Args: {
          curlopt: string;
          value: string;
        };
        Returns: string;
      };
      pgp_armor_headers: {
        Args: {
          : string;
          key: string;
          value: string;
        };
        Returns: string[];
      };
      pgp_key_id: {
        Args: {
        };
        Returns: string;
      };
      pgp_pub_decrypt: {
        Args: {
        };
        Returns: string;
      };
      pgp_pub_decrypt: {
        Args: {
        };
        Returns: string;
      };
      pgp_pub_decrypt: {
        Args: {
        };
        Returns: string;
      };
      pgp_pub_decrypt_bytea: {
        Args: {
        };
        Returns: string;
      };
      pgp_pub_decrypt_bytea: {
        Args: {
        };
        Returns: string;
      };
      pgp_pub_decrypt_bytea: {
        Args: {
        };
        Returns: string;
      };
      pgp_pub_encrypt: {
        Args: {
        };
        Returns: string;
      };
      pgp_pub_encrypt: {
        Args: {
        };
        Returns: string;
      };
      pgp_pub_encrypt_bytea: {
        Args: {
        };
        Returns: string;
      };
      pgp_pub_encrypt_bytea: {
        Args: {
        };
        Returns: string;
      };
      pgp_sym_decrypt: {
        Args: {
        };
        Returns: string;
      };
      pgp_sym_decrypt: {
        Args: {
        };
        Returns: string;
      };
      pgp_sym_decrypt_bytea: {
        Args: {
        };
        Returns: string;
      };
      pgp_sym_decrypt_bytea: {
        Args: {
        };
        Returns: string;
      };
      pgp_sym_encrypt: {
        Args: {
        };
        Returns: string;
      };
      pgp_sym_encrypt: {
        Args: {
        };
        Returns: string;
      };
      pgp_sym_encrypt_bytea: {
        Args: {
        };
        Returns: string;
      };
      pgp_sym_encrypt_bytea: {
        Args: {
        };
        Returns: string;
      };
      text_to_bytea: {
        Args: {
          data: string;
        };
        Returns: string;
      };
      urlencode: {
        Args: {
          string: string;
        };
        Returns: string;
      };
      urlencode: {
        Args: {
          string: string;
        };
        Returns: string;
      };
      urlencode: {
        Args: {
          data: Json;
        };
        Returns: string;
      };
    };
  };
}
