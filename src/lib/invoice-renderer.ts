import { INVOICE_TEMPLATE_HTML } from "./invoice-template";

export function getInvoiceHtml(invoiceData: any): string {
  const template = invoiceData.template || {};
  const totalAmount = parseFloat(invoiceData.total_amount) || 0;
  // Use total_amount as subtotal since breakdown fields were removed
  const subtotal = totalAmount;
  const sstAmount = parseFloat(invoiceData.sst_amount) || 0;
  const discountAmount = parseFloat(invoiceData.discount_amount) || 0;
  const voucherAmount = parseFloat(invoiceData.voucher_amount) || 0;
  const sstRate = invoiceData.sst_rate || 6;

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (d: any) => {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.getFullYear() + '-' +
           String(date.getMonth() + 1).padStart(2, '0') + '-' +
           String(date.getDate()).padStart(2, '0');
  };

  const linkedPayments = invoiceData.linked_payments || [];
  const firstPaymentWithBank = linkedPayments.find((p: any) => p.issuer_bank);
  const custData = invoiceData.customer_data || {};

  const customerBankName = custData.bank_name || (firstPaymentWithBank && firstPaymentWithBank.issuer_bank) || '';
  const customerBankAccountNo = custData.bank_account_no || (firstPaymentWithBank && firstPaymentWithBank.bank_account_no) || custData.ic_number || '';
  const customerBankAccountName = custData.bank_account_name || custData.name || invoiceData.customer_name_snapshot || '';

  const replacements: Record<string, string | number> = {
    '{{INVOICE_NUMBER}}': invoiceData.invoice_number || 'N/A',
    '{{COMPANY_NAME}}': template.company_name || 'Atap Solar',
    '{{COMPANY_ADDRESS}}': template.company_address || '',
    '{{COMPANY_PHONE}}': template.company_phone || '',
    '{{COMPANY_EMAIL}}': template.company_email || '',
    '{{LOGO_URL}}': template.logo_url || 'https://admin.atap.solar/logo-08.png', // Fallback to absolute URL if possible
    '{{STATUS}}': invoiceData.status || 'Draft',
    '{{INVOICE_DATE}}': formatDate(invoiceData.invoice_date),
    '{{DUE_DATE}}': invoiceData.due_date || '',
    '{{CUSTOMER_NAME}}': invoiceData.customer_name_snapshot || 'Valued Customer',
    '{{CUSTOMER_ADDRESS}}': invoiceData.customer_address_snapshot || '',
    '{{CUSTOMER_PHONE}}': invoiceData.customer_phone_snapshot || '',
    '{{CUSTOMER_EMAIL}}': invoiceData.customer_email_snapshot || '',
    '{{SUBTOTAL}}': formatCurrency(subtotal),
    '{{SST_RATE}}': sstRate,
    '{{SST_AMOUNT}}': formatCurrency(sstAmount),
    '{{DISCOUNT_AMOUNT}}': formatCurrency(Math.abs(discountAmount)),
    '{{VOUCHER_AMOUNT}}': formatCurrency(Math.abs(voucherAmount)),
    '{{TOTAL_AMOUNT}}': formatCurrency(totalAmount),
    '{{BANK_NAME}}': customerBankName,
    '{{BANK_ACCOUNT_NO}}': customerBankAccountNo,
    '{{BANK_ACCOUNT_NAME}}': customerBankAccountName,
    '{{TERMS}}': template.terms_and_conditions || '',
    '{{CREATED_BY}}': invoiceData.created_by_user_name || 'System'
  };

  // 1. Initial string replacement for simple placeholders
  let html = INVOICE_TEMPLATE_HTML;
  for (const [placeholder, value] of Object.entries(replacements)) {
    html = html.replace(new RegExp(placeholder, 'g'), String(value || ''));
  }

  // 2. Handle conditional visibility (display: none)
  const items = invoiceData.items || [];
  const isResidential = items.some((item: any) => {
    const pkgType = (item.package_type || '').toLowerCase();
    return pkgType === 'residential';
  });

  const isPrimaryHardware = items.some((item: any) => {
    return !!item.is_a_package || (item.inv_item_type || item.item_type) === 'package';
  });

  const toggles = [
    { id: 'discount-row', show: discountAmount !== 0 },
    { id: 'voucher-row', show: voucherAmount !== 0 },
    { id: 'sst-row', show: sstAmount !== 0 },
    { id: 'terms-section', show: !!template.terms_and_conditions },
    { id: 'created-by-section', show: !!invoiceData.created_by_user_name },
    { id: 'residential-payment-terms', show: true },
    { id: 'warranty-section', show: isPrimaryHardware }
  ];

  for (const { id, show } of toggles) {
    if (!show) {
      // Find the element with this ID and add style="display: none;" or remove it
      // Simple string replacement for these specific IDs
      html = html.replace(new RegExp(`id="${id}"`, 'g'), `id="${id}" style="display: none;"`);
    } else {
      html = html.replace(new RegExp(`id="${id}" style="display: none;"`, 'g'), `id="${id}"`);
    }
  }

  // 3. Render items list
  const itemsHtml = items.map((item: any) => {
    const itemType = (item.inv_item_type || item.item_type || '').toLowerCase();
    const price = parseFloat(item.amount || item.total_price) || 0;
    const isDiscount = itemType === 'discount' || itemType === 'voucher' || itemType === 'rebate' || price < 0;
    const priceClass = isDiscount ? 'text-red-600' : 'text-slate-900';

    return `
      <div class="px-3 py-3 flex gap-3 items-start border-b border-slate-100/50">
        <div class="flex-1">
          <p class="text-sm font-medium text-slate-900 leading-snug whitespace-pre-line">${item.description}</p>
        </div>
        <div class="text-center w-20 text-sm font-medium text-slate-600">
          ${item.qty ? parseFloat(item.qty) : ''}
        </div>
        <div class="text-right w-24">
          <p class="text-sm font-semibold ${priceClass}">${isDiscount ? '-' : ''}RM ${formatCurrency(Math.abs(price))}</p>
        </div>
      </div>
    `;
  }).join('');

  const specsHtml = isPrimaryHardware ? `
    <div class="px-3 py-3 flex gap-3 items-start">
      <div class="flex-1">
        <div class="text-sm font-medium text-slate-900 leading-snug space-y-3 text-left warranties-print-compact">
          <div>
            <strong>Solar Panel Product Warranty:</strong><br>
            Beginning on the Warranty Start Date and for the Limited Product Warranty Period, Panel manufacturer warrants that the Module and its respective DC connectors and cables (hereinafter referred to as the "Products") will be free from material defects in workmanship which impair the performance of the Products. Material defects shall not include changes in appearance or normal wear and tear of the Products.
          </div>
          <div>
            <strong>Solar Panel Power Warranty (12 Year Product Warranty 30 Year Linear Power Warranty):</strong><br>
            Beginning on Warranty Start Date and for the first year following the Warranty Start Date, Panel manufacturer warrants that the Degradation Rate of Modules shall not exceed the applicable First Year Degradation Rate; for each year after the first year, the Degradation Rate of Modules shall not exceed the applicable Annual Degradation Rate, as set forth at Table below.
          </div>
        </div>
      </div>
      <div class="text-right w-24"></div>
    </div>
  ` : '';

  html = html.replace('<!-- Items will be rendered here via JavaScript -->', itemsHtml + specsHtml);

  // 4. Clean up the script tag since it's not needed for the PDF generator
  html = html.replace(/<script>[\s\S]*?<\/script>/, '');

  return html;
}
