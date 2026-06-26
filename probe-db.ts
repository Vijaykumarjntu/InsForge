  import pg from 'pg';

  async function runProbe() {
    console.log('📡 Scanning active database container cluster layout...');
    
    // const client = new pg.Client({
    //   connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
    //   const client = new Client({
    //     connectionString: 'postgresql://postgres:postgres@localhost:5432/insforge'
    //   });
    // });

    const client = new Client({
        connectionString: 'postgresql://postgres:postgres@localhost:5432/insforge'
      });
    try {
      await client.connect();
      
      const res = await client.query(`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name;
      `);

      console.log('\n📋 REAL DATABASE TABLES ACTIVE RIGHT NOW:\n');
      if (res.rows.length === 0) {
        console.log('⚠️  The database is completely empty! No custom tables or schemas exist.');
      } else {
        console.table(res.rows);
      }

    } catch (err: any) {
      console.error('💥 Database Connection Error:', err.message);
    } finally {
      await client.end();
    }
  }

  runProbe();