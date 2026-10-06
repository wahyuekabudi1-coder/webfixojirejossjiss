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
          Subject: 'INVOICE - PRIVATE TOUR - Official Booking Confirmation & Receipt - Booking Summary & Payment Receipt',
          Keywords: 'Smart Journey, Invoice, Private Tour, Booking Summary, Payment Receipt, Official, Hotline 24/7'
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // =========================================================================
      // PALET WARNA VISUAL PERSIS GAMBAR REFERENSI (1 (4).png)
      // =========================================================================
      const primaryGreen = '#0f766e';     // Deep Brand Teal / Green (#0f766e / #0d5c55)
      const titleGreen = '#0d9488';       // Medium Emerald Green untuk "Private Tour"
      const darkEmerald = '#044e47';      // Forest Dark Emerald
      const paidGreen = '#15803d';        // Solid Green Status Check (#15803d)
      const mintBg = '#dcfce7';           // Light Mint Green Background (#dcfce7)
      const mintBorder = '#86efac';       // Mint Green Border (#86efac)
      const darkSlate = '#0f172a';        // Slate 900 (Teks Utama & Heading)
      const bodySlate = '#334155';        // Slate 700 (Teks Body & Nilai)
      const mutedSlate = '#64748b';       // Slate 500 (Label Muted)
      const borderSlate = '#cbd5e1';      // Slate 300 (Border Container Halus)
      const lightBorder = '#e2e8f0';      // Slate 200 (Divider Halus)
      const cardBg = '#f8fafc';           // Slate 50 (Off-White Card Background)

      const pageWidth = 595.28;
      const leftMargin = 28;
      const rightMargin = pageWidth - 28; // 567.28 pt
      const contentWidth = rightMargin - leftMargin; // 539.28 pt

      const logoPath = path.join(process.cwd(), 'public', 'logo.png');

      // =========================================================================
      // 0. WATERMARK LOGO SMART JOURNEY BESAR DI TENGAH (DI BELAKANG KONTEN)
      // =========================================================================
      if (fs.existsSync(logoPath)) {
        doc.save();
        doc.opacity(0.065);
        const watermarkSize = 260;
        const watermarkX = (pageWidth - watermarkSize) / 2;
        const watermarkY = 260;
        doc.image(logoPath, watermarkX, watermarkY, { fit: [watermarkSize, watermarkSize] });
        doc.restore();
      }

      // =========================================================================
      // 1. HEADER (PERSIS GAMBAR REFERENSI SEBAGAI MASTER TEMPLATE)
      // KIRI: Logo Smart Journey + "Smart Journey" + Underline Gold + "Go Beyond"
      // TENGAH: Garis pemisah vertikal antara brand dan informasi perusahaan
      // KANAN: Blok Informasi Perusahaan PT. Sawah Jaya Trans + NPWP + Kontak
      // BAWAH: Garis horizontal / header separator
      // =========================================================================
      const headerTopY = 22;

      // KIRI: Logo & Brand Typography
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, leftMargin, headerTopY, { fit: [48, 48] });
        
        const brandTextX = leftMargin + 54;
        doc.font('Helvetica-Bold').fontSize(21).fillColor(darkSlate)
          .text('Smart Journey', brandTextX, headerTopY + 2);
        
        // Garis Aksen Emas / Warm di Bawah Brand
        doc.strokeColor('#ca8a04').lineWidth(1.5)
          .moveTo(brandTextX, headerTopY + 26).lineTo(brandTextX + 76, headerTopY + 26).stroke();

        doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#854d0e')
          .text('Go Beyond', brandTextX, headerTopY + 28);
      } else {
        doc.font('Helvetica-Bold').fontSize(21).fillColor(darkSlate)
          .text('Smart Journey', leftMargin, headerTopY + 2);
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#854d0e')
          .text('Go Beyond', leftMargin, headerTopY + 28);
      }

      // 4. GARIS PEMISAH VERTIKAL ANTARA BRAND DAN INFORMASI PERUSAHAAN (PERSIS REFERENSI)
      const vertSepX = 276;
      doc.strokeColor('#e2e8f0').lineWidth(0.8)
        .moveTo(vertSepX, headerTopY + 2).lineTo(vertSepX, headerTopY + 54).stroke();

      // KANAN: Blok Informasi Perusahaan PT. Sawah Jaya Trans Sesuai Referensi
      const companyX = 292;
      const companyW = rightMargin - companyX;

      const drawSmallGreenBullet = (x: number, y: number) => {
        doc.save();
        doc.circle(x, y, 2.5).fill(primaryGreen);
        doc.restore();
      };

      let compY = headerTopY - 2;

      // Baris 1: PT. Sawah Jaya Trans (Bold)
      drawSmallGreenBullet(companyX + 6, compY + 5);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(darkSlate)
        .text('PT. Sawah Jaya Trans', companyX + 14, compY, { width: companyW - 14, align: 'left' });

      // Baris 2: NPWP / Nomor Resmi
      compY += 11;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate)
        .text('20.876.765.7-657.000', companyX + 14, compY, { width: companyW - 14, align: 'left' });

      // Baris 3: Alamat Kantor
      compY += 10;
      drawSmallGreenBullet(companyX + 6, compY + 4);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text('Jl. Puntadewa No. 192, Tumpang, Malang, Jawa Timur', companyX + 14, compY, { width: companyW - 14, align: 'left' });

      // Baris 4: Nomor WhatsApp & Badge Centang Biru Vector (Tanpa unicode rusak)
      compY += 10;
      drawSmallGreenBullet(companyX + 6, compY + 4);
      const waNumberText = '+62 852-1234-7289';
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkSlate)
        .text(waNumberText, companyX + 14, compY);
      
      const waWidth = doc.widthOfString(waNumberText);
      const checkBadgeX = companyX + 14 + waWidth + 5;
      const checkBadgeY = compY + 4;
      doc.circle(checkBadgeX, checkBadgeY, 3.5).fill('#0284c7');
      doc.strokeColor('#ffffff').lineWidth(1)
        .moveTo(checkBadgeX - 1.5, checkBadgeY)
        .lineTo(checkBadgeX - 0.3, checkBadgeY + 1.3)
        .lineTo(checkBadgeX + 1.8, checkBadgeY - 1.2)
        .stroke();

      // Baris 5: Email
      compY += 10;
      drawSmallGreenBullet(companyX + 6, compY + 4);
      doc.font('Helvetica').fontSize(7.2).fillColor(bodySlate)
        .text('Email: Info@sawahjayatrans.com', companyX + 14, compY, { width: companyW - 14, align: 'left' });

      // Baris 6: Website
      compY += 10;
      drawSmallGreenBullet(companyX + 6, compY + 4);
      doc.font('Helvetica-Bold').fontSize(7.2).fillColor(primaryGreen)
        .text('www.smartjourney.id', companyX + 14, compY, { width: companyW - 14, align: 'left' });

      // 5. GARIS HORIZONTAL / HEADER SEPARATOR (PERSIS REFERENSI)
      const headerSepY = 82;
      doc.strokeColor('#cbd5e1').lineWidth(0.8)
        .moveTo(leftMargin, headerSepY).lineTo(rightMargin, headerSepY).stroke();
      doc.roundedRect(leftMargin, headerSepY - 0.5, 90, 2, 1).fill(primaryGreen);

      // =========================================================================
      // 2. JUDUL DOKUMEN (INVOICE + PRIVATE TOUR) & BADGE PAID (PERSIS REFERENSI)
      // =========================================================================
      const titleY = 92;

      // Bar Aksen Vertikal Hijau di Sisi Kiri
      doc.roundedRect(leftMargin, titleY + 1, 4.5, 46, 2).fill(darkEmerald);

      // KIRI: Tipografi Hierarki INVOICE & Private Tour Sesuai Blueprint
      const titleTextX = leftMargin + 11;
      doc.font('Helvetica-Bold').fontSize(26).fillColor(darkSlate)
        .text('INVOICE', titleTextX, titleY - 2, { characterSpacing: 0.5 });

      const rawTrip = data.trip as any;
      const isSharedTrip = rawTrip?.type === 'shared' || 
        (data.trip.package || '').toLowerCase().includes('open trip') || 
        (data.trip.title || '').toLowerCase().includes('open trip') ||
        (data.trip.package || '').toLowerCase().includes('share tour');
      const tripCategoryTitle = isSharedTrip ? 'Open Trip' : 'Private Tour';

      doc.font('Helvetica-Bold').fontSize(16).fillColor(titleGreen)
        .text(tripCategoryTitle, titleTextX, titleY + 23);

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(bodySlate)
        .text('Official Booking Confirmation & Receipt', titleTextX, titleY + 41);

      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate)
        .text('Booking Summary & Payment Receipt', titleTextX, titleY + 51);

      // KANAN: BADGE PAID / LUNAS BESAR & TEGAS (Pill Shape dengan Checkmark Hijau)
      const isPaid = (data.paymentStatus || '').toLowerCase() === 'paid';
      const badgeW = 125;
      const badgeH = 38;
      const badgeX = rightMargin - badgeW;
      const badgeY = titleY + 2;

      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 12).fill(mintBg);
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 12).strokeColor(mintBorder).lineWidth(1).stroke();

      // Lingkaran Hijau Pekat dengan Checkmark Putih di Kiri Badge
      const checkCircleX = badgeX + 22;
      const checkCircleY = badgeY + (badgeH / 2);
      const checkCircleR = 11;

      doc.circle(checkCircleX, checkCircleY, checkCircleR).fill(paidGreen);

      // Vektor Checkmark Putih
      doc.strokeColor('#ffffff').lineWidth(2.2)
        .moveTo(checkCircleX - 4.5, checkCircleY)
        .lineTo(checkCircleX - 1, checkCircleY + 4)
        .lineTo(checkCircleX + 5, checkCircleY - 3.5)
        .stroke();

      // Teks "PAID" & "LUNAS" di Dalam Badge
      doc.font('Helvetica-Bold').fontSize(16).fillColor(darkEmerald)
        .text(isPaid ? 'PAID' : 'PENDING', badgeX + 38, badgeY + 6, { width: badgeW - 42, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(darkEmerald)
        .text(isPaid ? 'LUNAS' : 'MENUNGGU', badgeX + 38, badgeY + 23, { width: badgeW - 42, align: 'center', characterSpacing: 0.5 });

      // 8. POSISI INVOICE NO DI BAWAH BADGE (PERSIS REFERENSI)
      const invoiceNum = data.invoiceNumber || `INV-${data.bookingCode}`;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(darkSlate)
        .text(`Invoice No: ${invoiceNum}`, rightMargin - 200, titleY + 46, { width: 200, align: 'right' });

      // =========================================================================
      // 3. BOOKING INFORMATION CARD (PERSIS GAMBAR REFERENSI DENGAN TITIK DUA TERSEJAJAR)
      // =========================================================================
      const cardY = 154;
      const cardH = 82;

      doc.roundedRect(leftMargin, cardY, contentWidth, cardH, 8).fill(cardBg);
      doc.roundedRect(leftMargin, cardY, contentWidth, cardH, 8).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Header Card: Dot Hijau + BOOKING INFORMATION (Tanpa unicode emoji)
      doc.circle(leftMargin + 16, cardY + 11.5, 2.5).fill(primaryGreen);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryGreen)
        .text('BOOKING INFORMATION', leftMargin + 23, cardY + 7, { characterSpacing: 0.4 });

      // Garis Pembatas Vertikal di Tengah Card
      const midColX = leftMargin + (contentWidth / 2) - 10;
      doc.strokeColor(lightBorder).lineWidth(0.6)
        .moveTo(midColX, cardY + 22).lineTo(midColX, cardY + cardH - 8).stroke();

      // --- KOLOM KIRI (Booking ID, Booking Date, Travel Date dengan Highlight Box) ---
      const col1LabelX = leftMargin + 14;
      const col1ColonX = leftMargin + 76;
      const col1ValX = leftMargin + 84;

      // 1. Booking ID (Bold Hijau Teal Sesuai Referensi)
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(darkSlate).text('Booking ID', col1LabelX, cardY + 25);
      doc.font('Helvetica').fontSize(7.8).fillColor(darkSlate).text(':', col1ColonX, cardY + 25);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(primaryGreen).text(data.bookingCode, col1ValX, cardY + 24);

      // 2. Booking Date
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(darkSlate).text('Booking Date', col1LabelX, cardY + 42);
      doc.font('Helvetica').fontSize(7.8).fillColor(darkSlate).text(':', col1ColonX, cardY + 42);
      doc.font('Helvetica').fontSize(7.8).fillColor(darkSlate).text(data.bookingDate || '-', col1ValX, cardY + 42);

      // 3. Travel Date (Highlight Box Hijau Mint Sesuai Referensi)
      const travelDateVal = data.trip.departureDate || '-';
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(darkSlate).text('Travel Date', col1LabelX, cardY + 59);
      doc.font('Helvetica').fontSize(7.8).fillColor(darkSlate).text(':', col1ColonX, cardY + 59);

      const travelBoxW = 140;
      const travelBoxH = 21;
      const travelBoxY = cardY + 55;
      doc.roundedRect(col1ValX, travelBoxY, travelBoxW, travelBoxH, 5).fill(mintBg);
      doc.roundedRect(col1ValX, travelBoxY, travelBoxW, travelBoxH, 5).strokeColor(mintBorder).lineWidth(0.8).stroke();

      // Teks Tanggal di Dalam Highlight Box
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkEmerald)
        .text(travelDateVal, col1ValX, travelBoxY + 6, { width: travelBoxW, align: 'center' });

      // --- KOLOM KANAN (Customer, Phone, Email, Nationality, No. of Pax) ---
      const col2LabelX = midColX + 16;
      const col2ColonX = col2LabelX + 104;
      const col2ValX = col2ColonX + 8;
      const col2ValW = rightMargin - col2ValX - 10;

      // Gunakan data customer aktual tanpa dummy/hardcoded palsu
      const custPhone = (data.customer.phone && data.customer.phone.trim() !== '' && data.customer.phone !== '-') 
        ? data.customer.phone.trim() 
        : '-';
      const custEmail = (data.customer.email && data.customer.email.trim() !== '' && data.customer.email !== '-') 
        ? data.customer.email.trim() 
        : '-';
      const guestCount = data.trip.participantsCount || (data.trip.participantsNames ? data.trip.participantsNames.length : 1);

      // Row 1: Customer
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Customer', col2LabelX, cardY + 23);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate).text(':', col2ColonX, cardY + 23);
      doc.font('Helvetica-Bold').fontSize(7.8).fillColor(darkSlate).text(data.customer.name || '-', col2ValX, cardY + 23, { width: col2ValW });

      // Row 2: Customer Phone / WhatsApp
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Customer Phone / WhatsApp', col2LabelX, cardY + 35);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate).text(':', col2ColonX, cardY + 35);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate).text(custPhone, col2ValX, cardY + 35, { width: col2ValW });

      // Row 3: Customer Email
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Customer Email', col2LabelX, cardY + 47);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate).text(':', col2ColonX, cardY + 47);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate).text(custEmail, col2ValX, cardY + 47, { width: col2ValW, ellipsis: true });

      // Row 4: Nationality
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('Nationality', col2LabelX, cardY + 59);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate).text(':', col2ColonX, cardY + 59);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate).text(data.customer.nationality || 'Indonesia (Domestic)', col2ValX, cardY + 59, { width: col2ValW });

      // Row 5: No. of Pax
      doc.font('Helvetica').fontSize(7.5).fillColor(mutedSlate).text('No. of Pax', col2LabelX, cardY + 71);
      doc.font('Helvetica').fontSize(7.5).fillColor(darkSlate).text(':', col2ColonX, cardY + 71);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text(`${guestCount} Pax`, col2ValX, cardY + 71, { width: col2ValW });

      // =========================================================================
      // 4. TABEL TRANSAKSI (HEADER HIJAU TEAL, GARIS TIPIS, SPACING & ALIGNMENT RAPI)
      // =========================================================================
      let curY = 244;

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

      // Definisi Lebar Kolom Tabel (Total = contentWidth: 539.28 pt)
      const colNoW = 34;
      const colDescW = 275;
      const colQtyW = 52;
      const colUnitW = 86;
      const colAmtW = contentWidth - (colNoW + colDescW + colQtyW + colUnitW); // 92.28 pt

      const colNoX = leftMargin;
      const colDescX = colNoX + colNoW;
      const colQtyX = colDescX + colDescW;
      const colUnitX = colQtyX + colQtyW;
      const colAmtX = colUnitX + colUnitW;

      // HEADER TABEL HIJAU SOLID (Rounded Top Corners Sesuai Referensi)
      const tableHeaderH = 23;
      doc.roundedRect(leftMargin, curY, contentWidth, tableHeaderH, 5).fill(primaryGreen);

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
      doc.text('No.', colNoX, curY + 7, { width: colNoW, align: 'center' });
      doc.text('Description / Detail Transaksi', colDescX + 10, curY + 7, { width: colDescW - 14, align: 'left' });
      doc.text('Qty', colQtyX, curY + 7, { width: colQtyW, align: 'center' });
      doc.text('Unit Price', colUnitX, curY + 7, { width: colUnitW - 10, align: 'right' });
      doc.text('Amount', colAmtX, curY + 7, { width: colAmtW - 10, align: 'right' });

      curY += tableHeaderH;

      // Render Baris-Baris Items (Spacious, Alternating, Garis Halus)
      lineItems.forEach((item, index) => {
        const rowH = 26;

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
      const leftColW = 276;
      const rightColW = contentWidth - leftColW - 12; // 251.28 pt
      const rightColX = leftMargin + leftColW + 12;
      const payBoxH = 96;

      // Helper function untuk ikon bulat hijau di baris panel
      const drawPanelRowIcon = (cx: number, cy: number) => {
        doc.save();
        doc.circle(cx, cy, 6).fill(primaryGreen);
        doc.circle(cx, cy, 2.8).fill('#ffffff');
        doc.restore();
      };

      // --- PANEL KIRI: PAYMENT INFORMATION ---
      doc.roundedRect(leftMargin, blockTopY, leftColW, payBoxH, 8).fill(cardBg);
      doc.roundedRect(leftMargin, blockTopY, leftColW, payBoxH, 8).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Header Bar Panel Kiri: PAYMENT INFORMATION (Tanpa unicode emoji)
      doc.circle(leftMargin + 16, blockTopY + 12, 2.5).fill(primaryGreen);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text('PAYMENT INFORMATION', leftMargin + 23, blockTopY + 8, { characterSpacing: 0.4 });

      const pRowStartX = leftMargin + 12;
      const pLabelX = pRowStartX + 16;
      const pColonX = pLabelX + 76;
      const pValX = pColonX + 8;
      const pValW = leftColW - (pValX - leftMargin) - 10;

      let pRowY = blockTopY + 23;

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

      // Header Bar Panel Kanan: PAYMENT SUMMARY (Tanpa unicode emoji)
      doc.circle(rightColX + 16, blockTopY + 12, 2.5).fill(primaryGreen);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text('PAYMENT SUMMARY', rightColX + 23, blockTopY + 8, { characterSpacing: 0.4 });

      const totValW = 100;
      const totValX = rightColX + rightColW - totValW - 12;

      // Subtotal
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('Subtotal', rightColX + 14, blockTopY + 26);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate)
        .text(formatRupiah(subtotal), totValX, blockTopY + 26, { width: totValW, align: 'right' });

      // Discount
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkSlate).text('Discount', rightColX + 14, blockTopY + 41);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(discount > 0 ? '#dc2626' : darkSlate)
        .text(discount > 0 ? ('- ' + formatRupiah(discount)) : 'Rp 0', totValX, blockTopY + 41, { width: totValW, align: 'right' });

      // TOTAL FOCAL POINT (HILIGHT HIJAU MINT SESUAI GAMBAR REFERENSI)
      const totalBoxY = blockTopY + 56;
      const totalBoxH = 34;
      doc.roundedRect(rightColX + 8, totalBoxY, rightColW - 16, totalBoxH, 6).fill(mintBg);
      doc.roundedRect(rightColX + 8, totalBoxY, rightColW - 16, totalBoxH, 6).strokeColor(mintBorder).lineWidth(0.8).stroke();

      doc.font('Helvetica-Bold').fontSize(12).fillColor(darkSlate)
        .text('TOTAL', rightColX + 16, totalBoxY + 11);

      doc.font('Helvetica-Bold').fontSize(14).fillColor(darkSlate)
        .text(formatRupiah(finalTotal), totValX - 10, totalBoxY + 10, { width: totValW + 10, align: 'right' });

      curY = blockTopY + payBoxH + 12;

      // =========================================================================
      // 6. TERMS & NOTES (SESUAI GAMBAR REFERENSI DENGAN NOMOR BULAT HIJAU)
      // =========================================================================
      const notesH = 88;
      doc.roundedRect(leftMargin, curY, contentWidth, notesH, 8).fill(cardBg);
      doc.roundedRect(leftMargin, curY, contentWidth, notesH, 8).strokeColor(borderSlate).lineWidth(0.8).stroke();

      // Dot Hijau + TERMS & NOTES (Tanpa unicode emoji)
      doc.circle(leftMargin + 16, curY + 12, 2.5).fill(primaryGreen);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text('TERMS & NOTES', leftMargin + 23, curY + 8, { characterSpacing: 0.4 });

      // 3 Butir Ketentuan dengan Badge Nomor Bulat Hijau Sesuai Gambar
      const termsList = [
        'Dokumen invoice ini merupakan bukti konfirmasi pemesanan dan tanda terima pembayaran resmi yang sah dari Smart Journey (PT Sawah Jaya Trans).',
        'Rincian penjemputan dan armada telah terjadwal secara resmi. Harap siap di lokasi penjemputan 15 menit sebelum waktu keberangkatan.',
        'Dokumen ini dapat ditunjukkan langsung kepada pengemudi / tim penjemputan resmi Smart Journey saat hari keberangkatan.'
      ];

      let termY = curY + 24;
      termsList.forEach((termText, idx) => {
        const numCircleX = leftMargin + 18;
        const numCircleY = termY + 4;
        const numCircleR = 6;

        // Lingkaran Bulat Hijau
        doc.circle(numCircleX, numCircleY, numCircleR).fill(primaryGreen);

        // Angka Putih di Tengah Lingkaran
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#ffffff')
          .text(String(idx + 1), numCircleX - 4, numCircleY - 3.2, { width: 8, align: 'center' });

        // Teks Ketentuan
        doc.font('Helvetica').fontSize(7).fillColor(bodySlate)
          .text(termText, leftMargin + 30, termY, { width: contentWidth - 40 });

        termY += 14;
      });

      // Sub-note di Bawah Butir Ketentuan
      doc.font('Helvetica').fontSize(7).fillColor(bodySlate)
        .text('Bantuan operasional & perubahan jadwal dapat dikonfirmasikan melalui WhatsApp resmi Smart Journey di +62 852-1234-7289.', leftMargin + 30, termY + 1, { width: contentWidth - 40 });

      // =========================================================================
      // 7. BOTTOM DECORATION / FADE & FOOTER (PERSIS SESUAI GAMBAR REFERENSI)
      // Nuansa Fade Hijau Lengkung Lembut di Bagian Bawah Halaman + Shield Icon + Kode Verifikasi
      // =========================================================================
      const footerY = 746;

      // Background Fade Hijau Lembut di Bagian Bawah
      doc.roundedRect(leftMargin, footerY, contentWidth, 54, 8).fill('#e8f8f0');

      // Shield Checkmark Icon di Tengah Footer
      const centerShieldX = leftMargin + (contentWidth / 2) - 86;
      const centerShieldY = footerY + 27;

      doc.circle(centerShieldX, centerShieldY, 11).fill(mintBg);
      doc.circle(centerShieldX, centerShieldY, 11).strokeColor(paidGreen).lineWidth(1.5).stroke();
      doc.strokeColor(paidGreen).lineWidth(2)
        .moveTo(centerShieldX - 4.5, centerShieldY)
        .lineTo(centerShieldX - 1, centerShieldY + 3.8)
        .lineTo(centerShieldX + 5, centerShieldY - 3.5)
        .stroke();

      // Teks Kode Verifikasi di Samping Shield Icon
      const vHash = data.verificationHash || `SJ-VERIFIED-${data.bookingCode}-0238895Z`;
      const vTextX = centerShieldX + 18;

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text('Kode Verifikasi:', vTextX, footerY + 13);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate)
        .text(vHash, vTextX, footerY + 24);
      doc.font('Helvetica').fontSize(7.2).fillColor(mutedSlate)
        .text('Dokumen Resmi Sah', vTextX, footerY + 36);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
