export const INVOICE_TEMPLATE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Invoice {{INVOICE_NUMBER}}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
          },
          colors: {
            brand: {
              50: '#f8fafc',
              100: '#f1f5f9',
              800: '#1e293b',
              900: '#0f172a',
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      font-family: 'Inter', sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
      background-color: #f1f5f9;
    }
    .invoice-container {
      max-width: 100%;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 16px 12px;
    }
    @media (min-width: 640px) {
      .invoice-container {
        max-width: 720px;
        padding: 40px;
        margin: 20px auto;
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
      }
    }
    .label-text {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .data-text {
      font-size: 14px;
      color: #0f172a;
      font-weight: 500;
    }
    .terms-text {
      font-size: 8px !important;
      line-height: 1.15;
      color: #64748b;
      text-align: justify;
    }
    .divider {
      border-bottom: 1px solid #e2e8f0;
      margin: 16px 0;
    }
    @page {
      size: A4 portrait;
      margin: 0 !important;
    }
    @media print {
      body {
        background: white;
        margin: 0 1.2cm !important;
        padding: 0 !important;
      }
      .invoice-container {
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none;
        max-width: 100%;
      }
      .no-print { display: none !important; }
      
      /* Force all background colors and styles to print exactly */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .terms-text { 
        font-size: 10px !important; 
        line-height: 1.35 !important;
      }
      .print-page-break {
        page-break-before: always;
        break-before: page;
      }
      /* Page 1 Compact Print Optimizations to fit all items, payment, and totals on exactly Page 1 */
      header {
        margin-bottom: 8px !important;
      }
      .divider {
        display: none !important;
      }
      section.mb-6 {
        margin-bottom: 8px !important;
      }
      #invoice-items > div {
        padding-top: 4px !important;
        padding-bottom: 4px !important;
      }
      .mb-8 {
        margin-bottom: 8px !important;
        gap: 16px !important;
      }
      
      /* 1. Customize Font for Customer Name */
      #customer-name-preview {
        font-size: 13px !important;
        font-weight: 700 !important;
      }
      
      /* 2 & 3. Minimize Font for standard items & warranty to share the exact same size */
      #invoice-items p, 
      #invoice-items div, 
      .warranties-print-compact,
      .warranties-print-compact div {
        font-size: 10px !important;
        line-height: 1.3 !important;
      }
      .warranties-print-compact strong {
        font-size: 10px !important;
      }
      .warranties-print-compact > * + * {
        margin-top: 4px !important;
      }
      
      /* Tighten spacing around Page 2 top-borders (horizontal lines) */
      .print-page-break section {
        margin-bottom: 6px !important;
        padding-top: 6px !important;
      }
      .label-text {
        font-size: 9.5px !important;
        margin-bottom: 2px !important;
      }
      #residents-only-label {
        font-size: 8px !important;
      }
      
      /* 4. Remove Subtotal on print */
      #subtotal-row {
        display: none !important;
      }
      
      /* 5. Force all fonts in solid black on print */
      * {
        color: #000000 !important;
        text-shadow: none !important;
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container relative">

    <!-- Action Buttons (Optional - only show if not for print) -->
    <div class="mb-4 flex justify-between items-center no-print" id="action-buttons">
      <div class="flex flex-wrap items-center gap-2">
        <span style="font-size:11px;font-weight:600;color:#64748b;margin-right:4px;">Payment:</span>
        
        <div id="container-a" style="display: inline-flex; align-items: center; border: 1.5px solid #e2e8f0; border-radius: 6px; background: #fff; padding: 2px 4px; gap: 2px;">
          <button id="btn-a" onclick="selectMilestone('a')" style="font-size:12px; font-weight:700; color:#374151; padding: 2px 6px; border-radius: 4px; cursor:pointer; background:none; border:none;">a</button>
          <input type="number" id="pct-a" value="20" min="0" max="100" step="any" oninput="onPctInput('a')" style="width: 45px; font-size:12px; font-weight:600; text-align:center; border: 1px solid #cbd5e1; border-radius:4px; padding: 1px 2px;" />
          <span style="font-size:11px; color:#64748b; padding-right: 2px;">%</span>
        </div>

        <div id="container-b" style="display: inline-flex; align-items: center; border: 1.5px solid #e2e8f0; border-radius: 6px; background: #fff; padding: 2px 4px; gap: 2px;">
          <button id="btn-b" onclick="selectMilestone('b')" style="font-size:12px; font-weight:700; color:#374151; padding: 2px 6px; border-radius: 4px; cursor:pointer; background:none; border:none;">b</button>
          <input type="number" id="pct-b" value="35" min="0" max="100" step="any" oninput="onPctInput('b')" style="width: 45px; font-size:12px; font-weight:600; text-align:center; border: 1px solid #cbd5e1; border-radius:4px; padding: 1px 2px;" />
          <span style="font-size:11px; color:#64748b; padding-right: 2px;">%</span>
        </div>

        <div id="container-c" style="display: inline-flex; align-items: center; border: 1.5px solid #e2e8f0; border-radius: 6px; background: #fff; padding: 2px 4px; gap: 2px;">
          <button id="btn-c" onclick="selectMilestone('c')" style="font-size:12px; font-weight:700; color:#374151; padding: 2px 6px; border-radius: 4px; cursor:pointer; background:none; border:none;">c</button>
          <input type="number" id="pct-c" value="35" min="0" max="100" step="any" oninput="onPctInput('c')" style="width: 45px; font-size:12px; font-weight:600; text-align:center; border: 1px solid #cbd5e1; border-radius:4px; padding: 1px 2px;" />
          <span style="font-size:11px; color:#64748b; padding-right: 2px;">%</span>
        </div>

        <div id="container-d" style="display: inline-flex; align-items: center; border: 1.5px solid #e2e8f0; border-radius: 6px; background: #fff; padding: 2px 4px; gap: 2px;">
          <button id="btn-d" onclick="selectMilestone('d')" style="font-size:12px; font-weight:700; color:#374151; padding: 2px 6px; border-radius: 4px; cursor:pointer; background:none; border:none;">d</button>
          <input type="number" id="pct-d" value="10" min="0" max="100" step="any" oninput="onPctInput('d')" style="width: 45px; font-size:12px; font-weight:600; text-align:center; border: 1px solid #cbd5e1; border-radius:4px; padding: 1px 2px;" />
          <span style="font-size:11px; color:#64748b; padding-right: 2px;">%</span>
        </div>

        <span id="milestone-label" style="font-size:11px;color:#64748b;margin-left:6px;display:none;"></span>
        <button id="btn-clear" onclick="selectMilestone(null)" style="font-size:11px;color:#94a3b8;background:none;border:none;cursor:pointer;display:none;">&#x2715; Clear</button>
      </div>
      <button onclick="window.print()" class="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded shadow transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
        </svg>
        <span>Print</span>
      </button>
    </div>

    <!-- Header/Content Table -->
    <table style="width: 100%; border-collapse: collapse; border: none; margin: 0; padding: 0;">
      <thead>
        <!-- Spacer row to act as top margin on every page -->
        <tr style="border: none; height: 1.2cm;">
          <td style="border: none; padding: 0; margin: 0; height: 1.2cm;"></td>
        </tr>
        <tr style="border: none;">
          <td style="border: none; padding: 0; margin: 0;">
            <div class="flex justify-between items-start mb-4">
              <img id="company-logo" src="{{LOGO_URL}}" alt="{{COMPANY_NAME}}" class="h-16 object-contain">
              <div class="text-right">
                <h1 class="text-2xl font-bold text-slate-900 tracking-tight">SALES ORDER</h1>
                <p class="text-sm font-medium text-slate-500">#{{INVOICE_NUMBER}}</p>
              </div>
            </div>
            <div class="divider" style="margin-top: 0; margin-bottom: 8px;"></div>
          </td>
        </tr>
      </thead>
      <tfoot>
        <!-- Spacer row to act as bottom margin on every page -->
        <tr style="border: none; height: 1.2cm;">
          <td style="border: none; padding: 0; margin: 0; height: 1.2cm;"></td>
        </tr>
      </tfoot>
      <tbody>
        <tr style="border: none;">
          <td style="border: none; padding: 0; margin: 0;">
            
            <div class="flex flex-col sm:flex-row justify-between gap-4 text-sm text-slate-600 mt-2 mb-6">
              <!-- From -->
              <div>
                 <p class="font-bold text-slate-900">{{COMPANY_NAME}}</p>
                 <p class="text-xs font-bold text-slate-700">ETERNALGY SDN BHD</p>
                 <p class="text-xs text-slate-500 mt-0.5">202301029164 (1523087-A)</p>
                 <p class="text-xs text-slate-500">TIN No.: C5815978903</p>
                  <p class="text-xs text-slate-500 mt-0.5 leading-normal">
                    23-01, Jalan Mutiara Emas 10/19,<br>
                    Taman Mount Austin, 81100 Johor Bahru,<br>
                    Johor Darul Ta'zim
                  </p>
              </div>
              <!-- Dates -->
              <div class="sm:text-right flex flex-col sm:items-end gap-1">
                <div>
                  <span class="label-text block">Date Issued</span>
                  <span class="font-medium text-slate-900">{{INVOICE_DATE}}</span>
                </div>
              </div>
            </div>

    <!-- Bill To -->
    <section class="mb-6">
      <p class="label-text mb-1">Bill To</p>
      <p class="text-lg font-bold text-slate-900 leading-none mb-1" id="customer-name-preview">
        {{CUSTOMER_NAME}}
      </p>
      <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed mb-1">{{CUSTOMER_ADDRESS}}</p>
      <div class="text-xs text-slate-500">
        <span class="mr-3">Tel: {{CUSTOMER_PHONE}}</span>
        <span>{{CUSTOMER_EMAIL}}</span>
      </div>
    </section>

    <!-- Line Items -->
    <section class="mb-6">
      <div class="bg-slate-50 rounded-t-lg border-b border-slate-200 px-3 py-2 flex text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <div class="flex-1">Description</div>
        <div class="text-center w-20">Qty</div>
        <div class="text-right w-24">Amount</div>
      </div>
      <div class="divide-y divide-slate-100 border-b border-slate-100" id="invoice-items">
        <!-- Items will be rendered here via JavaScript -->
      </div>
    </section>

    <!-- Summary & Payment -->
    <div class="flex flex-col sm:flex-row gap-8 mb-8">

      <!-- Payment Details (Left on Desktop, Bottom on Mobile) -->
      <div class="flex-1 order-2 sm:order-1">
        <div class="bg-slate-50 p-4 rounded-lg border border-slate-100">
          <p class="label-text mb-2">Payment Details</p>
          <div class="space-y-1">
            <div class="flex justify-between text-xs">
              <span class="text-slate-500">Bank</span>
              <span class="font-medium text-slate-900 text-right">{{BANK_NAME}}</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-slate-500">Account No.</span>
              <span class="font-medium text-slate-900 text-right">{{BANK_ACCOUNT_NO}}</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-slate-500">Account Name</span>
              <span class="font-medium text-slate-900 text-right">{{BANK_ACCOUNT_NAME}}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Totals (Right on Desktop, Top on Mobile) -->
      <div class="flex-1 sm:max-w-xs order-1 sm:order-2">
        <div class="space-y-2 text-sm">
          <div class="flex justify-between text-slate-600" id="subtotal-row" style="display: none;">
            <span>Subtotal</span>
            <span>RM {{SUBTOTAL}}</span>
          </div>
          <div class="flex justify-between text-red-600" id="discount-row" style="display: none;">
            <span>Discount</span>
            <span>-RM {{DISCOUNT_AMOUNT}}</span>
          </div>
          <div class="flex justify-between text-red-600" id="voucher-row" style="display: none;">
            <span>Voucher</span>
            <span>-RM {{VOUCHER_AMOUNT}}</span>
          </div>
          <div class="flex justify-between text-slate-600" id="sst-row" style="display: none;">
            <span>SST ({{SST_RATE}}%)</span>
            <span>RM {{SST_AMOUNT}}</span>
          </div>
          <div class="border-t border-slate-900 pt-3 mt-1 flex justify-between items-end">
            <span class="font-bold text-slate-900">Total</span>
            <span class="text-2xl font-bold text-slate-900 leading-none" id="total-display">RM {{TOTAL_AMOUNT}}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Page 2 Content -->
    <div class="print-page-break">
      <!-- Payment Terms -->
      <section class="mb-4 pt-4" id="residential-payment-terms">
        <p class="label-text mb-2">Payment Term</p>
        <p id="residents-only-label" class="text-[10px] font-semibold text-slate-500 mb-2">(For Residents Package Only)</p>
        <div class="terms-text">
          <table class="w-full text-left">
            <tbody>
              <tr>
                <td class="py-0.5 pr-2 font-semibold text-slate-700" style="width: 140px;">a. 1st Payment</td>
                <td class="py-0.5 text-slate-600" id="term-label-a">Initial Payment 20%</td>
              </tr>
              <tr>
                <td class="py-0.5 pr-2 font-semibold text-slate-700">b. 2nd Payment</td>
                <td class="py-0.5 text-slate-600" id="term-label-b">Upon SELCO Approval 35%</td>
              </tr>
              <tr>
                <td class="py-0.5 pr-2 font-semibold text-slate-700">c. 3rd Payment</td>
                <td class="py-0.5 text-slate-600" id="term-label-c">Completion of Installation Works 35%</td>
              </tr>
              <tr>
                <td class="py-0.5 pr-2 font-semibold text-slate-700">d. 4th Payment</td>
                <td class="py-0.5 text-slate-600" id="term-label-d">Upon Meter Activation 10%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Note -->
      <section class="mb-4 pt-4 border-t border-slate-200">
        <p class="label-text mb-2">Note</p>
        <div class="terms-text">
          <p>Prices are subjected to change without prior notice. We hope that our quotation is favorable to you and looking forward to receiving your valued orders in due course. Thanks and regards.</p>
        </div>
      </section>

      <!-- Terms & Conditions -->
      <section class="mb-4 pt-4 border-t border-slate-200">
        <p class="label-text mb-2">Terms &amp; Conditions</p>
        <div class="terms-text text-justify">
          <ol class="list-decimal pl-5 space-y-1">
            <li>Any discrepancies in the invoice must be reported in writing within 7 days of the invoice date.</li>
            <li>Goods will only be sold upon full payment of the invoice (no consignment or outstanding balances permitted).</li>
            <li>All cheques should be crossed and made payable to <strong>ETERNALGY SDN BHD</strong>, Maybank account: <strong>[501534157918]</strong>.</li>
            <li>Goods sold are non-returnable and non-refundable.</li>
            <li>Cancellation
              <ol class="list-alpha pl-5 mt-1 space-y-0.5">
                <li>5% Downpayment Refund (Before SEDA/SELCO Application) - non-refundable administrative fee of RM600.</li>
                <li>5% + 60% Refund (After SEDA/SELCO Application) - non-refundable charges (RM1,500).</li>
                <li>35% Payment After Installation Complete (Non-Refundable).</li>
              </ol>
            </li>
            <li>Please provide us with the bank deposit slip. Goods will be dispatched once the cheque has cleared.</li>
          </ol>
        </div>
      </section>

      <!-- Created By -->
      <div class="text-right text-xs text-slate-400 mb-4" id="created-by-section" style="display: none;">
        Quotation Created by: <span class="font-medium text-slate-600">{{CREATED_BY}}</span>
      </div>

      <!-- Footer -->
      <footer class="mt-8 text-center">
        <p class="text-[8px] text-slate-400 uppercase tracking-widest">Thank you for considering ETERNALGY SDN BHD</p>
      </footer>
    </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <script>
    var baseTotal = 0;
    var activeMilestone = null;
    var milestoneRates = { a: 0.20, b: 0.35, c: 0.35, d: 0.10 };
    var milestoneLabels = { a: 'a - Initial 20%', b: 'b - SELCO Approval 35%', c: 'c - Completion 35%', d: 'd - Meter Activation 10%' };

    function formatPercent(val) {
      var num = val * 100;
      if (num % 1 === 0) {
        return num.toFixed(0);
      }
      return num.toFixed(2);
    }

    function updateRatesFromInputs() {
      ['a', 'b', 'c', 'd'].forEach(function(k) {
        var input = document.getElementById('pct-' + k);
        if (input) {
          var val = parseFloat(input.value);
          if (isNaN(val)) val = 0;
          milestoneRates[k] = val / 100;
        }
      });

      milestoneLabels.a = 'a - Initial ' + formatPercent(milestoneRates.a) + '%';
      milestoneLabels.b = 'b - SELCO Approval ' + formatPercent(milestoneRates.b) + '%';
      milestoneLabels.c = 'c - Completion ' + formatPercent(milestoneRates.c) + '%';
      milestoneLabels.d = 'd - Meter Activation ' + formatPercent(milestoneRates.d) + '%';

      var termA = document.getElementById('term-label-a');
      var termB = document.getElementById('term-label-b');
      var termC = document.getElementById('term-label-c');
      var termD = document.getElementById('term-label-d');

      if (termA) termA.textContent = 'Initial Payment ' + formatPercent(milestoneRates.a) + '%';
      if (termB) termB.textContent = 'Upon SELCO Approval ' + formatPercent(milestoneRates.b) + '%';
      if (termC) termC.textContent = 'Completion of Installation Works ' + formatPercent(milestoneRates.c) + '%';
      if (termD) termD.textContent = 'Upon Meter Activation ' + formatPercent(milestoneRates.d) + '%';
    }

    function onPctInput(k) {
      updateRatesFromInputs();
      
      if (window.invoiceData && window.invoiceData.items) {
        renderItems(window.invoiceData.items);
      }

      var totalEl = document.getElementById('total-display');
      var labelEl = document.getElementById('milestone-label');
      if (totalEl) {
        var amt = activeMilestone ? baseTotal * milestoneRates[activeMilestone] : window.invoiceData.total_amount;
        totalEl.textContent = 'RM ' + formatCurrency(amt);
      }
      if (labelEl) {
        labelEl.textContent = activeMilestone ? milestoneLabels[activeMilestone] : '';
      }
    }

    function selectMilestone(key) {
      activeMilestone = (activeMilestone === key) ? null : key;
      
      if (window.invoiceData && window.invoiceData.items) {
        renderItems(window.invoiceData.items);
      }

      var totalEl = document.getElementById('total-display');
      var labelEl = document.getElementById('milestone-label');
      var clearBtn = document.getElementById('btn-clear');
      if (totalEl) {
        var amt = activeMilestone ? baseTotal * milestoneRates[activeMilestone] : window.invoiceData.total_amount;
        totalEl.textContent = 'RM ' + formatCurrency(amt);
      }
      ['a','b','c','d'].forEach(function(k) {
        var btn = document.getElementById('btn-' + k);
        var container = document.getElementById('container-' + k);
        if (!btn) return;
        if (k === activeMilestone) {
          btn.style.background = '#0f172a'; btn.style.color = '#fff';
          if (container) {
            container.style.borderColor = '#0f172a';
            container.style.background = '#f8fafc';
          }
        } else {
          btn.style.background = 'none'; btn.style.color = '#374151';
          if (container) {
            container.style.borderColor = '#e2e8f0';
            container.style.background = '#fff';
          }
        }
      });
      if (labelEl) { labelEl.textContent = activeMilestone ? milestoneLabels[activeMilestone] : ''; labelEl.style.display = activeMilestone ? '' : 'none'; }
      if (clearBtn) { clearBtn.style.display = activeMilestone ? '' : 'none'; }
    }

    function formatCurrency(amount) {
      const num = parseFloat(amount);
      if (isNaN(num)) return '0.00';
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(d) {
      if (!d) return '';
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      return date.getFullYear() + '-' +
             String(date.getMonth() + 1).padStart(2, '0') + '-' +
             String(date.getDate()).padStart(2, '0');
    }

    function renderInvoice(invoiceData) {
      const template = invoiceData.template || {};
      const items = invoiceData.items || [];
      const subtotal = parseFloat(invoiceData.subtotal) || 0;
      const sstAmount = parseFloat(invoiceData.sst_amount) || 0;
      const discountAmount = parseFloat(invoiceData.discount_amount) || 0;
      const voucherAmount = parseFloat(invoiceData.voucher_amount) || 0;
      const totalAmount = parseFloat(invoiceData.total_amount) || 0;
      
      // Calculate package price
      const pkgItem = items.find(item => {
        const itemType = (item.inv_item_type || item.item_type || '').toLowerCase();
        const desc = (item.description || '').toUpperCase();
        const isPkgDesc = desc.includes('JINKO') || desc.includes('INVERTER') || desc.includes('PV SYSTEM') || desc.includes('SOLAR MOUNTING');
        return !!item.is_a_package || !!item.package_name || !!item.package_bubble_id || !!item.linked_package || itemType === 'package' || isPkgDesc;
      });
      const pkgPrice = pkgItem ? (parseFloat(pkgItem.amount || pkgItem.total_price) || 0) : 0;
      
      baseTotal = totalAmount;
      const sstRate = invoiceData.sst_rate || 6;

      const rawNum = invoiceData.invoice_number || '';
      const soNumber = rawNum.startsWith('INV') ? 'SO' + rawNum.slice(3) : (rawNum.startsWith('SO') ? rawNum : 'SO-' + rawNum);
      document.title = \`Sales Order \${soNumber}\`;

      const linkedPayments = invoiceData.linked_payments || [];
      const firstPaymentWithBank = linkedPayments.find(p => p.issuer_bank);
      const custData = invoiceData.customer_data || {};

      const customerBankName = custData.bank_name || (firstPaymentWithBank && firstPaymentWithBank.issuer_bank) || '';
      const customerBankAccountNo = custData.bank_account_no || (firstPaymentWithBank && firstPaymentWithBank.bank_account_no) || custData.ic_number || '';
      const customerBankAccountName = custData.bank_account_name || custData.name || invoiceData.customer_name_snapshot || '';

      const replacements = {
        '{{INVOICE_NUMBER}}': soNumber,
        '{{COMPANY_NAME}}': template.company_name || 'Atap Solar',
        '{{COMPANY_ADDRESS}}': (template.company_address || '').toUpperCase(),
        '{{COMPANY_PHONE}}': template.company_phone || '',
        '{{COMPANY_EMAIL}}': template.company_email || '',
        '{{LOGO_URL}}': template.logo_url || '/logo-08.png',
        '{{STATUS}}': invoiceData.status || 'Draft',
        '{{INVOICE_DATE}}': formatDate(invoiceData.invoice_date),
        '{{CUSTOMER_NAME}}': (invoiceData.customer_name_snapshot || 'Valued Customer').toUpperCase(),
        '{{CUSTOMER_ADDRESS}}': (invoiceData.customer_address_snapshot || '').toUpperCase(),
        '{{CUSTOMER_PHONE}}': invoiceData.customer_phone_snapshot || '',
        '{{CUSTOMER_EMAIL}}': invoiceData.customer_email_snapshot || '',
        '{{SUBTOTAL}}': formatCurrency(subtotal),
        '{{SST_RATE}}': sstRate,
        '{{SST_AMOUNT}}': formatCurrency(sstAmount),
        '{{DISCOUNT_AMOUNT}}': formatCurrency(Math.abs(discountAmount)),
        '{{VOUCHER_AMOUNT}}': formatCurrency(Math.abs(voucherAmount)),
        '{{TOTAL_AMOUNT}}': formatCurrency(activeMilestone ? baseTotal * milestoneRates[activeMilestone] : totalAmount),
        '{{BANK_NAME}}': customerBankName,
        '{{BANK_ACCOUNT_NO}}': customerBankAccountNo,
        '{{BANK_ACCOUNT_NAME}}': customerBankAccountName,
        '{{TERMS}}': template.terms_and_conditions || '',
        '{{CREATED_BY}}': (invoiceData.created_by_user_name || 'System').toUpperCase()
      };

      let html = document.body.innerHTML;
      for (const [placeholder, value] of Object.entries(replacements)) {
        html = html.replace(new RegExp(placeholder, 'g'), value || '');
      }
      document.body.innerHTML = html;

      const isResidential = items.some(item => {
        const pkgType = (item.package_type || '').toLowerCase();
        return pkgType === 'residential';
      });

      toggleElement('discount-row', discountAmount !== 0);
      toggleElement('voucher-row', voucherAmount !== 0);
      toggleElement('sst-row', sstAmount !== 0);
      toggleElement('terms-section', !!template.terms_and_conditions);
      toggleElement('created-by-section', !!invoiceData.created_by_user_name);
      toggleElement('residential-payment-terms', true);

      renderItems(items);
    }

    function toggleElement(id, show) {
      const el = document.getElementById(id);
      if (el) el.style.display = show ? '' : 'none';
    }

    function renderItems(items) {
      const container = document.getElementById('invoice-items');
      if (!container) return;

      const itemsHtml = items.map(item => {
        const itemType = (item.inv_item_type || item.item_type || '').toLowerCase();
        const price = parseFloat(item.amount || item.total_price) || 0;
        
        const desc = (item.description || '').toUpperCase();
        const isPkgDesc = desc.includes('JINKO') || desc.includes('INVERTER') || desc.includes('PV SYSTEM') || desc.includes('SOLAR MOUNTING');
        const isPkg = !!item.is_a_package || !!item.package_name || !!item.package_bubble_id || !!item.linked_package || itemType === 'package' || isPkgDesc;

        var solarHeader = isPkg
          ? '<p style="font-size: 13px; font-weight: 700; color: #000; margin-bottom: 4px;">Installation of Solar Panel</p>'
          : '';

        var scheduleHtml = '';
        if (isPkg) {
          var rateA = milestoneRates.a;
          var rateB = milestoneRates.b;
          var rateC = milestoneRates.c;
          var rateD = milestoneRates.d;
          
          var a = baseTotal * rateA;
          var b = baseTotal * rateB;
          var c = baseTotal * rateC;
          var d = baseTotal * rateD;

          scheduleHtml = '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:13px;color:#000;line-height:1.5;">'
            + '<div style="font-weight:700;color:#000;margin-bottom:4px;">Package Amount: RM ' + formatCurrency(baseTotal) + '</div>'
            + '<div style="color:#000;">a. Initial payment ' + formatPercent(rateA) + '% = RM ' + formatCurrency(a) + '</div>'
            + '<div style="color:#000;">b. Upon selco approval ' + formatPercent(rateB) + '% = RM ' + formatCurrency(b) + '</div>'
            + '<div style="color:#000;">c. Upon completion of installation works ' + formatPercent(rateC) + '% = RM ' + formatCurrency(c) + '</div>'
            + '<div style="color:#000;">d. Upon Meter Activation ' + formatPercent(rateD) + '% = RM ' + formatCurrency(d) + '</div>'
            + '</div>';
        }

        // If a milestone is active, update the price shown for the package item
        let displayPrice = price;

        const isDiscount = itemType === 'discount' || itemType === 'voucher' || itemType === 'rebate' || price < 0;
        const priceColor = isDiscount ? 'color: #dc2626;' : 'color: #000;';

        const priceHtml = activeMilestone 
          ? '' 
          : \`<p class="font-semibold" style="font-size: 13px; \${priceColor}">\${isDiscount ? '-' : ''}RM \${formatCurrency(Math.abs(displayPrice))}</p>\`;

        return \`
          <div class="px-3 py-3 flex gap-3 items-start border-b border-slate-100/50" style="color: #000;">
            <div class="flex-1">
              \${solarHeader}
              <p style="font-size: 13px; font-weight: 400; color: #000; line-height: 1.5;" class="whitespace-pre-line">\${item.description}</p>
              \${scheduleHtml}
            </div>
            <div class="text-center w-20 text-sm font-medium" style="color: #000; font-size: 13px;">
              \${item.qty ? parseFloat(item.qty) : ''}
            </div>
            <div class="text-right w-24">
              \${priceHtml}
            </div>
          </div>
        \`;
      }).join('');

      const specsHtml = ''; // Removed warranty description

      container.innerHTML = itemsHtml + specsHtml;
    }

    if (window.invoiceData) {
      renderInvoice(window.invoiceData);
    }
  </script>
</body>
</html>
`;
