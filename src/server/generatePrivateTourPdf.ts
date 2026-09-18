import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

export interface InvoiceLineItem {
  no?: number;
  description: string;
  qty: number | string;
  unitPrice: number;
  amount: number;
}

export interface FinalSummaryPdfInput {
  invoiceNumber?: string;
  bookingCode: string;
  bookingDate: string;
  bookingStatus: string;
  paymentStatus: string;
  confirmedAt?: string;
  verificationCode?: string;
  verificationHash?: string;
  notes?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    nationality?: string;
    pickupLocation: string;
    dropoffLocation?: string;
  };
  pickup?: {
    location: string;
    date?: string;
    time?: string;
  };
  trip: {
    title: string;
    package: string;
    departureDate: string;
    duration: string;
    participantsCount: number;
    participantsNames: string[];
    participantsManifest?: Array<{ name: string; nationality?: string }>;
    vehicleName: string;
    pickupLocation: string;
    dropoffLocation?: string;
    itinerary?: any[];
  };
  items?: InvoiceLineItem[];
  payment: {
    baseAmount: number;
    uniqueCode: number;
    discount?: number;
    totalPaid: number;
    currency: string;
    paidAt: string;
    paymentDate: string;
    paymentId: string;
    paymentMethod: string;
    paymentProvider?: string;
    paymentReference?: string;
  };
  company?: {
    name: string;
    legalName: string;
    brand: string;
    address: string;
    cityCountry: string;
    phone: string;
    email: string;
    website: string;
  };
}

function formatRupiah(amount: number): string {
  return 'Rp ' + Math.max(0, Math.round(amount || 0)).toLocaleString('id-ID');
}

