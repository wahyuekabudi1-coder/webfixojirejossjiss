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
      // Setup PDFKit document strictly formatted for exactly 1 page A4
      const doc = new PDFDocument({
        size: 'A4',
        margin: 28,
        bufferPages: true,
        autoFirstPage: true,
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
      const leftMargin = 32;
      const rightMargin = pageWidth - 32; // 563.28 pt
      const contentWidth = rightMargin - leftMargin; // 531.28 pt

      // =========================================================================
      // 1. HEADER (KIRI: Logo Resmi Smart Journey, KANAN: Informasi Perusahaan)
      // =========================================================================
      const headerTopY = 28;
      const logoPath = path.join(process.cwd(), 'public', 'logo.png');

      if (fs.existsSync(logoPath)) {
        // Logo resmi Smart Journey: proporsional 1:1, tidak stretch / distorsi
        doc.image(logoPath, leftMargin, headerTopY, { fit: [56, 56] });
      } else {
        // Fallback typography branding jika logo file tidak ditemukan
        doc.font('Helvetica-Bold').fontSize(15).fillColor(primaryTeal).text('SMART JOURNEY', leftMargin, headerTopY + 10);
        doc.font('Helvetica').fontSize(8.5).fillColor(mutedSlate).text('Go Beyond', leftMargin, headerTopY + 28);
      }

      // KANAN: Data Resmi Perusahaan Smart Journey
      const companyX = 260;
      const companyW = rightMargin - companyX;

      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(darkSlate)
        .text('Smart Journey', companyX, headerTopY, { width: companyW, align: 'right' });

      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryTeal)
        .text('PT Sawah Jaya Trans', companyX, headerTopY + 13, { width: companyW, align: 'right' });

      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text('Hub Operasional: Malang & Denpasar Bali', companyX, headerTopY + 24, { width: companyW, align: 'right' });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate)
        .text('Jl. Puntadewa No. 192, Tumpang, Malang, Jawa Timur', companyX, headerTopY + 34, { width: companyW, align: 'right' });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate)
        .text('WhatsApp: +62 852-1234-7289  |  Email: Info@sawahjayatrans.com', companyX, headerTopY + 44, { width: companyW, align: 'right' });

      doc.font('Helvetica-Bold').fontSize(7.2).fillColor(primaryTeal)
        .text('www.smartjourney.id', companyX, headerTopY + 54, { width: companyW, align: 'right' });

      // Separator Garis Branding
      const sepY = 88;
      doc.strokeColor(borderSlate).lineWidth(0.8).moveTo(leftMargin, sepY).lineTo(rightMargin, sepY).stroke();
      doc.strokeColor(primaryTeal).lineWidth(2).moveTo(leftMargin, sepY).lineTo(leftMargin + 80, sepY).stroke();

      // =========================================================================
      // 2. JUDUL DOKUMEN & STATUS BADGE
      // =========================================================================
      const titleY = 96;

      // Judul Utama: INVOICE
      doc.font('Helvetica-Bold').fontSize(20).fillColor(darkSlate)
        .text('INVOICE', leftMargin, titleY, { characterSpacing: 0.8 });

      // Status Badge: PAID vs PENDING
      const isPaid = (data.paymentStatus || '').toLowerCase() === 'paid';
      const badgeW = 90;
      const badgeH = 22;
      const badgeX = rightMargin - badgeW;

      const badgeBg = isPaid ? paidGreenBg : '#fef3c7';
      const badgeBorder = isPaid ? paidGreenBorder : '#f59e0b';
      const badgeText = isPaid ? paidGreenText : '#b45309';

      doc.roundedRect(badgeX, titleY + 1, badgeW, badgeH, 4).fill(badgeBg);
      doc.roundedRect(badgeX, titleY + 1, badgeW, badgeH, 4).strokeColor(badgeBorder).lineWidth(1).stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(badgeText)
        .text(isPaid ? '✓ PAID' : 'PENDING', badgeX, titleY + 7, { width: badgeW, align: 'center' });

      // Subtitle 1: Dynamic Trip Category (OPEN TRIP / SHARE TOUR vs PRIVATE TOUR)
      const rawTrip = data.trip as any;
      const isSharedTrip = rawTrip?.type === 'shared' || 
        (data.trip.package || '').toLowerCase().includes('open trip') || 
        (data.trip.title || '').toLowerCase().includes('open trip') ||
        (data.trip.package || '').toLowerCase().includes('share tour');
      const tripCategorySubtitle = isSharedTrip ? 'OPEN TRIP / SHARE TOUR' : 'PRIVATE TOUR';

      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryTeal)
        .text(tripCategorySubtitle, leftMargin, titleY + 24, { characterSpacing: 0.5 });

      // Subtitle 2: Booking Summary & Payment Receipt
      doc.font('Helvetica').fontSize(8).fillColor(mutedSlate)
        .text(isPaid ? 'Official Booking Confirmation & Receipt' : 'Official Booking Invoice & Payment Details', leftMargin, titleY + 37);

      const invoiceNum = data.invoiceNumber || `INV-${data.bookingCode}`;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate)
        .text(`Invoice No: ${invoiceNum}`, companyX, titleY + 34, { width: companyW, align: 'right' });

      // =========================================================================
      // 3. BOOKING INFORMATION CARD (Data Aktual Dinamis)
      // =========================================================================
      const cardY = 146;
      const cardH = 66;
      doc.roundedRect(leftMargin, cardY, contentWidth, cardH, 5).fill(bgCard);
      doc.roundedRect(leftMargin, cardY, contentWidth, cardH, 5).strokeColor(borderSlate).lineWidth(0.8).stroke();

      const col1X = leftMargin + 12;
      const col2X = leftMargin + (contentWidth / 2) + 6;
      const labelW = 76;
      const valW1 = (contentWidth / 2) - labelW - 16;
      const valW2 = (contentWidth / 2) - labelW - 16;

      // Baris 1: Invoice No. & Customer Name
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Invoice No.', col1X, cardY + 8);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkSlate).text(invoiceNum, col1X + labelW, cardY + 8, { width: valW1 });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Customer', col2X, cardY + 8);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkSlate).text(data.customer.name || '-', col2X + labelW, cardY + 8, { width: valW2 });

      // Baris 2: Booking ID & Nationality
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Booking ID', col1X, cardY + 22);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryTeal).text(data.bookingCode, col1X + labelW, cardY + 22, { width: valW1 });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Nationality', col2X, cardY + 22);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(data.customer.nationality || 'Indonesia (Domestic)', col2X + labelW, cardY + 22, { width: valW2 });

      // Baris 3: Booking Date & No. of Pax
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Booking Date', col1X, cardY + 36);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(data.bookingDate || '-', col1X + labelW, cardY + 36, { width: valW1 });

      const guestCount = data.trip.participantsCount || (data.trip.participantsNames ? data.trip.participantsNames.length : 1);
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('No. of Pax', col2X, cardY + 36);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkSlate).text(`${guestCount} Pax`, col2X + labelW, cardY + 36, { width: valW2 });

      // Baris 4: Travel Date & Fleet / Package Info
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Travel Date', col1X, cardY + 50);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkSlate).text(data.trip.departureDate || '-', col1X + labelW, cardY + 50, { width: valW1 });

      const fleetText = `${data.trip.title}${data.trip.vehicleName ? ' • ' + data.trip.vehicleName : ''}`;
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Tour / Fleet', col2X, cardY + 50);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(fleetText, col2X + labelW, cardY + 50, { width: valW2, ellipsis: true });

      // =========================================================================
      // 4. INVOICE ITEMS TABLE (WAJIB DINAMIS: No. | Description | Qty | Unit Price | Amount)
      // =========================================================================
      let curY = 220;

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

        if (data.payment.uniqueCode && data.payment.uniqueCode > 0) {
          const hasUnique = lineItems.some(it => 
            it.description.toLowerCase().includes('unique') || 
            it.description.toLowerCase().includes('kode unik')
          );
          if (!hasUnique) {
            lineItems.push({
              no: lineItems.length + 1,
              description: 'Payment Verification Code (Kode Unik Pembayaran Otomatis)',
              qty: '1 Transaksi',
              unitPrice: data.payment.uniqueCode,
              amount: data.payment.uniqueCode
            });
          }
        }
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

      // Definisi Lebar Kolom Tabel (Total = contentWidth)
      const colNoW = 28;
      const colDescW = 280;
      const colQtyW = 46;
      const colUnitW = 84;
      const colAmtW = contentWidth - (colNoW + colDescW + colQtyW + colUnitW); // 93.28 pt

      const colNoX = leftMargin;
      const colDescX = colNoX + colNoW;
      const colQtyX = colDescX + colDescW;
      const colUnitX = colQtyX + colQtyW;
      const colAmtX = colUnitX + colUnitW;

      const headerH = 20;
      doc.rect(leftMargin, curY, contentWidth, headerH).fill('#f1f5f9');
      doc.rect(leftMargin, curY, contentWidth, headerH).strokeColor(borderSlate).lineWidth(0.8).stroke();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkSlate);
      doc.text('No.', colNoX, curY + 6, { width: colNoW, align: 'center' });
      doc.text('Description', colDescX + 8, curY + 6, { width: colDescW - 12, align: 'left' });
      doc.text('Qty', colQtyX, curY + 6, { width: colQtyW, align: 'center' });
      doc.text('Unit Price', colUnitX, curY + 6, { width: colUnitW - 8, align: 'right' });
      doc.text('Amount', colAmtX, curY + 6, { width: colAmtW - 8, align: 'right' });

      curY += headerH;

      // Render Baris-Baris Items (Proportional height for 1 page layout)
      lineItems.forEach((item, index) => {
        const rowH = 20;

        // Alternating background
        if (index % 2 === 1) {
          doc.rect(leftMargin, curY, contentWidth, rowH).fill('#fafbfd');
        }
        doc.rect(leftMargin, curY, contentWidth, rowH).strokeColor(borderSlate).lineWidth(0.5).stroke();

        const textY = curY + 6;
        doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate)
          .text(String(item.no || index + 1), colNoX, textY, { width: colNoW, align: 'center' });

        doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate)
          .text(item.description, colDescX + 8, textY, { width: colDescW - 14, ellipsis: true });

        doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate)
          .text(String(item.qty), colQtyX, textY, { width: colQtyW, align: 'center' });

        doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate)
          .text(formatRupiah(item.unitPrice), colUnitX, textY, { width: colUnitW - 8, align: 'right' });

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkSlate)
          .text(formatRupiah(item.amount), colAmtX, textY, { width: colAmtW - 8, align: 'right' });

        curY += rowH;
      });

      // =========================================================================
      // 5. TOTAL SECTION & PAYMENT INFORMATION
      // =========================================================================
      curY += 10;

      const blockTopY = curY;
      const leftColW = 270;
      const rightColW = contentWidth - leftColW - 12; // 249.28 pt
      const rightColX = leftMargin + leftColW + 12;

      // KIRI: PAYMENT INFORMATION
      const payBoxH = 88;
      doc.roundedRect(leftMargin, blockTopY, leftColW, payBoxH, 5).fill(bgCard);
      doc.roundedRect(leftMargin, blockTopY, leftColW, payBoxH, 5).strokeColor(borderSlate).lineWidth(0.8).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor(primaryTeal)
        .text('PAYMENT INFORMATION', leftMargin + 10, blockTopY + 7);

      const payLabelW = 86;
      const payValW = leftColW - payLabelW - 18;

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Payment Method', leftMargin + 10, blockTopY + 22);
      doc.font('Helvetica-Bold').fontSize(7.2).fillColor(darkSlate)
        .text(data.payment.paymentMethod || 'Bank Transfer / QRIS', leftMargin + payLabelW, blockTopY + 22, { width: payValW });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Payment Provider', leftMargin + 10, blockTopY + 35);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text(data.payment.paymentProvider || 'ArtoPay Gateway', leftMargin + payLabelW, blockTopY + 35, { width: payValW });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Payment Reference', leftMargin + 10, blockTopY + 48);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text(data.payment.paymentReference || data.payment.paymentId || data.bookingCode, leftMargin + payLabelW, blockTopY + 48, { width: payValW, ellipsis: true });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Payment Date', leftMargin + 10, blockTopY + 61);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text(data.payment.paymentDate || data.payment.paidAt || '-', leftMargin + payLabelW, blockTopY + 61, { width: payValW });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Payment Status', leftMargin + 10, blockTopY + 74);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(paidGreen)
        .text(isPaid ? 'PAID (Lunas Terverifikasi)' : 'PENDING', leftMargin + payLabelW, blockTopY + 74, { width: payValW });

      // KANAN: TOTAL SECTION (Subtotal, Discount, Total)
      const subtotal = lineItems.reduce((sum, it) => sum + Number(it.amount || 0), 0);
      const discount = data.payment.discount || 0;
      const finalTotal = data.payment.totalPaid || (subtotal - discount);

      doc.roundedRect(rightColX, blockTopY, rightColW, payBoxH, 5).fill('#ffffff');
      doc.roundedRect(rightColX, blockTopY, rightColW, payBoxH, 5).strokeColor(borderSlate).lineWidth(0.8).stroke();

      const totLabelW = 75;
      const totValW = rightColW - totLabelW - 18;

      // Subtotal
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Subtotal', rightColX + 10, blockTopY + 10);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate)
        .text(formatRupiah(subtotal), rightColX + totLabelW, blockTopY + 10, { width: totValW, align: 'right' });

      // Discount
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Discount', rightColX + 10, blockTopY + 25);
      doc.font('Helvetica').fontSize(8).fillColor(discount > 0 ? '#dc2626' : bodySlate)
        .text(discount > 0 ? ('- ' + formatRupiah(discount)) : 'Rp 0', rightColX + totLabelW, blockTopY + 25, { width: totValW, align: 'right' });

      // Divider sebelum Total
      doc.strokeColor(borderSlate).lineWidth(0.5)
        .moveTo(rightColX + 10, blockTopY + 40).lineTo(rightColX + rightColW - 10, blockTopY + 40).stroke();

      // Highlight Box Total
      const totalBoxY = blockTopY + 46;
      const totalBoxH = 34;
      doc.roundedRect(rightColX + 8, totalBoxY, rightColW - 16, totalBoxH, 4).fill(paidGreenBg);
      doc.roundedRect(rightColX + 8, totalBoxY, rightColW - 16, totalBoxH, 4).strokeColor(paidGreenBorder).lineWidth(1).stroke();

      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(paidGreenText)
        .text('TOTAL', rightColX + 16, totalBoxY + 11);

      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(paidGreenText)
        .text(formatRupiah(finalTotal), rightColX + totLabelW, totalBoxY + 10, { width: totValW - 6, align: 'right' });

      curY = blockTopY + payBoxH + 10;

      // =========================================================================
      // 6. TERMS & NOTES (Resmi & Relevan Smart Journey)
      // =========================================================================
      const notesH = data.notes ? 68 : 58;
      doc.roundedRect(leftMargin, curY, contentWidth, notesH, 5).fill('#ffffff');
      doc.roundedRect(leftMargin, curY, contentWidth, notesH, 5).strokeColor(borderSlate).lineWidth(0.8).stroke();

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryTeal)
        .text('TERMS & NOTES', leftMargin + 10, curY + 6);

      doc.font('Helvetica').fontSize(6.5).fillColor(bodySlate)
        .text('1. Dokumen invoice ini merupakan bukti konfirmasi pemesanan dan tanda terima pembayaran resmi yang sah dari Smart Journey (PT Sawah Jaya Trans).', leftMargin + 10, curY + 18)
        .text('2. Rincian penjemputan dan armada telah terjadwal secara resmi. Harap siap di lokasi penjemputan 15 menit sebelum waktu keberangkatan.', leftMargin + 10, curY + 28)
        .text('3. Dokumen ini dapat ditunjukkan langsung kepada pengemudi / tim penjemputan resmi Smart Journey saat hari keberangkatan.', leftMargin + 10, curY + 38)
        .text('4. Bantuan operasional & perubahan jadwal dapat dikonfirmasikan melalui WhatsApp resmi Smart Journey di +62 852-1234-7289.', leftMargin + 10, curY + 48);

      if (data.notes) {
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor(darkSlate)
          .text(`Catatan Khusus Tamu: ${data.notes}`, leftMargin + 10, curY + 57, { width: contentWidth - 20, ellipsis: true });
      }

      // =========================================================================
      // 7. FOOTER PADA SATU HALAMAN A4 (Fixed at bottom within safe margins)
      // =========================================================================
      const footerY = 770;

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

      // Footer Kanan: Kontak Web, Invoice Code, Validitas 1 Halaman
      const vHash = data.verificationHash || `SJ-VERIFIED-${data.bookingCode}`;
      doc.font('Helvetica').fontSize(6.8).fillColor(mutedSlate)
        .text(`Email: Info@sawahjayatrans.com  |  Web: www.smartjourney.id`, 280, footerY + 6, { width: rightMargin - 280, align: 'right' });

      doc.font('Helvetica').fontSize(6.8).fillColor(mutedSlate)
        .text(`Kode Verifikasi: ${vHash}  •  Dokumen Resmi Sah (1 Halaman A4)`, 280, footerY + 16, { width: rightMargin - 280, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
