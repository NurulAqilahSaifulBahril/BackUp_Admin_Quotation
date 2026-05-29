const { Client } = require('pg');
const http = require('https');
const fs = require('fs');

const token = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3Nzk3Nzg2NjUsImV4cCI6MTc4MDEzODY3NiwiZGJfbmFtZSI6InByb2RfbWFpbiIsImFjY2VzcyI6InJlYWRfb25seSIsInByb3h5X3VybCI6Imh0dHBzOi8vcGctcHJveHktcHJvZHVjdGlvbi51cC5yYWlsd2F5LmFwcC8iLCJhcGlfZG9jc191cmwiOiJodHRwczovL3BnLXByb3h5LXByb2R1Y3Rpb24udXAucmFpbHdheS5hcHAvZG9jcyJ9.94icVRxLECmRaYr2fwzjW69SsCeHMTG5mlvMiG5THbA";
const localConnectionString = "postgres://postgres:postgres@localhost:5432/backup_admin_dev";

// Large log/history/large-payload tables to limit to avoid network timeouts
const HUGE_TABLE_LIMITS = {
  'invoice_snapshot': 2000,
  'user_debug': 2000,
  'system_logs': 2000,
  'invoice_audit_log': 5000,
  'customer_history': 2000,
  'customer_snapshot': 2000,
  'received_emails': 0,
  'emails': 0,
  'email_logs': 0,
  'webhooks': 0
};

function runRemoteQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      db_name: "prod_main",
      sql: sql,
      params: params
    });

    const options = {
      hostname: 'pg-proxy-production.up.railway.app',
      port: 443,
      path: '/api/sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (d) => {
        body += d;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) {
            reject(new Error(parsed.error));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error("Failed to parse response: " + body));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

