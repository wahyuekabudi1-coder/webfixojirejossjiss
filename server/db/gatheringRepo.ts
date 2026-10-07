import { DatabaseClient } from './types';
import { getDB } from './pool';

export interface GatheringItineraryDay {
  day: number;
  title: string;
  desc?: string;
  activities?: string[];
}

export interface GatheringEstimatedPrices {
  pax60: number;
  pax70: number;
  pax80: number;
  pax90: number;
  pax90PlusNote?: string;
}

export interface GatheringPackage {
  id: string;
  title: string;
  name?: string; // alias for title
  slug: string;
  destination: string;
  duration: string;
  days?: number;
  nights?: number;
  image: string;
  featuredImage?: string; // alias for image
  gallery: string[];
  description: string;
  itinerary: GatheringItineraryDay[];
  included: string[];
  includes?: string[]; // alias for included
  excluded: string[];
  excludes?: string[]; // alias for excluded
  facilities: string[];
  notes: string;
  price60Pax: number;
  price70Pax: number;
  price80Pax: number;
  price90Pax: number;
  price90PlusText: string;
  estimatedPrices?: GatheringEstimatedPrices;
  isPublished: boolean;
  isArchived: boolean;
  status?: 'published' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface GatheringRequest {
  id: string;
  packageId: string;
  packageName: string;
  duration?: string;
  customerName: string;
  picName?: string; // alias
  companyName: string;
  company?: string; // alias
  whatsapp: string;
  email: string;
  estimatedParticipants: string;
  participants?: string; // alias
  requestedDate: string;
  notes?: string;
  status: 'REQUESTED' | 'REVIEWING' | 'PROPOSAL_SENT' | 'REVISION_REQUESTED' | 'APPROVED' | 'REJECTED';
  secureToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationLineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PackageSnapshot {
  packageId: string;
  packageName: string;
  destination: string;
  duration: string;
  itinerary: GatheringItineraryDay[];
  included: string[];
  excluded: string[];
  facilities: string[];
  notes: string;
  participantCount: number;
  eventDate: string;
  pricing?: {
    price60Pax?: number;
    price70Pax?: number;
    price80Pax?: number;
    price90Pax?: number;
    price90PlusText?: string;
  };
  lineItems: QuotationLineItem[];
  subtotal: number;
  discount: number;
  additionalCost: number;
  grandTotal: number;
}

export interface GatheringQuotationVersion {
  id: string;
  quotationId: string;
  versionNumber: number;
  itinerary: GatheringItineraryDay[];
  included: string[];
  includes?: string[];
  excluded: string[];
  excludes?: string[];
  notes: string;
  lineItems: QuotationLineItem[];
  subtotal: number;
  discount: number;
  additionalCost: number;
  grandTotal: number;
  pricePerPaxIDR?: number;
  packageSnapshot?: PackageSnapshot | null;
  revisionNotes?: string;
  createdBy: string;
  createdAt: string;
}

export interface GatheringQuotation {
  id: string;
  quotationNumber: string;
  requestId: string;
  packageId: string;
  packageName?: string;
  customerName: string;
  picName?: string;
  companyName: string;
  company?: string;
  whatsapp: string;
  email: string;
  eventDate: string;
  participantCount: number;
  participants?: string;
  validUntil: string;
  currentVersion: number;
  status: 'PROPOSAL_SENT' | 'REVISION_REQUESTED' | 'APPROVED' | 'REJECTED';
  subtotal: number;
  discount: number;
  additionalCost: number;
  grandTotal: number;
  pricePerPaxIDR?: number;
  totalPriceIDR?: number;
  currency: string;
  bookingId?: string;
  packageSnapshot?: PackageSnapshot | null;
  secureToken?: string;
  terms?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  versions?: GatheringQuotationVersion[];
}

export class GatheringRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async seedDefaultPackages(): Promise<void> {
    const db = await this.db();
    const rows = await db.query<any>('SELECT COUNT(*) as count FROM event_gathering_packages');
    const count = rows[0]?.count || 0;
    if (Number(count) > 0) return;

    const defaultPackages: GatheringPackage[] = [
      {
        id: 'pkg-bromo-gathering-2d1n',
        title: 'Bromo Corporate Gathering & Teambuilding',
        name: 'Bromo Corporate Gathering & Teambuilding',
        slug: 'bromo-gathering-2d1n',
        destination: 'Bromo - Pasuruan - Probolinggo, Jawa Timur',
        duration: '2 Hari 1 Malam (2D1N)',
        days: 2,
        nights: 1,
        image: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1200&q=80',
        featuredImage: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1200&q=80',
        gallery: [
          'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=80',
          '/bromo.png'
        ],
        description: 'Paket eksklusif corporate gathering dan outbound di kawasan Bromo. Dirancang khusus untuk perusahaan, instansi, BUMN, dan komunitas besar yang mengutamakan kenyamanan, kekompakan tim, dan panorama sunrise spektakuler kaldera Bromo dengan armada 4x4 Jeep Hardtop.',
        itinerary: [
          {
            day: 1,
            title: 'Penjemputan & Ice Breaking Outbound di Lautan Pasir',
            desc: 'Penjemputan rombongan di Meeting Point (Surabaya/Malang) dengan Bus Pariwisata Executive AC. Tiba di resort Bromo, makan siang prasmanan nusantara, dilanjutkan Fun Teambuilding Games di Lautan Pasir Bromo bersama Fasilitator Profesional, dan Gala Dinner BBQ malam keakraban.',
            activities: [
              '08.00 - Penjemputan rombongan di Meeting Point (Surabaya / Malang) dengan Bus Pariwisata Executive AC.',
              '11.30 - Tiba di Kawasan Bromo, Welcome Drink & Makan Siang Prasmanan Khas Tengger.',
              '13.30 - Program Fun Games & Teambuilding Outbound bersama Fasilitator Profesional.',
              '16.30 - Check-in Hotel / Resort Bromo & Waktu santai pribadi.',
              '19.00 - Gala Dinner Perusahaan, Hiburan Musik Akustik & Api Unggun Hangat.'
            ]
          },
          {
            day: 2,
            title: 'Jeep Convoy Sunrise, Kawah Bromo & Pelepasan Rombongan',
            desc: 'Morning call, konvoi Jeep 4x4 menuju Sunrise Point Penanjakan 1. Eksplorasi Kawah Aktif Bromo, Pura Luhur Poten, Pasir Berbisik, dan Savana Bukit Teletubbies. Kembali ke hotel, sarapan prasmanan, evaluasi program, penyerahan kenang-kenangan dan transfer kepulangan.',
            activities: [
              '03.00 - Morning Call & Persiapan Petualangan 4x4 Jeep Hardtop.',
              '04.30 - Menyaksikan Golden Sunrise spektakuler di Penanjakan 1 / Kingkong Hill.',
              '06.30 - Eksplorasi Kawah Aktif Bromo, Pura Luhur Poten, & Pasir Berbisik.',
              '08.30 - Photo Session Rombongan di Bukit Teletubbies & Savana Hijau.',
              '10.00 - Kembali ke hotel, Mandi & Sarapan pagi prasmanan.',
              '12.00 - Check-out & Perjalanan kembali ke Surabaya/Malang dengan singgah di pusat oleh-oleh khas.'
            ]
          }
        ],
        included: [
          'Transportasi Bus Pariwisata Executive AC PP dari Surabaya / Malang',
          'Konvoi Armada Jeep 4x4 Bromo Resmi (kapasitas 5-6 orang per jeep)',
          'Akomodasi 1 Malam di Hotel Resort Bromo Bintang 3-4 (Twin / Triple share)',
          'Konsumsi lengkap: 1x Welcome Snack, 2x Lunch Buffet, 1x Gala Dinner BBQ, 1x Breakfast',
          'Fasilitator outbound profesional, games master & outbound equipment',
          'Tiket masuk seluruh kawasan TNBTS Bromo & asuransi rombongan',
          'Dokumentasi foto & video cinematic drone profesional',
          'Spanduk / Banner Gathering Perusahaan custom nama & logo',
          'Air mineral flow selama acara & P3K standar korporat'
        ],
        excluded: [
          'Tiket pesawat / kereta api menuju meeting point',
          'Pengeluaran pribadi & room service hotel',
          'Sewa kuda di kawah Bromo (opsional)',
          'Tipping kru & driver (sukarela)'
        ],
        facilities: [
          'Bus Pariwisata Eksekutif AC',
          'Konvoi Jeep 4x4 Hardtop Resmi',
          'Hotel Resort & Hall Ballroom Pertemuan',
          'Sound System & Stage Gala Dinner Outdoor/Indoor',
          'Tim Dokumentasi Drone & Kamera Profesional',
          'Dedicated Event Manager & On-ground Crew'
        ],
        notes: 'Dapat dikustomisasi dengan sesi workshop internal, pembagian doorprize perusahaan, atau penyesuaian tema kaos rombongan.',
        price60Pax: 1450000,
        price70Pax: 1380000,
        price80Pax: 1320000,
        price90Pax: 1250000,
        price90PlusText: 'Hubungi Admin',
        isPublished: true,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'pkg-ijen-banyuwangi-retreat-3d2n',
        title: 'Ijen Blue Flame & Banyuwangi Executive Retreat',
        name: 'Ijen Blue Flame & Banyuwangi Executive Retreat',
        slug: 'ijen-baluran-retreat-3d2n',
        destination: 'Kawah Ijen, Baluran & Banyuwangi, Jawa Timur',
        duration: '3 Hari 2 Malam (3D2N)',
        days: 3,
        nights: 2,
        image: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=80',
        featuredImage: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=80',
        gallery: [
          'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=1000&q=80',
          '/kawah-ijen.png'
        ],
        description: 'Program corporate retreat premium yang memadukan keajaiban alam api biru Kawah Ijen, eksotisme savana Taman Nasional Baluran ("Little Africa in Java"), dan gala dinner tepi pantai Selat Bali untuk merekatkan soliditas manajemen.',
        itinerary: [
          {
            day: 1,
            title: 'Meet & Greet Banyuwangi & Eksplorasi Savana Baluran',
            desc: 'Tiba di Banyuwangi, welcoming seafood lunch di pesisir pantai. Perjalanan ke Savana Bekol dan Pantai Bama Baluran. Check-in resort pantai bintang 4 dan sunset cocktail briefing.',
            activities: [
              '09.00 - Penjemputan di Bandara Banyuwangi (BWX) / Stasiun Ketapang.',
              '11.30 - Welcoming Seafood Lunch di Pesisir Pantai Banyuwangi.',
              '13.30 - Safari petualangan di Savana Bekol Taman Nasional Baluran & Pantai Bama.',
              '17.00 - Check-in Resort Pantai Bintang 4 & Sunset Cocktail.',
              '19.30 - Dinner keakraban & briefing pendakian Ijen.'
            ]
          },
          {
            day: 2,
            title: 'Midnight Trekking Ijen Blue Fire & Restorative Spa',
            desc: 'Pemberangkatan dini hari menuju Paltuding. Pendakian Kawah Ijen dengan masker gas standar & pemandu berlisensi. Menyaksikan fenomena langka Blue Fire dan danau kawah toska. Siang restorative spa & santai di resort. Malam Gala Dinner & Awarding Night.',
            activities: [
              '00.30 - Morning Call & Perjalanan menuju Pos Paltuding Kawah Ijen.',
              '02.00 - Mulai pendakian didampingi Ranger Berlisensi & Tim Medis.',
              '04.00 - Menyaksikan fenomena spektakuler Blue Fire & Golden Sunrise Kawah Ijen.',
              '07.30 - Kembali ke Paltuding & Sarapan pagi hangat.',
              '10.30 - Kembali ke hotel, Istirahat & Spa Relaksasi.',
              '19.00 - Corporate Awarding Night & Gala Dinner Seafood Tepi Pantai.'
            ]
          },
          {
            day: 3,
            title: 'Wisata Budaya Desa Osing & Transfer Kepulangan',
            desc: 'Sarapan santai di tepi pantai, kunjungan ke Desa Adat Kemiren, berbelanja kopi Osing & batik Banyuwangi, diantar kembali menuju Bandara Banyuwangi.',
            activities: [
              '08.00 - Sarapan santai di tepi pantai & waktu bebas.',
              '10.30 - Check-out hotel & kunjungan ke Desa Adat Osing Kemiren.',
              '12.00 - Makan Siang Pecel Pitik khas suku Osing.',
              '14.00 - Belanja oleh-oleh khas Banyuwangi & Transfer kembali ke Bandara Banyuwangi / Stasiun.'
            ]
          }
        ],
        included: [
          'Transportasi Bus Pariwisata AC Executive & Driver berlisensi',
          'Akomodasi 2 malam di Resort Bintang 4 Tepi Pantai (Twin share)',
          'Makan 7x lengkap termasuk Gala Dinner Awarding Night',
          'Tiket masuk resmi Kawah Ijen & TN Baluran',
          'Masker gas respiratori & headlamp senter kepala per peserta',
          'Pemandu lokal berlisensi (1 guide per 15 pax) & tim logistik medis',
          'Dokumentasi lengkap foto & video liputan drone',
          'Asuransi perjalanan wisata rombongan'
        ],
        excluded: [
          'Tiket pesawat PP ke Banyuwangi',
          'Troli gerobak dorong Ijen (opsional untuk peserta tertentu)',
          'Keperluan pribadi di luar paket'
        ],
        facilities: [
          'Hotel Resort Bintang 4 Tepi Pantai',
          'Transportasi Bus Eksekutif AC',
          'Alat Safety & Respirator Ijen Lengkap',
          'Ballroom & Audio Visual Awarding Night',
          'Pemandu Medis & Tour Leader Dedicated'
        ],
        notes: 'Aktivitas fisik moderat. Bagi pimpinan yang menghendaki tanpa jalan kaki, tersedia fasilitas taksi troli dorong lokal di lokasi.',
        price60Pax: 2250000,
        price70Pax: 2150000,
        price80Pax: 2050000,
        price90Pax: 1950000,
        price90PlusText: 'Hubungi Admin',
        isPublished: true,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'pkg-batu-malang-leadership-2d1n',
        title: 'Batu Malang Highland Leadership Outing',
        name: 'Batu Malang Highland Leadership Outing',
        slug: 'batu-malang-leadership-2d1n',
        destination: 'Kota Wisata Batu & Malang, Jawa Timur',
        duration: '2 Hari 1 Malam (2D1N)',
        days: 2,
        nights: 1,
        image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
        featuredImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
        gallery: [
          'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
          'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1000&q=80',
          '/tumpak-sewu.png'
        ],
        description: 'Paket gathering berhawa sejuk di dataran tinggi Kota Batu Malang. Mengkombinasikan aktivitas team building interaktif di lapangan hijau luas, petik apel organik, kunjungan destinasi ikonik, dan gala dinner berlatar pemandangan lampu kota Malang.',
        itinerary: [
          {
            day: 1,
            title: 'Outbound Experiential Learning & Gala Dinner Akustik',
            desc: 'Penjemputan di Malang/Surabaya, tiba di Batu Highland Resort. Sesi ice breaking & team challenge bersama master trainer. Sore petik apel langsung di kebun petani. Malam Gala Dinner & hiburan akustik.',
            activities: [
              '08.30 - Penjemputan di Surabaya / Malang dengan Bus Pariwisata.',
              '11.00 - Tiba di Kota Batu & Makan Siang Khas Jawa Timur.',
              '13.00 - Program Experiential Team Building Outbound di lapangan resort.',
              '16.00 - Check-in Hotel Resort Bintang 4 di kaki Gunung Panderman.',
              '19.00 - Gala Dinner Indoor/Outdoor Ballroom dengan Live Acoustic & Doorprize.'
            ]
          },
          {
            day: 2,
            title: 'Wisata Edukasi, Pusat Oleh-Oleh & Kepulangan',
            desc: 'Sarapan pagi prasmanan, checkout, mengunjungi Museum Angkut atau Jatim Park. Belanja oleh-oleh khas apel dan strudel Batu, pengantaran kembali ke stasiun/bandara.',
            activities: [
              '07.30 - Sarapan prasmanan di resort.',
              '09.00 - Kunjungan wisata petik apel organik segar langsung dari pohon.',
              '11.00 - Menjelajah Museum Angkut / Destinasi tematik Batu.',
              '13.00 - Farewell Lunch & Berbelanja oleh-oleh khas Malang Batu.',
              '15.30 - Pengantaran kembali ke Stasiun Malang / Bandara Juanda Surabaya.'
            ]
          }
        ],
        included: [
          'Bus pariwisata eksekutif AC, audio sistem & reclining seats',
          'Hotel Resort Bintang 4 Kota Batu (Twin share)',
          'Makan 4x lengkap (Welcome Lunch, Gala Dinner, Breakfast, Closing Lunch)',
          'Instruktur & trainer outbound bersertifikat',
          'Sound system, panggung & MC profesional untuk gala dinner',
          'Tiket masuk kebun apel & objek wisata pilihan',
          'Dokumentasi foto & video cinematic drone',
          'Spanduk rombongan, P3K & air mineral flow'
        ],
        excluded: [
          'Transportasi luar kota ke titik kumpul',
          'Pengeluaran pribadi di luar program yang disepakati'
        ],
        facilities: [
          'Resort Pegunungan Hawa Sejuk',
          'Lapangan Outbound Luas Berumput',
          'Ballroom Indoor & Outdoor Panoramic Terrace',
          'Bus Pariwisata Terawat & Crew Ramah'
        ],
        notes: 'Sangat cocok untuk rombongan keluarga besar karyawan dengan rentang usia beragam karena ritme aktivitasnya ringan dan santai.',
        price60Pax: 1280000,
        price70Pax: 1220000,
        price80Pax: 1160000,
        price90Pax: 1100000,
        price90PlusText: 'Hubungi Admin',
        isPublished: true,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const p of defaultPackages) {
      await db.execute(
        `INSERT INTO event_gathering_packages (
          id, title, slug, destination, duration, image, gallery, description,
          itinerary, included, excluded, facilities, notes, price_60_pax, price_70_pax,
          price_80_pax, price_90_pax, price_90_plus_text, is_published, is_archived,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id, p.title, p.slug, p.destination, p.duration, p.image, JSON.stringify(p.gallery), p.description,
          JSON.stringify(p.itinerary), JSON.stringify(p.included), JSON.stringify(p.excluded),
          JSON.stringify(p.facilities), p.notes, p.price60Pax, p.price70Pax, p.price80Pax,
          p.price90Pax, p.price90PlusText, p.isPublished ? 1 : 0, p.isArchived ? 1 : 0,
          p.createdAt, p.updatedAt
        ]
      );
    }
    console.log('[GatheringRepo] ✅ Seeded 3 default event gathering packages');
  }

  // -------------------------------------------------------------
  // PACKAGES
  // -------------------------------------------------------------
  async getPackages(includeUnpublished = false): Promise<GatheringPackage[]> {
    const db = await this.db();
    let sql = 'SELECT * FROM event_gathering_packages WHERE is_archived = 0';
    if (!includeUnpublished) {
      sql += ' AND is_published = 1';
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await db.query<any>(sql);
    return rows.map(mapPackageFromDb);
  }

  async getPackageById(idOrSlug: string): Promise<GatheringPackage | null> {
    const db = await this.db();
    const rows = await db.query<any>(
      'SELECT * FROM event_gathering_packages WHERE (id = ? OR slug = ?) AND is_archived = 0 LIMIT 1',
      [idOrSlug, idOrSlug]
    );
    if (!rows.length) return null;
    return mapPackageFromDb(rows[0]);
  }

  async createPackage(pkg: Partial<GatheringPackage>): Promise<GatheringPackage> {
    const db = await this.db();
    const id = pkg.id || `pkg-eg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const title = pkg.title || pkg.name || 'Untitled Gathering Package';
    let slug = pkg.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id;
    let attempts = 0;
    while (attempts < 5) {
      const existingSlug = await db.query('SELECT id FROM event_gathering_packages WHERE slug = ? LIMIT 1', [slug]);
      if (existingSlug.length > 0) {
        slug = `${slug.replace(/-\d+$/, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
        attempts++;
      } else {
        break;
      }
    }
    const now = new Date().toISOString();

    const price60 = pkg.price60Pax ?? pkg.estimatedPrices?.pax60 ?? 0;
    const price70 = pkg.price70Pax ?? pkg.estimatedPrices?.pax70 ?? 0;
    const price80 = pkg.price80Pax ?? pkg.estimatedPrices?.pax80 ?? 0;
    const price90 = pkg.price90Pax ?? pkg.estimatedPrices?.pax90 ?? 0;
    const price90Plus = pkg.price90PlusText ?? pkg.estimatedPrices?.pax90PlusNote ?? 'Hubungi Admin';

    const isPublished = pkg.status ? pkg.status === 'published' : (pkg.isPublished !== false);

    await db.execute(
      `INSERT INTO event_gathering_packages (
        id, title, slug, destination, duration, image, gallery, description,
        itinerary, included, excluded, facilities, notes, price_60_pax, price_70_pax,
        price_80_pax, price_90_pax, price_90_plus_text, is_published, is_archived,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title,
        slug,
        pkg.destination || 'Jawa Timur',
        pkg.duration || '2 Days 1 Night',
        pkg.image || pkg.featuredImage || '/bromo.png',
        JSON.stringify(pkg.gallery || []),
        pkg.description || '',
        JSON.stringify(pkg.itinerary || []),
        JSON.stringify(pkg.included || pkg.includes || []),
        JSON.stringify(pkg.excluded || pkg.excludes || []),
        JSON.stringify(pkg.facilities || []),
        typeof pkg.notes === 'string' ? pkg.notes : (Array.isArray(pkg.notes) ? (pkg.notes as any).join('\n') : ''),
        price60,
        price70,
        price80,
        price90,
        price90Plus,
        isPublished ? 1 : 0,
        0,
        now,
        now
      ]
    );

    const created = await this.getPackageById(id);
    return created!;
  }

  async updatePackage(id: string, pkg: Partial<GatheringPackage>): Promise<GatheringPackage | null> {
    const db = await this.db();
    const existing = await this.getPackageById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const title = pkg.title ?? pkg.name ?? existing.title;
    const image = pkg.image ?? pkg.featuredImage ?? existing.image;
    const included = pkg.included ?? pkg.includes ?? existing.included;
    const excluded = pkg.excluded ?? pkg.excludes ?? existing.excluded;
    const price60 = pkg.price60Pax ?? pkg.estimatedPrices?.pax60 ?? existing.price60Pax;
    const price70 = pkg.price70Pax ?? pkg.estimatedPrices?.pax70 ?? existing.price70Pax;
    const price80 = pkg.price80Pax ?? pkg.estimatedPrices?.pax80 ?? existing.price80Pax;
    const price90 = pkg.price90Pax ?? pkg.estimatedPrices?.pax90 ?? existing.price90Pax;
    const price90Plus = pkg.price90PlusText ?? pkg.estimatedPrices?.pax90PlusNote ?? existing.price90PlusText;

    let isPublished = existing.isPublished;
    if (pkg.status) {
      isPublished = pkg.status === 'published';
    } else if (pkg.isPublished !== undefined) {
      isPublished = pkg.isPublished;
    }

    const notesStr = typeof pkg.notes === 'string' ? pkg.notes : (Array.isArray(pkg.notes) ? (pkg.notes as any).join('\n') : existing.notes);

    await db.execute(
      `UPDATE event_gathering_packages SET
        title = ?, slug = ?, destination = ?, duration = ?, image = ?, gallery = ?,
        description = ?, itinerary = ?, included = ?, excluded = ?, facilities = ?,
        notes = ?, price_60_pax = ?, price_70_pax = ?, price_80_pax = ?, price_90_pax = ?,
        price_90_plus_text = ?, is_published = ?, updated_at = ?
      WHERE id = ?`,
      [
        title,
        pkg.slug ?? existing.slug,
        pkg.destination ?? existing.destination,
        pkg.duration ?? existing.duration,
        image,
        JSON.stringify(pkg.gallery ?? existing.gallery),
        pkg.description ?? existing.description,
        JSON.stringify(pkg.itinerary ?? existing.itinerary),
        JSON.stringify(included),
        JSON.stringify(excluded),
        JSON.stringify(pkg.facilities ?? existing.facilities),
        notesStr,
        price60,
        price70,
        price80,
        price90,
        price90Plus,
        isPublished ? 1 : 0,
        now,
        id
      ]
    );

    return await this.getPackageById(id);
  }

  async togglePublishPackage(id: string): Promise<boolean> {
    const db = await this.db();
    const pkg = await this.getPackageById(id);
    if (!pkg) return false;
    const newStatus = pkg.isPublished ? 0 : 1;
    await db.execute('UPDATE event_gathering_packages SET is_published = ? WHERE id = ?', [newStatus, id]);
    return true;
  }

  async archivePackage(id: string): Promise<boolean> {
    const db = await this.db();
    await db.execute('UPDATE event_gathering_packages SET is_archived = 1 WHERE id = ?', [id]);
    return true;
  }

  async deletePackage(id: string): Promise<boolean> {
    const db = await this.db();
    await db.execute('UPDATE event_gathering_packages SET is_archived = 1 WHERE id = ?', [id]);
    return true;
  }

  // -------------------------------------------------------------
  // REQUESTS
  // -------------------------------------------------------------
  async getRequests(): Promise<GatheringRequest[]> {
    const db = await this.db();
    const rows = await db.query<any>('SELECT * FROM event_gathering_requests ORDER BY created_at DESC');
    return rows.map(mapRequestFromDb);
  }

  async getRequestById(id: string): Promise<GatheringRequest | null> {
    const db = await this.db();
    const rows = await db.query<any>('SELECT * FROM event_gathering_requests WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return null;
    return mapRequestFromDb(rows[0]);
  }

  async getRequestByToken(token: string): Promise<GatheringRequest | null> {
    const db = await this.db();
    const rows = await db.query<any>('SELECT * FROM event_gathering_requests WHERE secure_token = ? OR id = ? LIMIT 1', [token, token]);
    if (!rows.length) return null;
    return mapRequestFromDb(rows[0]);
  }

  async createRequest(reqData: Partial<GatheringRequest>): Promise<GatheringRequest> {
    const db = await this.db();
    const id = `EGR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const secureToken = `tok_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    const now = new Date().toISOString();

    const customerName = reqData.customerName || reqData.picName || 'PIC';
    const companyName = reqData.companyName || reqData.company || '-';
    const participants = reqData.estimatedParticipants || reqData.participants || '60';

    await db.execute(
      `INSERT INTO event_gathering_requests (
        id, package_id, package_name, duration, customer_name, company_name,
        whatsapp, email, estimated_participants, requested_date, notes,
        status, secure_token, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        reqData.packageId || '',
        reqData.packageName || 'Event & Gathering',
        reqData.duration || '2 Days 1 Night',
        customerName,
        companyName,
        reqData.whatsapp || '',
        reqData.email || '',
        participants,
        reqData.requestedDate || '',
        reqData.notes || '',
        'REQUESTED',
        secureToken,
        now,
        now
      ]
    );

    const created = await this.getRequestById(id);
    return created!;
  }

  async updateRequestStatus(id: string, status: GatheringRequest['status']): Promise<boolean> {
    const db = await this.db();
    const now = new Date().toISOString();
    await db.execute(
      'UPDATE event_gathering_requests SET status = ?, updated_at = ? WHERE id = ?',
      [status, now, id]
    );
    return true;
  }

  // -------------------------------------------------------------
  // QUOTATIONS
  // -------------------------------------------------------------
  async getQuotations(): Promise<GatheringQuotation[]> {
    const db = await this.db();
    const rows = await db.query<any>('SELECT * FROM event_gathering_quotations ORDER BY created_at DESC');
    const quotations: GatheringQuotation[] = [];
    for (const row of rows) {
      const q = mapQuotationFromDb(row);
      q.versions = await this.getQuotationVersions(q.id);
      quotations.push(q);
    }
    return quotations;
  }

  async getQuotationById(idOrNumber: string): Promise<GatheringQuotation | null> {
    const db = await this.db();
    const rows = await db.query<any>(
      'SELECT * FROM event_gathering_quotations WHERE id = ? OR quotation_number = ? OR request_id = ? ORDER BY created_at DESC LIMIT 1',
      [idOrNumber, idOrNumber, idOrNumber]
    );
    if (!rows.length) return null;
    const q = mapQuotationFromDb(rows[0]);
    q.versions = await this.getQuotationVersions(q.id);
    return q;
  }

  async getQuotationByRequestId(requestId: string): Promise<GatheringQuotation | null> {
    const db = await this.db();
    const rows = await db.query<any>(
      'SELECT * FROM event_gathering_quotations WHERE request_id = ? ORDER BY created_at DESC LIMIT 1',
      [requestId]
    );
    if (!rows.length) return null;
    const q = mapQuotationFromDb(rows[0]);
    q.versions = await this.getQuotationVersions(q.id);
    return q;
  }

  async getQuotationVersions(quotationId: string): Promise<GatheringQuotationVersion[]> {
    const db = await this.db();
    const rows = await db.query<any>(
      'SELECT * FROM event_gathering_quotation_versions WHERE quotation_id = ? ORDER BY version_number ASC',
      [quotationId]
    );
    return rows.map(mapVersionFromDb);
  }

  async createQuotation(data: {
    requestId: string;
    packageId: string;
    packageName?: string;
    customerName: string;
    companyName?: string;
    whatsapp: string;
    email: string;
    eventDate: string;
    participantCount: number;
    validUntil: string;
    itinerary?: GatheringItineraryDay[];
    included?: string[];
    excluded?: string[];
    notes?: string;
    lineItems: QuotationLineItem[];
    discount?: number;
    additionalCost?: number;
    terms?: string[];
  }): Promise<GatheringQuotation> {
    const db = await this.db();
    const id = `EGQ-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const quotationNumber = `QUO-EG-${new Date().getFullYear()}-${randomSeq}`;
    const now = new Date().toISOString();

    let items = Array.isArray(data.lineItems) ? [...data.lineItems] : [];
    let subtotal = 0;
    if (items.length > 0) {
      for (const item of items) {
        subtotal += Number(item.subtotal || ((item.quantity || 1) * (item.unitPrice || 0)) || 0);
      }
    } else {
      const pax = data.participantCount || 60;
      const unit = (data as any).pricePerPaxIDR || ((data as any).totalPriceIDR ? Math.round((data as any).totalPriceIDR / pax) : 0);
      const total = (data as any).totalPriceIDR || (pax * unit);
      subtotal = total;
      items = [{
        id: `item-${Date.now()}-1`,
        name: `Paket ${data.packageName || 'Corporate Gathering'} (${pax} Pax)`,
        quantity: pax,
        unitPrice: unit,
        subtotal: total
      }];
    }
    const discount = Number(data.discount || 0);
    const additionalCost = Number(data.additionalCost || 0);
    const grandTotal = Math.max(0, subtotal - discount + additionalCost);

    const linkedReq = data.requestId ? await this.getRequestById(data.requestId) : null;
    const secureToken = linkedReq?.secureToken || `tok_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Fetch master package to build immutable snapshot
    const masterPkg = await this.getPackageById(data.packageId);
    const snapshot: PackageSnapshot = {
      packageId: data.packageId,
      packageName: data.packageName || masterPkg?.title || masterPkg?.name || 'Event & Gathering',
      destination: masterPkg?.destination || 'Jawa Timur',
      duration: masterPkg?.duration || '2 Days 1 Night',
      itinerary: data.itinerary || masterPkg?.itinerary || [],
      included: data.included || masterPkg?.included || masterPkg?.includes || [],
      excluded: data.excluded || masterPkg?.excluded || masterPkg?.excludes || [],
      facilities: masterPkg?.facilities || [],
      notes: data.notes || masterPkg?.notes || '',
      participantCount: data.participantCount || 60,
      eventDate: data.eventDate,
      pricing: {
        price60Pax: masterPkg?.price60Pax,
        price70Pax: masterPkg?.price70Pax,
        price80Pax: masterPkg?.price80Pax,
        price90Pax: masterPkg?.price90Pax,
        price90PlusText: masterPkg?.price90PlusText
      },
      lineItems: items,
      subtotal,
      discount,
      additionalCost,
      grandTotal
    };

    const snapshotJson = JSON.stringify(snapshot);

    await db.execute(
      `INSERT INTO event_gathering_quotations (
        id, quotation_number, request_id, package_id, customer_name, company_name,
        whatsapp, email, event_date, participant_count, valid_until, current_version,
        status, subtotal, discount, additional_cost, grand_total, currency, package_snapshot, secure_token, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        quotationNumber,
        data.requestId,
        data.packageId,
        data.customerName,
        data.companyName || '-',
        data.whatsapp,
        data.email,
        data.eventDate,
        data.participantCount || 60,
        data.validUntil,
        1,
        'PROPOSAL_SENT',
        subtotal,
        discount,
        additionalCost,
        grandTotal,
        'IDR',
        snapshotJson,
        secureToken,
        now,
        now
      ]
    );

    // Create Version 1 snapshot
    const versionId = `EQV-${Date.now()}-1`;
    await db.execute(
      `INSERT INTO event_gathering_quotation_versions (
        id, quotation_id, version_number, itinerary, included, excluded, notes,
        line_items, subtotal, discount, additional_cost, grand_total, package_snapshot, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        versionId,
        id,
        1,
        JSON.stringify(snapshot.itinerary),
        JSON.stringify(snapshot.included),
        JSON.stringify(snapshot.excluded),
        snapshot.notes,
        JSON.stringify(items),
        subtotal,
        discount,
        additionalCost,
        grandTotal,
        snapshotJson,
        'admin',
        now
      ]
    );

    // Update request status to PROPOSAL_SENT
    if (data.requestId) {
      await this.updateRequestStatus(data.requestId, 'PROPOSAL_SENT');
    }

    const created = await this.getQuotationById(id);
    return created!;
  }

  async createQuotationVersion(
    quotationId: string,
    data: {
      lineItems: QuotationLineItem[];
      discount?: number;
      additionalCost?: number;
      itinerary?: GatheringItineraryDay[];
      included?: string[];
      excluded?: string[];
      notes?: string;
      revisionNotes?: string;
      eventDate?: string;
      participantCount?: number;
      validUntil?: string;
    }
  ): Promise<GatheringQuotation> {
    const db = await this.db();
    const existing = await this.getQuotationById(quotationId);
    if (!existing) throw new Error('Quotation tidak ditemukan.');

    const nextVersionNumber = (existing.currentVersion || 1) + 1;
    const now = new Date().toISOString();

    let subtotal = 0;
    for (const item of (data.lineItems || [])) {
      subtotal += Number(item.subtotal || item.quantity * item.unitPrice || 0);
    }
    const discount = Number(data.discount !== undefined ? data.discount : existing.discount);
    const additionalCost = Number(data.additionalCost !== undefined ? data.additionalCost : existing.additionalCost);
    const grandTotal = Math.max(0, subtotal - discount + additionalCost);
    const eventDate = data.eventDate || existing.eventDate;
    const participantCount = data.participantCount || existing.participantCount;

    // Build updated version snapshot
    const prevSnapshot = existing.packageSnapshot;
    const snapshot: PackageSnapshot = {
      packageId: existing.packageId,
      packageName: prevSnapshot?.packageName || 'Event & Gathering',
      destination: prevSnapshot?.destination || '',
      duration: prevSnapshot?.duration || '',
      itinerary: data.itinerary || prevSnapshot?.itinerary || [],
      included: data.included || prevSnapshot?.included || [],
      excluded: data.excluded || prevSnapshot?.excluded || [],
      facilities: prevSnapshot?.facilities || [],
      notes: data.notes || prevSnapshot?.notes || '',
      participantCount,
      eventDate,
      pricing: prevSnapshot?.pricing,
      lineItems: data.lineItems || [],
      subtotal,
      discount,
      additionalCost,
      grandTotal
    };

    const snapshotJson = JSON.stringify(snapshot);
    const versionId = `EQV-${Date.now()}-${nextVersionNumber}`;

    await db.execute(
      `INSERT INTO event_gathering_quotation_versions (
        id, quotation_id, version_number, itinerary, included, excluded, notes,
        line_items, subtotal, discount, additional_cost, grand_total, package_snapshot, revision_notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        versionId,
        quotationId,
        nextVersionNumber,
        JSON.stringify(snapshot.itinerary),
        JSON.stringify(snapshot.included),
        JSON.stringify(snapshot.excluded),
        snapshot.notes,
        JSON.stringify(data.lineItems || []),
        subtotal,
        discount,
        additionalCost,
        grandTotal,
        snapshotJson,
        data.revisionNotes || '',
        'admin',
        now
      ]
    );

    await db.execute(
      `UPDATE event_gathering_quotations SET
        current_version = ?, status = 'PROPOSAL_SENT', subtotal = ?, discount = ?,
        additional_cost = ?, grand_total = ?, event_date = ?, participant_count = ?,
        valid_until = ?, package_snapshot = ?, updated_at = ?
      WHERE id = ?`,
      [
        nextVersionNumber,
        subtotal,
        discount,
        additionalCost,
        grandTotal,
        eventDate,
        participantCount,
        data.validUntil || existing.validUntil,
        snapshotJson,
        now,
        quotationId
      ]
    );

    if (existing.requestId) {
      await this.updateRequestStatus(existing.requestId, 'PROPOSAL_SENT');
    }

    return (await this.getQuotationById(quotationId))!;
  }

  async requestRevision(quotationId: string, revisionNotes: string): Promise<boolean> {
    const db = await this.db();
    const q = await this.getQuotationById(quotationId);
    if (!q) return false;

    const now = new Date().toISOString();
    await db.execute(
      `UPDATE event_gathering_quotations SET status = 'REVISION_REQUESTED', updated_at = ? WHERE id = ?`,
      [now, quotationId]
    );

    if (q.requestId) {
      await this.updateRequestStatus(q.requestId, 'REVISION_REQUESTED');
    }

    // Update latest version record with revision notes
    const versions = await this.getQuotationVersions(quotationId);
    if (versions.length > 0) {
      const latest = versions[versions.length - 1];
      await db.execute(
        `UPDATE event_gathering_quotation_versions SET revision_notes = ? WHERE id = ?`,
        [revisionNotes, latest.id]
      );
    }

    return true;
  }

  async setQuotationBookingId(quotationId: string, bookingId: string): Promise<void> {
    const db = await this.db();
    const now = new Date().toISOString();
    await db.execute(
      `UPDATE event_gathering_quotations SET booking_id = ?, status = 'APPROVED', updated_at = ? WHERE id = ?`,
      [bookingId, now, quotationId]
    );

    const q = await this.getQuotationById(quotationId);
    if (q?.requestId) {
      await this.updateRequestStatus(q.requestId, 'APPROVED');
    }
  }
}

export const gatheringRepo = new GatheringRepository();

export function createGatheringRepo(db: DatabaseClient) {
  return {
    seedDefaultPackages: () => gatheringRepo.seedDefaultPackages(),
    getPackages: (includeUnpublished?: boolean) => gatheringRepo.getPackages(includeUnpublished),
    getPackageById: (id: string) => gatheringRepo.getPackageById(id),
    createPackage: (pkg: any) => gatheringRepo.createPackage(pkg),
    updatePackage: (id: string, pkg: any) => gatheringRepo.updatePackage(id, pkg),
    togglePublishPackage: (id: string) => gatheringRepo.togglePublishPackage(id),
    archivePackage: (id: string) => gatheringRepo.archivePackage(id),
    deletePackage: (id: string) => gatheringRepo.deletePackage(id),
    getRequests: () => gatheringRepo.getRequests(),
    getRequestById: (id: string) => gatheringRepo.getRequestById(id),
    getRequestByToken: (t: string) => gatheringRepo.getRequestByToken(t),
    createRequest: (req: any) => gatheringRepo.createRequest(req),
    updateRequestStatus: (id: string, s: any) => gatheringRepo.updateRequestStatus(id, s),
    getQuotations: () => gatheringRepo.getQuotations(),
    getQuotationById: (id: string) => gatheringRepo.getQuotationById(id),
    getQuotationByRequestId: (rId: string) => gatheringRepo.getQuotationByRequestId(rId),
    getQuotationVersions: (qId: string) => gatheringRepo.getQuotationVersions(qId),
    createQuotation: (d: any) => gatheringRepo.createQuotation(d),
    createQuotationVersion: (id: string, d: any) => gatheringRepo.createQuotationVersion(id, d),
    requestRevision: (id: string, n: string) => gatheringRepo.requestRevision(id, n),
    setQuotationBookingId: (id: string, bId: string) => gatheringRepo.setQuotationBookingId(id, bId)
  };
}

function mapPackageFromDb(row: any): GatheringPackage {
  const isPublished = Boolean(row.is_published);
  const isArchived = Boolean(row.is_archived);
  const title = String(row.title || 'Untitled Gathering Package');
  const image = String(row.image || '/bromo.png');
  const included = safeParseJson(row.included, []);
  const excluded = safeParseJson(row.excluded, []);
  const p60 = Number(row.price_60_pax || 0);
  const p70 = Number(row.price_70_pax || 0);
  const p80 = Number(row.price_80_pax || 0);
  const p90 = Number(row.price_90_pax || 0);
  const p90Plus = String(row.price_90_plus_text || 'Hubungi Admin');
  const rawItinerary = safeParseJson(row.itinerary, []);
  const itinerary: GatheringItineraryDay[] = rawItinerary.map((it: any) => ({
    day: Number(it.day || 1),
    title: String(it.title || ''),
    desc: it.desc || (Array.isArray(it.activities) ? it.activities.join('\n') : ''),
    activities: Array.isArray(it.activities) ? it.activities : (it.desc ? [it.desc] : [])
  }));

  const durationStr = String(row.duration || '2 Days 1 Night');
  let days = 2;
  let nights = 1;
  const dMatch = durationStr.match(/(\d+)\s*(?:Day|Hari|D)/i);
  if (dMatch) days = parseInt(dMatch[1]);
  const nMatch = durationStr.match(/(\d+)\s*(?:Night|Malam|N)/i);
  if (nMatch) nights = parseInt(nMatch[1]);

  return {
    id: String(row.id),
    title,
    name: title,
    slug: String(row.slug),
    destination: String(row.destination || ''),
    duration: durationStr,
    days,
    nights,
    image,
    featuredImage: image,
    gallery: safeParseJson(row.gallery, []),
    description: String(row.description || ''),
    itinerary,
    included,
    includes: included,
    excluded,
    excludes: excluded,
    facilities: safeParseJson(row.facilities, []),
    notes: String(row.notes || ''),
    price60Pax: p60,
    price70Pax: p70,
    price80Pax: p80,
    price90Pax: p90,
    price90PlusText: p90Plus,
    estimatedPrices: {
      pax60: p60,
      pax70: p70,
      pax80: p80,
      pax90: p90,
      pax90PlusNote: p90Plus
    },
    isPublished,
    isArchived,
    status: isArchived ? 'archived' : (isPublished ? 'published' : 'draft'),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || '')
  };
}

function mapRequestFromDb(row: any): GatheringRequest {
  const customerName = String(row.customer_name);
  const companyName = String(row.company_name || '-');
  const participants = String(row.estimated_participants || '60');

  return {
    id: String(row.id),
    packageId: String(row.package_id),
    packageName: String(row.package_name),
    duration: row.duration ? String(row.duration) : undefined,
    customerName,
    picName: customerName,
    companyName,
    company: companyName,
    whatsapp: String(row.whatsapp),
    email: String(row.email),
    estimatedParticipants: participants,
    participants,
    requestedDate: String(row.requested_date),
    notes: row.notes ? String(row.notes) : undefined,
    status: row.status as GatheringRequest['status'],
    secureToken: String(row.secure_token),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || '')
  };
}

function mapQuotationFromDb(row: any): GatheringQuotation {
  const customerName = String(row.customer_name);
  const companyName = String(row.company_name || '-');
  const count = Number(row.participant_count || 60);
  const grandTotal = Number(row.grand_total || 0);

  return {
    id: String(row.id),
    quotationNumber: String(row.quotation_number),
    requestId: String(row.request_id),
    packageId: String(row.package_id),
    packageName: row.package_name ? String(row.package_name) : undefined,
    customerName,
    picName: customerName,
    companyName,
    company: companyName,
    whatsapp: String(row.whatsapp),
    email: String(row.email),
    eventDate: String(row.event_date),
    participantCount: count,
    participants: `${count} Pax`,
    validUntil: String(row.valid_until),
    currentVersion: Number(row.current_version || 1),
    status: row.status as GatheringQuotation['status'],
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount || 0),
    additionalCost: Number(row.additional_cost || 0),
    grandTotal,
    pricePerPaxIDR: count > 0 ? Math.round(grandTotal / count) : 0,
    totalPriceIDR: grandTotal,
    currency: String(row.currency || 'IDR'),
    bookingId: row.booking_id ? String(row.booking_id) : undefined,
    packageSnapshot: safeParseJson(row.package_snapshot, null),
    secureToken: row.secure_token ? String(row.secure_token) : undefined,
    terms: safeParseJson(row.terms, []),
    notes: row.notes ? String(row.notes) : '',
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || '')
  };
}

function mapVersionFromDb(row: any): GatheringQuotationVersion {
  const rawItinerary = safeParseJson(row.itinerary, []);
  const itinerary: GatheringItineraryDay[] = rawItinerary.map((it: any) => ({
    day: Number(it.day || 1),
    title: String(it.title || ''),
    desc: it.desc || (Array.isArray(it.activities) ? it.activities.join('\n') : ''),
    activities: Array.isArray(it.activities) ? it.activities : (it.desc ? [it.desc] : [])
  }));
  const included = safeParseJson(row.included, []);
  const excluded = safeParseJson(row.excluded, []);
  const grandTotal = Number(row.grand_total || 0);

  return {
    id: String(row.id),
    quotationId: String(row.quotation_id),
    versionNumber: Number(row.version_number),
    itinerary,
    included,
    includes: included,
    excluded,
    excludes: excluded,
    notes: String(row.notes || ''),
    lineItems: safeParseJson(row.line_items, []),
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount || 0),
    additionalCost: Number(row.additional_cost || 0),
    grandTotal,
    pricePerPaxIDR: grandTotal,
    packageSnapshot: safeParseJson(row.package_snapshot, null),
    revisionNotes: row.revision_notes ? String(row.revision_notes) : undefined,
    createdBy: String(row.created_by || 'admin'),
    createdAt: String(row.created_at || '')
  };
}

function safeParseJson(str: any, fallback: any): any {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
