import PDFDocument from 'pdfkit';

export interface FinalSummaryPdfInput {
  bookingCode: string;
  bookingDate: string;
  bookingStatus: string;
  paymentStatus: string;
  verificationHash: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    pickupLocation: string;
    dropoffLocation?: string;
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
    itinerary?: Array<{ day?: string | number; title?: string; desc?: string; activities?: string[] } | string>;
  };
  payment: {
    baseAmount: number;
    uniqueCode: number;
    totalPaid: number;
    currency: string;
    paidAt: string;
    paymentDate: string;
    paymentId: string;
    paymentMethod: string;
  };
  company?: {
    name: string;
    legalEntity: string;
    brand: string;
    hotline: string;
    email: string;
    website: string;
    operationalHub: string;
  };
}

function formatRupiah(amount: number): string {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

export function generatePrivateTourPdf(data: FinalSummaryPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `SmartJourney-Final-Booking-${data.bookingCode}`,
          Author: 'Smart Journey Indonesia',
          Subject: `Final Booking Summary - ${data.bookingCode}`,
          Keywords: 'Smart Journey, Private Tour, Booking, Invoice, Voucher'
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#1e3a2f'; // Deep emerald forest
      const accentColor = '#b45309';  // Amber/gold
      const darkColor = '#0f172a';    // Slate 900
      const mutedColor = '#64748b';   // Slate 500
      const lightBg = '#f8fafc';      // Slate 50
      const borderColor = '#e2e8f0';  // Slate 200

      const pageWidth = 595.28;
      const contentWidth = pageWidth - 80;

      // =========================================================================
      // 1. HEADER SECTION
      // =========================================================================
      // Company brand bar
      doc.rect(40, 40, contentWidth, 68).fill(primaryColor);

      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
        .text('SMART JOURNEY', 56, 52, { characterSpacing: 1.5 });
      doc.fontSize(8.5).font('Helvetica')
        .fillColor('#cbd5e1')
        .text('PT SMART JOURNEY TRANSINDO • INDONESIA TRAVEL NETWORK', 56, 75);
      doc.fontSize(8).font('Helvetica')
        .fillColor('#94a3b8')
        .text('Hub: Malang & Surabaya, Jawa Timur • Hotline: +62 852-1234-7289 • support@smartjourney.co.id', 56, 88);

      // Title & Status Badge
      doc.fillColor(darkColor).fontSize(14).font('Helvetica-Bold')
        .text('FINAL BOOKING SUMMARY', 40, 122);
      doc.fontSize(9).font('Helvetica')
        .fillColor(mutedColor)
        .text('Dokumen Resmi Konfirmasi Tur & Bukti Pembayaran Lunas', 40, 140);

      // Status Badges (Right side)
      const badgeX = pageWidth - 190;
      doc.roundedRect(badgeX, 120, 70, 22, 4).fill('#ecfdf5');
      doc.rect(badgeX, 120, 70, 22).strokeColor('#10b981').lineWidth(1).stroke();
      doc.fillColor('#065f46').fontSize(9).font('Helvetica-Bold')
        .text('✓ PAID', badgeX + 16, 126);

      doc.roundedRect(badgeX + 76, 120, 74, 22, 4).fill('#eff6ff');
      doc.rect(badgeX + 76, 120, 74, 22).strokeColor('#3b82f6').lineWidth(1).stroke();
      doc.fillColor('#1e40af').fontSize(8.5).font('Helvetica-Bold')
        .text('CONFIRMED', badgeX + 82, 126);

      // Thin divider
      doc.strokeColor(borderColor).lineWidth(1)
        .moveTo(40, 160).lineTo(pageWidth - 40, 160).stroke();

      // =========================================================================
      // 2. BOOKING OVERVIEW CARDS (2 Columns)
      // =========================================================================
      let curY = 172;
      const colWidth = (contentWidth - 16) / 2;

      // Left: Booking Reference
      doc.roundedRect(40, curY, colWidth, 78, 6).fill(lightBg);
      doc.roundedRect(40, curY, colWidth, 78, 6).strokeColor(borderColor).lineWidth(0.8).stroke();

      doc.fillColor(accentColor).fontSize(8).font('Helvetica-Bold')
        .text('KODE BOOKING RESMI', 52, curY + 10);
      doc.fillColor(darkColor).fontSize(16).font('Helvetica-Bold')
        .text(data.bookingCode, 52, curY + 22);

      doc.fillColor(mutedColor).fontSize(8).font('Helvetica')
        .text('Tanggal Reservasi:', 52, curY + 45);
      doc.fillColor(darkColor).font('Helvetica-Bold')
        .text(data.bookingDate, 130, curY + 45);

      doc.fillColor(mutedColor).font('Helvetica')
        .text('Verifikasi Sistem:', 52, curY + 59);
      doc.fillColor('#0369a1').fontSize(7.5).font('Helvetica-Bold')
        .text(data.verificationHash, 130, curY + 59);

      // Right: Customer Summary
      const col2X = 40 + colWidth + 16;
      doc.roundedRect(col2X, curY, colWidth, 78, 6).fill(lightBg);
      doc.roundedRect(col2X, curY, colWidth, 78, 6).strokeColor(borderColor).lineWidth(0.8).stroke();

      doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
        .text('DATA PEMESAN (LEAD TRAVELER)', col2X + 12, curY + 10);

      doc.fillColor(mutedColor).fontSize(8).font('Helvetica')
        .text('Nama:', col2X + 12, curY + 26);
      doc.fillColor(darkColor).font('Helvetica-Bold')
        .text(data.customer.name || '-', col2X + 50, curY + 26);

      doc.fillColor(mutedColor).font('Helvetica')
        .text('Kontak:', col2X + 12, curY + 41);
      doc.fillColor(darkColor).font('Helvetica')
        .text(data.customer.phone || '-', col2X + 50, curY + 41);

      doc.fillColor(mutedColor).font('Helvetica')
        .text('Email:', col2X + 12, curY + 56);
      doc.fillColor(darkColor).font('Helvetica')
        .text(data.customer.email || '-', col2X + 50, curY + 56);

      // =========================================================================
      // 3. TOUR SPECIFICATIONS & OPERATIONAL LOGISTICS
      // =========================================================================
      curY += 92;

      doc.fillColor(darkColor).fontSize(10).font('Helvetica-Bold')
        .text('RINCIAN PERJALANAN PRIVATE TOUR', 40, curY);

      curY += 16;
      const tourBoxHeight = 88;
      doc.roundedRect(40, curY, contentWidth, tourBoxHeight, 6).fill('#ffffff');
      doc.roundedRect(40, curY, contentWidth, tourBoxHeight, 6).strokeColor(borderColor).lineWidth(0.8).stroke();

      const leftMargin = 52;
      const midCol = 40 + contentWidth / 2;

      // Row 1
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Nama Paket Tur:', leftMargin, curY + 10);
      doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold').text(data.trip.title, leftMargin + 85, curY + 10, { width: 170 });

      doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Pilihan Paket:', midCol, curY + 10);
      doc.fillColor(darkColor).fontSize(9).font('Helvetica-Bold').text(data.trip.package, midCol + 70, curY + 10);

      // Row 2
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Tanggal Wisata:', leftMargin, curY + 28);
      doc.fillColor(darkColor).fontSize(8.5).font('Helvetica-Bold').text(data.trip.departureDate || '-', leftMargin + 85, curY + 28);

      doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Durasi Tur:', midCol, curY + 28);
      doc.fillColor(darkColor).fontSize(8.5).font('Helvetica-Bold').text(data.trip.duration || '1 Hari', midCol + 70, curY + 28);

      // Row 3
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Jumlah Peserta:', leftMargin, curY + 44);
      doc.fillColor(darkColor).fontSize(8.5).font('Helvetica-Bold').text(`${data.trip.participantsCount} Orang`, leftMargin + 85, curY + 44);

      doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Armada Mobil:', midCol, curY + 44);
      doc.fillColor(darkColor).fontSize(8.5).font('Helvetica-Bold').text(data.trip.vehicleName || 'Standard Tourism Vehicle', midCol + 70, curY + 44);

      // Row 4 (Locations)
      doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Titik Penjemputan:', leftMargin, curY + 60);
      doc.fillColor(darkColor).fontSize(8).font('Helvetica').text(data.customer.pickupLocation || data.trip.pickupLocation || 'Sesuai Konfirmasi', leftMargin + 85, curY + 60, { width: 170 });

      if (data.customer.dropoffLocation || data.trip.dropoffLocation) {
        doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('Titik Pengantaran:', midCol, curY + 60);
        doc.fillColor(darkColor).fontSize(8).font('Helvetica').text(data.customer.dropoffLocation || data.trip.dropoffLocation || '-', midCol + 85, curY + 60, { width: 150 });
      }

      // =========================================================================
      // 4. GUEST MANIFEST TABLE
      // =========================================================================
      curY += tourBoxHeight + 14;

      doc.fillColor(darkColor).fontSize(10).font('Helvetica-Bold')
        .text('MANIFEST RESMI PESERTA TUR', 40, curY);

      curY += 14;
      // Manifest Table Header
      doc.rect(40, curY, contentWidth, 18).fill('#f1f5f9');
      doc.rect(40, curY, contentWidth, 18).strokeColor(borderColor).lineWidth(0.8).stroke();

      doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold')
        .text('NO', 50, curY + 5)
        .text('NAMA LENGKAP SESUAI IDENTITAS', 80, curY + 5)
        .text('KEWARGANEGARAAN / STATUS', 380, curY + 5);

      curY += 18;
      const manifestList = (data.trip.participantsManifest && data.trip.participantsManifest.length > 0)
        ? data.trip.participantsManifest
        : (data.trip.participantsNames || []).map((name) => ({ name, nationality: 'Indonesia / Domestik' }));

      const displayList = manifestList.length > 0 ? manifestList : [{ name: data.customer.name, nationality: 'Indonesia' }];

      displayList.forEach((guest, index) => {
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(40, curY, contentWidth, 16).fill(rowBg);
        doc.rect(40, curY, contentWidth, 16).strokeColor(borderColor).lineWidth(0.5).stroke();

        doc.fillColor(darkColor).fontSize(8).font('Helvetica')
          .text(String(index + 1), 50, curY + 4)
          .text(guest.name || `Peserta ${index + 1}`, 80, curY + 4)
          .text(guest.nationality || 'Indonesia / Domestik', 380, curY + 4);

        curY += 16;
      });

      // =========================================================================
      // 5. FINANCIAL TRANSACTION LEDGER
      // =========================================================================
      curY += 14;

      doc.fillColor(darkColor).fontSize(10).font('Helvetica-Bold')
        .text('RINCIAN PEMBAYARAN (FINANCIAL LEDGER)', 40, curY);

      curY += 14;
      const paymentBoxHeight = 72;
      doc.roundedRect(40, curY, contentWidth, paymentBoxHeight, 6).fill('#ffffff');
      doc.roundedRect(40, curY, contentWidth, paymentBoxHeight, 6).strokeColor(borderColor).lineWidth(0.8).stroke();

      // Ledger Rows
      doc.fillColor(darkColor).fontSize(8.5).font('Helvetica')
        .text('Harga Dasar Paket Private Tour', 52, curY + 10);
      doc.font('Helvetica-Bold')
        .text(formatRupiah(data.payment.baseAmount), pageWidth - 160, curY + 10, { width: 108, align: 'right' });

      doc.font('Helvetica')
        .text('Kode Unik Transaksi (Authoritative Verification Code)', 52, curY + 24);
      doc.font('Helvetica-Bold').fillColor('#0284c7')
        .text(formatRupiah(data.payment.uniqueCode), pageWidth - 160, curY + 24, { width: 108, align: 'right' });

      // Total Paid Highlight Row
      doc.rect(46, curY + 39, contentWidth - 12, 24).fill('#ecfdf5');
      doc.fillColor('#065f46').fontSize(9).font('Helvetica-Bold')
        .text('TOTAL PEMBAYARAN LUNAS (SETTLED)', 52, curY + 46);
      doc.fontSize(10).font('Helvetica-Bold')
        .text(formatRupiah(data.payment.totalPaid), pageWidth - 160, curY + 46, { width: 108, align: 'right' });

      // Payment metadata sub-bar
      curY += paymentBoxHeight + 6;
      doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica')
        .text(`Metode: ${data.payment.paymentMethod || 'ArtoPay Gateway'}  •  Ref / Trx ID: ${data.payment.paymentId || 'SETTLED_ARTOPAY'}  •  Waktu Lunas: ${data.payment.paymentDate || data.payment.paidAt}`, 42, curY);

      // =========================================================================
      // 6. ITINERARY & HIGHLIGHTS
      // =========================================================================
      curY += 18;

      doc.fillColor(darkColor).fontSize(10).font('Helvetica-Bold')
        .text('JADWAL PERJALANAN (ITINERARY HIGHLIGHTS)', 40, curY);

      curY += 14;
      const itinerary = data.trip.itinerary || [];
      if (Array.isArray(itinerary) && itinerary.length > 0) {
        itinerary.slice(0, 4).forEach((item, idx) => {
          let title = '';
          let desc = '';
          if (typeof item === 'string') {
            title = `Tahap ${idx + 1}`;
            desc = item;
          } else {
            title = String(item.day || item.title || `Hari ${idx + 1}`);
            desc = String(item.desc || (item.activities ? item.activities.join(', ') : item.title || ''));
          }

          doc.rect(40, curY, contentWidth, 22).fill(lightBg);
          doc.rect(40, curY, contentWidth, 22).strokeColor(borderColor).lineWidth(0.5).stroke();

          doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
            .text(title, 50, curY + 4);
          doc.fillColor(darkColor).fontSize(7.5).font('Helvetica')
            .text(desc, 140, curY + 4, { width: contentWidth - 110, ellipsis: true });

          curY += 24;
        });
      } else {
        doc.fillColor(mutedColor).fontSize(8).font('Helvetica')
          .text('Itinerary standar operasional sesuai spesifikasi paket reservasi.', 40, curY);
        curY += 16;
      }

      // =========================================================================
      // 7. FOOTER & AUTHENTICATION SEAL
      // =========================================================================
      const footerY = 770;

      doc.strokeColor(borderColor).lineWidth(0.8)
        .moveTo(40, footerY).lineTo(pageWidth - 40, footerY).stroke();

      doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica')
        .text('Dokumen ini diterbitkan secara otomatis dan sah oleh sistem komputer Smart Journey Indonesia.', 40, footerY + 8);
      doc.text('Tunjukkan dokumen ini kepada Tour Coordinator / Driver resmi kami saat hari penjemputan.', 40, footerY + 18);

      doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold')
        .text(`VERIFIED ID: ${data.verificationHash}`, pageWidth - 260, footerY + 8, { width: 220, align: 'right' });
      doc.fillColor(mutedColor).fontSize(7).font('Helvetica')
        .text(`Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} WIB`, pageWidth - 260, footerY + 18, { width: 220, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
