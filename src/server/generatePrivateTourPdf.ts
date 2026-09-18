import PDFDocument from 'pdfkit';

export interface FinalSummaryPdfInput {
  bookingCode: string;
  bookingDate: string;
  bookingStatus: string;
  paymentStatus: string;
  confirmedAt?: string;
  verificationCode?: string;
  verificationHash?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
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
    brand: string;
    hotline: string;
    email: string;
    operationalHub: string;
  };
}

function formatRupiah(amount: number): string {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

interface ParsedDayGroup {
  dayTitle: string;
  activities: string[];
}

function parseItinerary(itinerary: any[]): ParsedDayGroup[] {
  if (!Array.isArray(itinerary) || itinerary.length === 0) {
    return [];
  }

  // If already structured objects
  if (typeof itinerary[0] === 'object' && itinerary[0] !== null && (itinerary[0].day || itinerary[0].dayTitle || itinerary[0].title)) {
    return itinerary.map((item, idx) => {
      const dayTitle = (item.dayTitle || item.title || `DAY ${item.day || idx + 1}`).toUpperCase();
      let activities: string[] = [];
      if (Array.isArray(item.activities)) {
        activities = item.activities.map((a: any) => typeof a === 'string' ? a : `${a.time || ''} — ${a.title || a.desc || ''}`.trim());
      } else if (item.desc) {
        activities = [item.desc];
      }
      return { dayTitle, activities };
    });
  }

  // If string array
  const dayGroups: Map<number, { dayTitle: string; activities: string[] }> = new Map();
  let defaultDay = 1;

  for (const rawItem of itinerary) {
    const item = String(rawItem).trim();
    if (!item) continue;

    if (item.startsWith('Day ') && item.includes('|')) {
      const parts = item.split('|').map(p => p.trim());
      const dayPart = parts[0];
      const time = parts[1] || '';
      const title = parts[2] || '';
      const desc = parts[3] || '';
      
      const dayNumMatch = dayPart.match(/\d+/);
      const dayNum = dayNumMatch ? parseInt(dayNumMatch[0]) : 1;
      
      let dayTitle = `DAY ${dayNum}`;
      if (dayPart.includes('-')) {
        const sub = dayPart.substring(dayPart.indexOf('-') + 1).trim();
        dayTitle = `DAY ${dayNum} — ${sub.toUpperCase()}`;
      }

      if (!dayGroups.has(dayNum)) {
        dayGroups.set(dayNum, { dayTitle, activities: [] });
      }

      const actText = time ? `${time} — ${title || desc}` : `${title || desc}`;
      dayGroups.get(dayNum)!.activities.push(actText);
    } else if (item.includes('-') && /^\d{1,2}[:.]\d{2}/.test(item)) {
      const dashIdx = item.indexOf('-');
      const time = item.substring(0, dashIdx).trim();
      const act = item.substring(dashIdx + 1).trim();
      if (!dayGroups.has(defaultDay)) {
        dayGroups.set(defaultDay, { dayTitle: `DAY ${defaultDay} — JADWAL PERJALANAN`, activities: [] });
      }
      dayGroups.get(defaultDay)!.activities.push(`${time} — ${act}`);
    } else {
      if (!dayGroups.has(defaultDay)) {
        dayGroups.set(defaultDay, { dayTitle: `DAY ${defaultDay} — JADWAL PERJALANAN`, activities: [] });
      }
      dayGroups.get(defaultDay)!.activities.push(item);
    }
  }

  if (dayGroups.size === 0) return [];

  return Array.from(dayGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, grp]) => grp);
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
          Author: 'Smart Journey',
          Subject: 'FINAL BOOKING CONFIRMATION - Booking Summary & Payment Receipt',
          Keywords: 'Smart Journey, Private Tour, Final Booking Confirmation, Receipt, Voucher'
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primaryEmerald = '#134e4a'; // Deep Emerald Slate
      const darkSlate = '#0f172a';      // Slate 900
      const bodySlate = '#334155';      // Slate 700
      const mutedSlate = '#64748b';     // Slate 500
      const cardBg = '#f8fafc';         // Slate 50
      const strokeLine = '#e2e8f0';     // Slate 200
      const emeraldBg = '#ecfdf5';      // Emerald 50
      const emeraldBorder = '#10b981';  // Emerald 500
      const emeraldText = '#065f46';    // Emerald 800

      const pageWidth = 595.28;
      const contentWidth = pageWidth - 72; // 36 margin on left and right

      // =========================================================================
      // 1. OFFICIAL DOCUMENT HEADER
      // =========================================================================
      // Brand Bar
      doc.rect(36, 36, contentWidth, 62).fill(primaryEmerald);

      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
        .text('SMART JOURNEY', 50, 48, { characterSpacing: 1.5 });
      
      doc.fillColor('#99f6e4').fontSize(11).font('Helvetica-Bold')
        .text('FINAL BOOKING CONFIRMATION', 50, 68);

      doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica')
        .text('Booking Summary & Payment Receipt', 50, 82);

      // Top Right Status Badges inside Brand Bar
      const topBadgeX = pageWidth - 160;
      doc.roundedRect(topBadgeX, 46, 110, 20, 4).fill(emeraldBg);
      doc.roundedRect(topBadgeX, 46, 110, 20, 4).strokeColor(emeraldBorder).lineWidth(1).stroke();
      doc.fillColor(emeraldText).fontSize(8).font('Helvetica-Bold')
        .text('✓ CONFIRMED & PAID', topBadgeX + 6, 52, { width: 98, align: 'center' });

      doc.fillColor('#cbd5e1').fontSize(7.5).font('Helvetica')
        .text(`Code: ${data.bookingCode}`, topBadgeX, 72, { width: 110, align: 'center' });

      let curY = 106;

      // =========================================================================
      // 2. BOOKING STATUS & CUSTOMER INFORMATION (Two Column Row)
      // =========================================================================
      const colWidth = (contentWidth - 12) / 2;
      const leftColX = 36;
      const rightColX = 36 + colWidth + 12;

      // LEFT: BOOKING STATUS
      const statusBoxHeight = 84;
      doc.roundedRect(leftColX, curY, colWidth, statusBoxHeight, 5).fill(cardBg);
      doc.roundedRect(leftColX, curY, colWidth, statusBoxHeight, 5).strokeColor(strokeLine).lineWidth(0.8).stroke();

      doc.fillColor(primaryEmerald).fontSize(8.5).font('Helvetica-Bold')
        .text('BOOKING STATUS', leftColX + 12, curY + 8);

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Booking Code:', leftColX + 12, curY + 22);
      doc.fillColor(darkSlate).fontSize(10).font('Helvetica-Bold').text(data.bookingCode, leftColX + 85, curY + 20);

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Booking Status:', leftColX + 12, curY + 37);
      doc.fillColor(emeraldText).fontSize(8.5).font('Helvetica-Bold').text('CONFIRMED', leftColX + 85, curY + 36);

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Payment Status:', leftColX + 12, curY + 52);
      doc.fillColor(emeraldText).fontSize(8.5).font('Helvetica-Bold').text('PAID', leftColX + 85, curY + 51);

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Booking Date:', leftColX + 12, curY + 67);
      doc.fillColor(darkSlate).fontSize(7.5).font('Helvetica-Bold').text(data.bookingDate || '-', leftColX + 85, curY + 67);

      // RIGHT: CUSTOMER INFORMATION
      doc.roundedRect(rightColX, curY, colWidth, statusBoxHeight, 5).fill(cardBg);
      doc.roundedRect(rightColX, curY, colWidth, statusBoxHeight, 5).strokeColor(strokeLine).lineWidth(0.8).stroke();

      doc.fillColor(primaryEmerald).fontSize(8.5).font('Helvetica-Bold')
        .text('CUSTOMER INFORMATION', rightColX + 12, curY + 8);

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Customer Name:', rightColX + 12, curY + 22);
      doc.fillColor(darkSlate).fontSize(8.5).font('Helvetica-Bold').text(data.customer.name || '-', rightColX + 85, curY + 22, { width: colWidth - 95 });

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Email:', rightColX + 12, curY + 37);
      doc.fillColor(bodySlate).fontSize(7.5).font('Helvetica').text(data.customer.email || '-', rightColX + 85, curY + 37, { width: colWidth - 95 });

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Phone:', rightColX + 12, curY + 52);
      doc.fillColor(bodySlate).fontSize(7.5).font('Helvetica').text(data.customer.phone || '-', rightColX + 85, curY + 52);

      const guestCount = data.trip.participantsCount || (data.trip.participantsNames ? data.trip.participantsNames.length : 1);
      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Number of Guests:', rightColX + 12, curY + 67);
      doc.fillColor(darkSlate).fontSize(7.5).font('Helvetica-Bold').text(`${guestCount} Orang`, rightColX + 85, curY + 67);

      curY += statusBoxHeight + 10;

      // =========================================================================
      // 3. TRIP INFORMATION & PICKUP INFORMATION
      // =========================================================================
      const tripBoxHeight = 84;
      doc.roundedRect(leftColX, curY, colWidth, tripBoxHeight, 5).fill('#ffffff');
      doc.roundedRect(leftColX, curY, colWidth, tripBoxHeight, 5).strokeColor(strokeLine).lineWidth(0.8).stroke();

      doc.fillColor(primaryEmerald).fontSize(8.5).font('Helvetica-Bold')
        .text('TRIP INFORMATION', leftColX + 12, curY + 8);

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Tour Name:', leftColX + 12, curY + 22);
      doc.fillColor(darkSlate).fontSize(8).font('Helvetica-Bold').text(data.trip.title, leftColX + 75, curY + 22, { width: colWidth - 85 });

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Package:', leftColX + 12, curY + 37);
      doc.fillColor(bodySlate).fontSize(7.5).font('Helvetica-Bold').text(data.trip.package, leftColX + 75, curY + 37, { width: colWidth - 85 });

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Travel Date:', leftColX + 12, curY + 52);
      doc.fillColor(darkSlate).fontSize(7.5).font('Helvetica-Bold').text(data.trip.departureDate || '-', leftColX + 75, curY + 52);

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Duration & Fleet:', leftColX + 12, curY + 67);
      doc.fillColor(bodySlate).fontSize(7.5).font('Helvetica').text(`${data.trip.duration || '1 Hari'} • ${data.trip.vehicleName || 'Private Vehicle'}`, leftColX + 75, curY + 67, { width: colWidth - 85 });

      // RIGHT: PICKUP INFORMATION
      doc.roundedRect(rightColX, curY, colWidth, tripBoxHeight, 5).fill('#ffffff');
      doc.roundedRect(rightColX, curY, colWidth, tripBoxHeight, 5).strokeColor(strokeLine).lineWidth(0.8).stroke();

      doc.fillColor(primaryEmerald).fontSize(8.5).font('Helvetica-Bold')
        .text('PICKUP INFORMATION', rightColX + 12, curY + 8);

      const pickupLoc = data.pickup?.location || data.customer.pickupLocation || data.trip.pickupLocation || 'Hotel Lobby / Meeting Point';
      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Pickup Location:', rightColX + 12, curY + 22);
      doc.fillColor(darkSlate).fontSize(7.5).font('Helvetica-Bold').text(pickupLoc, rightColX + 85, curY + 22, { width: colWidth - 95 });

      const pickupDate = data.pickup?.date || data.trip.departureDate || '-';
      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Pickup Date:', rightColX + 12, curY + 50);
      doc.fillColor(bodySlate).fontSize(7.5).font('Helvetica').text(pickupDate, rightColX + 85, curY + 50);

      const pickupTime = data.pickup?.time;
      if (pickupTime) {
        doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Pickup Time:', rightColX + 12, curY + 65);
        doc.fillColor(emeraldText).fontSize(7.5).font('Helvetica-Bold').text(pickupTime, rightColX + 85, curY + 65);
      } else {
        doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Pickup Time:', rightColX + 12, curY + 65);
        doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Sesuai jadwal konfirmasi driver', rightColX + 85, curY + 65);
      }

      curY += tripBoxHeight + 10;

      // =========================================================================
      // 4. ITINERARY SECTION (Day-by-Day Structure)
      // =========================================================================
      doc.fillColor(darkSlate).fontSize(9).font('Helvetica-Bold')
        .text('ITINERARY (RENCANA PERJALANAN)', 36, curY);

      curY += 14;
      const parsedItinerary = parseItinerary(data.trip.itinerary || []);

      if (parsedItinerary.length > 0) {
        // Display up to 3 day groups cleanly
        for (const group of parsedItinerary.slice(0, 3)) {
          doc.rect(36, curY, contentWidth, 16).fill('#f1f5f9');
          doc.rect(36, curY, contentWidth, 16).strokeColor(strokeLine).lineWidth(0.5).stroke();
          doc.fillColor(primaryEmerald).fontSize(7.5).font('Helvetica-Bold')
            .text(group.dayTitle, 46, curY + 4);
          curY += 16;

          const acts = group.activities.slice(0, 4);
          for (const act of acts) {
            doc.rect(36, curY, contentWidth, 14).fill('#ffffff');
            doc.rect(36, curY, contentWidth, 14).strokeColor(strokeLine).lineWidth(0.5).stroke();
            doc.fillColor(darkSlate).fontSize(7.5).font('Helvetica')
              .text(`•  ${act}`, 48, curY + 3, { width: contentWidth - 24, ellipsis: true });
            curY += 14;
          }
        }
      } else {
        doc.rect(36, curY, contentWidth, 24).fill(cardBg);
        doc.rect(36, curY, contentWidth, 24).strokeColor(strokeLine).lineWidth(0.5).stroke();
        doc.fillColor(bodySlate).fontSize(7.5).font('Helvetica')
          .text('Itinerary private tour disesuaikan secara personal oleh tim Smart Journey berdasarkan paket dan titik penjemputan.', 46, curY + 7);
        curY += 28;
      }

      curY += 10;

      // =========================================================================
      // 5. PAYMENT DETAILS & BOOKING CONFIRMATION
      // =========================================================================
      const payBoxHeight = 86;
      // LEFT: PAYMENT DETAILS
      doc.roundedRect(leftColX, curY, colWidth, payBoxHeight, 5).fill('#ffffff');
      doc.roundedRect(leftColX, curY, colWidth, payBoxHeight, 5).strokeColor(strokeLine).lineWidth(0.8).stroke();

      doc.fillColor(primaryEmerald).fontSize(8.5).font('Helvetica-Bold')
        .text('PAYMENT DETAILS', leftColX + 12, curY + 8);

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Package Price:', leftColX + 12, curY + 22);
      doc.fillColor(darkSlate).fontSize(7.5).font('Helvetica-Bold').text(formatRupiah(data.payment.baseAmount), leftColX + colWidth - 95, curY + 22, { width: 85, align: 'right' });

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Unique Payment Code:', leftColX + 12, curY + 34);
      doc.fillColor('#0284c7').fontSize(7.5).font('Helvetica-Bold').text(formatRupiah(data.payment.uniqueCode), leftColX + colWidth - 95, curY + 34, { width: 85, align: 'right' });

      doc.rect(leftColX + 6, curY + 46, colWidth - 12, 18).fill(emeraldBg);
      doc.fillColor(emeraldText).fontSize(8).font('Helvetica-Bold').text('TOTAL PAID:', leftColX + 12, curY + 51);
      doc.fillColor(emeraldText).fontSize(8.5).font('Helvetica-Bold').text(formatRupiah(data.payment.totalPaid), leftColX + colWidth - 105, curY + 51, { width: 95, align: 'right' });

      doc.fillColor(mutedSlate).fontSize(7).font('Helvetica')
        .text(`Method: ${data.payment.paymentMethod || 'ArtoPay'} • Ref: ${data.bookingCode} • Status: PAID`, leftColX + 12, curY + 70);

      // RIGHT: BOOKING CONFIRMATION SEAL
      doc.roundedRect(rightColX, curY, colWidth, payBoxHeight, 5).fill(cardBg);
      doc.roundedRect(rightColX, curY, colWidth, payBoxHeight, 5).strokeColor(strokeLine).lineWidth(0.8).stroke();

      doc.fillColor(primaryEmerald).fontSize(8.5).font('Helvetica-Bold')
        .text('BOOKING CONFIRMATION', rightColX + 12, curY + 8);

      doc.fillColor(emeraldText).fontSize(7.5).font('Helvetica-Bold')
        .text('This booking has been successfully confirmed by Smart Journey.', rightColX + 12, curY + 22, { width: colWidth - 24 });

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Booking Code:', rightColX + 12, curY + 44);
      doc.fillColor(darkSlate).fontSize(7.5).font('Helvetica-Bold').text(data.bookingCode, rightColX + 85, curY + 44);

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Booking Status:', rightColX + 12, curY + 56);
      doc.fillColor(emeraldText).fontSize(7.5).font('Helvetica-Bold').text('CONFIRMED', rightColX + 85, curY + 56);

      doc.fillColor(mutedSlate).fontSize(7.5).font('Helvetica').text('Payment Status:', rightColX + 12, curY + 68);
      doc.fillColor(emeraldText).fontSize(7.5).font('Helvetica-Bold').text('PAID', rightColX + 85, curY + 68);

      if (data.confirmedAt) {
        doc.fillColor(mutedSlate).fontSize(7).font('Helvetica')
          .text(`Confirmed At: ${data.confirmedAt}`, rightColX + 12, curY + 78);
      }

      curY += payBoxHeight + 10;

      // =========================================================================
      // 6. IMPORTANT INFORMATION & CONTACT & VERIFICATION
      // =========================================================================
      const infoBoxHeight = 58;
      // LEFT: IMPORTANT INFORMATION
      doc.roundedRect(leftColX, curY, colWidth, infoBoxHeight, 5).fill('#ffffff');
      doc.roundedRect(leftColX, curY, colWidth, infoBoxHeight, 5).strokeColor(strokeLine).lineWidth(0.8).stroke();

      doc.fillColor(primaryEmerald).fontSize(8).font('Helvetica-Bold')
        .text('IMPORTANT INFORMATION', leftColX + 12, curY + 6);

      doc.fillColor(bodySlate).fontSize(7).font('Helvetica')
        .text('•  Please ensure your pickup location is correct.', leftColX + 12, curY + 18)
        .text('•  Please be ready before the scheduled pickup time.', leftColX + 12, curY + 29)
        .text('•  Keep this document for your trip reference.', leftColX + 12, curY + 40);

      // RIGHT: VERIFICATION & CONTACT
      doc.roundedRect(rightColX, curY, colWidth, infoBoxHeight, 5).fill('#ffffff');
      doc.roundedRect(rightColX, curY, colWidth, infoBoxHeight, 5).strokeColor(strokeLine).lineWidth(0.8).stroke();

      doc.fillColor(primaryEmerald).fontSize(8).font('Helvetica-Bold')
        .text('VERIFICATION & CONTACT', rightColX + 12, curY + 6);

      doc.fillColor(mutedSlate).fontSize(7).font('Helvetica').text('Booking Code:', rightColX + 12, curY + 18);
      doc.fillColor(darkSlate).fontSize(7.5).font('Helvetica-Bold').text(data.bookingCode, rightColX + 70, curY + 18);

      if (data.verificationCode || data.verificationHash) {
        const vCode = data.verificationCode || data.verificationHash;
        doc.fillColor(mutedSlate).fontSize(7).font('Helvetica').text('Verification:', rightColX + 128, curY + 18);
        doc.fillColor(darkSlate).fontSize(7).font('Helvetica-Bold').text(vCode!, rightColX + 170, curY + 18, { width: colWidth - 175 });
      }

      doc.fillColor(primaryEmerald).fontSize(6.5).font('Helvetica')
        .text('Verify your booking through Check Booking on Smart Journey.', rightColX + 12, curY + 29);

      doc.fillColor(mutedSlate).fontSize(6.5).font('Helvetica')
        .text('PT Sawah Jaya Trans • WhatsApp: +62 852-1234-7289', rightColX + 12, curY + 39)
        .text('Email: Info@sawahjayatrans.com • Hub: Malang & Bali', rightColX + 12, curY + 47);

      // =========================================================================
      // 7. FOOTER
      // =========================================================================
      const footerY = 790;
      doc.strokeColor(strokeLine).lineWidth(0.8)
        .moveTo(36, footerY).lineTo(pageWidth - 36, footerY).stroke();

      doc.fillColor(primaryEmerald).fontSize(8).font('Helvetica-Bold')
        .text('SMART JOURNEY', 36, footerY + 6, { continued: true })
        .fillColor(mutedSlate).font('Helvetica')
        .text('   •   Go Beyond   •   Travel • Explore • Experience', { align: 'left' });

      doc.fillColor(mutedSlate).fontSize(7).font('Helvetica')
        .text(`Official Document SJ-${data.bookingCode} • Generated: ${new Date().toISOString().substring(0, 10)}`, pageWidth - 260, footerY + 6, { width: 224, align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
