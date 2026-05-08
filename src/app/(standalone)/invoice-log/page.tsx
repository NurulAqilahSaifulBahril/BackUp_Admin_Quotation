'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuditLog {
  id: number;
  invoice_id: number;
  invoice_number: string;
  entity_type: string;
  entity_id?: string | null;
  action_type: string;
  changes: Array<{ field: string; before: unknown; after: unknown }>;
  actor_user_id?: string | null;
  actor_name: string | null;
  actor_phone: string | null;
  actor_role: string | null;
  source_app?: string | null;
  db_user?: string | null;
  application_name: string | null;
  client_addr?: string | null;
  txid?: string | null;
  edited_at: string;
  row_old?: Record<string, unknown> | null;
  row_new?: Record<string, unknown> | null;
}

interface Change {
  field: string;
  before: unknown;
  after: unknown;
}

interface InvoiceSummary {
  invoice_id: number;
  invoice_number: string;
  total_changes: number;
  latest_change: string;
  customer_name: string | null;
  total_amount: string | null;
  invoice_created_at: string | null;
  percent_paid: string | null;
  first_payment_date: string | null;
  seda_status: string | null;
  seda_modified_date: string | null;
  agent: string | null;
}

interface Pagination {
  page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
  has_more: boolean;
}

// Parse changes from DB (could be JSON string or already parsed array)
function parseChanges(changes: unknown): Change[] {
  if (!changes) return [];
  if (Array.isArray(changes)) return changes as Change[];
  if (typeof changes === 'string') {
    try { return JSON.parse(changes) as Change[]; } catch { return []; }
  }
  return [];
}

// Detect what was actually touched based on changes/entity
function getTouchType(log: AuditLog): { label: string; class: string } {
  const changes = parseChanges(log.changes);
  const fields = changes.map(c => (c.field || '').toLowerCase());
  const entity = (log.entity_type || '').toLowerCase();

  // Viewer activity (page views / session events) — not an edit
  if (entity === 'viewer_activity') {
    return { label: 'View', class: 'view' };
  }

  // Payment-related fields
  if (fields.some(f => f.includes('payment') || f.includes('paid') || f.includes('deposit') || f.includes('amount_paid'))) {
    return { label: 'Payment', class: 'payment' };
  }
  
  // SEDA-related
  if (fields.some(f => f.includes('seda')) || log.invoice_number?.includes('SEDA')) {
    return { label: 'SEDA', class: 'seda' };
  }
  
  // Invoice items / line items
  if (entity === 'invoice_item' || fields.some(f => f.includes('qty') || f.includes('quantity') || f.includes('description') || f.includes('unit_price'))) {
    return { label: 'Item', class: 'item' };
  }
  
  // Status changes
  if (fields.some(f => f.includes('status'))) {
    return { label: 'Status', class: 'status' };
  }
  
  // Customer info
  if (fields.some(f => f.includes('customer') || f.includes('client'))) {
    return { label: 'Customer', class: 'customer' };
  }
  
  // Invoice header fields
  if (entity === 'invoice' || fields.some(f => f.includes('total') || f.includes('date') || f.includes('due') || f.includes('number'))) {
    return { label: 'Invoice', class: 'invoice' };
  }
  
  return { label: log.action_type === 'INSERT' ? 'New' : log.action_type === 'DELETE' ? 'Del' : 'Mod', class: 'update' };
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatChangeValue(
  field: string,
  value: unknown,
  actorName: string | null,
  actorUserId: string | null,
  uidMap: Record<string, string>,
  isAfter = true
): string {
  if (value === null || value === undefined) return 'NULL';

  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length > 50 ? json.slice(0, 47) + '…' : json;
    } catch {
      return String(value);
    }
  }

  const v = String(value);

  // UID resolution for non-special fields
  if (!['device_hash', 'viewer_type'].includes(field) && uidMap[v]) {
    return uidMap[v];
  }

  if (field === 'device_hash' && v.length > 9) {
    return v.slice(0, 6) + '...';
  }

  if (isAfter && field === 'viewer_type' && v === 'logged_in') {
    // Prefer actor_name, then resolve actor_user_id via uidMap, then fallback
    if (actorName) return actorName;
    if (actorUserId && uidMap[actorUserId]) return uidMap[actorUserId];
    return 'Logged in';
  }

  return v.length > 40 ? v.slice(0, 38) + '…' : v;
}

// Icons
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14"/><path d="M12 5v14"/>
  </svg>
);

const MinusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

export default function InvoiceLogPage() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [view, setView] = useState<'list' | 'history'>('list');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceSummary | null>(null);
  const [invoiceHistory, setInvoiceHistory] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Expanded rows for history view
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // UID → name resolution map
  const [uidMap, setUidMap] = useState<Record<string, string>>({});

  const fetchLogs = useCallback(async (page = 1, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('grouped', 'true');
      params.set('page', page.toString());
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/invoice-audit-log?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch invoices');

      const data = await response.json();
      if (append) {
        setInvoices(prev => [...prev, ...data.invoices]);
      } else {
        setInvoices(data.invoices);
      }
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Initial load
  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchLogs]);

  const loadMore = () => {
    if (pagination && pagination.has_more && !loading) {
      fetchLogs(pagination.page + 1, true);
    }
  };

  const openInvoiceHistory = async (inv: InvoiceSummary) => {
    setSelectedInvoice(inv);
    setView('history');
    setHistoryLoading(true);
    setExpandedRows({});
    setUidMap({});
    try {
      const response = await fetch(`/api/invoice-audit-log?invoice_id=${inv.invoice_id}`);
      if (response.ok) {
        const data = await response.json();
        const logs: AuditLog[] = data.logs || [];
        setInvoiceHistory(logs);

        // Collect all UID-like values from changes for resolution
        const items: Array<{ field: string; value: string }> = [];
        for (const log of logs) {
          for (const change of (log.changes || [])) {
            const v = String(change.after ?? '');
            if (v && v !== 'null') items.push({ field: change.field, value: v });
            const vb = String(change.before ?? '');
            if (vb && vb !== 'null') items.push({ field: change.field, value: vb });
          }
          // Also resolve actor_user_id for viewer_type name display
          if (log.actor_user_id && log.actor_user_id !== 'null' && log.actor_user_id !== 'system') {
            items.push({ field: 'actor_user_id', value: log.actor_user_id });
          }
        }
        if (items.length > 0) {
          fetch('/api/invoice-audit-log/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          })
            .then(r => r.json())
            .then(d => setUidMap(d.map || {}))
            .catch(() => {});
        }
      } else {
        setInvoiceHistory([]);
      }
    } catch {
      setInvoiceHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleChange = (logId: number) => {
    setExpandedRows(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  return (
    <div className="invoice-log-app">
      {/* NavBar */}
      <nav className="il-nav">
        <div className="il-nav-brand">
          <div className="il-nav-logo">E</div>
          <div>
            <div className="il-nav-title">ETERNALGY</div>
            <div className="il-nav-subtitle">Invoice Audit Log</div>
          </div>
        </div>
        <div className="il-nav-badge">
          {pagination?.total_count?.toLocaleString() || 0} logs
        </div>
      </nav>

      {/* Main Content */}
      <div className="il-section">
        {/* Header */}
        <div className="il-step-label">AUDIT TRAIL</div>
        <div className="il-heading">Invoice Changes</div>
        <div className="il-subheading">Track all modifications - compact view</div>
        
        {/* Search & Filter */}
        <div className="il-card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: showFilters ? '12px' : '0' }}>
            <div className="il-input-wrap" style={{ flex: 1 }}>
              <SearchIcon />
              <input
                type="text"
                className="il-input"
                placeholder="Search invoice number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              className="il-btn outline" 
              style={{ width: 'auto', padding: '10px 12px' }}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Hide' : 'Filter'}
            </button>
          </div>
          
        </div>

        {/* Error State */}
        {error && (
          <div className="il-card" style={{ background: 'var(--eb)', border: '1px solid var(--ebd)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--et)' }}>
              ⚠ {error}
            </div>
            <button 
              className="il-btn green" 
              style={{ marginTop: '10px' }}
              onClick={() => fetchLogs(1)}
            >
              Try Again
            </button>
          </div>
        )}

        {/* INVOICE LIST VIEW */}
        {view === 'list' && (() => {
          const todayStr = new Date().toDateString();
          const todayInvoices = invoices.filter(inv => new Date(inv.latest_change).toDateString() === todayStr);
          const olderInvoices = invoices.filter(inv => new Date(inv.latest_change).toDateString() !== todayStr);

          const renderCard = (inv: InvoiceSummary) => {
            const daysSinceCreated = inv.invoice_created_at
              ? Math.floor((Date.now() - new Date(inv.invoice_created_at).getTime()) / 86400000)
              : null;
            const daysSince1stPayment = inv.first_payment_date
              ? Math.floor((Date.now() - new Date(inv.first_payment_date).getTime()) / 86400000)
              : null;
            const payPct = inv.percent_paid ? Math.round(parseFloat(inv.percent_paid)) : 0;
            return (
              <div
                key={inv.invoice_id}
                className="il-log-card"
                onClick={() => openInvoiceHistory(inv)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div>
                    <div className="il-log-title" style={{ fontSize: '15px', fontWeight: 700 }}>
                      {inv.customer_name || 'Unknown Customer'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--g400)', marginTop: '2px' }}>
                      {inv.invoice_number}
                      {inv.total_amount && (
                        <span style={{ marginLeft: '8px', color: 'var(--gp)', fontWeight: 600 }}>
                          RM {parseFloat(inv.total_amount).toLocaleString('en-MY', { minimumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRightIcon />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
                  {inv.seda_status && (() => {
                    const isSubmitted = inv.seda_status!.toLowerCase().includes('submit');
                    const sedaDate = isSubmitted && inv.seda_modified_date
                      ? new Date(inv.seda_modified_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' })
                      : null;
                    return (
                      <span className="il-tag seda">
                        <span style={{ fontWeight: 400, opacity: 0.75 }}>SEDA : </span>
                        <strong style={{ fontWeight: 700 }}>{inv.seda_status}</strong>
                        {sedaDate && <span style={{ fontWeight: 400 }}> ({sedaDate})</span>}
                      </span>
                    );
                  })()}
                  <span className={`il-tag ${payPct >= 100 ? 'payment' : payPct > 0 ? 'item' : 'delete'}`}>
                    {payPct}% paid
                  </span>
                  {daysSince1stPayment !== null && (
                    <span className="il-tag gray">
                      <strong style={{ color: 'var(--gp)', fontWeight: 700 }}>{daysSince1stPayment}D</strong>
                      <span style={{ fontWeight: 400 }}> since Deposit</span>
                    </span>
                  )}
                </div>

                <div className="il-log-meta">
                  {daysSinceCreated !== null && <span>{daysSinceCreated}d old</span>}
                  {daysSinceCreated !== null && <span>•</span>}
                  <span>{inv.total_changes} changes</span>
                  <span>•</span>
                  <span>Last: {formatDate(inv.latest_change)}</span>
                  {inv.agent && (
                    <>
                      <span>•</span>
                      <span style={{ color: 'var(--gp)' }}>{inv.agent}</span>
                    </>
                  )}
                </div>
              </div>
            );
          };

          return (
            <>
              {/* TODAY CHANGES */}
              {(todayInvoices.length > 0 || loading) && (
                <div className="il-card" style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="il-step-label" style={{ color: 'var(--gp)' }}>TODAY CHANGES</span>
                    <span style={{ fontSize: '11px', color: 'var(--gp)', fontWeight: 600 }}>
                      {todayInvoices.length} invoices
                    </span>
                  </div>
                  {todayInvoices.map(renderCard)}
                  {loading && todayInvoices.length === 0 && (
                    <>
                      {[1, 2].map((i) => (
                        <div key={i} className="il-log-card" style={{ pointerEvents: 'none' }}>
                          <div className="il-skeleton" style={{ width: '160px', height: '20px', marginBottom: '8px' }} />
                          <div className="il-skeleton" style={{ width: '110px', height: '14px' }} />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* ALL INVOICES */}
              <div className="il-card" style={{ marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="il-step-label">ALL INVOICES</span>
                  <span style={{ fontSize: '11px', color: 'var(--g500)' }}>
                    {pagination?.total_count ?? invoices.length} total
                  </span>
                </div>
                {olderInvoices.map(renderCard)}
                {loading && (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="il-log-card" style={{ pointerEvents: 'none' }}>
                        <div className="il-skeleton" style={{ width: '140px', height: '20px', marginBottom: '8px' }} />
                        <div className="il-skeleton" style={{ width: '100px', height: '14px' }} />
                      </div>
                    ))}
                  </>
                )}
                {!loading && invoices.length === 0 && !error && (
                  <div className="il-empty" style={{ padding: '30px 20px' }}>
                    <div className="il-empty-title">No invoices found</div>
                    <div className="il-empty-text">Try a different search</div>
                  </div>
                )}
              </div>

              {pagination?.has_more && (
                <button
                  className="il-load-more"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              )}
            </>
          );
        })()}

        {/* INVOICE HISTORY VIEW */}
        {view === 'history' && selectedInvoice && (
          <>
            {/* Back button */}
            <button
              className="il-expand"
              style={{ marginTop: '14px' }}
              onClick={() => setView('list')}
            >
              <span className="il-expand-text">← Back to Invoice List</span>
            </button>
            
            <div className="il-card" style={{ marginTop: '14px' }}>
              <div style={{ marginBottom: '12px' }}>
                <div className="il-heading">{selectedInvoice.customer_name || selectedInvoice.invoice_number}</div>
                <div style={{ fontSize: '11px', color: 'var(--g400)', marginBottom: '4px' }}>{selectedInvoice.invoice_number}</div>
                <div className="il-subheading">Change history ({invoiceHistory.length} entries)</div>
              </div>
              
              {historyLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="il-skeleton" style={{ height: '50px', marginBottom: '8px', borderRadius: '10px' }} />
                  ))}
                </>
              ) : (
                invoiceHistory.map((log, idx) => (
                  <div key={log.id} style={{ borderBottom: idx < invoiceHistory.length - 1 ? '1px solid var(--g100)' : 'none' }}>
                    {/* Compact row: [date] | [what updated] (+) */}
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 0',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleChange(log.id)}
                    >
                      <span style={{ 
                        fontSize: '11px', 
                        color: 'var(--g500)',
                        minWidth: '85px',
                        fontFamily: 'monospace'
                      }}>
                        {formatDate(log.edited_at)}
                      </span>
                      
                      {(() => {
                        const touch = getTouchType(log);
                        const isViewerActivity = (log.entity_type || '').toLowerCase() === 'viewer_activity';
                        const eventChange = isViewerActivity
                          ? (log.changes || []).find(c => c.field === 'event_type')
                          : null;
                        const detailText = eventChange
                          ? String(eventChange.after ?? eventChange.before ?? '')
                          : (log.changes || []).map(c => c.field).slice(0, 2).join(', ');
                        const extraCount = eventChange
                          ? 0
                          : (log.changes?.length || 0) > 2 ? (log.changes!.length - 2) : 0;
                        return (
                          <span style={{ flex: 1, fontSize: '12px' }}>
                            <span className={`il-tag ${touch.class}`} style={{ marginRight: '6px' }}>
                              {touch.label}
                            </span>
                            {detailText}
                            {extraCount > 0 && (
                              <span style={{ color: 'var(--g400)' }}> +{extraCount}</span>
                            )}
                          </span>
                        );
                      })()}
                      
                      <button
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          border: '1px solid var(--g300)',
                          background: expandedRows[log.id] ? 'var(--gp)' : '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: expandedRows[log.id] ? '#fff' : 'var(--gp)',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        {expandedRows[log.id] ? '−' : '+'}
                      </button>
                    </div>
                    
                    {/* Expanded details */}
                    {expandedRows[log.id] && (
                      <div style={{ padding: '0 0 12px 95px' }}>
                        {log.changes?.map((change, cidx) => (
                          <div 
                            key={cidx}
                            style={{ 
                              fontSize: '11px',
                              padding: '6px 0',
                              borderBottom: cidx < log.changes!.length - 1 ? '1px dashed var(--g200)' : 'none'
                            }}
                          >
                            <span style={{ fontWeight: 600, color: 'var(--g700)' }}>{change.field}</span>
                            <span style={{ color: 'var(--g400)', margin: '0 6px' }}>→</span>
                            <span style={{ color: 'var(--gp)' }}>
                              {formatChangeValue(change.field, change.after, log.actor_name, log.actor_user_id || null, uidMap, true)}
                            </span>
                            {change.before !== undefined && change.before !== null && (
                              <span style={{ color: 'var(--g400)', marginLeft: '8px' }}>
                                {(() => {
                                  const v = formatChangeValue(change.field, change.before, log.actor_name, log.actor_user_id || null, uidMap, false);
                                  return `(was: ${v})`;
                                })()}
                              </span>
                            )}
                          </div>
                        ))}
                        
                        <div style={{ fontSize: '10px', color: 'var(--g400)', marginTop: '8px' }}>
                          By: {log.actor_name || 'System'} • {log.application_name || 'Unknown'}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {!historyLoading && invoiceHistory.length === 0 && (
                <div className="il-empty" style={{ padding: '30px 20px' }}>
                  <div className="il-empty-title">No history found</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
