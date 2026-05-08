import { NextRequest, NextResponse } from 'next/server';
import { queryProxy } from '@/lib/pg-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const logId = parseInt(id, 10);
    
    if (isNaN(logId)) {
      return NextResponse.json(
        { error: 'Invalid log ID' },
        { status: 400 }
      );
    }
    
    const sql = `
      SELECT
        id,
        invoice_id,
        invoice_number,
        entity_type,
        entity_id,
        action_type,
        changes,
        row_old,
        row_new,
        actor_user_id,
        actor_name,
        actor_phone,
        actor_role,
        source_app,
        db_user,
        application_name,
        client_addr,
        txid,
        edited_at
      FROM invoice_audit_log
      WHERE id = $1
      LIMIT 1
    `;
    
    const result = await queryProxy(sql, [logId]);
    const log = result.rows[0];
    
    if (!log) {
      return NextResponse.json(
        { error: 'Log not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ log });
    
  } catch (error) {
    console.error('Error fetching audit log detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log detail', details: String(error) },
      { status: 500 }
    );
  }
}
