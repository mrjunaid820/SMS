import React from 'react';
import { FeePayment, FeeInvoice, SchoolSettings } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

export interface PrintReceiptProps {
  payment: FeePayment;
  invoice: FeeInvoice;
  settings: SchoolSettings;
}

export const PrintReceipt: React.FC<PrintReceiptProps> = ({ payment, invoice, settings }) => {
  const student = invoice.enrollment?.student;
  const section = invoice.enrollment?.section;
  const cls = section?.class;

  return (
    <div className="max-w-md mx-auto bg-white text-slate-900 border-2 border-slate-300 rounded-xl p-6 font-sans text-xs shadow-sm">
      {/* Header */}
      <div className="text-center border-b border-slate-200 pb-3 mb-3">
        <div className="flex items-center justify-center gap-1.5 text-emerald-600 mb-1">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">OFFICIAL PAYMENT RECEIPT</span>
        </div>
        <h2 className="text-base font-bold text-navy-950 uppercase">{settings.school_name}</h2>
        <p className="text-[10px] text-slate-500">{settings.address}</p>
        <p className="text-[10px] text-slate-500">Ph: {settings.phone}</p>
      </div>

      {/* Details */}
      <div className="space-y-1.5 mb-4 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Receipt Number:</span>
          <span className="font-mono font-bold text-navy-900">{payment.receipt_no}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Payment Date:</span>
          <span className="font-medium">{formatDate(payment.payment_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Invoice Number:</span>
          <span className="font-mono">{invoice.invoice_no}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Billing Month:</span>
          <span className="font-semibold">{invoice.billing_month}</span>
        </div>
        <div className="border-t border-slate-100 my-1.5" />
        <div className="flex justify-between">
          <span className="text-slate-500">Student Name:</span>
          <span className="font-bold">{student?.full_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Admission No:</span>
          <span className="font-mono">{student?.admission_no}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Class & Roll No:</span>
          <span>
            {cls?.name || 'Class 9'} - {section?.name || 'A'} (Roll #{invoice.enrollment?.roll_no})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Payment Mode:</span>
          <span className="font-semibold">{payment.payment_method}</span>
        </div>
        {payment.reference_no && (
          <div className="flex justify-between">
            <span className="text-slate-500">Reference / Slip #:</span>
            <span className="font-mono text-slate-700">{payment.reference_no}</span>
          </div>
        )}
      </div>

      {/* Amount Box */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center mb-4">
        <span className="text-[11px] uppercase font-semibold text-emerald-800">Amount Paid</span>
        <div className="text-xl font-bold font-mono text-emerald-700">
          {formatCurrency(payment.amount)}
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-slate-50 rounded-lg p-2.5 text-[11px] space-y-1 mb-6 border border-slate-200">
        <div className="flex justify-between">
          <span className="text-slate-500">Total Invoice Amount:</span>
          <span className="font-mono">{formatCurrency(invoice.net_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Total Paid So Far:</span>
          <span className="font-mono font-semibold text-emerald-700">{formatCurrency(invoice.paid_amount)}</span>
        </div>
        <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
          <span>Remaining Dues:</span>
          <span className="font-mono text-rose-700">
            {formatCurrency(Math.max(0, Number(invoice.net_amount) - Number(invoice.paid_amount)))}
          </span>
        </div>
      </div>

      {/* Signature */}
      <div className="flex justify-between items-end pt-2 text-[10px] text-slate-400">
        <p>Computer Generated Receipt</p>
        <div className="text-center">
          <div className="w-24 border-b border-slate-400 mb-1" />
          <span className="text-slate-600 font-semibold">Accounts Officer</span>
        </div>
      </div>
    </div>
  );
};
