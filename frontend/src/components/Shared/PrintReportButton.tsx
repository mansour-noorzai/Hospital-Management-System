import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import { usePreferences, type HospitalBranding } from '@/providers/PreferencesProvider';

export interface ReportField {
  label: string;
  value: unknown;
}

export interface ReportTable {
  title?: string;
  columns: string[];
  rows: unknown[][];
}

export interface PrintableReport {
  title: string;
  subtitle?: string;
  reference?: string;
  fields?: ReportField[];
  tables?: ReportTable[];
  notes?: string;
  footer?: string;
}

interface PrintReportButtonProps {
  report: PrintableReport;
  label?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderFields(fields: ReportField[] = []) {
  if (!fields.length) return '';
  return `<dl class="fields">${fields.map((field) => `
    <div><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(field.value)}</dd></div>`).join('')}
  </dl>`;
}

function renderTables(tables: ReportTable[] = []) {
  return tables.map((table) => `
    <section class="table-section">
      ${table.title ? `<h2>${escapeHtml(table.title)}</h2>` : ''}
      <table>
        <thead><tr>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
        <tbody>${table.rows.length
          ? table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${Math.max(table.columns.length, 1)}" class="empty">No records</td></tr>`}
        </tbody>
      </table>
    </section>`).join('');
}

// eslint-disable-next-line react-refresh/only-export-components
export function openPrintableReport(
  report: PrintableReport,
  hospital?: HospitalBranding,
  dir: 'ltr' | 'rtl' = 'ltr',
) {
  const printWindow = window.open('', '_blank', 'width=980,height=760');
  if (!printWindow) {
    window.alert('Please allow pop-ups to print or save this report as PDF.');
    return;
  }
  printWindow.opener = null;

  const hospitalName = hospital?.name || hospital?.systemName || 'Hospital Management System';
  const generatedAt = new Date().toLocaleString();
  const contact = [hospital?.address, hospital?.phone, hospital?.email, hospital?.website]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
  <html dir="${dir}"><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; print-color-adjust: exact; }
    body { margin: 0; color: #172033; font-family: Arial, "Noto Sans Arabic", sans-serif; font-size: 12px; line-height: 1.55; }
    header { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; border-bottom: 2px solid ${escapeHtml(hospital?.primaryColor || '#0f766e')}; }
    header img { width: 62px; height: 62px; object-fit: contain; }
    header h1 { margin: 0; font-size: 21px; }
    header p { margin: 2px 0 0; color: #5b6578; }
    .report-head { display: flex; justify-content: space-between; gap: 20px; margin: 18px 0; }
    .report-head h2 { margin: 0; font-size: 18px; }
    .report-head p { margin: 3px 0 0; color: #64748b; }
    .meta { text-align: end; color: #64748b; white-space: nowrap; }
    .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; border: 1px solid #d7dde7; border-radius: 8px; overflow: hidden; margin: 0 0 18px; }
    .fields div { padding: 8px 10px; border-bottom: 1px solid #e4e8ef; }
    .fields div:nth-child(odd) { border-inline-end: 1px solid #e4e8ef; }
    .fields dt { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
    .fields dd { margin: 2px 0 0; font-weight: 600; overflow-wrap: anywhere; white-space: pre-wrap; }
    .table-section { margin-top: 18px; break-inside: avoid; }
    .table-section h2 { margin: 0 0 7px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 7px 8px; border: 1px solid #d7dde7; text-align: start; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #eef4f5; color: #263246; font-size: 10px; text-transform: uppercase; }
    tr { break-inside: avoid; }
    .notes { margin-top: 18px; padding: 11px; border: 1px solid #d7dde7; border-radius: 8px; white-space: pre-wrap; }
    footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #d7dde7; color: #64748b; text-align: center; font-size: 10px; }
    .empty { text-align: center; color: #64748b; }
    @media print { body { -webkit-print-color-adjust: exact; } }
  </style></head><body>
    <header>
      ${hospital?.logoUrl ? `<img src="${escapeHtml(hospital.logoUrl)}" alt="Hospital logo">` : ''}
      <div><h1>${escapeHtml(hospitalName)}</h1>${contact ? `<p>${contact}</p>` : ''}</div>
    </header>
    <div class="report-head"><div><h2>${escapeHtml(report.title)}</h2>${report.subtitle ? `<p>${escapeHtml(report.subtitle)}</p>` : ''}</div>
      <div class="meta">${report.reference ? `<div>Reference: ${escapeHtml(report.reference)}</div>` : ''}<div>Generated: ${escapeHtml(generatedAt)}</div></div>
    </div>
    ${renderFields(report.fields)}
    ${renderTables(report.tables)}
    ${report.notes ? `<div class="notes"><strong>Notes</strong><br>${escapeHtml(report.notes)}</div>` : ''}
    <footer>${escapeHtml(report.footer || hospital?.invoiceFooter || hospitalName)}</footer>
  </body></html>`);
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 350);
}

export function PrintReportButton({
  report,
  label = 'Print / Save PDF',
  size = 'sm',
  variant = 'outline',
  className,
}: PrintReportButtonProps) {
  const { hospital, dir } = usePreferences();
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      title="Print or choose Save as PDF"
      onClick={() => openPrintableReport(report, hospital, dir)}
    >
      <FontAwesomeIcon icon={faPrint} className={label ? 'me-1.5' : undefined} />
      {label}
    </Button>
  );
}
