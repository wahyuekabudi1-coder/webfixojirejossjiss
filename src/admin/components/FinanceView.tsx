import React, { useState } from 'react';
import { 
  CreditCard, Receipt, TrendingUp, FileText, Download, 
  CheckCircle2, AlertTriangle, Clock, RefreshCw, Send, DollarSign,
  ShieldCheck, ArrowUpRight, BarChart3, Search, Terminal
} from 'lucide-react';
import { UnifiedBookingDetail } from '../../components/admin/BookingDetailModal';
import { Booking } from '../../types';

interface FinanceViewProps {
  bookings: UnifiedBookingDetail[];
  activeTab: 'payments' | 'invoices' | 'revenue' | 'reports';
  setActiveTab: (tab: 'payments' | 'invoices' | 'revenue' | 'reports') => void;
  formatPrice: (usd: number, idr: number) => string;
  theme: any;
  isDark?: boolean;
  triggerToast: (msg: string) => void;
  onOpenDetail: (booking: UnifiedBookingDetail) => void;
}

export default function FinanceView({
  bookings,
  activeTab,
  setActiveTab,
  formatPrice,
  theme,
  isDark = false,
  triggerToast,
  onOpenDetail
}: FinanceViewProps) {
  // Sandbox Simulator State
  const [sandboxBookingId, setSandboxBookingId] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [searchInvoice, setSearchInvoice] = useState('');

  // Total Revenues
  const paidBookings = bookings.filter(b => (b.paymentStatus || '').toLowerCase() === 'paid');
  
  const totalRevenueIDR = paidBookings.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);
  const totalRevenueUSD = paidBookings.reduce((sum, b) => sum + (b.totalAmountUSD || 0), 0);

  // Revenue per Service
  const revenueByService = {
    tour: paidBookings.filter(b => b.serviceType === 'tour').reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0),
    sharetour: paidBookings.filter(b => b.serviceType === 'sharetour').reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0),
    airport: paidBookings.filter(b => b.serviceType === 'airport').reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0),
    taxi: paidBookings.filter(b => b.serviceType === 'taxi').reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0),
    rental: paidBookings.filter(b => b.serviceType === 'car-rental' || b.serviceType === 'rental').reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0)
  };

  // Handler for Sandbox Webhook Simulation
  const handleSimulateWebhook = async () => {
    if (!sandboxBookingId.trim()) {
      triggerToast('Pilih atau masukkan ID booking untuk simulasi.');
      return;
    }

    setIsSimulating(true);
    try {
      const res = await fetch('/api/artopay/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: sandboxBookingId.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Simulasi gagal');
      }

      triggerToast(`Simulasi Sukses! Booking #${sandboxBookingId} terverifikasi Paid via Sandbox ArtoPay.`);
    } catch (err: any) {
      triggerToast(`Gagal: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // Invoices list (filtered by search)
  const invoicesList = paidBookings.filter(b => {
    if (!searchInvoice.trim()) return true;
    const q = searchInvoice.toLowerCase();
    return b.bookingCode.toLowerCase().includes(q) ||
      b.customerName.toLowerCase().includes(q) ||
      b.serviceTitle.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <DollarSign className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-tight font-sans">
                KEUANGAN &amp; ARUS PEMBAYARAN (FINANCE)
              </h2>
              <p className={`text-xs ${theme.textSecondary}`}>
                Audit transaksi ArtoPay, verifikasi kode unik pembayaran, arsip faktur/invoice resmi, dan laporan buku besar.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            const csvRows = [
              ['ID Booking', 'Layanan', 'Pelanggan', 'Tanggal Bayar', 'Jumlah IDR', 'Kode Unik', 'Status']
            ];
            paidBookings.forEach(b => {
              csvRows.push([
                `"${b.bookingCode}"`,
                `"${b.serviceType}"`,
                `"${b.customerName}"`,
                `"${b.paidAt || '-'}"`,
                `"${b.totalAmountIDR || 0}"`,
                `"${b.uniqueCode || 0}"`,
                `"${b.paymentStatus}"`
              ]);
            });
            const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `smartjourney_finance_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            triggerToast('Buku Besar Keuangan berhasil diunduh');
          }}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <Download className="h-4 w-4" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* FINANCE SUB-NAV */}
      <div className="flex items-center gap-2 border-b border-neutral-700/40 pb-2">
        {[
          { id: 'payments' as const, label: 'Pembayaran & ArtoPay', icon: CreditCard },
          { id: 'invoices' as const, label: 'Faktur & Invoices', icon: Receipt },
          { id: 'revenue' as const, label: 'Analisis Pendapatan (Revenue)', icon: TrendingUp },
          { id: 'reports' as const, label: 'Laporan Keuangan', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? isDark
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold shadow-xs'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-700 font-extrabold shadow-xs'
                  : isDark
                    ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-transparent'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. VIEW: PAYMENTS & ARTOPAY GATEWAY */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* SANDBOX PAYMENT SIMULATION TOOL */}
          <div className={`${theme.card} border rounded-2xl p-5 space-y-4 shadow-sm border-amber-500/30`}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono bg-amber-500/15 text-amber-500 font-black px-2 py-0.5 rounded border border-amber-500/30">
                  DEVELOPER / SANDBOX TOOL
                </span>
                <h3 className="text-sm font-black font-sans text-neutral-100">
                  Simulasi Webhook Pembayaran Sukses (ArtoPay Sandbox Only)
                </h3>
                <p className="text-xs text-neutral-400">
                  Simulasikan panggilan callback webhook ArtoPay untuk memverifikasi flow: Pending Payment → ArtoPay Webhook → Paid → Pending Confirmation.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <div className="relative flex-grow w-full">
                <input
                  type="text"
                  value={sandboxBookingId}
                  onChange={(e) => setSandboxBookingId(e.target.value)}
                  placeholder="Masukkan Kode Booking / ID Booking (misal: SJ-TB-1234)..."
                  className={`w-full ${theme.input} px-4 py-2.5 rounded-xl text-xs font-mono`}
                />
              </div>

              <button
                disabled={isSimulating}
                onClick={handleSimulateWebhook}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shrink-0"
              >
                {isSimulating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Kirim Simulasi Webhook</span>
              </button>
            </div>
          </div>

          {/* RECENT PAYMENT LOGS TABLE */}
          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="p-4 border-b border-neutral-700/40">
              <h4 className="text-xs font-black uppercase tracking-wider font-mono text-neutral-300">
                AUDIT TRANSAKSI &amp; PEMBAYARAN TERBARU
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                  <tr>
                    <th className="p-3.5">Kode Transaksi</th>
                    <th className="p-3.5">Layanan</th>
                    <th className="p-3.5">Nama Pelanggan</th>
                    <th className="p-3.5 text-right">Nilai Tagihan</th>
                    <th className="p-3.5 text-center">Kode Unik</th>
                    <th className="p-3.5 text-center">Status Pembayaran</th>
                    <th className="p-3.5">Waktu Pembayaran</th>
                    <th className="p-3.5 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {bookings.slice(0, 15).map((item) => {
                    const isPaid = (item.paymentStatus || '').toLowerCase() === 'paid';

                    return (
                      <tr key={item.id} className={`${theme.hover} transition-colors`}>
                        <td className="p-3.5 font-mono font-bold text-amber-500">
                          #{item.bookingCode}
                        </td>
                        <td className="p-3.5 font-semibold text-neutral-300">
                          {item.serviceTitle}
                        </td>
                        <td className="p-3.5 font-bold text-neutral-100">
                          {item.customerName}
                        </td>
                        <td className="p-3.5 font-mono font-black text-right text-neutral-100">
                          {item.totalAmountIDR 
                            ? `Rp ${Number(item.totalAmountIDR).toLocaleString('id-ID')}`
                            : (item.totalAmountUSD ? formatPrice(item.totalAmountUSD, item.totalAmountIDR || 0) : '-')}
                        </td>
                        <td className="p-3.5 text-center font-mono text-amber-400 font-bold">
                          {item.uniqueCode ? `+${item.uniqueCode}` : '-'}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            {item.paymentStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-neutral-400">
                          {item.paidAt ? new Date(item.paidAt).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => onOpenDetail(item)}
                            className="px-2.5 py-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 font-bold text-[11px]"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. VIEW: INVOICES */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchInvoice}
              onChange={(e) => setSearchInvoice(e.target.value)}
              placeholder="Cari nomor invoice, tamu, atau layanan..."
              className={`w-full ${theme.input} pl-9 pr-4 py-2 rounded-xl text-xs`}
            />
          </div>

          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                  <tr>
                    <th className="p-3.5">Nomor Faktur (Invoice)</th>
                    <th className="p-3.5">Kode Booking</th>
                    <th className="p-3.5">Pelanggan</th>
                    <th className="p-3.5">Layanan</th>
                    <th className="p-3.5 text-right">Jumlah Dibayar</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {invoicesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-neutral-500 font-mono">
                        Belum ada invoice transaksi yang lunas / terbayar.
                      </td>
                    </tr>
                  ) : (
                    invoicesList.map((item) => (
                      <tr key={item.id} className={`${theme.hover} transition-colors`}>
                        <td className="p-3.5 font-mono font-bold text-neutral-200">
                          INV-2026-{item.bookingCode.slice(-6)}
                        </td>
                        <td className="p-3.5 font-mono text-amber-500 font-bold">
                          #{item.bookingCode}
                        </td>
                        <td className="p-3.5 font-bold text-neutral-100">
                          {item.customerName}
                        </td>
                        <td className="p-3.5 text-neutral-300">
                          {item.serviceTitle}
                        </td>
                        <td className="p-3.5 font-mono font-black text-right text-emerald-400">
                          Rp {Number(item.totalAmountIDR || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Lunas (Paid)
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => onOpenDetail(item)}
                            className="px-2.5 py-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 text-[11px] font-bold"
                          >
                            Lihat Slip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. VIEW: REVENUE */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className={`${theme.card} border rounded-2xl p-6 space-y-2`}>
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                Total Pendapatan Terverifikasi (IDR)
              </span>
              <div className="text-2xl font-black font-mono text-amber-500">
                Rp {totalRevenueIDR.toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-neutral-400">
                Dari {paidBookings.length} transaksi yang telah lunas via ArtoPay.
              </p>
            </div>

            <div className={`${theme.card} border rounded-2xl p-6 space-y-2`}>
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                Total Pendapatan Terverifikasi (USD)
              </span>
              <div className="text-2xl font-black font-mono text-emerald-400">
                ${totalRevenueUSD.toLocaleString('en-US')} USD
              </div>
              <p className="text-[11px] text-neutral-400">
                Wisatawan mancanegara (WNA Price).
              </p>
            </div>

            <div className={`${theme.card} border rounded-2xl p-6 space-y-2`}>
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                Rata-rata Nilai Pesanan (AOV)
              </span>
              <div className="text-2xl font-black font-mono text-purple-400">
                {paidBookings.length > 0 
                  ? `Rp ${Math.round(totalRevenueIDR / paidBookings.length).toLocaleString('id-ID')}`
                  : 'Rp 0'}
              </div>
              <p className="text-[11px] text-neutral-400">
                Average order value transaksi lunas.
              </p>
            </div>
          </div>

          {/* Revenue Breakdown by Service */}
          <div className={`${theme.card} border rounded-2xl p-6 space-y-4 shadow-sm`}>
            <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 border-b border-neutral-700/40 pb-2">
              DISTRIBUSI PENDAPATAN BERDASARKAN LAYANAN
            </h4>

            <div className="space-y-3 pt-2">
              {[
                { label: 'Private Tour', val: revenueByService.tour, color: 'bg-amber-500' },
                { label: 'Open Trip / Share Tour', val: revenueByService.sharetour, color: 'bg-emerald-500' },
                { label: 'Airport Transfer', val: revenueByService.airport, color: 'bg-blue-500' },
                { label: 'Taxi Point-to-Point', val: revenueByService.taxi, color: 'bg-indigo-500' },
                { label: 'Car Rental & Charter', val: revenueByService.rental, color: 'bg-purple-500' }
              ].map((item, idx) => {
                const percent = totalRevenueIDR > 0 ? Math.round((item.val / totalRevenueIDR) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-neutral-200">{item.label}</span>
                      <span className="font-mono text-neutral-400">
                        Rp {item.val.toLocaleString('id-ID')} ({percent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. VIEW: REPORTS */}
      {activeTab === 'reports' && (
        <div className={`${theme.card} border rounded-2xl p-6 space-y-6 shadow-sm`}>
          <div className="border-b border-neutral-700/40 pb-3">
            <h4 className="text-sm font-black font-sans text-neutral-100">
              LAPORAN KEUANGAN &amp; REKONSILIASI PEMBUKUAN
            </h4>
            <p className="text-xs text-neutral-400">
              Unduh data rekonsiliasi dan laporan laba kotor untuk penutupan buku operasional bulanan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl ${theme.innerCard} border border-neutral-700/40 space-y-3`}>
              <h5 className="text-xs font-bold text-neutral-200">Laporan Transaksi Harian (Daily Sales)</h5>
              <p className="text-[11px] text-neutral-400">
                Daftar semua transaksi yang tercatat hari ini lengkap dengan kode pembayaran dan rincian tamu.
              </p>
              <button
                onClick={() => triggerToast('Laporan harian berhasil diunduh.')}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-neutral-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh Harian (CSV)</span>
              </button>
            </div>

            <div className={`p-4 rounded-xl ${theme.innerCard} border border-neutral-700/40 space-y-3`}>
              <h5 className="text-xs font-bold text-neutral-200">Laporan Bulanan Lengkap (Monthly Closing)</h5>
              <p className="text-[11px] text-neutral-400">
                Rekapitulasi omset kotor, fee supir, dan utilisasi armada bulanan untuk departemen akuntansi.
              </p>
              <button
                onClick={() => triggerToast('Laporan bulanan berhasil diunduh.')}
                className="px-3 py-1.5 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh Bulanan (CSV)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
