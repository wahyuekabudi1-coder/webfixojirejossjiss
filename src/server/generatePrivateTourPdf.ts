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
        margins: { top: 20, bottom: 15, left: 28, right: 28 },
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Title: `SmartJourney-Invoice-${data.bookingCode}`,
          Author: 'Smart Journey (PT Sawah Jaya Trans)',
          Subject: 'INVOICE - PRIVATE TOUR - Official Booking Confirmation & Receipt',
          Keywords: 'Smart Journey, Invoice, Private Tour, Booking Summary, Payment Receipt, Official'
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // =========================================================================
      // PALET WARNA RESMI SESUAI GAMBAR REFERENSI
      // =========================================================================
      const primaryGreen = '#0f766e';     // Deep Brand Teal / Green (#0f766e / #115e59)
      const brandDark = '#064e3b';        // Dark Forest Green
      const paidGreen = '#15803d';        // Solid Green Status (#15803d / #16a34a)
      const mintBg = '#dcfce7';           // Light Mint Green Background (#dcfce7 / #ecfdf5)
      const mintBorder = '#86efac';       // Mint Green Border
      const darkSlate = '#0f172a';        // Black / Slate 900 (Teks Utama)
      const bodySlate = '#334155';        // Slate 700 (Teks Body)
      const mutedSlate = '#64748b';       // Slate 500 (Label Muted)
      const borderSlate = '#e2e8f0';      // Slate 200 (Border Container Halus)
      const cardBg = '#f8fafc';           // Slate 50 (Off-White Card Background)

      const pageWidth = 595.28;
      const leftMargin = 30;
      const rightMargin = pageWidth - 30; // 565.28 pt
      const contentWidth = rightMargin - leftMargin; // 535.28 pt

      const logoPath = path.join(process.cwd(), 'public', 'logo.png');

      // =========================================================================
      // BACKGROUND: WATERMARK LOGO SMART JOURNEY BESAR DI TENGAH (OPASITAS SANGAT RENDAH)
      // =========================================================================
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.opacity(0.045);
        const watermarkSize = 240;
        const watermarkX = (pageWidth - watermarkSize) / 2;
        const watermarkY = 280;
        doc.image(logoPath, watermarkX, watermarkY, { fit: [watermarkSize, watermarkSize] });
        doc.restore();
      }

      // =========================================================================
      // 1. HEADER (SESUAI GAMBAR REFERENSI)
      // KIRI: Logo Smart Journey + Teks "Smart Journey" & "Go Beyond"
      // KANAN: Blok Informasi Perusahaan Lengkap dengan Ikon
      // =========================================================================
      const headerTopY = 26;

      // KIRI: Logo + Brand
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, leftMargin, headerTopY, { fit: [46, 46] });
        
        const brandTextX = leftMargin + 54;
        doc.font('Helvetica-Bold').fontSize(19).fillColor(darkSlate)
          .text('Smart Journey', brandTextX, headerTopY + 2);
        
        doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryGreen)
          .text('Go Beyond', brandTextX, headerTopY + 23);
      } else {
        doc.font('Helvetica-Bold').fontSize(19).fillColor(darkSlate)
          .text('Smart Journey', leftMargin, headerTopY + 2);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryGreen)
          .text('Go Beyond', leftMargin, headerTopY + 23);
      }

      // KANAN: Data Resmi Perusahaan (PT Sawah Jaya Trans, Alamat, Hub, Kontak, Web)
      const companyX = 260;
      const companyW = rightMargin - companyX;

      // Helper function untuk menggambar bullet ikon kecil hijau
      const drawGreenIconDot = (x: number, y: number) => {
        doc.save();
        doc.circle(x, y, 2.5).fill(primaryGreen);
        doc.restore();
      };

      let compLineY = headerTopY;
      
      // Line 1: PT Sawah Jaya Trans (Bold)
      drawGreenIconDot(companyX + 8, compLineY + 4);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text('PT Sawah Jaya Trans', companyX + 16, compLineY, { width: companyW - 16, align: 'left' });

      // Line 2: Alamat
      compLineY += 10.5;
      drawGreenIconDot(companyX + 8, compLineY + 4);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text('Jl. Puntadewa No. 192, Tumpang, Malang, Jawa Timur', companyX + 16, compLineY, { width: companyW - 16, align: 'left' });

      // Line 3: Hub Operasional
      compLineY += 9.5;
      drawGreenIconDot(companyX + 8, compLineY + 4);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text('Hub Operasional: Malang & Denpasar Bali', companyX + 16, compLineY, { width: companyW - 16, align: 'left' });

      // Line 4: WhatsApp
      compLineY += 9.5;
      drawGreenIconDot(companyX + 8, compLineY + 4);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text('WhatsApp: +62 852-1234-7289', companyX + 16, compLineY, { width: companyW - 16, align: 'left' });

      // Line 5: Email
      compLineY += 9.5;
      drawGreenIconDot(companyX + 8, compLineY + 4);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text('Email: Info@sawahjayatrans.com', companyX + 16, compLineY, { width: companyW - 16, align: 'left' });

      // Line 6: Web
      compLineY += 9.5;
      drawGreenIconDot(companyX + 8, compLineY + 4);
      doc.font('Helvetica-Bold').fontSize(7.2).fillColor(primaryGreen)
        .text('www.smartjourney.id', companyX + 16, compLineY, { width: companyW - 16, align: 'left' });

      // Separator Garis Tipis di Bawah Header
      const headerSepY = 82;
      doc.strokeColor(borderSlate).lineWidth(0.8).moveTo(leftMargin, headerSepY).lineTo(rightMargin, headerSepY).stroke();

      // =========================================================================
      // 2. JUDUL DOKUMEN (INVOICE + PRIVATE TOUR) & BADGE PAID (SESUAI REFERENSI)
      // =========================================================================
      const titleY = 90;

      // Bar Aksen Vertikal Hijau di Sisi Kiri Judul
      doc.roundedRect(leftMargin, titleY + 2, 4, 38, 2).fill(primaryGreen);

      // KIRI: Tipografi Hierarki
      const titleTextX = leftMargin + 10;
      doc.font('Helvetica-Bold').fontSize(24).fillColor(darkSlate)
        .text('INVOICE', titleTextX, titleY, { characterSpacing: 0.6 });

      const rawTrip = data.trip as any;
      const isSharedTrip = rawTrip?.type === 'shared' || 
        (data.trip.package || '').toLowerCase().includes('open trip') || 
        (data.trip.title || '').toLowerCase().includes('open trip') ||
        (data.trip.package || '').toLowerCase().includes('share tour');
      const tripCategoryTitle = isSharedTrip ? 'OPEN TRIP' : 'PRIVATE TOUR';

      doc.font('Helvetica-Bold').fontSize(19).fillColor(primaryGreen)
        .text(tripCategoryTitle, titleTextX, titleY + 24, { characterSpacing: 0.5 });

      doc.font('Helvetica').fontSize(8).fillColor(bodySlate)
        .text('Official Booking Confirmation & Receipt  •  Booking Summary & Payment Receipt', titleTextX, titleY + 45);

      // KANAN: BADGE PAID BESAR & TEGAS (Pill Shape dengan Lingkaran Checkmark Hijau)
      const isPaid = (data.paymentStatus || '').toLowerCase() === 'paid';
      const badgeW = 115;
      const badgeH = 34;
      const badgeX = rightMargin - badgeW;
      const badgeY = titleY + 4;

      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 17).fill(mintBg);
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 17).strokeColor(mintBorder).lineWidth(1).stroke();

      // Lingkaran Hijau dengan Checkmark Putih di dalam badge
      const checkCircleX = badgeX + 22;
      const checkCircleY = badgeY + (badgeH / 2);
      const checkCircleR = 10;

      doc.circle(checkCircleX, checkCircleY, checkCircleR).fill(paidGreen);

      // Path Vektor Checkmark Putih
      doc.strokeColor('#ffffff').lineWidth(2)
        .moveTo(checkCircleX - 4, checkCircleY)
        .lineTo(checkCircleX - 1, checkCircleY + 3.5)
        .lineTo(checkCircleX + 4.5, checkCircleY - 3)
        .stroke();

      // Teks "PAID" Besar & Tegas
      doc.font('Helvetica-Bold').fontSize(16).fillColor(paidGreen)
        .text(isPaid ? 'PAID' : 'PENDING', badgeX + 38, badgeY + 8, { width: badgeW - 42, align: 'center' });

      // Nomor Invoice di Bawah Badge
      const invoiceNum = data.invoiceNumber || `INV-${data.bookingCode}`;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(darkSlate)
        .text(`Invoice No: ${invoiceNum}`, companyX - 40, titleY + 46, { width: rightMargin - (companyX - 40), align: 'right' });

      // =========================================================================
      // 3. BOOKING INFORMATION CARD (SESUAI GAMBAR REFERENSI DENGAN TITIK DUA TERSEJAJAR)
      // =========================================================================
      const cardY = 146;
      const cardH = 80;

      doc.roundedRect(leftMargin, cardY, contentWidth, cardH, 8).fill(cardBg);
      doc.roundedRect(leftMargin, cardY, contentWidth, cardH, 8).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Kolom Kiri: Booking ID, Booking Date, Travel Date
      const col1LabelX = leftMargin + 14;
      const col1ColonX = leftMargin + 82;
      const col1ValX = leftMargin + 90;
      const col1ValW = 160;

      // Kolom Kanan: Customer, Nationality, No. of Pax, Tour / Fleet (+ Phone / Email aman)
      const midX = leftMargin + (contentWidth / 2) - 8;
      const col2LabelX = midX + 8;
      const col2ColonX = midX + 78;
      const col2ValX = midX + 86;
      const col2ValW = rightMargin - col2ValX - 10;

      const custPhone = (data.customer.phone && data.customer.phone.trim() !== '' && data.customer.phone !== '-') 
        ? data.customer.phone.trim() 
        : '';
      const custEmail = (data.customer.email && data.customer.email.trim() !== '' && data.customer.email !== '-') 
        ? data.customer.email.trim() 
        : '';
      const guestCount = data.trip.participantsCount || (data.trip.participantsNames ? data.trip.participantsNames.length : 1);

      // --- KOLOM KIRI ---
      // 1. Booking ID
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('Booking ID', col1LabelX, cardY + 12);
      doc.font('Helvetica').fontSize(8).fillColor(darkSlate).text(':', col1ColonX, cardY + 12);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate).text(data.bookingCode, col1ValX, cardY + 12, { width: col1ValW });

      // 2. Booking Date
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('Booking Date', col1LabelX, cardY + 30);
      doc.font('Helvetica').fontSize(8).fillColor(darkSlate).text(':', col1ColonX, cardY + 30);
      doc.font('Helvetica').fontSize(8).fillColor(bodySlate).text(data.bookingDate || '-', col1ValX, cardY + 30, { width: col1ValW });

      // 3. Travel Date (Bold Menonjol)
      const travelDateVal = data.trip.departureDate || '-';
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('Travel Date', col1LabelX, cardY + 48);
      doc.font('Helvetica').fontSize(8).fillColor(darkSlate).text(':', col1ColonX, cardY + 48);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate).text(travelDateVal, col1ValX, cardY + 48, { width: col1ValW });

      // --- KOLOM KANAN ---
      // 1. Customer
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('Customer', col2LabelX, cardY + 10);
      doc.font('Helvetica').fontSize(8).fillColor(darkSlate).text(':', col2ColonX, cardY + 10);
      doc.font('Helvetica').fontSize(8).fillColor(bodySlate).text(data.customer.name || '-', col2ValX, cardY + 10, { width: col2ValW });

      // 2. Nationality (atau Phone jika tersedia)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('Nationality', col2LabelX, cardY + 25);
      doc.font('Helvetica').fontSize(8).fillColor(darkSlate).text(':', col2ColonX, cardY + 25);
      doc.font('Helvetica').fontSize(8).fillColor(bodySlate).text(data.customer.nationality || 'Indonesia (Domestic)', col2ValX, cardY + 25, { width: col2ValW });

      // 3. No. of Pax
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('No. of Pax', col2LabelX, cardY + 40);
      doc.font('Helvetica').fontSize(8).fillColor(darkSlate).text(':', col2ColonX, cardY + 40);
      doc.font('Helvetica').fontSize(8).fillColor(bodySlate).text(`${guestCount} Pax`, col2ValX, cardY + 40, { width: col2ValW });

      // 4. Tour / Fleet (Sesuai Referensi)
      const packageTitle = data.trip.title || 'Private Tour';
      const fleetTitle = data.trip.vehicleName ? ` • ${data.trip.vehicleName}` : '';
      const tourFleetText = `${packageTitle}${fleetTitle}`;

      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('Tour / Fleet', col2LabelX, cardY + 55);
      doc.font('Helvetica').fontSize(8).fillColor(darkSlate).text(':', col2ColonX, cardY + 55);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(tourFleetText, col2ValX, cardY + 55, { width: col2ValW, height: 22, ellipsis: true });

      // =========================================================================
      // 4. TABEL TRANSAKSI (HEADER HIJAU TEAL, GARIS TIPIS, SPACING & ALIGNMENT RAPI)
      // =========================================================================
      let curY = 236;

      // Resolusi Dynamic Line Items
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

      // Definisi Lebar Kolom Tabel (Total = contentWidth: 535.28 pt)
      const colNoW = 32;
      const colDescW = 270;
      const colQtyW = 54;
      const colUnitW = 85;
      const colAmtW = contentWidth - (colNoW + colDescW + colQtyW + colUnitW); // 94.28 pt

      const colNoX = leftMargin;
      const colDescX = colNoX + colNoW;
      const colQtyX = colDescX + colDescW;
      const colUnitX = colQtyX + colQtyW;
      const colAmtX = colUnitX + colUnitW;

      // HEADER TABEL HIJAU SOLID (Rounded Top Corners)
      const tableHeaderH = 24;
      doc.roundedRect(leftMargin, curY, contentWidth, tableHeaderH, 5).fill(primaryGreen);

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      doc.text('No.', colNoX, curY + 7, { width: colNoW, align: 'center' });
      doc.text('Description', colDescX + 10, curY + 7, { width: colDescW - 14, align: 'left' });
      doc.text('Qty', colQtyX, curY + 7, { width: colQtyW, align: 'center' });
      doc.text('Unit Price', colUnitX, curY + 7, { width: colUnitW - 10, align: 'right' });
      doc.text('Amount', colAmtX, curY + 7, { width: colAmtW - 10, align: 'right' });

      curY += tableHeaderH;

      // Render Baris-Baris Items (Spacious, Alternating, Garis Halus)
      lineItems.forEach((item, index) => {
        const rowH = 28;

        if (index % 2 === 1) {
          doc.rect(leftMargin, curY, contentWidth, rowH).fill('#fafbfd');
        } else {
          doc.rect(leftMargin, curY, contentWidth, rowH).fill('#ffffff');
        }
        doc.rect(leftMargin, curY, contentWidth, rowH).strokeColor(borderSlate).lineWidth(0.5).stroke();

        const textY = curY + 8;
        doc.font('Helvetica').fontSize(8).fillColor(darkSlate)
          .text(String(item.no || index + 1), colNoX, textY, { width: colNoW, align: 'center' });

        doc.font('Helvetica').fontSize(7.8).fillColor(darkSlate)
          .text(item.description, colDescX + 10, textY, { width: colDescW - 16, ellipsis: true });

        doc.font('Helvetica').fontSize(8).fillColor(bodySlate)
          .text(String(item.qty), colQtyX, textY, { width: colQtyW, align: 'center' });

        doc.font('Helvetica').fontSize(8).fillColor(bodySlate)
          .text(formatRupiah(item.unitPrice), colUnitX, textY, { width: colUnitW - 10, align: 'right' });

        doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate)
          .text(formatRupiah(item.amount), colAmtX, textY, { width: colAmtW - 10, align: 'right' });

        curY += rowH;
      });

      // =========================================================================
      // 5. PAYMENT INFORMATION & PAYMENT SUMMARY (DUA PANEL BERDAMPINGAN SESUAI REFERENSI)
      // =========================================================================
      curY += 12;

      const blockTopY = curY;
      const leftColW = 274;
      const rightColW = contentWidth - leftColW - 12; // 249.28 pt
      const rightColX = leftMargin + leftColW + 12;
      const payBoxH = 98;

      // Helper function untuk ikon bulat hijau di baris panel
      const drawPanelRowIcon = (cx: number, cy: number) => {
        doc.save();
        doc.circle(cx, cy, 6).fill(primaryGreen);
        doc.circle(cx, cy, 3).fill('#ffffff');
        doc.restore();
      };

      // --- PANEL KIRI: PAYMENT INFORMATION ---
      doc.roundedRect(leftMargin, blockTopY, leftColW, payBoxH, 8).fill(cardBg);
      doc.roundedRect(leftMargin, blockTopY, leftColW, payBoxH, 8).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Header Bar Panel Kiri: Ikon Kartu + PAYMENT INFORMATION
      doc.rect(leftMargin + 10, blockTopY + 8, 10, 7).fill(primaryGreen);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text('PAYMENT INFORMATION', leftMargin + 25, blockTopY + 8, { characterSpacing: 0.4 });

      const pRowStartX = leftMargin + 12;
      const pLabelX = pRowStartX + 16;
      const pColonX = pLabelX + 76;
      const pValX = pColonX + 8;
      const pValW = leftColW - (pValX - leftMargin) - 10;

      let pRowY = blockTopY + 24;

      // 1. Payment Method
      drawPanelRowIcon(pRowStartX + 6, pRowY + 4);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text('Payment Method', pLabelX, pRowY);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(':', pColonX, pRowY);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate)
        .text(data.payment.paymentMethod || 'ArtoPay Gateway', pValX, pRowY, { width: pValW });

      // 2. Payment Provider
      pRowY += 14;
      drawPanelRowIcon(pRowStartX + 6, pRowY + 4);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text('Payment Provider', pLabelX, pRowY);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(':', pColonX, pRowY);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate)
        .text(data.payment.paymentProvider || 'ArtoPay', pValX, pRowY, { width: pValW });

      // 3. Payment Reference
      pRowY += 14;
      drawPanelRowIcon(pRowStartX + 6, pRowY + 4);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text('Payment Reference', pLabelX, pRowY);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(':', pColonX, pRowY);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate)
        .text(data.payment.paymentReference || data.payment.paymentId || data.bookingCode, pValX, pRowY, { width: pValW, ellipsis: true });

      // 4. Payment Date
      pRowY += 14;
      drawPanelRowIcon(pRowStartX + 6, pRowY + 4);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text('Payment Date', pLabelX, pRowY);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(':', pColonX, pRowY);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate)
        .text(data.payment.paymentDate || data.payment.paidAt || '-', pValX, pRowY, { width: pValW });

      // 5. Payment Status (Bold Hijau Terverifikasi Sesuai Referensi)
      pRowY += 14;
      drawPanelRowIcon(pRowStartX + 6, pRowY + 4);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text('Payment Status', pLabelX, pRowY);
      doc.font('Helvetica').fontSize(7.5).fillColor(bodySlate).text(':', pColonX, pRowY);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(paidGreen)
        .text(isPaid ? 'PAID (Lunas Terverifikasi)' : 'PENDING PAYMENT', pValX, pRowY, { width: pValW });

      // --- PANEL KANAN: PAYMENT SUMMARY ---
      const subtotal = lineItems.reduce((sum, it) => sum + Number(it.amount || 0), 0);
      const discount = data.payment.discount || 0;
      const finalTotal = data.payment.totalPaid || (subtotal - discount);

      doc.roundedRect(rightColX, blockTopY, rightColW, payBoxH, 8).fill('#ffffff');
      doc.roundedRect(rightColX, blockTopY, rightColW, payBoxH, 8).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Header Bar Panel Kanan: Ikon + PAYMENT SUMMARY
      doc.rect(rightColX + 10, blockTopY + 8, 10, 7).fill(primaryGreen);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text('PAYMENT SUMMARY', rightColX + 25, blockTopY + 8, { characterSpacing: 0.4 });

      const totValW = 100;
      const totValX = rightColX + rightColW - totValW - 12;

      // Subtotal
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('Subtotal', rightColX + 14, blockTopY + 26);
      doc.font('Helvetica').fontSize(8).fillColor(darkSlate)
        .text(formatRupiah(subtotal), totValX, blockTopY + 26, { width: totValW, align: 'right' });

      // Discount
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('Discount', rightColX + 14, blockTopY + 42);
      doc.font('Helvetica').fontSize(8).fillColor(discount > 0 ? '#dc2626' : darkSlate)
        .text(discount > 0 ? ('- ' + formatRupiah(discount)) : 'Rp 0', totValX, blockTopY + 42, { width: totValW, align: 'right' });

      // TOTAL FOCAL POINT (HILIGHT HIJAU MINT SESUAI GAMBAR REFERENSI)
      const totalBoxY = blockTopY + 58;
      const totalBoxH = 32;
      doc.roundedRect(rightColX + 8, totalBoxY, rightColW - 16, totalBoxH, 6).fill(mintBg);
      doc.roundedRect(rightColX + 8, totalBoxY, rightColW - 16, totalBoxH, 6).strokeColor(mintBorder).lineWidth(0.8).stroke();

      doc.font('Helvetica-Bold').fontSize(11).fillColor(darkSlate)
        .text('TOTAL', rightColX + 16, totalBoxY + 10);

      doc.font('Helvetica-Bold').fontSize(13.5).fillColor(darkSlate)
        .text(formatRupiah(finalTotal), totValX - 6, totalBoxY + 9, { width: totValW + 6, align: 'right' });

      curY = blockTopY + payBoxH + 12;

      // =========================================================================
      // 6. TERMS & NOTES (SESUAI GAMBAR REFERENSI DENGAN NOMOR BULAT HIJAU)
      // =========================================================================
      const notesH = 86;
      doc.roundedRect(leftMargin, curY, contentWidth, notesH, 8).fill(cardBg);
      doc.roundedRect(leftMargin, curY, contentWidth, notesH, 8).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Ikon Dokumen + TERMS & NOTES
      doc.rect(leftMargin + 12, curY + 8, 8, 10).fill(primaryGreen);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text('TERMS & NOTES', leftMargin + 25, curY + 8, { characterSpacing: 0.4 });

      // 4 Butir Ketentuan dengan Badge Nomor Bulat Hijau
      const termsList = [
        'Dokumen invoice ini merupakan bukti konfirmasi pemesanan dan tanda terima pembayaran resmi yang sah dari Smart Journey (PT Sawah Jaya Trans).',
        'Rincian penjemputan dan armada telah terjadwal secara resmi. Harap siap di lokasi penjemputan 15 menit sebelum waktu keberangkatan.',
        'Dokumen ini dapat ditunjukkan langsung kepada pengemudi / tim penjemputan resmi Smart Journey saat hari keberangkatan.',
        'Bantuan operasional & perubahan jadwal dapat dikonfirmasikan melalui WhatsApp resmi Smart Journey di +62 852-1234-7289.'
      ];

      let termY = curY + 23;
      termsList.forEach((termText, idx) => {
        const numCircleX = leftMargin + 18;
        const numCircleY = termY + 4;
        const numCircleR = 5.5;

        // Lingkaran Bulat Hijau
        doc.circle(numCircleX, numCircleY, numCircleR).fill(primaryGreen);

        // Angka Putih di Tengah Lingkaran
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#ffffff')
          .text(String(idx + 1), numCircleX - 4, numCircleY - 3.2, { width: 8, align: 'center' });

        // Teks Ketentuan
        doc.font('Helvetica').fontSize(6.8).fillColor(bodySlate)
          .text(termText, leftMargin + 29, termY, { width: contentWidth - 38 });

        termY += 13.5;
      });

      // =========================================================================
      // 7. FOOTER (PERSIS SESUAI GAMBAR REFERENSI)
      // Pembagian Kolom Bersih: Brand, PT Sawah Jaya Trans, Hub & Hotline, Email, Web, Kode Verifikasi
      // =========================================================================
      const footerY = 740;

      // Garis Pembatas Atas Footer
      doc.strokeColor(primaryGreen).lineWidth(1.2)
        .moveTo(leftMargin, footerY).lineTo(rightMargin, footerY).stroke();

      // --- BARIS 1 FOOTER ---
      const footRow1Y = footerY + 6;

      // Kolom 1: Smart Journey & Go Beyond
      doc.font('Helvetica-Bold').fontSize(9).fillColor(darkSlate)
        .text('SMART JOURNEY', leftMargin, footRow1Y);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(primaryGreen)
        .text('Go Beyond', leftMargin, footRow1Y + 11);

      // Garis Vertikal Pemisah 1
      doc.strokeColor(borderSlate).lineWidth(0.8)
        .moveTo(leftMargin + 95, footRow1Y).lineTo(leftMargin + 95, footRow1Y + 22).stroke();

      // Kolom 2: PT Sawah Jaya Trans & Lisensi
      const footCol2X = leftMargin + 105;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate)
        .text('PT Sawah Jaya Trans', footCol2X, footRow1Y);
      doc.font('Helvetica').fontSize(6.8).fillColor(mutedSlate)
        .text('(Lisensi Resmi Biro Perjalanan Wisata)', footCol2X, footRow1Y + 10);

      // Garis Vertikal Pemisah 2
      doc.strokeColor(borderSlate).lineWidth(0.8)
        .moveTo(footCol2X + 175, footRow1Y).lineTo(footCol2X + 175, footRow1Y + 22).stroke();

      // Kolom 3: Hub Operasional & Hotline
      const footCol3X = footCol2X + 185;
      drawGreenIconDot(footCol3X + 4, footRow1Y + 4);
      doc.font('Helvetica').fontSize(6.8).fillColor(bodySlate)
        .text('Hub Operasional: Malang & Denpasar Bali', footCol3X + 11, footRow1Y);
      doc.font('Helvetica').fontSize(6.8).fillColor(bodySlate)
        .text('Hotline 24/7: +62 852-1234-7289', footCol3X + 11, footRow1Y + 10);

      // --- BARIS 2 FOOTER (KONTAK & KODE VERIFIKASI RESMI) ---
      const footRow2Y = footerY + 34;

      // Email
      drawGreenIconDot(leftMargin + 4, footRow2Y + 4);
      doc.font('Helvetica').fontSize(6.8).fillColor(bodySlate)
        .text('Email: Info@sawahjayatrans.com', leftMargin + 12, footRow2Y);

      // Garis Vertikal Pemisah Kontak
      doc.strokeColor(borderSlate).lineWidth(0.8)
        .moveTo(leftMargin + 145, footRow2Y).lineTo(leftMargin + 145, footRow2Y + 18).stroke();

      // Web
      drawGreenIconDot(leftMargin + 155, footRow2Y + 4);
      doc.font('Helvetica').fontSize(6.8).fillColor(bodySlate)
        .text('Web: www.smartjourney.id', leftMargin + 163, footRow2Y);

      // Garis Vertikal Pemisah Legalitas
      doc.strokeColor(borderSlate).lineWidth(0.8)
        .moveTo(footCol2X + 175, footRow2Y - 4).lineTo(footCol2X + 175, footRow2Y + 22).stroke();

      // Kode Verifikasi Sah (dengan Badge Lingkaran Checkmark Hijau)
      const vHash = data.verificationHash || `SJ-VERIFIED-${data.bookingCode}-0238895Z`;
      const vCheckX = footCol3X + 6;
      const vCheckY = footRow2Y + 7;

      doc.circle(vCheckX, vCheckY, 6).fill(mintBg);
      doc.circle(vCheckX, vCheckY, 6).strokeColor(paidGreen).lineWidth(0.8).stroke();
      doc.strokeColor(paidGreen).lineWidth(1.2)
        .moveTo(vCheckX - 2.5, vCheckY)
        .lineTo(vCheckX - 0.5, vCheckY + 2)
        .lineTo(vCheckX + 3, vCheckY - 2)
        .stroke();

      const vTextX = vCheckX + 12;
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(darkSlate)
        .text(`Kode Verifikasi:`, vTextX, footRow2Y);
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(darkSlate)
        .text(vHash, vTextX, footRow2Y + 9);
      doc.font('Helvetica').fontSize(6.2).fillColor(mutedSlate)
        .text('Dokumen Resmi Sah', vTextX, footRow2Y + 18);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