function parsePostgresArray(str) {
  if (!str.startsWith('{') || !str.endsWith('}')) {
    return [];
  }
  const result = [];
  let current = '';
  let inQuotes = false;
  let escaped = false;
  
  for (let i = 1; i < str.length - 1; i++) {
    const char = str[i];
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  // Unescape and strip quotes if any
  return result.map(item => {
    if (item.startsWith('"') && item.endsWith('"')) {
      item = item.slice(1, -1);
    }
    return item.replace(/\\"/g, '"');
  });
}

function convertValueIfRequired(colName, val) {
  const jsonbColumns = ['invoice_bubble_ids', 'changes', 'row_old', 'row_new', 'snapshot_data', 'payload', 'metadata', 'file_meta'];
  if (jsonbColumns.includes(colName) && val !== null && typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
    try {
      JSON.parse(val);
      // Valid JSON, return as is
      return val;
    } catch (e) {
      // Parse pg array and convert to JSON array string
      try {
        const parsed = parsePostgresArray(val);
        return JSON.stringify(parsed);
      } catch (err) {
        return val;
      }
    }
  }
  return val;
}

async function main() {
  const localClient = new Client({ connectionString: localConnectionString });
  
  try {
    console.log("Connecting to local PostgreSQL...");
    await localClient.connect();
    console.log("Connected to local database.");

    // Clean up local public schema to avoid already-existing relation errors
    console.log("Recreating clean public schema locally...");
    await localClient.query("DROP SCHEMA IF EXISTS public CASCADE");
    await localClient.query("CREATE SCHEMA public");
    await localClient.query("GRANT ALL ON SCHEMA public TO postgres");
    await localClient.query("GRANT ALL ON SCHEMA public TO public");
    console.log("Clean public schema created.");

    // 1. Read and run schema DDL
    const ddlPath = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\804902bd-3939-481a-bb46-0b554424b8d2\\scratch\\schema.sql';
    console.log(`Loading DDL schema from ${ddlPath}...`);
    const ddl = fs.readFileSync(ddlPath, 'utf8');
    
    // Execute DDL locally
    console.log("Creating tables and indexes locally...");
    await localClient.query(ddl);
    console.log("Schema created successfully.");

    // 2. Fetch list of tables from remote
    console.log("Fetching tables from remote database...");
    const tablesRes = await runRemoteQuery("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables to copy.`);

    // Disable triggers and foreign keys locally during copy
    await localClient.query("SET session_replication_role = 'replica'");

    for (const tableName of tables) {
      console.log(`\n----------------------------------------`);
      console.log(`Processing table: ${tableName}`);

      // Get columns
      const colRes = await runRemoteQuery(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      const columns = colRes.rows.map(r => r.column_name);
      const jsonbColumns = colRes.rows
        .filter(r => r.data_type && r.data_type.toLowerCase().includes('json'))
        .map(r => r.column_name);
      console.log(`Columns: ${columns.join(', ')}`);
      if (jsonbColumns.length > 0) {
        console.log(`JSON/JSONB Columns: ${jsonbColumns.join(', ')}`);
      }

      // Get row count
      const countRes = await runRemoteQuery(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const totalRows = parseInt(countRes.rows[0].count, 10);
      console.log(`Total rows in remote: ${totalRows}`);

      if (totalRows === 0) {
        console.log(`Table ${tableName} is empty. Skipping.`);
        continue;
      }

      // Check if it's a huge table that we should limit
      let limit = null;
      let isHuge = false;
      if (HUGE_TABLE_LIMITS[tableName] !== undefined) {
        limit = HUGE_TABLE_LIMITS[tableName];
        if (limit === 0) {
          console.log(`Skipping table ${tableName} entirely (limit set to 0).`);
          continue;
        }
        isHuge = true;
        console.log(`Capping table ${tableName} to latest ${limit} rows for speed.`);
      }

      // Clear local table first to ensure a fresh copy
      await localClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);

      // Determine sorting key (typically 'id' or first column)
      let sortKey = columns.includes('id') ? 'id' : (columns.includes('created_at') ? 'created_at' : columns[0]);
      
      let rowsFetched = 0;
      const MAX_PARAMS = 30000;
      let chunkSize = Math.min(1000, Math.floor(MAX_PARAMS / columns.length));
      if (chunkSize < 1) chunkSize = 1;
      console.log(`Using chunk size: ${chunkSize} (cols: ${columns.length})`);

      while (rowsFetched < (limit || totalRows)) {
        const currentChunkSize = Math.min(chunkSize, (limit || totalRows) - rowsFetched);
        
        let remoteSql = `SELECT ${columns.map(c => `"${c}"`).join(', ')} FROM "${tableName}"`;
        if (isHuge) {
          remoteSql += ` ORDER BY "${sortKey}" DESC`;
        } else {
          remoteSql += ` ORDER BY "${sortKey}" ASC`;
        }
        remoteSql += ` LIMIT ${currentChunkSize} OFFSET ${rowsFetched}`;

        console.log(`Fetching chunk ${rowsFetched} to ${rowsFetched + currentChunkSize}...`);
        const dataRes = await runRemoteQuery(remoteSql);
        const rows = dataRes.rows;

        if (rows.length === 0) {
          break;
        }

        // Perform batch insert locally
        const values = [];
        const placeholders = [];
        let paramIdx = 1;

        rows.forEach(row => {
          const rowPlaceholders = [];
          columns.forEach(col => {
            let val = row[col];
            
            // Format for local DB columns
            if (jsonbColumns.includes(col)) {
              if (val !== null) {
                if (typeof val === 'object') {
                  val = JSON.stringify(val);
                } else if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
                  try {
                    const parsed = parsePostgresArray(val);
                    val = JSON.stringify(parsed);
                  } catch (e) {}
                }
              }
            } else {
              // Standard object formatting
              if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
                val = JSON.stringify(val);
              }
            }

            values.push(val);
            rowPlaceholders.push(`$${paramIdx++}`);
          });
          placeholders.push(`(${rowPlaceholders.join(', ')})`);
        });

        const insertSql = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${placeholders.join(', ')}`;
        await localClient.query(insertSql, values);

        rowsFetched += rows.length;
      }
      console.log(`Copied ${rowsFetched} rows to local table "${tableName}".`);

      // Reset sequence if table has serial 'id' column
      if (columns.includes('id')) {
        try {
          const seqNameRes = await localClient.query(`SELECT pg_get_serial_sequence($1, 'id') as seq`, [tableName]);
          const seqName = seqNameRes.rows[0].seq;
          if (seqName) {
            await localClient.query(`SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${tableName}"), 1))`, [seqName]);
            console.log(`Reset sequence for ${tableName}.`);
          }
        } catch (seqErr) {
          console.warn(`Could not reset sequence for ${tableName}: ${seqErr.message}`);
        }
      }
    }

    // Enable triggers and foreign keys locally again
    await localClient.query("SET session_replication_role = 'origin'");

    // 3. Insert local dev user nurul@eternalgy.me
    console.log("\nInserting local dev user nurul@eternalgy.me...");
    
    // Insert into agent first if not exists
    const agentCheck = await localClient.query(`SELECT * FROM agent WHERE bubble_id = 'agent_51cc7b922d7c1867'`);
    if (agentCheck.rows.length === 0) {
      await localClient.query(`
        INSERT INTO agent (bubble_id, name, email, contact, agent_type, created_at, updated_at)
        VALUES ('agent_51cc7b922d7c1867', 'NURUL AQILAH BINTI SYARIFUL BHRIL @ SAIFUL BAHRIL', 'nurul@eternalgy.me', '0199849166', 'agent', NOW(), NOW())
      `);
      console.log("Created agent record for Nurul.");
    }

    // Insert into user for both .me and .com to be safe
    const emailsToCreate = ['nurul@eternalgy.me', 'nurul@eternalgy.com'];
    for (const email of emailsToCreate) {
      const userCheck = await localClient.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
      const bubbleId = email.endsWith('.me') ? 'user_nurul_mock_me' : 'user_nurul_mock_com';
      if (userCheck.rows.length > 0) {
        // Update existing user
        await localClient.query(`
          UPDATE "user" SET 
            access_level = ARRAY['admin', 'finance', 'seda', 'inventory', 'sales', 'superadmin', 'ceo', 'invoiceapprove', 'invoice editor', 'project', 'special', 'hr', 'ec'],
            linked_agent_profile = 'agent_51cc7b922d7c1867',
            bubble_id = $1,
            name = 'NURUL AQILAH BINTI SYARIFUL BHRIL @ SAIFUL BAHRIL'
          WHERE id = $2
        `, [bubbleId, userCheck.rows[0].id]);
        console.log(`Updated existing user record for ${email} with full admin access.`);
      } else {
        // Find next ID
        const maxIdRes = await localClient.query(`SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM "user"`);
        const nextId = maxIdRes.rows[0].next_id;
        // Insert new user
        await localClient.query(`
          INSERT INTO "user" (
            id, bubble_id, name, email, linked_agent_profile, access_level, user_signed_up, created_at, updated_at
          ) VALUES (
            $1, $2, 'NURUL AQILAH BINTI SYARIFUL BHRIL @ SAIFUL BAHRIL', $3, 'agent_51cc7b922d7c1867',
            ARRAY['admin', 'finance', 'seda', 'inventory', 'sales', 'superadmin', 'ceo', 'invoiceapprove', 'invoice editor', 'project', 'special', 'hr', 'ec'],
            true, NOW(), NOW()
          )
        `, [nextId, bubbleId, email]);
        console.log(`Created new user record for ${email} (ID: ${nextId}) with full admin access.`);
      }
    }

    console.log("\n==========================================");
    console.log("DATABASE COPY AND RESTORE COMPLETED SUCCESSFULLY!");
    console.log("==========================================");

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await localClient.end();
  }
}

main();
