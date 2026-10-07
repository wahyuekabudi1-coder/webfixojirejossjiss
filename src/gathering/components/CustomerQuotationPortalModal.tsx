import React, { useState, useEffect } from 'react';
import { 
  Building2, Calendar, Users, MapPin, CheckCircle2, Clock, 
  AlertCircle, FileText, X, Check, ArrowRight, ShieldCheck,
  Send, RefreshCw, Printer, DollarSign, Download, MessageSquare
} from 'lucide-react';
import { 
  GatheringQuotation, 
  GatheringQuotationVersion,
  PackageSnapshot 
} from '../types';
import { 
  fetchGatheringQuotationById, 
  apiApproveGatheringQuotation, 
  apiRevisionGatheringQuotation 
} from '../gatheringStore';

interface CustomerQuotationPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuotationId?: string;
  initialToken?: string;
  formatPrice?: (usd: number, idr: number) => string;
}

export default function CustomerQuotationPortalModal({
  isOpen,
  onClose,
  initialQuotationId = '',
  initialToken = '',
  formatPrice
}: CustomerQuotationPortalModalProps) {
  const [searchId, setSearchId] = useState(initialQuotationId);
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [quotation, setQuotation] = useState<GatheringQuotation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Revision state
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // Approval state
  const [isApproving, setIsApproving] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

  useEffect(() => {
    if (initialQuotationId) {
      setSearchId(initialQuotationId);
      loadQuotation(initialQuotationId, initialToken);
    }
  }, [initialQuotationId, initialToken]);

  const loadQuotation = async (id: string, token?: string) => {
    if (!id.trim()) {
      setError('Silakan masukkan nomor quotation atau ID penawaran.');
      return;
    }
    setLoading(true);
    setError('');
    setActionSuccessMsg('');

    try {
      const q = await fetchGatheringQuotationById(id.trim(), token?.trim());
      if (!q) {
        setError('Penawaran tidak ditemukan. Pastikan nomor quotation atau ID permintaan sudah benar.');
        setQuotation(null);
      } else {
        setQuotation(q);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat penawaran.');
      setQuotation(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadQuotation(searchId, tokenInput);
  };

  const handleApprove = async () => {
    if (!quotation) return;
    if (!confirm('Apakah Anda yakin ingin menyetujui penawaran ini? Setelah disetujui, reservasi resmi akan dibuat di sistem operasional Smart Journey.')) {
      return;
    }

    setIsApproving(true);
    setError('');
    setActionSuccessMsg('');

    try {
      const res = await apiApproveGatheringQuotation(quotation.id, tokenInput);
      setQuotation(res.quotation);
      setConfirmedBooking(res.booking);
      setActionSuccessMsg(res.message || 'Penawaran berhasil disetujui! Booking resmi telah diterbitkan.');
    } catch (err: any) {
      setError(err.message || 'Gagal menyetujui penawaran.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSubmitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotation || !revisionNotes.trim()) {
      setError('Catatan revisi wajib diisi.');
      return;
    }

    setIsSubmittingRevision(true);
    setError('');

    try {
      await apiRevisionGatheringQuotation(quotation.id, revisionNotes.trim(), tokenInput);
      setQuotation(prev => prev ? { ...prev, status: 'REVISION_REQUESTED' } : null);
      setIsRevisionMode(false);
      setRevisionNotes('');
      setActionSuccessMsg('Permintaan revisi berhasil dikirim ke Admin. Tim Smart Journey akan menerbitkan versi penawaran terbaru untuk Anda.');
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim revisi.');
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  if (!isOpen) return null;

  const currentSnapshot: PackageSnapshot | null = quotation?.packageSnapshot || null;
  const lineItems = quotation?.versions && quotation.versions.length > 0 
    ? quotation.versions[quotation.versions.length - 1].lineItems 
    : (currentSnapshot?.lineItems || []);

  const itinerary = currentSnapshot?.itinerary || [];
  const included = currentSnapshot?.included || [];
  const excluded = currentSnapshot?.excluded || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Portal Penawaran Resmi (Quotation Portal)</h2>
              <p className="text-xs text-slate-400">Verifikasi, telaah rincian, dan setujui proposal Event & Gathering</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Search Header if not loaded */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nomor Quotation / ID Penawaran
                </label>
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Contoh: QUO-EG-2026-1234 atau EGQ-..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Token Verifikasi (Opsional)
                </label>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="tok_..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span>Cari Penawaran</span>
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {actionSuccessMsg && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span className="font-medium">{actionSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Quotation Detail View */}
          {quotation && (
            <div className="space-y-6">
              {/* Top Meta Card */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-mono">
                        {quotation.quotationNumber || quotation.id}
                      </span>
                      {quotation.currentVersion && quotation.currentVersion > 1 && (
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          Versi V{quotation.currentVersion}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">
                      {quotation.packageName || 'Paket Corporate Gathering'}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {quotation.status === 'APPROVED' || quotation.status === 'CONFIRMED' ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resmi Disetujui (Approved)</span>
                      </span>
                    ) : quotation.status === 'REVISION_REQUESTED' ? (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Menunggu Revisi Admin</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Proposal Aktif (Siap Disetujui)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Perusahaan / Klien:</span>
                    <span className="font-bold text-slate-800 text-sm">{quotation.company || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Nama PIC:</span>
                    <span className="font-bold text-slate-800 text-sm">{quotation.picName || quotation.customerName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Tanggal Acara:</span>
                    <span className="font-bold text-slate-800 text-sm">{quotation.eventDate || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-medium">Peserta / Quota:</span>
                    <span className="font-bold text-slate-800 text-sm">{quotation.participants || `${quotation.participantCount} Pax`}</span>
                  </div>
                </div>

                {/* Validity Note */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Masa Berlaku Penawaran Hingga: <strong>{quotation.validUntil}</strong></span>
                  </span>
                  {quotation.bookingId && (
                    <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                      Booking Code: {quotation.bookingId}
                    </span>
                  )}
                </div>
              </div>

              {/* Itinerary Preview */}
              {itinerary.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>Rencana Perjalanan (Itinerary Snapshot)</span>
                  </h4>
                  <div className="space-y-3">
                    {itinerary.map((day, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-100">
                        <span className="font-bold text-slate-800 block mb-1">
                          Hari {day.day}: {day.title}
                        </span>
                        {day.activities && day.activities.length > 0 ? (
                          <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                            {day.activities.map((act, aIdx) => (
                              <li key={aIdx}>{act}</li>
                            ))}
                          </ul>
                        ) : day.desc ? (
                          <p className="text-slate-600">{day.desc}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inclusions & Exclusions */}
              {(included.length > 0 || excluded.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {included.length > 0 && (
                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                      <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                        <Check className="w-4 h-4" />
                        <span>Fasilitas Termasuk (Included)</span>
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {included.map((item, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {excluded.length > 0 && (
                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                      <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                        <X className="w-4 h-4" />
                        <span>Tidak Termasuk (Excluded)</span>
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {excluded.map((item, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5">
                            <span className="text-rose-500 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Line Items & Pricing Breakdown */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                  <span>Rincian Biaya Penawaran Resmi</span>
                </h4>

                {lineItems.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Uraian / Layanan</th>
                          <th className="py-2 px-3 text-center">Jumlah</th>
                          <th className="py-2 px-3 text-right">Harga Satuan</th>
                          <th className="py-2 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lineItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800">{item.name}</span>
                              {item.description && (
                                <span className="block text-[11px] text-slate-500">{item.description}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-700">{item.quantity}</td>
                            <td className="py-2.5 px-3 text-right text-slate-700 font-mono">
                              Rp {item.unitPrice.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                              Rp {item.subtotal.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 flex justify-between items-center">
                    <span>Estimasi Harga per Pax ({quotation.participants})</span>
                    <span className="font-bold text-sm text-slate-900 font-mono">
                      Rp {quotation.pricePerPaxIDR.toLocaleString('id-ID')} / Pax
                    </span>
                  </div>
                )}

                {/* Summary Table */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-end space-y-1.5 text-xs">
                  {quotation.subtotal && quotation.subtotal > 0 && (
                    <div className="flex justify-between w-64 text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono font-medium">Rp {quotation.subtotal.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {quotation.discount && quotation.discount > 0 && (
                    <div className="flex justify-between w-64 text-emerald-600">
                      <span>Diskon Khusus:</span>
                      <span className="font-mono font-medium">- Rp {quotation.discount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {quotation.additionalCost && quotation.additionalCost > 0 && (
                    <div className="flex justify-between w-64 text-slate-600">
                      <span>Biaya Tambahan:</span>
                      <span className="font-mono font-medium">+ Rp {quotation.additionalCost.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between w-64 pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                    <span>TOTAL KONTRAK:</span>
                    <span className="text-base text-amber-600 font-mono">
                      Rp {(quotation.grandTotal || quotation.totalPriceIDR).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Harga final mengikat sesuai syarat dan ketentuan tertera.</span>
                </div>
              </div>

              {/* Terms and Notes */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-xs text-slate-600 space-y-2">
                <span className="font-bold text-slate-800 block">Syarat & Ketentuan Berlaku:</span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                  <li>Down Payment (DP) 30% dibayarkan saat konfirmasi booking resmi.</li>
                  <li>Pelunasan sisa 70% dilakukan paling lambat H-3 sebelum pelaksanaan.</li>
                  <li>Penyesuaian peserta di atas batas toleransi akan dihitung ulang secara proporsional.</li>
                  <li>Smart Journey Corporate berhak menyesuaikan rute apabila terjadi force majeure demi keselamatan rombongan.</li>
                </ul>
              </div>

              {/* Revision Form Mode */}
              {isRevisionMode ? (
                <form onSubmit={handleSubmitRevision} className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center space-x-1.5">
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                    <span>Form Pengajuan Revisi Penawaran</span>
                  </h4>
                  <p className="text-xs text-amber-700">
                    Sampaikan penyesuaian yang diinginkan (misal: pengurangan fasilitas, perubahan tanggal, penyesuaian menu gala dinner, atau penyesuaian anggaran).
                  </p>
                  <textarea
                    rows={3}
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    placeholder="Tuliskan catatan revisi Anda di sini..."
                    className="w-full p-2.5 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsRevisionMode(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingRevision}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      {isSubmittingRevision ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Kirim Permintaan Revisi</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Action Buttons */
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Butuh konsultasi langsung? Hubungi tim reservasi di WhatsApp.
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    {quotation.status !== 'APPROVED' && quotation.status !== 'CONFIRMED' && (
                      <button
                        onClick={() => setIsRevisionMode(true)}
                        className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 rounded-xl text-xs font-bold transition-colors"
                      >
                        Ajukan Revisi
                      </button>
                    )}

                    {quotation.status !== 'APPROVED' && quotation.status !== 'CONFIRMED' ? (
                      <button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {isApproving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Setujui Penawaran & Buat Booking</span>
                      </button>
                    ) : (
                      <div className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Penawaran Ini Telah Resmi Menjadi Booking</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
