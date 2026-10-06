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
      // Setup PDFKit document strictly formatted for exactly 1 page A4 portrait
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

      // =========================================================================
      // PALET WARNA RESMI: SMART JOURNEY EXECUTIVE CORPORATE IDENTITY
      // =========================================================================
      const primaryGreen = '#0f766e';     // Deep Brand Teal / Green (Warna Utama)
      const brandDark = '#064e3b';        // Dark Emerald
      const accentGreen = '#059669';      // Emerald 600
      const darkSlate = '#0f172a';        // Slate 900 (Teks Utama & Heading)
      const bodySlate = '#334155';        // Slate 700 (Teks Body)
      const mutedSlate = '#64748b';       // Slate 500 (Label Deskriptif)
      const borderSlate = '#cbd5e1';      // Slate 300 (Border Container Rapi)
      const lightBorder = '#e2e8f0';      // Slate 200 (Divider Garis Tipis)
      const cardBg = '#f8fafc';           // Slate 50 (Soft Off-White Card Background)
      const paidGreen = '#16a34a';        // Emerald Green Status
      const paidGreenBg = '#ecfdf5';      // Emerald 50 (Highlight Green Background)
      const paidGreenBorder = '#10b981';  // Emerald 500 (Border Hijau)
      const paidGreenText = '#065f46';    // Emerald 800 (Teks Hijau Pekat)

      const pageWidth = 595.28;
      const leftMargin = 32;
      const rightMargin = pageWidth - 32; // 563.28 pt
      const contentWidth = rightMargin - leftMargin; // 531.28 pt

      const logoPath = path.join(process.cwd(), 'public', 'logo.png');

      // =========================================================================
      // WATERMARK (Sangat subtle di area tengah/belakang konten, Opacity 3.5%)
      // =========================================================================
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.opacity(0.035);
        const watermarkSize = 220;
        const watermarkX = (pageWidth - watermarkSize) / 2;
        const watermarkY = 310;
        doc.image(logoPath, watermarkX, watermarkY, { fit: [watermarkSize, watermarkSize] });
        doc.restore();
      }

      // =========================================================================
      // 1. HEADER DOKUMEN: LOGO + NAMA BRAND KUAT + BLOK INFORMASI PERUSAHAAN RAPI
      // =========================================================================
      const headerTopY = 30;

      if (fs.existsSync(logoPath)) {
        // Logo resmi Smart Journey (proporsional 1:1, tajam & elegan)
        doc.image(logoPath, leftMargin, headerTopY, { fit: [50, 50] });

        // Nama Brand Kuat di samping logo
        const brandTextX = leftMargin + 58;
        doc.font('Helvetica-Bold').fontSize(16).fillColor(darkSlate)
          .text('SMART JOURNEY', brandTextX, headerTopY + 4, { characterSpacing: 0.6 });
        
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryGreen)
          .text('PT SAWAH JAYA TRANS', brandTextX, headerTopY + 23, { characterSpacing: 0.4 });

        doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate)
          .text('Official Tour & Travel Operator Indonesia', brandTextX, headerTopY + 36);
      } else {
        // Fallback typography branding jika file logo tidak tersedia
        doc.font('Helvetica-Bold').fontSize(16).fillColor(darkSlate)
          .text('SMART JOURNEY', leftMargin, headerTopY + 4, { characterSpacing: 0.6 });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryGreen)
          .text('PT SAWAH JAYA TRANS', leftMargin, headerTopY + 23, { characterSpacing: 0.4 });
        doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate)
          .text('Official Tour & Travel Operator Indonesia', leftMargin, headerTopY + 36);
      }

      // KANAN: Data Resmi Perusahaan Tersusun Rapi Sebagai Satu Blok Tunggal
      const companyX = 240;
      const companyW = rightMargin - companyX;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(darkSlate)
        .text('PT Sawah Jaya Trans', companyX, headerTopY + 2, { width: companyW, align: 'right' });

      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text('Hub Operasional: Malang & Denpasar Bali', companyX, headerTopY + 14, { width: companyW, align: 'right' });

      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text('Jl. Puntadewa No. 192, Tumpang, Malang, Jawa Timur', companyX, headerTopY + 25, { width: companyW, align: 'right' });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate)
        .text('WhatsApp: +62 852-1234-7289  |  Email: Info@sawahjayatrans.com', companyX, headerTopY + 36, { width: companyW, align: 'right' });

      doc.font('Helvetica-Bold').fontSize(7.2).fillColor(primaryGreen)
        .text('www.smartjourney.id', companyX, headerTopY + 47, { width: companyW, align: 'right' });

      // Separator Garis Branding Elegan (Aksen Hijau + Border Halus)
      const sepY = 88;
      doc.strokeColor(lightBorder).lineWidth(0.8).moveTo(leftMargin, sepY).lineTo(rightMargin, sepY).stroke();
      doc.strokeColor(primaryGreen).lineWidth(2.5).moveTo(leftMargin, sepY).lineTo(leftMargin + 90, sepY).stroke();

      // =========================================================================
      // 2. JUDUL BESAR "INVOICE" & "PRIVATE TOUR" + BADGE PAID MODERN & TEGAS
      // =========================================================================
      const titleY = 98;

      // Judul Utama: INVOICE (Besar & Berwibawa)
      doc.font('Helvetica-Bold').fontSize(22).fillColor(darkSlate)
        .text('INVOICE', leftMargin, titleY, { characterSpacing: 0.8 });

      // Status Badge: PAID Modern & Tegas (Kanan Atas)
      const isPaid = (data.paymentStatus || '').toLowerCase() === 'paid';
      const badgeW = 100;
      const badgeH = 24;
      const badgeX = rightMargin - badgeW;

      const badgeBg = isPaid ? paidGreenBg : '#fef3c7';
      const badgeBorder = isPaid ? paidGreenBorder : '#f59e0b';
      const badgeText = isPaid ? paidGreenText : '#b45309';

      doc.roundedRect(badgeX, titleY + 2, badgeW, badgeH, 5).fill(badgeBg);
      doc.roundedRect(badgeX, titleY + 2, badgeW, badgeH, 5).strokeColor(badgeBorder).lineWidth(1.2).stroke();
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(badgeText)
        .text(isPaid ? '✓ PAID / LUNAS' : 'PENDING PAYMENT', badgeX, titleY + 8, { width: badgeW, align: 'center' });

      // Subtitle 1: Kategori Tur ("PRIVATE TOUR" atau "OPEN TRIP / SHARE TOUR")
      const rawTrip = data.trip as any;
      const isSharedTrip = rawTrip?.type === 'shared' || 
        (data.trip.package || '').toLowerCase().includes('open trip') || 
        (data.trip.title || '').toLowerCase().includes('open trip') ||
        (data.trip.package || '').toLowerCase().includes('share tour');
      const tripCategorySubtitle = isSharedTrip ? 'OPEN TRIP / SHARE TOUR' : 'PRIVATE TOUR';

      // Badge Kategori Minimalis
      const catBadgeW = 95;
      doc.roundedRect(leftMargin, titleY + 26, catBadgeW, 16, 3).fill(paidGreenBg);
      doc.roundedRect(leftMargin, titleY + 26, catBadgeW, 16, 3).strokeColor(paidGreenBorder).lineWidth(0.8).stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(paidGreenText)
        .text(tripCategorySubtitle, leftMargin, titleY + 30, { width: catBadgeW, align: 'center', characterSpacing: 0.4 });

      // Subtitle 2: Booking Summary & Payment Receipt
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate)
        .text('Booking Summary & Payment Receipt', leftMargin + catBadgeW + 8, titleY + 30);

      // Nomor Invoice & Tanggal Terbit di Kanan Bawah Badge
      const invoiceNum = data.invoiceNumber || `INV-${data.bookingCode}`;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text(`Invoice No: ${invoiceNum}`, companyX, titleY + 30, { width: companyW, align: 'right' });

      // =========================================================================
      // 3. BOOKING INFORMATION CARD (Layout Dua Kolom Seimbang, Travel Date Paling Menonjol)
      // =========================================================================
      // Kolom Kiri: Booking ID, Booking Date, Travel Date (Focal Operational Date)
      // Kolom Kanan: Customer, Customer Phone / WhatsApp, Customer Email, Nationality, No. of Pax
      // (Field "Tour / Fleet" dihapus dari sini, nama paket tampil eksklusif pada tabel Description)
      const cardY = 148;
      const cardH = 92;
      
      // Card Container Utama
      doc.roundedRect(leftMargin, cardY, contentWidth, cardH, 6).fill(cardBg);
      doc.roundedRect(leftMargin, cardY, contentWidth, cardH, 6).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Top Accent Header Strip
      doc.rect(leftMargin + 1, cardY, contentWidth - 2, 2.5).fill(primaryGreen);

      // Label Header Container
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryGreen)
        .text('BOOKING INFORMATION', leftMargin + 12, cardY + 7, { characterSpacing: 0.5 });

      // Garis Pembatas Vertikal Dua Kolom
      const midColX = leftMargin + (contentWidth / 2);
      doc.strokeColor(lightBorder).lineWidth(0.6)
        .moveTo(midColX, cardY + 8).lineTo(midColX, cardY + cardH - 8).stroke();

      // --- KOLOM KIRI (3 Field Operasional) ---
      const col1X = leftMargin + 12;
      const labelW1 = 76;
      const valW1 = (contentWidth / 2) - labelW1 - 22;

      // 1. Booking ID
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Booking ID', col1X, cardY + 23);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryGreen).text(data.bookingCode, col1X + labelW1, cardY + 22, { width: valW1 });

      // 2. Booking Date
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Booking Date', col1X, cardY + 40);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(data.bookingDate || '-', col1X + labelW1, cardY + 40, { width: valW1 });

      // 3. Travel Date (FOCAL OPERATIONAL POINT: Paling Menonjol dengan Kontainer Highlight Hijau)
      const travelDateVal = data.trip.departureDate || '-';
      const travelBadgeY = cardY + 58;
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(darkSlate).text('Travel Date', col1X, travelBadgeY + 5);

      const travelBadgeW = Math.min(valW1, 145);
      doc.roundedRect(col1X + labelW1, travelBadgeY, travelBadgeW, 22, 4).fill(paidGreenBg);
      doc.roundedRect(col1X + labelW1, travelBadgeY, travelBadgeW, 22, 4).strokeColor(paidGreenBorder).lineWidth(1).stroke();

      doc.font('Helvetica-Bold').fontSize(9).fillColor(paidGreenText)
        .text(travelDateVal, col1X + labelW1, travelBadgeY + 6, { width: travelBadgeW, align: 'center' });

      // --- KOLOM KANAN (5 Field Informasi Tamu) ---
      const col2X = midColX + 12;
      const labelW2 = 108;
      const valW2 = (contentWidth / 2) - labelW2 - 20;

      const guestCount = data.trip.participantsCount || (data.trip.participantsNames ? data.trip.participantsNames.length : 1);
      const custPhone = (data.customer.phone && data.customer.phone.trim() !== '' && data.customer.phone !== '-') 
        ? data.customer.phone.trim() 
        : '-';
      const custEmail = (data.customer.email && data.customer.email.trim() !== '' && data.customer.email !== '-') 
        ? data.customer.email.trim() 
        : '-';

      // 1. Customer
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Customer', col2X, cardY + 12);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text(data.customer.name || '-', col2X + labelW2, cardY + 12, { width: valW2, ellipsis: true });

      // 2. Customer Phone / WhatsApp
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Customer Phone / WhatsApp', col2X, cardY + 27);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(custPhone, col2X + labelW2, cardY + 27, { width: valW2 });

      // 3. Customer Email
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Customer Email', col2X, cardY + 42);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(custEmail, col2X + labelW2, cardY + 42, { width: valW2, ellipsis: true });

      // 4. Nationality
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Nationality', col2X, cardY + 57);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(data.customer.nationality || 'Indonesia (Domestic)', col2X + labelW2, cardY + 57, { width: valW2 });

      // 5. No. of Pax
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('No. of Pax', col2X, cardY + 72);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkSlate).text(`${guestCount} Pax`, col2X + labelW2, cardY + 72, { width: valW2 });

      // =========================================================================
      // 4. TABEL TRANSAKSI DENGAN HEADER HIJAU, GARIS TIPIS, SPACING & ALIGNMENT RAPI
      // =========================================================================
      let curY = 248;

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
        // Fallback dinamis: Nama paket tour dimunculkan di description tabel
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

      // Definisi Kolom Tabel (Total Lebar = contentWidth: 531.28 pt)
      const colNoW = 28;
      const colDescW = 278;
      const colQtyW = 48;
      const colUnitW = 84;
      const colAmtW = contentWidth - (colNoW + colDescW + colQtyW + colUnitW); // 93.28 pt

      const colNoX = leftMargin;
      const colDescX = colNoX + colNoW;
      const colQtyX = colDescX + colDescW;
      const colUnitX = colQtyX + colQtyW;
      const colAmtX = colUnitX + colUnitW;

      // HEADER TABEL HIJAU PROFESIONAL (Focal Visual Sesuai Permintaan User)
      const tableHeaderH = 22;
      doc.rect(leftMargin, curY, contentWidth, tableHeaderH).fill(primaryGreen);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
      doc.text('No.', colNoX, curY + 7, { width: colNoW, align: 'center' });
      doc.text('Description / Detail Transaksi', colDescX + 8, curY + 7, { width: colDescW - 12, align: 'left' });
      doc.text('Qty', colQtyX, curY + 7, { width: colQtyW, align: 'center' });
      doc.text('Unit Price', colUnitX, curY + 7, { width: colUnitW - 8, align: 'right' });
      doc.text('Amount', colAmtX, curY + 7, { width: colAmtW - 8, align: 'right' });

      curY += tableHeaderH;

      // Render Baris-Baris Items (Spacious, Alternating, Garis Tipis Halus)
      lineItems.forEach((item, index) => {
        const rowH = 22;

        // Alternating background
        if (index % 2 === 1) {
          doc.rect(leftMargin, curY, contentWidth, rowH).fill('#fafbfd');
        } else {
          doc.rect(leftMargin, curY, contentWidth, rowH).fill('#ffffff');
        }
        doc.rect(leftMargin, curY, contentWidth, rowH).strokeColor(lightBorder).lineWidth(0.5).stroke();

        const textY = curY + 7;
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
      // 5. PAYMENT INFORMATION & PAYMENT SUMMARY (DUA PANEL VISUAL, TOTAL SEBAGAI FOCAL POINT)
      // =========================================================================
      curY += 12;

      const blockTopY = curY;
      const leftColW = 270;
      const rightColW = contentWidth - leftColW - 12; // 249.28 pt
      const rightColX = leftMargin + leftColW + 12;
      const payBoxH = 94;

      // PANEL KIRI: PAYMENT INFORMATION
      doc.roundedRect(leftMargin, blockTopY, leftColW, payBoxH, 6).fill(cardBg);
      doc.roundedRect(leftMargin, blockTopY, leftColW, payBoxH, 6).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Header Bar Panel Kiri
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(primaryGreen)
        .text('PAYMENT INFORMATION', leftMargin + 10, blockTopY + 8, { characterSpacing: 0.4 });

      const payLabelW = 88;
      const payValW = leftColW - payLabelW - 18;

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Payment Method', leftMargin + 10, blockTopY + 23);
      doc.font('Helvetica-Bold').fontSize(7.2).fillColor(darkSlate)
        .text(data.payment.paymentMethod || 'Bank Transfer / QRIS', leftMargin + payLabelW, blockTopY + 23, { width: payValW });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Payment Provider', leftMargin + 10, blockTopY + 37);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text(data.payment.paymentProvider || 'ArtoPay Gateway', leftMargin + payLabelW, blockTopY + 37, { width: payValW });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Payment Reference', leftMargin + 10, blockTopY + 51);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text(data.payment.paymentReference || data.payment.paymentId || data.bookingCode, leftMargin + payLabelW, blockTopY + 51, { width: payValW, ellipsis: true });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Payment Date', leftMargin + 10, blockTopY + 65);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text(data.payment.paymentDate || data.payment.paidAt || '-', leftMargin + payLabelW, blockTopY + 65, { width: payValW });

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate).text('Payment Status', leftMargin + 10, blockTopY + 79);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(paidGreen)
        .text(isPaid ? '✓ PAID (Lunas Terverifikasi)' : 'PENDING', leftMargin + payLabelW, blockTopY + 79, { width: payValW });

      // PANEL KANAN: PAYMENT SUMMARY (Subtotal, Discount, TOTAL FOCAL POINT)
      const subtotal = lineItems.reduce((sum, it) => sum + Number(it.amount || 0), 0);
      const discount = data.payment.discount || 0;
      const finalTotal = data.payment.totalPaid || (subtotal - discount);

      doc.roundedRect(rightColX, blockTopY, rightColW, payBoxH, 6).fill('#ffffff');
      doc.roundedRect(rightColX, blockTopY, rightColW, payBoxH, 6).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Header Bar Panel Kanan
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(primaryGreen)
        .text('PAYMENT SUMMARY', rightColX + 10, blockTopY + 8, { characterSpacing: 0.4 });

      const totLabelW = 80;
      const totValW = rightColW - totLabelW - 18;

      // Subtotal
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Subtotal', rightColX + 10, blockTopY + 23);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate)
        .text(formatRupiah(subtotal), rightColX + totLabelW, blockTopY + 23, { width: totValW, align: 'right' });

      // Discount
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Discount', rightColX + 10, blockTopY + 37);
      doc.font('Helvetica').fontSize(8).fillColor(discount > 0 ? '#dc2626' : bodySlate)
        .text(discount > 0 ? ('- ' + formatRupiah(discount)) : 'Rp 0', rightColX + totLabelW, blockTopY + 37, { width: totValW, align: 'right' });

      // Divider Halus sebelum Kotak Total
      doc.strokeColor(lightBorder).lineWidth(0.5)
        .moveTo(rightColX + 10, blockTopY + 50).lineTo(rightColX + rightColW - 10, blockTopY + 50).stroke();

      // TOTAL FOCAL POINT: Kotak Hijau Menonjol & Berwibawa
      const totalBoxY = blockTopY + 54;
      const totalBoxH = 32;
      doc.roundedRect(rightColX + 8, totalBoxY, rightColW - 16, totalBoxH, 4).fill(primaryGreen);

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff')
        .text('TOTAL', rightColX + 16, totalBoxY + 11);

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
        .text(formatRupiah(finalTotal), rightColX + totLabelW, totalBoxY + 10, { width: totValW - 4, align: 'right' });

      curY = blockTopY + payBoxH + 12;

      // =========================================================================
      // 6. TERMS & NOTES CONTAINER (Rapi, Terstruktur, Tidak Tercecer)
      // =========================================================================
      const notesH = data.notes ? 72 : 62;
      doc.roundedRect(leftMargin, curY, contentWidth, notesH, 6).fill(cardBg);
      doc.roundedRect(leftMargin, curY, contentWidth, notesH, 6).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Aksen Hijau Vertikal di sisi kiri container Terms
      doc.rect(leftMargin + 1, curY + 1, 3.5, notesH - 2).fill(primaryGreen);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryGreen)
        .text('TERMS & NOTES', leftMargin + 12, curY + 7, { characterSpacing: 0.4 });

      doc.font('Helvetica').fontSize(6.8).fillColor(bodySlate)
        .text('1. Dokumen invoice ini merupakan bukti konfirmasi pemesanan dan tanda terima pembayaran resmi yang sah dari Smart Journey (PT Sawah Jaya Trans).', leftMargin + 12, curY + 20)
        .text('2. Rincian penjemputan dan armada telah terjadwal secara resmi. Harap siap di lokasi penjemputan 15 menit sebelum waktu keberangkatan.', leftMargin + 12, curY + 31)
        .text('3. Dokumen ini dapat ditunjukkan langsung kepada pengemudi / tim penjemputan resmi Smart Journey saat hari keberangkatan.', leftMargin + 12, curY + 42)
        .text('4. Bantuan operasional & perubahan jadwal dapat dikonfirmasikan melalui saluran resmi Smart Journey.', leftMargin + 12, curY + 53);

      if (data.notes) {
        doc.font('Helvetica-Bold').fontSize(6.8).fillColor(darkSlate)
          .text(`Catatan Khusus Tamu: ${data.notes}`, leftMargin + 12, curY + 63, { width: contentWidth - 24, ellipsis: true });
      }

      // =========================================================================
      // 7. FOOTER MINIMALIS: LEGALITAS & KODE VERIFIKASI (TANPA MENGULANG KONTAK PERUSAHAAN)
      // =========================================================================
      const footerY = 786;

      // Garis Pembatas Footer
      doc.strokeColor(lightBorder).lineWidth(0.8)
        .moveTo(leftMargin, footerY).lineTo(rightMargin, footerY).stroke();

      // Footer Kiri: Status Dokumen Sah Sistem
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryGreen)
        .text('SMART JOURNEY', leftMargin, footerY + 8, { continued: true })
        .font('Helvetica').fontSize(7).fillColor(mutedSlate)
        .text('  •  Official Travel Invoice & Receipt  •  Dokumen Sah Terverifikasi Sistem', { align: 'left' });

      // Footer Kanan: Kode Verifikasi Digital
      const vHash = data.verificationHash || `SJ-VERIFIED-${data.bookingCode}`;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkSlate)
        .text(`Kode Verifikasi: ${vHash}`, 240, footerY + 8, { width: rightMargin - 240, align: 'right' });

      doc.font('Helvetica').fontSize(6.8).fillColor(mutedSlate)
        .text('Dicetak Resmi dari Sistem Smart Journey  •  Dokumen 1 Halaman A4', 240, footerY + 18, { width: rightMargin - 240, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
