import { NextRequest, NextResponse } from 'next/server';
import { queryProxy } from '@/lib/pg-proxy';

// POST /api/invoice-audit-log/resolve
// Body: { items: Array<{ field: string; value: string }> }
// Returns: { map: Record<string, string> }  (value -> resolved name)

function isBubbleUid(val: string): boolean {
  return /^\d+x\d+$/.test(val.trim());
}

function isCustomerId(val: string): boolean {
  return /^cust_/i.test(val.trim());
}

function isNumericId(val: string): boolean {
  return /^\d+$/.test(val.trim());
}

function getTableHint(field: string): 'customer' | 'agent' | 'package' | 'seda' | 'user' | null {
  const f = field.toLowerCase();
  if (f.includes('customer')) return 'customer';
  if (f.includes('agent') || f === 'created_by' || f === 'linked_by') return 'agent';
  if (f.includes('package')) return 'package';
  if (f.includes('seda')) return 'seda';
  if (f.includes('user')) return 'user';
  if (f === 'actor_user_id') return 'user';
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { items: Array<{ field: string; value: string }> };
    const items: Array<{ field: string; value: string }> = body.items || [];

    if (items.length === 0) {
      return NextResponse.json({ map: {} });
    }

    const resolved: Record<string, string> = {};

    // Group unique values by table hint
    const byTable: Record<string, { values: Set<string>; type: 'bubble_id' | 'customer_id' | 'numeric_id' }> = {
      customer: { values: new Set(), type: 'customer_id' },
      agent:    { values: new Set(), type: 'bubble_id' },
      package:  { values: new Set(), type: 'bubble_id' },
      seda:     { values: new Set(), type: 'bubble_id' },
      user:     { values: new Set(), type: 'bubble_id' },
    };
    const userNumericIds: Set<string> = new Set();
    const fallback: Set<string> = new Set(); // try agent+user for unknown fields

    for (const { field, value } of items) {
      const v = String(value || '').trim();
      if (!v || v === 'null' || v === 'NULL') continue;

      const hint = getTableHint(field);
      const isActorUserId = field.toLowerCase() === 'actor_user_id';

      if (isActorUserId && isNumericId(v)) {
        userNumericIds.add(v);
        continue;
      }

      if (!isBubbleUid(v) && !isCustomerId(v)) continue; // skip non-UIDs

      if (hint) {
        byTable[hint].values.add(v);
      } else if (isBubbleUid(v)) {
        fallback.add(v);
      }
    }

    // Add fallback UIDs to agent + user tables
    for (const v of fallback) {
      byTable.agent.values.add(v);
      byTable.user.values.add(v);
    }

    // Query each table
    const queries: Promise<void>[] = [];

    const queryTable = async (
      table: string,
      idCol: string,
      nameCol: string,
      values: Set<string>
    ) => {
      if (values.size === 0) return;
      const arr = Array.from(values);
      const placeholders = arr.map((_, i) => `$${i + 1}`).join(', ');
      try {
        const result = await queryProxy(
          `SELECT ${idCol} AS uid, ${nameCol} AS name FROM ${table} WHERE ${idCol} = ANY(ARRAY[${placeholders}]) AND ${nameCol} IS NOT NULL`,
          arr
        );
        for (const row of result.rows as { uid: string; name: string }[]) {
          if (row.uid && row.name) resolved[row.uid] = row.name;
        }
      } catch {
        // silently skip failed lookups
      }
    };

    queries.push(queryTable('customer',          'customer_id', 'name',         byTable.customer.values));
    queries.push(queryTable('agent',             'bubble_id',   'name',         byTable.agent.values));
    queries.push(queryTable('"user"',            'bubble_id',   'name',         byTable.user.values));
    queries.push(queryTable('package',           'bubble_id',   'package_name', byTable.package.values));
    queries.push(queryTable('seda_registration', 'bubble_id',   'slug',         byTable.seda.values));

    // Resolve numeric actor_user_id values against users.id
    if (userNumericIds.size > 0) {
      queries.push(
        (async () => {
          const arr = Array.from(userNumericIds);
          const placeholders = arr.map((_, i) => `$${i + 1}`).join(', ');
          try {
            const result = await queryProxy(
              `SELECT id::text AS uid, name FROM "user" WHERE id = ANY(ARRAY[${placeholders}]) AND name IS NOT NULL`,
              arr.map(v => parseInt(v, 10))
            );
            for (const row of result.rows as { uid: string; name: string }[]) {
              if (row.uid && row.name) resolved[row.uid] = row.name;
            }
          } catch {
            // silently skip failed lookups
          }
        })()
      );
    }

    await Promise.all(queries);

    return NextResponse.json({ map: resolved });
  } catch (error) {
    console.error('Resolve UIDs error:', error);
    return NextResponse.json({ map: {} });
  }
}
