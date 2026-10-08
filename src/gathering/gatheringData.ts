import { GatheringPackage } from './types';

export const SEED_GATHERING_PACKAGES: GatheringPackage[] = [
  {
    id: 'gp-bromo-2d1n',
    slug: 'bromo-gathering-2d1n',
    name: 'Bromo Corporate Gathering & Offroad Adventure',
    destination: 'Bromo - Pasuruan - Probolinggo',
    duration: '2 Hari 1 Malam (2D1N)',
    days: 2,
    nights: 1,
    description: 'Paket gathering eksklusif untuk korporasi dan komunitas dengan sensasi Sunrise Bromo, konvoi 4x4 Jeep Hardtop, Fun Games Teambuilding di Lautan Pasir & Savana Teletubbies, serta Gala Dinner BBQ di lereng pegunungan.',
    featuredImage: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1000&q=80'
    ],
    itinerary: [
      {
        day: 1,
        title: 'Penjemputan & Ice Breaking Outbound',
        activities: [
          '08.00 - Penjemputan rombongan di Meeting Point (Surabaya / Malang) dengan Bus Pariwisata Executive AC.',
          '11.30 - Tiba di Kawasan Sukapura / Tosari, Welcome Drink & Makan Siang Prasmanan Khas Tengger.',
          '13.30 - Program Fun Games & Teambuilding Outbound bersama Fasilitator Profesional.',
          '16.30 - Check-in Hotel / Resort Bromo & Waktu santai pribadi.',
          '19.00 - Gala Dinner Perusahaan, Hiburan Musik Akustik & Api Unggun Hangat.'
        ]
      },
      {
        day: 2,
        title: 'Bromo Sunrise Jeep Safari & Kepulangan',
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
    includes: [
      'Transportasi Bus Pariwisata Executive AC PP dari Surabaya / Malang',
      'Armada Jeep 4x4 Bromo Resmi (kapasitas 5-6 orang per jeep)',
      'Akomodasi 1 Malam di Hotel Bintang / Resort Ternama Bromo (Twin / Triple share)',
      'Makan Prasmanan 4x (Welcome Lunch, Gala Dinner BBQ, Breakfast, Closing Lunch)',
      'Fun Teambuilding Games lengkap dengan Master Game & Peralatan Outbound',
      'Tiket Masuk Kawasan TNBTS Bromo untuk seluruh peserta',
      'Dokumentasi Foto & Video Profesional (termasuk Drone Footage)',
      'Spanduk Banner Gathering Perusahaan custom nama & logo',
      'Air Mineral selama perjalanan & Snack Box keberangkatan',
      'Tour Leader & Fasilitator Pendamping berlisensi',
      'P3K Standar & Asuransi Perjalanan'
    ],
    excludes: [
      'Pengeluaran pribadi (laundry, minibar, belanja oleh-oleh)',
      'Sewa kuda di Lautan Pasir Bromo',
      'Tipping sukarela Kru Bus, Jeep, dan Fasilitator'
    ],
    facilities: [
      'Bus Pariwisata Eksekutif',
      'Armada Jeep 4x4',
      'Sound System & Stage Outdoor',
      'Fasilitator Teambuilding Berpengalaman',
      'Drone & Fotografer Profesional',
      'Banner Event Custom'
    ],
    notes: [
      'Harga tercantum merupakan estimasi per peserta dan dapat disesuaikan dengan permintaan fasilitas khusus (hotel bintang tertentu, artis tamu, atau penambahan hari).',
      'Suhu udara Bromo berkisar 5 - 12°C, peserta disarankan membawa jaket tebal, sarung tangan, kupluk, dan sepatu yang nyaman.',
      'Jadwal itinerary fleksibel dan dapat dikustomisasi sesuai jam kedatangan penerbangan atau kereta rombongan.'
    ],
    faq: [
      {
        question: 'Berapa jumlah peserta minimal dan maksimal untuk paket gathering ini?',
        answer: 'Paket dirancang untuk kapasitas rombongan mulai dari 60 pax hingga 500+ pax dengan dukungan armada bus pariwisata executive dan puluhan armada Jeep 4x4 resmi.'
      },
      {
        question: 'Apakah paket sudah mencakup izin kegiatan korporasi dan tiket TNBTS Bromo?',
        answer: 'Ya, seluruh perizinan resmi kegiatan event korporasi, tiket masuk TNBTS Bromo untuk seluruh peserta, dan asuransi perjalanan sudah termasuk dalam paket.'
      },
      {
        question: 'Bagaimana jika ada peserta yang tidak kuat mendaki tangga kawah Bromo?',
        answer: 'Peserta dapat menikmati panorama indah dari Lautan Pasir dan Bukit Teletubbies, atau menyewa kuda lokal dengan panduan tim kami yang selalu mendampingi.'
      }
    ],
    estimatedPrices: {
      pax60: 950000,
      pax70: 890000,
      pax80: 840000,
      pax90: 795000,
      pax90PlusNote: 'Hubungi Admin untuk penawaran grup besar 90+ peserta'
    },
    status: 'published',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-01T08:00:00Z'
  },
  {
    id: 'gp-batu-malang-3d2n',
    slug: 'batu-malang-gathering-3d2n',
    name: 'Batu Malang Executive Leadership Camp & Gala Dinner',
    destination: 'Kota Batu & Malang',
    duration: '3 Hari 2 Malam (3D2N)',
    days: 3,
    nights: 2,
    description: 'Program gathering komprehensif memadukan keindahan alam pegunungan Kota Batu dengan outbound leadership training, rafting adrenalin di Kasembon, petik apel khas Batu, dan perayaan Corporate Gala Night di ballroom berbintang.',
    featuredImage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80'
    ],
    itinerary: [
      {
        day: 1,
        title: 'Penjemputan, Wisata Apel & Check-in Resort',
        activities: [
          '08.30 - Penjemputan di Stasiun / Bandara Surabaya atau Malang.',
          '11.30 - Makan siang prasmanan masakan tradisional Jawa Timur.',
          '13.30 - Kunjungan agrowisata Petik Apel Segar langsung dari pohon.',
          '16.00 - Check-in Resort Bintang 4 di Kota Batu & Istirahat.',
          '18.30 - Dinner & santai malam di Museum Angkut / Night Spectacular.'
        ]
      },
      {
        day: 2,
        title: 'Arung Jeram Rafting & Malam Puncak Gala Dinner',
        activities: [
          '07.30 - Sarapan pagi di resort.',
          '08.30 - Petualangan White Water Rafting sepanjang 7.5 KM penuh keseruan.',
          '12.30 - Makan siang tradisional di tepi sungai.',
          '14.30 - Kembali ke hotel & persiapan Gala Dinner.',
          '18.30 - Gala Dinner Corporate Night: Sambutan manajemen, Awarding, Musik & Doorprize.'
        ]
      },
      {
        day: 3,
        title: 'Souvenir Hunting & Kepulangan',
        activities: [
          '08.00 - Sarapan pagi & Check-out resort.',
          '09.30 - Berbelanja di Pusat Oleh-oleh Khas Malang & Keripik Tempe Sanan.',
          '12.00 - Makan siang penutupan sebelum transfer out ke bandara / stasiun.'
        ]
      }
    ],
    includes: [
      'Transportasi Bus Pariwisata Executive AC selama 3 hari',
      'Akomodasi 2 Malam di Resort Bintang 4 Kota Batu (Twin Share)',
      'Konsumsi Lengkap 7x (3x Breakfast, 3x Lunch, 1x Gala Dinner)',
      'Paket Rafting Kasembon lengkap dengan rescue & asuransi',
      'Tiket Masuk Agrowisata Petik Apel & Destinasi Wisata',
      'Sewa Ballroom Hotel & Sound System untuk Gala Dinner',
      'Master of Ceremony (MC) & Live Acoustic Music untuk Gala Dinner',
      'Dokumentasi Foto, Video & Drone Profesional',
      'Banner & Backdrop Acara Gathering Perusahaan',
      'Air Mineral & Snack Box',
      'Tour Leader Profesional'
    ],
    excludes: [
      'Tiket Pesawat / Kereta ke Meeting Point Surabaya/Malang',
      'Pengeluaran pribadi di luar program',
      'Tipping sukarela'
    ],
    facilities: [
      'Resort Bintang 4 dengan Kolam Renang',
      'Ballroom & Panggung Gala Dinner',
      'Peralatan Rafting Standar Internasional',
      'Live Music & Audio System',
      'Drone Dokumentasi'
    ],
    notes: [
      'Harga adalah estimasi per pax untuk pemesanan rombongan minimal 60 orang.',
      'Dapat menyertakan tema custom teambuilding sesuai value korporasi.'
    ],
    faq: [
      {
        question: 'Apakah tema dan modul outbound teambuilding dapat dikustomisasi?',
        answer: 'Tentu. Master Game kami akan berkoordinasi dengan tim panitia/HR perusahaan Anda untuk menyesuaikan modul simulasi outbound dengan target dan core values perusahaan.'
      },
      {
        question: 'Apakah fasilitas Gala Dinner sudah termasuk panggung, sound system, dan hiburan?',
        answer: 'Ya, kami menyediakan ballroom resort berbintang lengkap dengan panggung, sound system profesional, wireless mic, operator audio visual, dan hiburan live music.'
      },
      {
        question: 'Apakah menu makanan dapat disesuaikan dengan kebutuhan rombongan?',
        answer: 'Bisa. Menu prasmanan dapat disesuaikan (misal: menu halal nusantara, menu vegetarian, atau request menu tradisional khas Jawa Timur).'
      }
    ],
    estimatedPrices: {
      pax60: 1650000,
      pax70: 1550000,
      pax80: 1480000,
      pax90: 1390000,
      pax90PlusNote: 'Hubungi Admin untuk penawaran grup besar 90+ peserta'
    },
    status: 'published',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-01T08:00:00Z'
  },
  {
    id: 'gp-banyuwangi-ijen-3d2n',
    slug: 'banyuwangi-ijen-expedition-3d2n',
    name: 'Banyuwangi & Ijen Blue Fire Corporate Expedition',
    destination: 'Banyuwangi & Kawah Ijen',
    duration: '3 Hari 2 Malam (3D2N)',
    days: 3,
    nights: 2,
    description: 'Petualangan eksotis ke ujung timur pulau Jawa. Eksplorasi savana ala Afrika di Baluran National Park, hutan purba De Djawatan Benculuk, dan pendakian Kawah Ijen melihat api biru dunia dengan fasilitas eksklusif rombongan.',
    featuredImage: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80'
    ],
    itinerary: [
      {
        day: 1,
        title: 'Penjemputan Banyuwangi & Savana Baluran',
        activities: [
          '09.00 - Penjemputan di Bandara Banyuwangi (BWX) / Stasiun Ketapang.',
          '11.30 - Makan siang seafood khas pesisir Banyuwangi.',
          '13.30 - Eksplorasi Taman Nasional Baluran (Savana Bekol & Pantai Bama).',
          '17.30 - Check-in Hotel / Resort tepi pantai Banyuwangi.',
          '19.00 - Dinner & briefing pendakian Ijen.'
        ]
      },
      {
        day: 2,
        title: 'Midnight Trekking Blue Fire Kawah Ijen & De Djawatan',
        activities: [
          '00.30 - Berangkat menuju Pos Paltuding Ijen dengan armada khusus.',
          '02.00 - Mulai pendakian didampingi Ranger Berlisensi & Masker Gas Respirator.',
          '04.00 - Menyaksikan fenomena langka Api Biru (Blue Fire) & Danau Kawah Tosca.',
          '08.00 - Kembali ke hotel, sarapan pagi & istirahat relaksasi.',
          '14.00 - Mengunjungi Hutan Trembesi Raksasa De Djawatan Benculuk (Lord of the Rings).',
          '19.00 - BBQ Seafood Dinner tepi selat Bali.'
        ]
      },
      {
        day: 3,
        title: 'Desa Adat Kemiren & Belanja Oleh-Oleh',
        activities: [
          '08.00 - Sarapan & Check-out.',
          '09.30 - Berkunjung ke Desa Wisata Adat Osing Kemiren & menikmati kopi Osing.',
          '12.00 - Makan siang nasi tempong legendaris & belanja batik khas Banyuwangi.',
          '14.30 - Pengantaran ke Bandara / Stasiun.'
        ]
      }
    ],
    includes: [
      'Transportasi Bus Pariwisata AC selama di Banyuwangi',
      'Akomodasi 2 Malam di Hotel Bintang 4 Banyuwangi',
      'Masker Gas Respirator Standar & Senter Kepala untuk setiap peserta',
      'Guide Lokal Kawah Ijen & Tiket Masuk Seluruh Wisata',
      'Konsumsi Lengkap (Breakfast, Lunch, Dinner BBQ)',
      'Dokumentasi Foto & Video Perusahaan',
      'Banner Acara & Air Mineral',
      'Tour Leader Profesional'
    ],
    excludes: [
      'Tiket transportasi ke Banyuwangi',
      'Troli dorong di Kawah Ijen (opsional)',
      'Pengeluaran pribadi'
    ],
    facilities: [
      'Bus Eksekutif Nyaman',
      'Masker Respirator Lengkap',
      'Guide Berpengalaman',
      'Hotel Tepi Pantai',
      'Dokumentasi Drone'
    ],
    notes: [
      'Pendakian Ijen membutuhkan kondisi fisik sehat tanpa riwayat asma berat atau penyakit jantung.',
      'Tersedia ojek troli manusia (trolley) bagi peserta yang ingin naik tanpa mendaki.'
    ],
    faq: [
      {
        question: 'Apakah pendakian Blue Fire Kawah Ijen aman untuk rombongan gathering perusahaan?',
        answer: 'Aman dengan panduan Ranger lokal berlisensi dan masker respirator gas standar yang kami sediakan untuk setiap peserta.'
      },
      {
        question: 'Apakah tersedia troli dorong (trolley) bagi peserta yang ingin naik tanpa mendaki?',
        answer: 'Tersedia jasa sewa troli lokal di Pos Paltuding yang siap mengantar peserta naik dan turun kawah dengan biaya sewa langsung di lokasi.'
      },
      {
        question: 'Dari mana saja titik penjemputan peserta yang dapat difasilitasi?',
        answer: 'Penjemputan fleksibel dapat dimulai dari Bandara Banyuwangi (BWX), Stasiun Ketapang, maupun penjemputan langsung dari Surabaya atau Malang.'
      }
    ],
    estimatedPrices: {
      pax60: 1750000,
      pax70: 1650000,
      pax80: 1580000,
      pax90: 1490000,
      pax90PlusNote: 'Hubungi Admin untuk penawaran grup besar 90+ peserta'
    },
    status: 'published',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-01T08:00:00Z'
  }
];