export function generatePrivateTourPdf(data: FinalSummaryPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        bufferPages: true,
        info: {
          Title: `SmartJourney-Final-Booking-${data.bookingCode}`,
          Author: 'Smart Journey (PT Sawah Jaya Trans)',
          Subject: 'INVOICE - PRIVATE TOUR - Booking Summary & Payment Receipt',
          Keywords: 'Smart Journey, Invoice, Private Tour, Booking Summary, Payment Receipt, Official'
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Color Palette: Smart Journey Premium Corporate Identity
      const primaryTeal = '#0f766e';      // Brand Deep Teal
      const darkSlate = '#0f172a';        // Headings / Primary Text
      const bodySlate = '#334155';        // Body Text
      const mutedSlate = '#64748b';       // Secondary Labels
      const borderSlate = '#e2e8f0';      // Subtle Borders
      const bgCard = '#f8fafc';           // Slate 50 Soft Card Background
      const paidGreen = '#16a34a';        // Emerald Green Status
      const paidGreenBg = '#ecfdf5';      // Emerald 50
      const paidGreenBorder = '#10b981';  // Emerald 500
      const paidGreenText = '#065f46';    // Emerald 800

      const pageWidth = 595.28;
      const contentWidth = pageWidth - 72; // 523.28 pt
      const leftMargin = 36;
      const rightMargin = pageWidth - 36;  // 559.28 pt

      // =========================================================================
      // 1. HEADER (KIRI: Logo Resmi Smart Journey, KANAN: Informasi Perusahaan)
      // =========================================================================
      const headerTopY = 36;
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');

      if (fs.existsSync(logoPath)) {
        // Logo resmi Smart Journey: proporsional 1:1, tidak stretch / distorsi
        doc.image(logoPath, leftMargin, headerTopY, { fit: [64, 64] });
      } else {
        // Fallback typography branding jika logo file tidak ditemukan
        doc.font('Helvetica-Bold').fontSize(16).fillColor(primaryTeal).text('SMART JOURNEY', leftMargin, headerTopY + 12);
        doc.font('Helvetica').fontSize(9).fillColor(mutedSlate).text('Go Beyond', leftMargin, headerTopY + 32);
      }

      // KANAN: Data Resmi Perusahaan Smart Journey (Existing Project Data)
      const companyX = 260;
      const companyW = rightMargin - companyX;

      doc.font('Helvetica-Bold').fontSize(11).fillColor(darkSlate)
        .text('Smart Journey', companyX, headerTopY, { width: companyW, align: 'right' });

      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryTeal)
        .text('PT Sawah Jaya Trans', companyX, headerTopY + 14, { width: companyW, align: 'right' });

      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate)
        .text('Jl. Puntadewa No. 192, Tumpang, Malang, Jawa Timur', companyX, headerTopY + 26, { width: companyW, align: 'right' });

      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate)
        .text('Email: Info@sawahjayatrans.com  |  WhatsApp: +62 852-1234-7289', companyX, headerTopY + 38, { width: companyW, align: 'right' });

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryTeal)
        .text('www.smartjourney.id', companyX, headerTopY + 50, { width: companyW, align: 'right' });

      // Separator Garis Branding
      const sepY = 108;
      doc.strokeColor(borderSlate).lineWidth(1).moveTo(leftMargin, sepY).lineTo(rightMargin, sepY).stroke();
      doc.strokeColor(primaryTeal).lineWidth(2.5).moveTo(leftMargin, sepY).lineTo(leftMargin + 90, sepY).stroke();

      // =========================================================================
      // 2. JUDUL DOKUMEN & STATUS BADGE
      // =========================================================================
      const titleY = 120;

      // Judul Utama: INVOICE
      doc.font('Helvetica-Bold').fontSize(22).fillColor(darkSlate)
        .text('INVOICE', leftMargin, titleY, { characterSpacing: 1 });

      // Subtitle 1: PRIVATE TOUR
      doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryTeal)
        .text('PRIVATE TOUR', leftMargin, titleY + 26, { characterSpacing: 0.5 });

      // Subtitle 2: Booking Summary & Payment Receipt
      doc.font('Helvetica').fontSize(8.5).fillColor(mutedSlate)
        .text('Booking Summary & Payment Receipt', leftMargin, titleY + 41);

      // Status Badge: PAID (Hanya jika backend menyatakan lunas)
      const isPaid = (data.paymentStatus || '').toLowerCase() === 'paid';
      const badgeW = 96;
      const badgeH = 24;
      const badgeX = rightMargin - badgeW;

      doc.roundedRect(badgeX, titleY + 2, badgeW, badgeH, 4).fill(paidGreenBg);
      doc.roundedRect(badgeX, titleY + 2, badgeW, badgeH, 4).strokeColor(paidGreenBorder).lineWidth(1).stroke();
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(paidGreenText)
        .text(isPaid ? '✓ PAID' : 'PENDING', badgeX, titleY + 9, { width: badgeW, align: 'center' });

      const invoiceNum = data.invoiceNumber || `INV-${data.bookingCode}`;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text(`Invoice No: ${invoiceNum}`, companyX, titleY + 36, { width: companyW, align: 'right' });

      // =========================================================================
      // 3. BOOKING INFORMATION CARD (Data Aktual Dinamis)
      // =========================================================================
      const cardY = 176;
      const cardH = 78;
      doc.roundedRect(leftMargin, cardY, contentWidth, cardH, 6).fill(bgCard);
      doc.roundedRect(leftMargin, cardY, contentWidth, cardH, 6).strokeColor(borderSlate).lineWidth(0.8).stroke();

      const col1X = leftMargin + 14;
      const col2X = leftMargin + (contentWidth / 2) + 6;
      const labelW = 82;
      const valW1 = (contentWidth / 2) - labelW - 20;
      const valW2 = (contentWidth / 2) - labelW - 20;

      // Baris 1: Invoice No. & Customer Name
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Invoice No.', col1X, cardY + 10);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text(invoiceNum, col1X + labelW, cardY + 10, { width: valW1 });

      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Customer', col2X, cardY + 10);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text(data.customer.name || '-', col2X + labelW, cardY + 10, { width: valW2 });

      // Baris 2: Booking ID & Nationality
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Booking ID', col1X, cardY + 26);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryTeal).text(data.bookingCode, col1X + labelW, cardY + 26, { width: valW1 });

      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Nationality', col2X, cardY + 26);
      doc.font('Helvetica').fontSize(8).fillColor(bodySlate).text(data.customer.nationality || 'Indonesia (Domestic)', col2X + labelW, cardY + 26, { width: valW2 });

      // Baris 3: Booking Date & No. of Pax
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Booking Date', col1X, cardY + 42);
      doc.font('Helvetica').fontSize(8).fillColor(bodySlate).text(data.bookingDate || '-', col1X + labelW, cardY + 42, { width: valW1 });

      const guestCount = data.trip.participantsCount || (data.trip.participantsNames ? data.trip.participantsNames.length : 1);
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('No. of Pax', col2X, cardY + 42);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text(`${guestCount} Pax`, col2X + labelW, cardY + 42, { width: valW2 });

      // Baris 4: Travel Date & Fleet / Package Info
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Travel Date', col1X, cardY + 58);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text(data.trip.departureDate || '-', col1X + labelW, cardY + 58, { width: valW1 });

      const fleetText = `${data.trip.title}${data.trip.vehicleName ? ' • ' + data.trip.vehicleName : ''}`;
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Tour / Fleet', col2X, cardY + 58);
      doc.font('Helvetica').fontSize(8).fillColor(bodySlate).text(fleetText, col2X + labelW, cardY + 58, { width: valW2, ellipsis: true });

      // =========================================================================
      // 4. INVOICE ITEMS TABLE (WAJIB DINAMIS: No. | Description | Qty | Unit Price | Amount)
      // =========================================================================
      let curY = 268;

      // Resolusi Dynamic Line Items dari Data Booking Aktual
      let lineItems: InvoiceLineItem[] = [];

      if (Array.isArray(data.items) && data.items.length > 0) {
        lineItems = data.items.map((it, idx) => ({
          no: it.no || idx + 1,
          description: it.description || 'Private Tour Service Item',
          qty: it.qty ?? 1,
          unitPrice: Number(it.unitPrice) || 0,
          amount: Number(it.amount) || (Number(it.qty || 1) * Number(it.unitPrice || 0))
        }));
      } else {
        // Fallback dinamis dari spesifikasi booking & snapshot aktual
        const paxCount = guestCount || 1;
        const baseAmount = data.payment.baseAmount || data.payment.totalPaid;
        const packageDesc = `${data.trip.title}${data.trip.package ? ' - ' + data.trip.package : ''}`;
        const fleetDetail = data.trip.vehicleName ? ` (Fleet: ${data.trip.vehicleName})` : '';

        lineItems.push({
          no: 1,
          description: `${packageDesc}${fleetDetail}`,
          qty: paxCount > 1 ? `${paxCount} Pax` : '1 Package',
          unitPrice: paxCount > 1 ? Math.round(baseAmount / paxCount) : baseAmount,
          amount: baseAmount
        });

        if (data.payment.uniqueCode && data.payment.uniqueCode > 0) {
          lineItems.push({
            no: 2,
            description: 'Payment Verification Code (Kode Unik Pembayaran Otomatis)',
            qty: '1 Transaksi',
            unitPrice: data.payment.uniqueCode,
            amount: data.payment.uniqueCode
          });
        }
      }

      // Definisi Lebar Kolom Tabel (Total = 523.28 pt = contentWidth)
      const colNoW = 32;
      const colDescW = 275;
      const colQtyW = 45;
      const colUnitW = 82;
      const colAmtW = contentWidth - (colNoW + colDescW + colQtyW + colUnitW); // 89.28 pt

      const colNoX = leftMargin;
      const colDescX = colNoX + colNoW;
      const colQtyX = colDescX + colDescW;
      const colUnitX = colQtyX + colQtyW;
      const colAmtX = colUnitX + colUnitW;

      function renderTableHeader(yPos: number) {
        const headerH = 22;
        doc.rect(leftMargin, yPos, contentWidth, headerH).fill('#f1f5f9');
        doc.rect(leftMargin, yPos, contentWidth, headerH).strokeColor(borderSlate).lineWidth(0.8).stroke();

        doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate);
        doc.text('No.', colNoX, yPos + 6, { width: colNoW, align: 'center' });
        doc.text('Description', colDescX + 8, yPos + 6, { width: colDescW - 12, align: 'left' });
        doc.text('Qty', colQtyX, yPos + 6, { width: colQtyW, align: 'center' });
        doc.text('Unit Price', colUnitX, yPos + 6, { width: colUnitW - 8, align: 'right' });
        doc.text('Amount', colAmtX, yPos + 6, { width: colAmtW - 8, align: 'right' });

        return yPos + headerH;
      }

      curY = renderTableHeader(curY);

      // Render Baris-Baris Items
      lineItems.forEach((item, index) => {
        // Hitung ketinggian baris secara dinamis agar description panjang wrap dengan rapi
        doc.font('Helvetica').fontSize(8);
        const textH = doc.heightOfString(item.description, { width: colDescW - 16 });
        const rowH = Math.max(24, textH + 12);

        // Pagination jika item sangat banyak
        if (curY + rowH > 700) {
          doc.addPage();
          curY = renderTableHeader(36);
        }

        // Alternating background
        if (index % 2 === 1) {
          doc.rect(leftMargin, curY, contentWidth, rowH).fill('#fafbfd');
        }

        doc.rect(leftMargin, curY, contentWidth, rowH).strokeColor(borderSlate).lineWidth(0.5).stroke();

        const textY = curY + 7;
        doc.font('Helvetica').fontSize(8).fillColor(mutedSlate)
          .text(String(item.no || index + 1), colNoX, textY, { width: colNoW, align: 'center' });

        doc.font('Helvetica').fontSize(8).fillColor(darkSlate)
          .text(item.description, colDescX + 8, textY, { width: colDescW - 16, align: 'left' });

        doc.font('Helvetica').fontSize(8).fillColor(bodySlate)
          .text(String(item.qty), colQtyX, textY, { width: colQtyW, align: 'center' });

        doc.font('Helvetica').fontSize(8).fillColor(bodySlate)
          .text(formatRupiah(item.unitPrice), colUnitX, textY, { width: colUnitW - 8, align: 'right' });

        doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate)
          .text(formatRupiah(item.amount), colAmtX, textY, { width: colAmtW - 8, align: 'right' });

        curY += rowH;
      });

      // =========================================================================
      // 5. TOTAL SECTION & PAYMENT INFORMATION
      // =========================================================================
      curY += 14;

      // Pastikan ada ruang cukup sebelum halaman bawah
      if (curY + 120 > 720) {
        doc.addPage();
        curY = 40;
      }

      const blockTopY = curY;
      const leftColW = 270;
      const rightColW = contentWidth - leftColW - 14; // 239.28 pt
      const rightColX = leftMargin + leftColW + 14;

      // KIRI: PAYMENT INFORMATION (Data Pembayaran Tersimpan Backend)
      const payBoxH = 94;
      doc.roundedRect(leftMargin, blockTopY, leftColW, payBoxH, 6).fill(bgCard);
      doc.roundedRect(leftMargin, blockTopY, leftColW, payBoxH, 6).strokeColor(borderSlate).lineWidth(0.8).stroke();

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryTeal)
        .text('PAYMENT INFORMATION', leftMargin + 12, blockTopY + 8);

      const payLabelW = 88;
      const payValW = leftColW - payLabelW - 20;

      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Payment Method', leftMargin + 12, blockTopY + 24);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkSlate)
        .text(data.payment.paymentMethod || 'Bank Transfer / QRIS', leftMargin + payLabelW, blockTopY + 24, { width: payValW });

      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Payment Provider', leftMargin + 12, blockTopY + 38);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate)
        .text(data.payment.paymentProvider || 'ArtoPay Gateway', leftMargin + payLabelW, blockTopY + 38, { width: payValW });

      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Payment Reference', leftMargin + 12, blockTopY + 52);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate)
        .text(data.payment.paymentReference || data.payment.paymentId || data.bookingCode, leftMargin + payLabelW, blockTopY + 52, { width: payValW, ellipsis: true });

      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Payment Date', leftMargin + 12, blockTopY + 66);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate)
        .text(data.payment.paymentDate || data.payment.paidAt || '-', leftMargin + payLabelW, blockTopY + 66, { width: payValW });

      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Payment Status', leftMargin + 12, blockTopY + 80);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(paidGreen)
        .text(isPaid ? 'PAID (Lunas Terverifikasi)' : 'PENDING', leftMargin + payLabelW, blockTopY + 80, { width: payValW });

      // KANAN: TOTAL SECTION (Subtotal, Discount, Total)
      const subtotal = lineItems.reduce((sum, it) => sum + Number(it.amount || 0), 0);
      const discount = data.payment.discount || 0;
      const finalTotal = data.payment.totalPaid || (subtotal - discount);

      doc.roundedRect(rightColX, blockTopY, rightColW, payBoxH, 6).fill('#ffffff');
      doc.roundedRect(rightColX, blockTopY, rightColW, payBoxH, 6).strokeColor(borderSlate).lineWidth(0.8).stroke();

      const totLabelW = 80;
      const totValW = rightColW - totLabelW - 20;

      // Subtotal
      doc.font('Helvetica').fontSize(8).fillColor(mutedSlate).text('Subtotal', rightColX + 12, blockTopY + 12);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text(formatRupiah(subtotal), rightColX + totLabelW, blockTopY + 12, { width: totValW, align: 'right' });

      // Discount
      doc.font('Helvetica').fontSize(8).fillColor(mutedSlate).text('Discount', rightColX + 12, blockTopY + 28);
      doc.font('Helvetica').fontSize(8.5).fillColor(discount > 0 ? '#dc2626' : bodySlate)
        .text(discount > 0 ? ('- ' + formatRupiah(discount)) : 'Rp 0', rightColX + totLabelW, blockTopY + 28, { width: totValW, align: 'right' });

      // Divider sebelum Total
      doc.strokeColor(borderSlate).lineWidth(0.5)
        .moveTo(rightColX + 12, blockTopY + 44).lineTo(rightColX + rightColW - 12, blockTopY + 44).stroke();

      // Highlight Box Total
      const totalBoxY = blockTopY + 50;
      const totalBoxH = 34;
      doc.roundedRect(rightColX + 8, totalBoxY, rightColW - 16, totalBoxH, 4).fill(paidGreenBg);
      doc.roundedRect(rightColX + 8, totalBoxY, rightColW - 16, totalBoxH, 4).strokeColor(paidGreenBorder).lineWidth(1).stroke();

      doc.font('Helvetica-Bold').fontSize(10).fillColor(paidGreenText)
        .text('TOTAL', rightColX + 18, totalBoxY + 11);

      doc.font('Helvetica-Bold').fontSize(11).fillColor(paidGreenText)
        .text(formatRupiah(finalTotal), rightColX + totLabelW, totalBoxY + 10, { width: totValW - 6, align: 'right' });

      curY = blockTopY + payBoxH + 12;

      // =========================================================================
      // 6. TERMS & NOTES (Resmi & Relevan Smart Journey)
      // =========================================================================
      const notesH = data.notes ? 72 : 62;
      if (curY + notesH > 740) {
        doc.addPage();
        curY = 40;
      }

      doc.roundedRect(leftMargin, curY, contentWidth, notesH, 6).fill('#ffffff');
      doc.roundedRect(leftMargin, curY, contentWidth, notesH, 6).strokeColor(borderSlate).lineWidth(0.8).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryTeal)
        .text('TERMS & NOTES', leftMargin + 12, curY + 7);

      doc.font('Helvetica').fontSize(6.8).fillColor(bodySlate)
        .text('1. Dokumen invoice ini merupakan bukti konfirmasi pemesanan dan tanda terima pembayaran resmi yang sah dari Smart Journey (PT Sawah Jaya Trans).', leftMargin + 12, curY + 20)
        .text('2. Rincian penjemputan dan armada telah terjadwal secara resmi. Harap siap di lokasi penjemputan 15 menit sebelum waktu keberangkatan.', leftMargin + 12, curY + 30)
        .text('3. Dokumen ini dapat ditunjukkan langsung kepada pengemudi / tim penjemputan resmi Smart Journey saat hari keberangkatan.', leftMargin + 12, curY + 40)
        .text('4. Bantuan operasional & perubahan jadwal dapat dikonfirmasikan melalui WhatsApp resmi Smart Journey di +62 852-1234-7289.', leftMargin + 12, curY + 50);

      if (data.notes) {
        doc.font('Helvetica-Bold').fontSize(6.8).fillColor(darkSlate)
          .text(`Catatan Khusus Tamu: ${data.notes}`, leftMargin + 12, curY + 60, { width: contentWidth - 24, ellipsis: true });
      }

      // =========================================================================
      // 7. FOOTER PADA SETIAP HALAMAN (Multi-page Safe via bufferedPageRange)
      // =========================================================================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const footerY = 800;

        // Garis Pembatas Footer
        doc.strokeColor(borderSlate).lineWidth(0.8)
          .moveTo(leftMargin, footerY).lineTo(rightMargin, footerY).stroke();

        // Footer Kiri: Branding, Legalitas, Hotline
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryTeal)
          .text('SMART JOURNEY', leftMargin, footerY + 6, { continued: true })
          .font('Helvetica').fillColor(mutedSlate)
          .text('  •  Go Beyond  •  PT Sawah Jaya Trans (Lisensi Resmi Biro Perjalanan Wisata)', { align: 'left' });

        doc.font('Helvetica').fontSize(6.8).fillColor(mutedSlate)
          .text('Hub Operasional: Malang & Denpasar Bali  |  Hotline 24/7: +62 852-1234-7289', leftMargin, footerY + 16);

        // Footer Kanan: Kontak Web, Invoice Code, Pagination
        const vHash = data.verificationHash || `SJ-VERIFIED-${data.bookingCode}`;
        const pageText = range.count > 1 ? `Hal. ${i + 1} dari ${range.count}` : 'Dokumen Resmi Sah';
        doc.font('Helvetica').fontSize(6.8).fillColor(mutedSlate)
          .text(`Email: Info@sawahjayatrans.com  |  Web: www.smartjourney.id`, 300, footerY + 6, { width: rightMargin - 300, align: 'right' });

        doc.font('Helvetica').fontSize(6.8).fillColor(mutedSlate)
          .text(`Kode Verifikasi: ${vHash}  •  ${pageText}`, 300, footerY + 16, { width: rightMargin - 300, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
