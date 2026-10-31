import React from 'react';
import { FeeInvoice, SchoolSettings } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';

export interface PrintFeeVoucherProps {
  invoice: FeeInvoice;
  settings: SchoolSettings;
}

export const PrintFeeVoucher: React.FC<PrintFeeVoucherProps> = ({ invoice, settings }) => {
  const copies = ['BANK COPY', 'SCHOOL COPY', 'STUDENT COPY'];

  const student = invoice.enrollment?.student;
  const section = invoice.enrollment?.section;
  const cls = section?.class;
  const sessionName = invoice.academic_session?.name || (invoice.enrollment as any)?.academic_session?.name;

  const originalTotal = Number(invoice.total_amount || 0);
  const discountAmount = Number(invoice.discount_amount || 0);
  const netPayable = Number(invoice.net_amount || 0);
  const paidAmount = Number(invoice.paid_amount || 0);
  const remainingBalance = Math.max(0, netPayable - paidAmount);

  return (
    <div className="w-full bg-white text-slate-900 p-4 font-sans text-xs">
      <div className="voucher-grid grid grid-cols-1 md:grid-cols-3 gap-4 border-2 border-slate-300 p-2">
        {copies.map((copyName, idx) => (
          <div
            key={idx}
            className={`flex flex-col justify-between p-3 ${
              idx < 2 ? 'md:border-r-2 md:border-dashed md:border-slate-300' : ''
            }`}
          >
            {/* Header */}
            <div className="text-center border-b border-slate-300 pb-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-300 inline-block mb-1">
                {copyName}
              </span>
              <h2 className="text-xs font-bold text-navy-950 uppercase">{settings.school_name}</h2>
              <p className="text-[9px] text-slate-500">A/C # 0123-45678901-03 (Habib Bank Ltd)</p>
            </div>

            {/* Challan / Student Meta */}
            <div className="space-y-1 mb-3 text-[11px]">
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">Challan #:</span>
                <span className="font-bold text-navy-900">{invoice.invoice_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Month / Session:</span>
                <span className="font-semibold">
                  {invoice.billing_month} {sessionName ? `(${sessionName})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Due Date:</span>
                <span className="font-bold text-rose-700">{formatDate(invoice.due_date)}</span>
              </div>
              <div className="border-t border-slate-200 my-1" />
              <div className="flex justify-between">
                <span className="text-slate-600">Student:</span>
                <span className="font-bold truncate max-w-[130px]">{student?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Adm #:</span>
                <span className="font-mono">{student?.admission_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Class & Roll:</span>
                <span>
                  {cls?.name || 'Class 9'} ({section?.name || 'A'}) - Roll #{invoice.enrollment?.roll_no}
                </span>
              </div>
            </div>

            {/* Itemized Table */}
            <table className="w-full text-left text-[10px] border border-slate-300 mb-2">
              <thead className="bg-slate-100 font-semibold border-b border-slate-300">
                <tr>
                  <th className="p-1">Particulars</th>
                  <th className="p-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, i) => (
                    <tr key={i}>
                      <td className="p-1">
                        {item.description}
                        {item.is_waived && (
                          <span className="ml-1 px-1 py-0.2 bg-emerald-100 text-emerald-800 text-[8px] font-semibold rounded">
                            FREE / WAIVED
                          </span>
                        )}
                      </td>
                      <td className="p-1 text-right font-mono">
                        {item.is_waived && Number(item.amount) === 0 ? (
                          <span className="text-emerald-700 font-semibold">FREE</span>
                        ) : (
                          formatCurrency(item.amount)
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-1">Monthly Tuition Fee</td>
                    <td className="p-1 text-right font-mono">{formatCurrency(invoice.total_amount)}</td>
                  </tr>
                )}

                {/* Subtotals & Adjustments */}
                <tr className="bg-slate-50 font-medium">
                  <td className="p-1 text-slate-700">Original Total</td>
                  <td className="p-1 text-right font-mono">{formatCurrency(originalTotal)}</td>
                </tr>

                {discountAmount > 0 && (
                  <tr className="text-emerald-700">
                    <td className="p-1">
                      Discount / Waiver
                      {invoice.discount_reason && (
                        <span className="block text-[8px] text-emerald-600 truncate max-w-[150px]">
                          Reason: {invoice.discount_reason}
                        </span>
                      )}
                    </td>
                    <td className="p-1 text-right font-mono font-medium">-{formatCurrency(discountAmount)}</td>
                  </tr>
                )}

                <tr className="bg-slate-100 font-bold border-t border-slate-300">
                  <td className="p-1 text-navy-950">Final Payable (within due date)</td>
                  <td className="p-1 text-right font-mono text-navy-950">{formatCurrency(netPayable)}</td>
                </tr>

                {paidAmount > 0 && (
                  <>
                    <tr className="text-emerald-700">
                      <td className="p-1 font-medium">Amount Already Paid</td>
                      <td className="p-1 text-right font-mono">{formatCurrency(paidAmount)}</td>
                    </tr>
                    <tr className="bg-rose-50 font-bold text-rose-800">
                      <td className="p-1">Remaining Balance</td>
                      <td className="p-1 text-right font-mono">{formatCurrency(remainingBalance)}</td>
                    </tr>
                  </>
                )}

                <tr className="text-rose-700 text-[9px]">
                  <td className="p-1">After Due Date (Late Surcharge Rs. 200)</td>
                  <td className="p-1 text-right font-mono">{formatCurrency(netPayable + 200)}</td>
                </tr>
              </tbody>
            </table>

            {/* Notes if present */}
            {invoice.notes && (
              <div className="mb-2 p-1 bg-slate-50 border border-slate-200 rounded text-[9px] text-slate-600">
                <b>Notes:</b> {invoice.notes}
              </div>
            )}

            {/* Bank Stamp and Signature */}
            <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-end text-[9px] text-slate-500">
              <div className="w-24 h-10 border border-slate-300 rounded flex items-center justify-center text-center text-slate-400 text-[8px]">
                Bank Cashier Stamp
              </div>
              <div className="text-center">
                <div className="w-20 border-b border-slate-400 mb-1" />
                <span>Authorized Sign</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
