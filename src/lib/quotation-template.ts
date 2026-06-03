export const QUOTATION_TEMPLATE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Quotation {{QUOTATION_NUMBER}}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"><\/script>
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
  <\/script>
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
      font-size: 11px !important;
      line-height: 1.1;
      color: #334155;
    }
    .terms-text ol {
      list-style-type: decimal;
      padding-left: 1.2em;
      margin: 0;
    }
    .terms-text li {
      margin-bottom: 1px;
    }
    .terms-text li ol {
      list-style-type: lower-alpha;
      margin-top: 2px;
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
        margin: 0 0.8cm !important;
        padding: 0 !important;
        zoom: 0.92;
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
      
      /* Condense layout spacing for single-page printing */
      header { margin-bottom: 8px !important; }
      .divider {
        display: none !important;
      }
      section {
        margin-bottom: 6px !important;
        padding-top: 6px !important;
      }
      .mb-6 { margin-bottom: 6px !important; }
      .mb-8 { margin-bottom: 6px !important; }
      .mb-4 { margin-bottom: 6px !important; }
      .py-3 { padding-top: 6px !important; padding-bottom: 6px !important; }
      
      /* Scale down logo slightly on paper */
      #company-logo { height: 44px !important; }
      
      /* Slightly smaller text for secondary blocks */
      .terms-text { font-size: 9.5px !important; line-height: 1.35 !important; }
      .label-text { font-size: 8px !important; margin-bottom: 1px !important; }
      
      /* Make list items compact on print */
      #invoice-items p, 
      #invoice-items div {
        font-size: 10px !important;
        line-height: 1.3 !important;
      }
      
      /* Force payment term, note, and terms & conditions in solid black on print */
      #residential-payment-terms,
      #residential-payment-terms *,
      #note-section,
      #note-section *,
      #terms-section,
      #terms-section *,
      #prepared-by-section,
      #prepared-by-section * {
        color: #000000 !important;
      }
      
      #residents-only-label {
        font-size: 8px !important;
      }
      
      /* Force single-page bounds */
      html, body {
        height: 99%;
        page-break-after: avoid;
        page-break-before: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container relative">

    <!-- Action Buttons (only for screen, not print) -->
    <div class="mb-4 flex justify-end gap-2 no-print" id="action-buttons">
      <button id="toggle-details-btn" onclick="toggleDetails()" class="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium px-4 py-2 rounded border border-slate-200 shadow transition-colors">
        <span id="toggle-details-dot" class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        <span id="toggle-details-text">Show Details</span>
      </button>
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
        <tr style="border: none; height: 0.5cm;">
          <td style="border: none; padding: 0; margin: 0; height: 0.5cm;"></td>
        </tr>
        <tr style="border: none;">
          <td style="border: none; padding: 0; margin: 0;">
            <div class="flex justify-between items-start mt-8 mb-4">
              <img id="company-logo" src="{{LOGO_URL}}" alt="{{COMPANY_NAME}}" class="h-16 object-contain">
              <div class="text-right">
                <h1 class="text-2xl font-bold text-slate-900 tracking-tight">QUOTATION</h1>
                <p class="text-sm font-medium text-slate-500">#{{QUOTATION_NUMBER}}</p>
              </div>
            </div>
            <div class="divider" style="margin-top: 0; margin-bottom: 8px;"></div>
          </td>
        </tr>
      </thead>
      <tfoot>
        <!-- Spacer row to act as bottom margin on every page -->
        <tr style="border: none; height: 0.5cm;">
          <td style="border: none; padding: 0; margin: 0; height: 0.5cm;"></td>
        </tr>
      </tfoot>
      <tbody>
        <tr style="border: none;">
          <td style="border: none; padding: 0; margin: 0;">
            
            <div class="flex flex-col sm:flex-row justify-between gap-4 text-sm text-slate-600 mt-2 mb-6">
              <!-- From -->
              <div>
                 <p class="font-bold text-slate-900">{{COMPANY_NAME}}</p>
                 <p class="text-xs text-slate-500 mt-0.5">202301029164 (1523087-A)</p>
                 <p class="text-xs text-slate-500">TIN No.: C5815978903</p>
                 <p class="whitespace-pre-line text-xs leading-normal mt-0.5">{{COMPANY_ADDRESS}}</p>
              </div>
              <!-- Date -->
              <div class="sm:text-right flex flex-col sm:items-end gap-1">
                <div>
                  <span class="label-text block">Date Issued</span>
                  <span class="font-medium text-slate-900">{{INVOICE_DATE}}</span>
                </div>
              </div>
            </div>

    <!-- Quotation To -->
    <section class="mb-6">
      <p class="label-text mb-1">Quotation For</p>
      <p class="text-lg font-bold text-slate-900 leading-none mb-1">
        {{CUSTOMER_NAME}}
      </p>
      <p class="text-xs text-slate-600 whitespace-pre-line leading-normal mt-0.5 mb-1 uppercase">{{CUSTOMER_ADDRESS}}</p>
      <div class="text-xs text-slate-500">
        <span class="mr-3" id="customer-phone-row">Tel: {{CUSTOMER_PHONE}}</span>
        <span id="customer-email-row">{{CUSTOMER_EMAIL}}</span>
      </div>
    </section>

    <!-- Line Items (packages only) -->
    <section class="mb-6">
      <div class="bg-slate-50 rounded-t-lg border-b border-slate-200 px-3 py-2 flex text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <div class="flex-1">Description</div>
        <div class="text-center w-20">Qty</div>
        <div class="text-right w-24">Amount (RM)</div>
      </div>
      <div class="divide-y divide-slate-100 border-b border-slate-100" id="invoice-items">
        <!-- Items will be rendered here via JavaScript -->
      </div>
    </section>

    <!-- Total -->
    <div class="flex justify-end mb-4">
      <div class="w-full sm:w-64">
        <div class="border-t-2 border-slate-900 pt-1 flex justify-between items-end">
          <span class="font-bold text-slate-900">Total</span>
          <span class="text-xl font-bold text-slate-900 leading-none">RM {{TOTAL_AMOUNT}}</span>
        </div>
      </div>
    </div>

    <!-- Payment Terms -->
    <section class="mb-4 pt-2 border-t border-slate-200" id="residential-payment-terms" style="display: none;">
      <p class="label-text mb-2">Payment Term</p>
      <p id="residents-only-label" class="text-[10px] font-semibold text-slate-500 mb-2">(For Residents Package Only)</p>
      <div class="terms-text">
        <table class="w-full text-left">
          <tbody>
            <tr>
              <td class="py-0.5 pr-2 font-semibold text-slate-700" style="width: 110px;">1st Payment</td>
              <td class="py-0.5 text-slate-600">Initial Payment 5%</td>
            </tr>
            <tr>
              <td class="py-0.5 pr-2 font-semibold text-slate-700">2nd Payment</td>
              <td class="py-0.5 text-slate-600">SEDA Approval 60%</td>
            </tr>
            <tr>
              <td class="py-0.5 pr-2 font-semibold text-slate-700">3rd Payment</td>
              <td class="py-0.5 text-slate-600">Completion of Installation 35%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Note -->
    <section class="mb-4" id="note-section">
      <p class="label-text mb-2">Note</p>
      <div class="terms-text">
        <p>Prices are subjected to change without prior notice. We hope that our quotation is favorable to you and looking forward to receiving your valued orders in due course. Thanks and regards.</p>
      </div>
    </section>

    <!-- Terms & Conditions -->
    <section class="mb-4" id="terms-section">
      <p class="label-text mb-2">Terms &amp; Conditions</p>
      <div class="terms-text">
        <ol>
          <li>Any discrepancies in the invoice must be reported in writing within 7 days of the invoice date.</li>
          <li>Goods will only be sold upon full payment of the invoice (no consignment or outstanding balances permitted).</li>
          <li>All cheques should be crossed and made payable to <strong>ETERNALGY SDN BHD</strong>, Maybank account: <strong>[501534157918]</strong>.</li>
          <li>Goods sold are non-returnable and non-refundable.</li>
          <li>Cancellation
            <ol>
              <li>5% Downpayment Refund (Before SEDA/SELCO Application) - non-refundable administrative fee of RM600.</li>
              <li>5% + 60% Refund (After SEDA/SELCO Application) - non-refundable charges (RM1,500).</li>
              <li>35% Payment After Installation Complete (Non-Refundable).</li>
            </ol>
          </li>
          <li>Please provide us with the bank deposit slip. Goods will be dispatched once the cheque has cleared.</li>
        </ol>
      </div>
    </section>

    <!-- Signatures -->
    <table style="width: 100%; border-collapse: collapse; border: none; margin-top: 24px; margin-bottom: 24px;">
      <tr style="border: none;">
        <!-- Company Signature (Left) -->
        <td style="width: 50%; border: none; padding: 0 16px 0 0; vertical-align: top;">
          <div style="font-size: 11px; font-weight: 700; color: #000; margin-bottom: 8px;">For ETERNALGY SDN BHD</div>
          <div style="height: 70px; display: flex; align-items: flex-end; margin-bottom: 8px;">
            <img src="/company-signature.png" alt="Eternalgy Stamp" style="height: 70px; width: auto; object-fit: contain;">
          </div>
          <div style="border-bottom: 1px dashed #000; width: 180px; margin-bottom: 4px;"></div>
          <div style="font-size: 10px; color: #475569; font-weight: 600;">Authorized Signature</div>
        </td>
        <!-- Customer Signature (Right) -->
        <td style="width: 50%; border: none; padding: 0 0 0 16px; vertical-align: top;">
          <div style="font-size: 11px; font-weight: 700; color: #000; margin-bottom: 8px;">Accepted &amp; Confirmed By</div>
          <div id="customer-signature-container" style="height: 70px; display: flex; align-items: flex-end; justify-content: flex-start; margin-bottom: 8px;"></div>
          <div style="border-bottom: 1px dashed #000; width: 180px; margin-bottom: 4px;"></div>
          <div style="font-size: 10px; color: #475569; font-weight: 600;">Customer Signature</div>
          <div style="font-size: 10px; color: #475569; margin-top: 2px;">Name: {{CUSTOMER_NAME}}</div>
          <div id="customer-signature-date" style="font-size: 10px; color: #475569; margin-top: 2px;">Date: <span id="customer-sig-date-val"></span></div>
        </td>
      </tr>
    </table>

    <div id="prepared-by-section" style="font-size: 10px; color: #475569; margin-top: 12px; margin-bottom: 12px;">
      Prepared by: <span style="font-weight: 600; color: #000;">{{CREATED_BY}}</span>
    </div>


    <!-- Footer -->
    <footer class="mt-8 text-center">
      <p class="text-[8px] text-slate-400 uppercase tracking-widest">Thank you for considering ETERNALGY SDN BHD</p>
    </footer>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <script>
    function formatCurrency(amount) {
      var num = parseFloat(amount);
      if (isNaN(num)) return '0.00';
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderQuotation(invoiceData) {
      var template = invoiceData.template || {};
      var items = invoiceData.items || [];

      function formatDate(d) {
        if (!d) return '';
        var date = new Date(d);
        if (isNaN(date.getTime())) return d;
        return date.getFullYear() + '-' +
               String(date.getMonth() + 1).padStart(2, '0') + '-' +
               String(date.getDate()).padStart(2, '0');
      }

      function toQuotationNumber(invNum) {
        if (!invNum) return 'N/A';
        return invNum.replace(/^INV/i, 'QT');
      }

      var quotationNumber = toQuotationNumber(invoiceData.invoice_number);

      var showDiscounts = invoiceData.showDiscounts !== false;
      var packageItems = items.filter(function(item) {
        var price = parseFloat(item.total_price || item.amount) || 0;
        var itemType = (item.inv_item_type || item.item_type || '').toLowerCase();
        var desc = (item.description || '').toUpperCase();
        var isPkgDesc = desc.includes('JINKO') || desc.includes('INVERTER') || desc.includes('PV SYSTEM') || desc.includes('SOLAR MOUNTING');
        var isPkg = !!item.is_a_package || !!item.package_name || !!item.package_bubble_id || !!item.linked_package || itemType === 'package' || isPkgDesc;

        if (showDiscounts) {
          return true; // Show all list items
        } else {
          return isPkg; // Else only show package details
        }
      });

      var toggleBtn = document.getElementById('toggle-details-btn');
      var toggleText = document.getElementById('toggle-details-text');
      var toggleDot = document.getElementById('toggle-details-dot');
      if (toggleText && toggleDot) {
        if (showDiscounts) {
          toggleText.innerText = 'Hide Details';
          toggleDot.className = 'w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse';
          if (toggleBtn) {
            toggleBtn.className = 'inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium px-4 py-2 rounded border border-red-200 shadow transition-colors';
          }
        } else {
          toggleText.innerText = 'Show Details';
          toggleDot.className = 'w-1.5 h-1.5 rounded-full bg-slate-400';
          if (toggleBtn) {
            toggleBtn.className = 'inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium px-4 py-2 rounded border border-slate-200 shadow transition-colors';
          }
        }
      }

      var isResidential = items.some(function(item) {
        var pkgType = (item.package_type || '').toLowerCase();
        return pkgType === 'residential';
      });

      document.title = 'Quotation ' + quotationNumber;

      var replacements = {
        '{{QUOTATION_NUMBER}}': quotationNumber,
        '{{COMPANY_NAME}}': 'ETERNALGY SDN BHD',
        '{{COMPANY_ADDRESS}}': '23-01, JALAN MUTIARA EMAS 10/19,\\nTAMAN MOUNT AUSTIN, 81100 JOHOR BAHRU,\\nJOHOR DARUL TA\\'ZIM',
        '{{LOGO_URL}}': template.logo_url || '/logo-08.png',
        '{{INVOICE_DATE}}': formatDate(invoiceData.invoice_date),
        '{{CUSTOMER_NAME}}': invoiceData.customer_name_snapshot || 'Valued Customer',
        '{{CUSTOMER_ADDRESS}}': invoiceData.customer_address_snapshot || '',
        '{{CUSTOMER_PHONE}}': invoiceData.customer_phone_snapshot || '',
        '{{CUSTOMER_EMAIL}}': invoiceData.customer_email_snapshot || '',
        '{{TOTAL_AMOUNT}}': formatCurrency(invoiceData.total_amount),
        '{{CREATED_BY}}': invoiceData.created_by_user_name || 'System'
      };

      var html = document.body.innerHTML;
      for (var key in replacements) {
        if (replacements.hasOwnProperty(key)) {
          var escaped = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          html = html.replace(new RegExp(escaped, 'g'), replacements[key] || '');
        }
      }
      document.body.innerHTML = html;


      var phoneRow = document.getElementById('customer-phone-row');
      if (phoneRow && !invoiceData.customer_phone_snapshot) {
        phoneRow.style.display = 'none';
      }
      var emailRow = document.getElementById('customer-email-row');
      if (emailRow && !invoiceData.customer_email_snapshot) {
        emailRow.style.display = 'none';
      }

      var residentialSection = document.getElementById('residential-payment-terms');
      if (residentialSection) {
        residentialSection.style.display = '';
      }
      
      var signatureContainer = document.getElementById('customer-signature-container');
      if (signatureContainer) {
        var signatureUrl = '';
        
        if (invoiceData.seda_registration && invoiceData.seda_registration.customer_signature) {
          signatureUrl = invoiceData.seda_registration.customer_signature;
        }
        
        if (signatureUrl) {
          var signatureHtml = '<div style="display: flex; flex-direction: column; align-items: flex-start;">';
          signatureHtml += '<img src="' + signatureUrl + '" alt="Customer Signature" style="height: 60px; width: auto; object-fit: contain; margin-bottom: 2px;">';
          signatureHtml += '</div>';
          
          signatureContainer.innerHTML = signatureHtml;
          
          var dateString = '';
          if (invoiceData.seda_registration && invoiceData.seda_registration.updated_at) {
            var dateObj = new Date(invoiceData.seda_registration.updated_at);
            dateString = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
          } else if (invoiceData.first_payment_date) {
            var dateObj = new Date(invoiceData.first_payment_date);
            dateString = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
          }
          
          if (dateString) {
             var dateVal = document.getElementById('customer-sig-date-val');
             if (dateVal) {
                dateVal.innerText = dateString;
             }
          }
        }
      }

      renderItems(packageItems);
    }

    function renderItems(items) {
      var container = document.getElementById('invoice-items');
      if (!container) return;

      var showDiscounts = (window.invoiceData && window.invoiceData.showDiscounts) !== false;
      var totalAmount = (window.invoiceData && window.invoiceData.total_amount) || '0.00';

      var htmlParts = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var itemType = (item.inv_item_type || item.item_type || '').toLowerCase();
        var price = parseFloat(item.total_price || item.amount) || 0;
        
        var desc = (item.description || '').toUpperCase();
        var isPkgDesc = desc.includes('JINKO') || desc.includes('INVERTER') || desc.includes('PV SYSTEM') || desc.includes('SOLAR MOUNTING');
        var isPackage = !!item.is_a_package || !!item.package_name || !!item.package_bubble_id || !!item.linked_package || itemType === 'package' || isPkgDesc;

        // Show package amount when click show discount, else package amount = total
        if (!showDiscounts && isPackage) {
          price = parseFloat(totalAmount) || 0;
        }

        var isDiscount = itemType === 'discount' || itemType === 'voucher' || itemType === 'rebate' || price < 0;
        var priceClass = isDiscount ? 'text-red-600' : 'text-slate-900';
        htmlParts.push(
          '<div class="px-3 py-3 flex gap-3 items-start border-b border-slate-100/50">' +
            '<div class="flex-1">' +
              '<p class="text-[13px] font-medium text-slate-900 leading-snug whitespace-pre-line">' + item.description + '</p>' +
            '</div>' +
            '<div class="text-center w-20 text-[13px] font-medium text-slate-600">' +
              (item.qty ? parseFloat(item.qty) : '') +
            '</div>' +
            '<div class="text-right w-24">' +
              '<p class="text-[13px] font-semibold ' + priceClass + '">' + (isDiscount ? '-' : '') + 'RM ' + formatCurrency(Math.abs(price)) + '</p>' +
            '</div>' +
          '</div>'
        );
      }
      container.innerHTML = htmlParts.join('');
    }

    if (window.invoiceData) {
      renderQuotation(window.invoiceData);
    }

    window.toggleDetails = function() {
      if (window.invoiceData) {
        window.invoiceData.showDiscounts = !window.invoiceData.showDiscounts;
        renderQuotation(window.invoiceData);
        if (window.parent) {
          window.parent.postMessage({ type: 'toggleQuotationDiscounts' }, '*');
        }
      }
    };
  <\/script>
</body>
</html>
`;
