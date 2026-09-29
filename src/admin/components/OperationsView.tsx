import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarDays, Clock, FileText, UserCheck, ChevronLeft, ChevronRight, 
  MapPin, Users, Car, Plane, Compass, Download, Printer, Filter, 
  CheckCircle2, AlertTriangle, ShieldCheck, Eye, Search, Plus, Edit2, 
  Trash2, X, Check, ArrowRight, Shield, Globe, Navigation, Award, Fuel,
  Phone, Mail, Info, Calendar, DollarSign
} from 'lucide-react';
import { UnifiedBookingDetail } from '../../components/admin/BookingDetailModal';
import { Batch as ShareTourBatch, Trip as ShareTourTrip } from '../../sharetour/types';
import { VEHICLES } from '../../data';
import { useApp } from '../../AppContext';
import { getAdminHeaders, handleAdminResponse } from '../../utils/adminAuth';

interface OperationsViewProps {
  bookings: UnifiedBookingDetail[];
  shareTourBatches: ShareTourBatch[];
  shareTourTrips: ShareTourTrip[];
  activeTab: 'calendar' | 'departures' | 'manifest' | 'assignment';
  setActiveTab: (tab: 'calendar' | 'departures' | 'manifest' | 'assignment') => void;
  onOpenDetail: (booking: UnifiedBookingDetail) => void;
  theme: any;
  isDark?: boolean;
  triggerToast: (msg: string) => void;
}

export interface OperationalAssignment {
  bookingId: string;
  bookingCode: string;
  vehicleName: string;
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  guideName?: string;
  guidePhone?: string;
  status: 'Assigned' | 'Ready' | 'On Trip' | 'Completed';
  note?: string;
  assignedAt: string;
}

interface FleetItem {
  id: string;
  name: string;
  plateNumber: string;
  capacity: number;
}

interface DriverItem {
  id: string;
  name: string;
  phone: string;
  license?: string;
  rating?: number;
}

interface GuideItem {
  id: string;
  name: string;
  phone: string;
  languages?: string;
}

// Company licensed master fallbacks if localStorage has not been seeded yet
const DEFAULT_FLEET: FleetItem[] = [
  { id: 'f-hiace-premio', name: 'Toyota HiAce Premio', plateNumber: 'N 7088 SJ', capacity: 11 },
  { id: 'f-hiace-commuter', name: 'Toyota HiAce Commuter', plateNumber: 'N 7192 SJ', capacity: 15 },
  { id: 'f-innova-reborn', name: 'Toyota Innova Reborn', plateNumber: 'N 1450 SJ', capacity: 7 },
  { id: 'f-avanza', name: 'Toyota Avanza', plateNumber: 'N 1823 SJ', capacity: 5 }
];

const DEFAULT_DRIVERS: DriverItem[] = [
  { id: 'd-1', name: 'Bpk. Hendra Saputra', phone: '+62 812-3456-7890', license: 'B1 Umum', rating: 5.0 },
  { id: 'd-2', name: 'Bpk. Agus Santoso', phone: '+62 813-9876-5432', license: 'A Umum', rating: 4.9 },
  { id: 'd-3', name: 'Bpk. Tomi Wijaya', phone: '+62 852-1122-3344', license: 'B1 Umum', rating: 5.0 },
  { id: 'd-4', name: 'Bpk. Made Artawa', phone: '+62 821-4455-6677', license: 'A Umum', rating: 4.8 }
];

const DEFAULT_GUIDES: GuideItem[] = [
  { id: 'g-1', name: 'Mas Dimas (HPI Certified)', phone: '+62 812-8899-0011', languages: 'ID, EN' },
  { id: 'g-2', name: 'Bli Wayan Budiana', phone: '+62 819-2233-4455', languages: 'ID, EN, ZH' },
  { id: 'g-3', name: 'Mbak Rina Oktaviani', phone: '+62 856-7788-9900', languages: 'ID, EN' }
];

export default function OperationsView({
  bookings,
  shareTourBatches,
  shareTourTrips,
  activeTab,
  setActiveTab,
  onOpenDetail,
  theme,
  isDark = false,
  triggerToast
}: OperationsViewProps) {
  const { addSchedule } = useApp();

  // -------------------------------------------------------------
  // 1. MASTER OPERATIONAL DATE HELPER
  // Open Trip MUST use departureDate from batch / official departureDate
  // -------------------------------------------------------------
  const getOfficialDepartureDate = (b: UnifiedBookingDetail): string => {
    let dateStr = '';
    if (b.serviceType === 'sharetour') {
      if (b.batchId && shareTourBatches.length > 0) {
        const batch = shareTourBatches.find(bat => bat.id === b.batchId);
        if (batch?.departureDate) {
          dateStr = batch.departureDate;
        }
      }
      if (!dateStr) {
        dateStr = b.departureDate || b.date || '';
      }
    } else {
      dateStr = b.departureDate || b.date || '';
    }

    if (dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }
    return dateStr.trim();
  };

  // -------------------------------------------------------------
  // 2. RESOURCE INVENTORY (Fleet, Drivers, Guides, Assignments)
  // -------------------------------------------------------------
  const [fleetList, setFleetList] = useState<FleetItem[]>(DEFAULT_FLEET);
  const [driverList, setDriverList] = useState<DriverItem[]>(DEFAULT_DRIVERS);
  const [guideList, setGuideList] = useState<GuideItem[]>(DEFAULT_GUIDES);
  const [assignments, setAssignments] = useState<Record<string, OperationalAssignment>>({});

  // Modal State for Assignment
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedBookingForAssign, setSelectedBookingForAssign] = useState<UnifiedBookingDetail | null>(null);
  const [assignForm, setAssignForm] = useState<{
    vehicleName: string;
    plateNumber: string;
    driverName: string;
    driverPhone: string;
    guideName: string;
    status: 'Assigned' | 'Ready' | 'On Trip' | 'Completed';
    note: string;
  }>({
    vehicleName: '',
    plateNumber: '',
    driverName: '',
    driverPhone: '',
    guideName: '',
    status: 'Ready',
    note: ''
  });

  // Load resources and assignments from Server Persistent SQL DB
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch persistent assignments from SQL backend
    fetch('/api/operations/assignments', {
      headers: getAdminHeaders()
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data?.assignments && typeof data.assignments === 'object') {
          setAssignments(data.assignments);
        }
      })
      .catch(err => {
        console.warn('Could not load operational assignments from server:', err);
      });

    // 2. Fetch persistent operational resources (fleet, drivers, guides) from SQL backend
    fetch('/api/operations/resources', {
      headers: getAdminHeaders()
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!isMounted || !data) return;
        if (Array.isArray(data.fleet) && data.fleet.length > 0) {
          setFleetList(data.fleet);
        }
        if (Array.isArray(data.drivers) && data.drivers.length > 0) {
          setDriverList(data.drivers);
        }
        if (Array.isArray(data.guides) && data.guides.length > 0) {
          setGuideList(data.guides);
        }
      })
      .catch(err => {
        console.warn('Could not load operational resources from server:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Save Assignment to Server Persistent SQL DB
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForAssign) return;

    const key = selectedBookingForAssign.bookingCode || selectedBookingForAssign.id;
    const newAssignment: OperationalAssignment = {
      bookingId: selectedBookingForAssign.id,
      bookingCode: selectedBookingForAssign.bookingCode,
      vehicleName: assignForm.vehicleName || selectedBookingForAssign.vehicleName || 'Toyota HiAce Premio',
      plateNumber: assignForm.plateNumber || 'N 7088 SJ',
      driverName: assignForm.driverName || 'Bpk. Hendra Saputra',
      driverPhone: assignForm.driverPhone || '+62 812-3456-7890',
      guideName: assignForm.guideName || '',
      status: assignForm.status,
      note: assignForm.note,
      assignedAt: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/operations/assignments', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(newAssignment)
      });
      const data = await handleAdminResponse(res, 'Gagal menyimpan penugasan operasional ke server.');
      const savedAssignment = data.assignment || newAssignment;

      const updated = {
        ...assignments,
        [key]: savedAssignment,
        [savedAssignment.bookingCode]: savedAssignment,
        [savedAssignment.bookingId]: savedAssignment
      };

      setAssignments(updated);

      // Optionally record to schedule table
      const targetDate = getOfficialDepartureDate(selectedBookingForAssign);
      if (targetDate && targetDate.length >= 10 && addSchedule) {
        try {
          addSchedule({
            date: targetDate,
            type: 'allocation',
            tourId: selectedBookingForAssign.serviceTitle || selectedBookingForAssign.id,
            driver: savedAssignment.driverName,
            vehicle: `${savedAssignment.vehicleName} (${savedAssignment.plateNumber})`,
            note: savedAssignment.note || `Trip #${selectedBookingForAssign.bookingCode}`
          });
        } catch {}
      }

      setIsAssignModalOpen(false);
      triggerToast(`Alokasi armada & crew untuk booking #${selectedBookingForAssign.bookingCode} berhasil disimpan ke database server.`);
    } catch (err: any) {
      console.error('Error saving assignment:', err);
      triggerToast(`Gagal menyimpan penugasan: ${err.message || 'Kesalahan server'}`);
    }
  };

  // Remove / Unassign Assignment from Server Persistent SQL DB
  const handleRemoveAssignment = async () => {
    if (!selectedBookingForAssign) return;
    const key = selectedBookingForAssign.bookingCode || selectedBookingForAssign.id;
    const code = selectedBookingForAssign.bookingCode;
    const id = selectedBookingForAssign.id;

    try {
      const res = await fetch(`/api/operations/assignments/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
      await handleAdminResponse(res, 'Gagal menghapus penugasan dari server.');

      setAssignments(prev => {
        const next = { ...prev };
        delete next[key];
        if (code) delete next[code];
        if (id) delete next[id];
        return next;
      });

      setIsAssignModalOpen(false);
      triggerToast(`Penugasan operasional booking #${code} berhasil dihapus.`);
    } catch (err: any) {
      console.error('Error deleting assignment:', err);
      triggerToast(`Gagal menghapus penugasan: ${err.message || 'Kesalahan server'}`);
    }
  };

  const openAssignModalForBooking = (item: UnifiedBookingDetail) => {
    setSelectedBookingForAssign(item);
    const key = item.bookingCode || item.id;
    const existing = assignments[key];

    if (existing) {
      setAssignForm({
        vehicleName: existing.vehicleName,
        plateNumber: existing.plateNumber,
        driverName: existing.driverName,
        driverPhone: existing.driverPhone,
        guideName: existing.guideName || '',
        status: existing.status,
        note: existing.note || ''
      });
    } else {
      const defaultVehicle = fleetList.find(f => f.name.toLowerCase().includes((item.vehicleName || '').toLowerCase())) || fleetList[0];
      setAssignForm({
        vehicleName: item.vehicleName || defaultVehicle?.name || 'Toyota HiAce Premio',
        plateNumber: defaultVehicle?.plateNumber || 'N 7088 SJ',
        driverName: driverList[0]?.name || 'Bpk. Hendra Saputra',
        driverPhone: driverList[0]?.phone || '+62 812-3456-7890',
        guideName: item.serviceType === 'tour' || item.serviceType === 'sharetour' ? (guideList[0]?.name || '') : '',
        status: 'Ready',
        note: item.specialRequests || ''
      });
    }
    setIsAssignModalOpen(true);
  };

  // -------------------------------------------------------------
  // 3. CALENDAR STATE & DATA MAPPING
  // -------------------------------------------------------------
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [calendarServiceFilter, setCalendarServiceFilter] = useState<'all' | 'tour' | 'sharetour' | 'airport' | 'taxi' | 'car-rental'>('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Map departures by Date (YYYY-MM-DD) across all 5 services
  const departuresByDate = useMemo(() => {
    const map = new Map<string, UnifiedBookingDetail[]>();

    bookings.forEach(b => {
      if (b.bookingStatus === 'Cancelled') return;

      const effectiveDate = getOfficialDepartureDate(b);
      if (!effectiveDate || effectiveDate.length < 10) return;

      if (calendarServiceFilter !== 'all') {
        if (calendarServiceFilter === 'tour' && b.serviceType !== 'tour') return;
        if (calendarServiceFilter === 'sharetour' && b.serviceType !== 'sharetour') return;
        if (calendarServiceFilter === 'airport' && b.serviceType !== 'airport') return;
        if (calendarServiceFilter === 'taxi' && b.serviceType !== 'taxi') return;
        if (calendarServiceFilter === 'car-rental' && b.serviceType !== 'car-rental' && b.serviceType !== 'rental') return;
      }

      const existing = map.get(effectiveDate) || [];
      existing.push(b);
      map.set(effectiveDate, existing);
    });

    return map;
  }, [bookings, calendarServiceFilter, shareTourBatches]);

  const selectedDayDepartures = departuresByDate.get(selectedDay) || [];

  // -------------------------------------------------------------
  // 4. DEPARTURES TAB STATE & MAPPING (Chronological, Open Trip Priority, Capacity)
  // -------------------------------------------------------------
  const [departuresHorizonFilter, setDeparturesHorizonFilter] = useState<'upcoming' | 'today' | 'all' | 'past'>('upcoming');
  const [departuresServiceFilter, setDeparturesServiceFilter] = useState<'all' | 'sharetour' | 'tour' | 'airport' | 'taxi' | 'car-rental'>('all');

  const todayStr = new Date().toISOString().slice(0, 10);

  // Open Trip Batches list enriched with live booked counts and capacity
  const enrichedBatches = useMemo(() => {
    return shareTourBatches
      .filter(batch => !batch.isArchived && !batch.isDeleted)
      .map(batch => {
        const trip = shareTourTrips.find(t => t.id === batch.tripId);
        
        // Confirmed bookings in this batch
        const batchBookings = bookings.filter(b => 
          b.serviceType === 'sharetour' && 
          b.batchId === batch.id &&
          b.bookingStatus !== 'Cancelled' &&
          (b.paymentStatus === 'Paid' || b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Completed')
        );

        const bookedPax = batchBookings.reduce((sum, b) => sum + (b.passengers || 1), 0);
        const quota = batch.quota || 12;
        const availableSeats = typeof batch.availableSeats === 'number' 
          ? batch.availableSeats 
          : Math.max(0, quota - bookedPax);
        const occupancyPct = Math.min(100, Math.round((bookedPax / quota) * 100));

        return {
          ...batch,
          tripTitle: trip?.title || 'Open Trip Bromo Ijen',
          tripDuration: trip?.duration || '1 Hari',
          tripLocation: trip?.location || 'Jawa Timur',
          bookedPax,
          availableSeats,
          occupancyPct,
          bookingsCount: batchBookings.length
        };
      })
      .sort((a, b) => (a.departureDate || '').localeCompare(b.departureDate || ''));
  }, [shareTourBatches, shareTourTrips, bookings]);

  // All departures list sorted chronologically
  const sortedDepartures = useMemo(() => {
    return bookings
      .filter(b => {
        if (b.bookingStatus === 'Cancelled') return false;

        const depDate = getOfficialDepartureDate(b);
        if (!depDate || depDate.length < 10) return false;

        // Service filter
        if (departuresServiceFilter !== 'all') {
          if (departuresServiceFilter === 'tour' && b.serviceType !== 'tour') return false;
          if (departuresServiceFilter === 'sharetour' && b.serviceType !== 'sharetour') return false;
          if (departuresServiceFilter === 'airport' && b.serviceType !== 'airport') return false;
          if (departuresServiceFilter === 'taxi' && b.serviceType !== 'taxi') return false;
          if (departuresServiceFilter === 'car-rental' && b.serviceType !== 'car-rental' && b.serviceType !== 'rental') return false;
        }

        // Horizon filter
        if (departuresHorizonFilter === 'today') {
          return depDate === todayStr;
        }
        if (departuresHorizonFilter === 'upcoming') {
          return depDate >= todayStr;
        }
        if (departuresHorizonFilter === 'past') {
          return depDate < todayStr;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = getOfficialDepartureDate(a);
        const dateB = getOfficialDepartureDate(b);
        const dateComp = dateA.localeCompare(dateB);
        if (dateComp !== 0) return dateComp;
        return (a.time || '08:00').localeCompare(b.time || '08:00');
      });
  }, [bookings, departuresServiceFilter, departuresHorizonFilter, shareTourBatches, todayStr]);

  // -------------------------------------------------------------
  // 5. MANIFEST TAB STATE & MAPPING (Strict Confirmed/Paid Only)
  // -------------------------------------------------------------
  const [manifestSearch, setManifestSearch] = useState('');
  const [manifestBatchFilter, setManifestBatchFilter] = useState<string>('all');
  const [manifestServiceFilter, setManifestServiceFilter] = useState<'all' | 'sharetour' | 'tour' | 'airport' | 'taxi' | 'car-rental'>('all');

  const manifestBookings = useMemo(() => {
    return bookings.filter(b => {
      // RULE: Strictly Confirmed/Paid bookings only
      const isPaid = (b.paymentStatus || '').toLowerCase() === 'paid';
      const isConfirmed = b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Completed';
      if (!isPaid && !isConfirmed) return false;
      if (b.bookingStatus === 'Cancelled') return false;

      // Filter by Service
      if (manifestServiceFilter !== 'all') {
        if (manifestServiceFilter === 'tour' && b.serviceType !== 'tour') return false;
        if (manifestServiceFilter === 'sharetour' && b.serviceType !== 'sharetour') return false;
        if (manifestServiceFilter === 'airport' && b.serviceType !== 'airport') return false;
        if (manifestServiceFilter === 'taxi' && b.serviceType !== 'taxi') return false;
        if (manifestServiceFilter === 'car-rental' && b.serviceType !== 'car-rental' && b.serviceType !== 'rental') return false;
      }

      // Filter by Open Trip Batch if selected
      if (manifestBatchFilter !== 'all') {
        if (b.serviceType !== 'sharetour' || b.batchId !== manifestBatchFilter) return false;
      }

      // Search Query
      if (manifestSearch.trim()) {
        const q = manifestSearch.toLowerCase();
        const match = 
          b.customerName.toLowerCase().includes(q) ||
          b.bookingCode.toLowerCase().includes(q) ||
          b.serviceTitle.toLowerCase().includes(q) ||
          (b.customerPhone || '').toLowerCase().includes(q) ||
          (b.customerEmail || '').toLowerCase().includes(q) ||
          (b.pickupLocation || '').toLowerCase().includes(q) ||
          (b.flightNumber || '').toLowerCase().includes(q) ||
          (b.participantNames || []).some(p => p.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = getOfficialDepartureDate(a);
      const dateB = getOfficialDepartureDate(b);
      return dateA.localeCompare(dateB);
    });
  }, [bookings, manifestServiceFilter, manifestBatchFilter, manifestSearch, shareTourBatches]);

  // Export Manifest as CSV
  const handleExportManifestCSV = () => {
    if (manifestBookings.length === 0) {
      triggerToast('Tidak ada data manifest terkonfirmasi untuk diekspor.');
      return;
    }

    const headers = [
      'Kode Booking',
      'Tanggal Keberangkatan',
      'Waktu',
      'Layanan',
      'Paket / Trip',
      'Nama Tamu Utama',
      'Telepon',
      'Email',
      'Jumlah Pax',
      'Nama Anggota Peserta',
      'Kebangsaan',
      'Titik Jemput',
      'Drop-off / Tujuan',
      'Flight / Transport',
      'Status Pembayaran',
      'Status Booking',
      'Catatan Khusus'
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = manifestBookings.map(item => {
      const depDate = getOfficialDepartureDate(item);
      const participantList = item.participantNames && item.participantNames.length > 0
        ? item.participantNames.join('; ')
        : item.customerName;

      return [
        escapeCsv(item.bookingCode),
        escapeCsv(depDate),
        escapeCsv(item.time || '08:00 WIB'),
        escapeCsv(item.serviceType.toUpperCase()),
        escapeCsv(item.serviceTitle),
        escapeCsv(item.customerName),
        escapeCsv(item.customerPhone),
        escapeCsv(item.customerEmail),
        escapeCsv(item.passengers),
        escapeCsv(participantList),
        escapeCsv(item.nationalityType || '-'),
        escapeCsv(item.pickupLocation || item.meetingPoint || '-'),
        escapeCsv(item.dropoffLocation || '-'),
        escapeCsv(item.flightNumber || '-'),
        escapeCsv(item.paymentStatus),
        escapeCsv(item.bookingStatus),
        escapeCsv(item.specialRequests || '-')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `manifest-smartjourney-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerToast(`Manifest (${manifestBookings.length} pemesanan terkonfirmasi) berhasil diunduh ke CSV.`);
  };

  // -------------------------------------------------------------
  // 6. ASSIGNMENT TAB STATE & MAPPING
  // -------------------------------------------------------------
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [assignmentServiceFilter, setAssignmentServiceFilter] = useState<'all' | 'tour' | 'sharetour' | 'airport' | 'taxi' | 'car-rental'>('all');

  const assignmentBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.bookingStatus === 'Cancelled') return false;

      // Filter by Service
      if (assignmentServiceFilter !== 'all') {
        if (assignmentServiceFilter === 'tour' && b.serviceType !== 'tour') return false;
        if (assignmentServiceFilter === 'sharetour' && b.serviceType !== 'sharetour') return false;
        if (assignmentServiceFilter === 'airport' && b.serviceType !== 'airport') return false;
        if (assignmentServiceFilter === 'taxi' && b.serviceType !== 'taxi') return false;
        if (assignmentServiceFilter === 'car-rental' && b.serviceType !== 'car-rental' && b.serviceType !== 'rental') return false;
      }

      // Filter by Assignment status
      const key = b.bookingCode || b.id;
      const isAssigned = Boolean(assignments[key]);
      if (assignmentStatusFilter === 'assigned' && !isAssigned) return false;
      if (assignmentStatusFilter === 'unassigned' && isAssigned) return false;

      return true;
    }).sort((a, b) => {
      const dateA = getOfficialDepartureDate(a);
      const dateB = getOfficialDepartureDate(b);
      return dateA.localeCompare(dateB);
    });
  }, [bookings, assignments, assignmentStatusFilter, assignmentServiceFilter, shareTourBatches]);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const getServiceBadge = (type: string) => {
    switch (type) {
      case 'tour':
        return { label: 'Private Tour', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' };
      case 'sharetour':
        return { label: 'Open Trip', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' };
      case 'airport':
        return { label: 'Airport Transfer', color: 'bg-sky-500/10 text-sky-500 border-sky-500/30' };
      case 'taxi':
        return { label: 'Taxi Service', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30' };
      case 'car-rental':
      case 'rental':
        return { label: 'Car Rental', color: 'bg-rose-500/10 text-rose-500 border-rose-500/30' };
      default:
        return { label: type.toUpperCase(), color: 'bg-neutral-800 text-neutral-300 border-neutral-700' };
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Operations Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-tight font-sans">
                PUSAT OPERASIONAL PERJALANAN (OPERATIONS)
              </h2>
              <p className={`text-xs ${theme.textSecondary}`}>
                Kalender 5 layanan terpadu, keberangkatan open trip &amp; privat, manifest penumpang terkonfirmasi, dan penugasan armada driver.
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary Stats */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl ${theme.innerCard} border border-neutral-700/60 flex items-center gap-2`}>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono text-neutral-300 font-bold">
              {bookings.filter(b => b.bookingStatus !== 'Cancelled').length} Total Booking Operasional
            </span>
          </div>
          <div className={`px-3 py-1.5 rounded-xl ${theme.innerCard} border border-neutral-700/60 flex items-center gap-2`}>
            <Users className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-mono text-neutral-300 font-bold">
              {enrichedBatches.length} Batch Open Trip
            </span>
          </div>
        </div>
      </div>

      {/* OPERATIONS SUB-NAV */}
      <div className="flex items-center gap-2 border-b border-neutral-700/40 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'calendar' as const, label: '1. Kalender Operasional', icon: CalendarDays },
          { id: 'departures' as const, label: '2. Jadwal Keberangkatan', icon: Clock },
          { id: 'manifest' as const, label: '3. Manifest Penumpang', icon: FileText },
          { id: 'assignment' as const, label: '4. Penugasan Armada & Kru', icon: UserCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                isActive
                  ? isDark
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold shadow-xs'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-700 font-extrabold shadow-xs'
                  : isDark
                    ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-transparent'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          1. VIEW: CALENDAR (JADWAL DARI SELURUH 5 SERVICE)
          ========================================================================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Calendar Service Filter */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase shrink-0 mr-1 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filter Layanan:
              </span>
              {[
                { id: 'all' as const, label: 'Semua 5 Layanan' },
                { id: 'tour' as const, label: 'Private Tour' },
                { id: 'sharetour' as const, label: 'Open Trip' },
                { id: 'airport' as const, label: 'Airport Transfer' },
                { id: 'taxi' as const, label: 'Taxi Service' },
                { id: 'car-rental' as const, label: 'Car Rental' }
              ].map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setCalendarServiceFilter(ch.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    calendarServiceFilter === ch.id
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-500 font-black'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-mono text-neutral-400">
              *Open Trip sinkron langsung dengan tanggal batch resmi
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Month Calendar Grid (2 cols) */}
            <div className={`lg:col-span-2 ${theme.card} border rounded-2xl p-5 space-y-4 shadow-sm`}>
              {/* Month Header Navigation */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black font-sans tracking-wide flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-amber-500" />
                  <span>{monthNames[month]} {year}</span>
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
                    title="Bulan Sebelumnya"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      setCurrentDate(now);
                      setSelectedDay(now.toISOString().slice(0, 10));
                    }}
                    className="px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
                  >
                    Hari Ini
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
                    title="Bulan Berikutnya"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Weekdays Row */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono uppercase text-neutral-400 font-bold border-b border-neutral-700/40 pb-2">
                {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 rounded-xl bg-transparent opacity-20" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isSelected = selectedDay === dateStr;
                  const isToday = todayStr === dateStr;
                  const dayDepartures = departuresByDate.get(dateStr) || [];
                  const hasDepartures = dayDepartures.length > 0;

                  // Service counts on this day
                  const hasTour = dayDepartures.some(b => b.serviceType === 'tour');
                  const hasShare = dayDepartures.some(b => b.serviceType === 'sharetour');
                  const hasAirport = dayDepartures.some(b => b.serviceType === 'airport');
                  const hasTaxi = dayDepartures.some(b => b.serviceType === 'taxi');
                  const hasRental = dayDepartures.some(b => b.serviceType === 'car-rental' || b.serviceType === 'rental');

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDay(dateStr)}
                      className={`h-22 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                          : isToday
                            ? 'border-amber-500/40 bg-neutral-800/30'
                            : `${theme.innerCard} border-neutral-800/60 hover:border-neutral-700`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-mono font-bold ${
                          isToday ? 'text-amber-500 font-black' : isSelected ? 'text-amber-400' : 'text-neutral-300'
                        }`}>
                          {dayNum}
                        </span>
                        {/* Service dot badges */}
                        <div className="flex items-center gap-0.5">
                          {hasShare && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Open Trip" />}
                          {hasTour && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Private Tour" />}
                          {hasAirport && <span className="h-1.5 w-1.5 rounded-full bg-sky-400" title="Airport" />}
                          {hasTaxi && <span className="h-1.5 w-1.5 rounded-full bg-purple-400" title="Taxi" />}
                          {hasRental && <span className="h-1.5 w-1.5 rounded-full bg-rose-400" title="Rental" />}
                        </div>
                      </div>

                      {hasDepartures ? (
                        <div className="space-y-0.5 overflow-hidden">
                          <div className="text-[10px] font-mono font-black text-amber-500 truncate">
                            {dayDepartures.length} Trip
                          </div>
                          <div className="text-[9px] text-neutral-400 truncate">
                            {dayDepartures.reduce((s, b) => s + (b.passengers || 1), 0)} Pax
                          </div>
                        </div>
                      ) : (
                        <span className="text-[9px] text-neutral-600 font-mono">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily Departure Inspector (1 col) */}
            <div className={`${theme.card} border rounded-2xl p-5 space-y-4 shadow-sm flex flex-col`}>
              <div className="border-b border-neutral-700/40 pb-3">
                <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold block">
                  INSPEKSI KEBERANGKATAN HARIAN
                </span>
                <h3 className="text-base font-black font-sans text-amber-500">
                  {selectedDay}
                </h3>
                <p className="text-[11px] text-neutral-400">
                  {selectedDayDepartures.length} Perjalanan Terjadwal pada tanggal ini.
                </p>
              </div>

              <div className="flex-grow space-y-2.5 overflow-y-auto max-h-[520px] no-scrollbar">
                {selectedDayDepartures.length === 0 ? (
                  <div className="py-16 text-center text-xs text-neutral-500 font-mono">
                    Tidak ada keberangkatan operasional terjadwal pada {selectedDay}.
                  </div>
                ) : (
                  selectedDayDepartures.map((item) => {
                    const badge = getServiceBadge(item.serviceType);
                    const key = item.bookingCode || item.id;
                    const assignment = assignments[key];

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl ${theme.innerCard} border border-neutral-700/60 hover:border-amber-500/40 transition-all space-y-2`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-amber-500">
                            #{item.bookingCode}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-neutral-100 line-clamp-1" title={item.serviceTitle}>
                          {item.serviceTitle}
                        </h4>

                        <div className="text-[11px] text-neutral-400 space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Tamu: <b className="text-neutral-200">{item.customerName}</b> ({item.passengers} Pax)</span>
                            <span className="font-mono text-amber-400 font-bold">{item.time || '08:00 WIB'}</span>
                          </div>
                          <div className="truncate text-[10px] text-neutral-500">
                            Jemput: {item.pickupLocation || item.meetingPoint || 'Sesuai Konfirmasi'}
                          </div>
                        </div>

                        {/* Crew & Fleet assigned badge */}
                        <div className="pt-1 border-t border-neutral-800 flex items-center justify-between text-[10px] font-mono">
                          {assignment ? (
                            <span className="text-emerald-400 flex items-center gap-1 truncate max-w-[170px]" title={`${assignment.vehicleName} • ${assignment.driverName}`}>
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{assignment.driverName} ({assignment.plateNumber})</span>
                            </span>
                          ) : (
                            <span className="text-amber-500/80 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>Belum Ditugaskan</span>
                            </span>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openAssignModalForBooking(item)}
                              className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 cursor-pointer"
                            >
                              {assignment ? 'Ubah' : 'Tugaskan'}
                            </button>
                            <button
                              onClick={() => onOpenDetail(item)}
                              className="p-1 rounded bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                              title="Lihat Detail Pesanan"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. VIEW: DEPARTURES (JADWAL KEBERANGKATAN MENDATANG & OPEN TRIP BATCH)
          ========================================================================= */}
      {activeTab === 'departures' && (
        <div className="space-y-6">
          {/* Departures Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase shrink-0 mr-1">
                Waktu:
              </span>
              {[
                { id: 'upcoming' as const, label: 'Mendatang (Upcoming)' },
                { id: 'today' as const, label: 'Hari Ini' },
                { id: 'all' as const, label: 'Semua Waktu' },
                { id: 'past' as const, label: 'Riwayat Lalu' }
              ].map((h) => (
                <button
                  key={h.id}
                  onClick={() => setDeparturesHorizonFilter(h.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    departuresHorizonFilter === h.id
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-500 font-black'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase shrink-0 mr-1">
                Layanan:
              </span>
              {[
                { id: 'all' as const, label: 'Semua' },
                { id: 'sharetour' as const, label: 'Open Trip (Batch)' },
                { id: 'tour' as const, label: 'Private Tour' },
                { id: 'airport' as const, label: 'Airport' },
                { id: 'taxi' as const, label: 'Taxi' },
                { id: 'car-rental' as const, label: 'Rental' }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setDeparturesServiceFilter(s.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    departuresServiceFilter === s.id
                      ? 'bg-amber-500/20 text-amber-400 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* OPEN TRIP BATCHES HIGHLIGHT (PRIORITIZED IF RELEVANT) */}
          {(departuresServiceFilter === 'all' || departuresServiceFilter === 'sharetour') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
                  <Compass className="h-4 w-4" />
                  <span>JADWAL BATCH RESMI OPEN TRIP ({enrichedBatches.length} BATCH TERDAFTAR)</span>
                </h3>
                <span className="text-[11px] font-mono text-neutral-400">
                  Data kapasitas, kursi terisi, dan sisa slot terverifikasi
                </span>
              </div>

              {enrichedBatches.length === 0 ? (
                <div className={`p-6 rounded-2xl ${theme.card} border text-center text-xs text-neutral-500 font-mono`}>
                  Belum ada batch open trip yang dijadwalkan pada sistem.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {enrichedBatches.map((batch) => {
                    const isUpcoming = (batch.departureDate || '') >= todayStr;
                    return (
                      <div
                        key={batch.id}
                        className={`p-4 rounded-2xl ${theme.card} border transition-all ${
                          isUpcoming ? 'border-neutral-700/80 hover:border-amber-500/40' : 'opacity-70 border-neutral-800'
                        } space-y-3 shadow-xs`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            BATCH RESMI
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                            batch.status === 'Open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {batch.status === 'Open' ? 'Tersedia' : 'Ditutup / Penuh'}
                          </span>
                        </div>

                        <div>
                          <div className="text-sm font-black font-sans text-neutral-100 line-clamp-1">
                            {batch.tripTitle}
                          </div>
                          <div className="text-[11px] font-mono font-bold text-amber-400 flex items-center gap-1.5 mt-0.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            <span>{batch.departureDate || 'Tanggal Belum Ditentukan'}</span>
                          </div>
                        </div>

                        {/* Capacity Progress Bar */}
                        <div className="space-y-1.5 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-neutral-400">Kapasitas: <b className="text-neutral-200">{batch.quota || 12} Kursi</b></span>
                            <span className="font-bold text-amber-400">{batch.bookedPax} Terisi</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                            <div 
                              className={`h-full transition-all rounded-full ${
                                batch.occupancyPct >= 90 ? 'bg-red-500' : batch.occupancyPct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${batch.occupancyPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                            <span>Tersedia: <b className="text-emerald-400">{batch.availableSeats} Slot</b></span>
                            <span>{batch.bookingsCount} Booking</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => {
                              setManifestBatchFilter(batch.id);
                              setActiveTab('manifest');
                            }}
                            className="text-[11px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                          >
                            <span>Buka Manifest Batch</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* MASTER DEPARTURES TABLE */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider font-mono text-neutral-400 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>DAFTAR JADWAL KEBERANGKATAN ({sortedDepartures.length} TRIP TERDAFTAR)</span>
            </h3>

            <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                    <tr>
                      <th className="p-3.5">Tanggal &amp; Waktu</th>
                      <th className="p-3.5">Layanan</th>
                      <th className="p-3.5">Nama Trip / Paket</th>
                      <th className="p-3.5">Tamu Utama</th>
                      <th className="p-3.5 text-center">Pax</th>
                      <th className="p-3.5">Titik Jemput</th>
                      <th className="p-3.5">Armada &amp; Supir</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/40">
                    {sortedDepartures.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-neutral-500 font-mono">
                          Tidak ada jadwal keberangkatan yang sesuai filter.
                        </td>
                      </tr>
                    ) : (
                      sortedDepartures.map((item) => {
                        const depDate = getOfficialDepartureDate(item);
                        const badge = getServiceBadge(item.serviceType);
                        const key = item.bookingCode || item.id;
                        const assignment = assignments[key];

                        return (
                          <tr 
                            key={item.id} 
                            onClick={() => onOpenDetail(item)}
                            className={`${theme.hover} transition-colors cursor-pointer`}
                          >
                            <td className="p-3.5 whitespace-nowrap">
                              <div className="font-mono font-bold text-amber-400">{depDate}</div>
                              <div className="text-[10px] font-mono text-neutral-400">{item.time || '08:00 WIB'}</div>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badge.color}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="p-3.5 font-semibold text-neutral-200 max-w-[200px] truncate" title={item.serviceTitle}>
                              <div>{item.serviceTitle}</div>
                              {item.batchId && (
                                <div className="text-[10px] font-mono text-emerald-400">Batch #{item.batchId.slice(0, 8)}</div>
                              )}
                            </td>
                            <td className="p-3.5">
                              <div className="font-bold text-neutral-200">{item.customerName}</div>
                              <div className="text-[10px] font-mono text-neutral-400">{item.customerPhone}</div>
                            </td>
                            <td className="p-3.5 font-mono text-center text-neutral-200">
                              <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-bold">
                                {item.passengers} Pax
                              </span>
                            </td>
                            <td className="p-3.5 text-neutral-400 max-w-[150px] truncate">
                              {item.pickupLocation || item.meetingPoint || 'Sesuai Konfirmasi'}
                            </td>
                            <td className="p-3.5">
                              {assignment ? (
                                <div className="text-xs">
                                  <div className="font-bold text-emerald-400">{assignment.driverName}</div>
                                  <div className="text-[10px] font-mono text-neutral-400">{assignment.vehicleName} ({assignment.plateNumber})</div>
                                </div>
                              ) : (
                                <span className="text-[11px] font-mono text-amber-500/80">
                                  Belum Dialokasikan
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                                item.bookingStatus === 'Confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                item.bookingStatus === 'Completed' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                                'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              }`}>
                                {item.bookingStatus}
                              </span>
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => openAssignModalForBooking(item)}
                                  className="px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[10px] font-bold"
                                  title="Alokasi Armada & Driver"
                                >
                                  {assignment ? 'Ubah' : 'Tugaskan'}
                                </button>
                                <button
                                  onClick={() => onOpenDetail(item)}
                                  className="p-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300"
                                  title="Lihat Detail Pesanan"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. VIEW: MANIFEST (MANIFEST RESMI PENUMPANG TERKONFIRMASI / PAID)
          ========================================================================= */}
      {activeTab === 'manifest' && (
        <div className="space-y-4">
          {/* Manifest Controls & Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap flex-grow max-w-2xl">
              {/* Search input */}
              <div className="relative flex-grow min-w-[240px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={manifestSearch}
                  onChange={(e) => setManifestSearch(e.target.value)}
                  placeholder="Cari nama peserta, nomor tiket, flight, atau kontak..."
                  className={`w-full ${theme.input} pl-9 pr-4 py-2 rounded-xl text-xs`}
                />
              </div>

              {/* Service filter */}
              <select
                value={manifestServiceFilter}
                onChange={(e) => setManifestServiceFilter(e.target.value as any)}
                className={`${theme.input} px-3 py-2 rounded-xl text-xs`}
              >
                <option value="all">Semua Layanan</option>
                <option value="sharetour">Open Trip (Share Tour)</option>
                <option value="tour">Private Tour</option>
                <option value="airport">Airport Transfer</option>
                <option value="taxi">Taxi Service</option>
                <option value="car-rental">Car Rental</option>
              </select>

              {/* Batch filter if Open Trip */}
              <select
                value={manifestBatchFilter}
                onChange={(e) => setManifestBatchFilter(e.target.value)}
                className={`${theme.input} px-3 py-2 rounded-xl text-xs`}
              >
                <option value="all">Semua Batch Open Trip</option>
                {enrichedBatches.map(b => (
                  <option key={b.id} value={b.id}>
                    Batch {b.departureDate} ({b.tripTitle})
                  </option>
                ))}
              </select>
            </div>

            {/* Print & Export Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="Cetak Manifest Dokumen Resmi"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak Manifest</span>
              </button>
              <button
                onClick={handleExportManifestCSV}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                title="Unduh file spreadsheet manifest format CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh CSV</span>
              </button>
            </div>
          </div>

          {/* Strict Confirmed/Paid Notice Banner */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                Manifest ini hanya menampilkan penumpang yang <b>Telah Terkonfirmasi / Lunas (Confirmed/Paid)</b> sesuai aturan operasional. Booking pending/batal otomatis disaring.
              </span>
            </div>
            <span className="font-mono font-bold shrink-0 ml-2">
              {manifestBookings.length} Peserta Terdata
            </span>
          </div>

          {/* Manifest Table */}
          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                  <tr>
                    <th className="p-3.5">Kode Booking</th>
                    <th className="p-3.5">Tgl Keberangkatan</th>
                    <th className="p-3.5">Tamu Utama &amp; Rombongan</th>
                    <th className="p-3.5">Layanan &amp; Trip</th>
                    <th className="p-3.5 text-center">Pax</th>
                    <th className="p-3.5">Titik Jemput &amp; Drop</th>
                    <th className="p-3.5">Kontak &amp; Flight</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {manifestBookings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-neutral-500 font-mono">
                        Tidak ada manifest penumpang terkonfirmasi yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    manifestBookings.map((item) => {
                      const depDate = getOfficialDepartureDate(item);
                      const badge = getServiceBadge(item.serviceType);

                      return (
                        <tr 
                          key={item.id}
                          onClick={() => onOpenDetail(item)}
                          className={`${theme.hover} transition-colors cursor-pointer`}
                        >
                          <td className="p-3.5 font-mono font-bold text-amber-500 whitespace-nowrap">
                            #{item.bookingCode}
                          </td>
                          <td className="p-3.5 font-mono text-neutral-300 whitespace-nowrap">
                            <div>{depDate}</div>
                            <div className="text-[10px] text-neutral-400">{item.time || '08:00 WIB'}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-neutral-100">{item.customerName}</div>
                            {item.participantNames && item.participantNames.length > 0 && (
                              <div className="text-[10px] text-neutral-400 mt-0.5">
                                Anggota: {item.participantNames.join(', ')}
                              </div>
                            )}
                            {item.nationalityType && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                                {item.nationalityType}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 max-w-[200px] truncate" title={item.serviceTitle}>
                            <div className="font-semibold text-neutral-200">{item.serviceTitle}</div>
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${badge.color}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-center text-neutral-200">
                            <span className="px-2 py-0.5 rounded bg-neutral-800 font-bold">
                              {item.passengers} Orang
                            </span>
                          </td>
                          <td className="p-3.5 text-neutral-400 text-xs max-w-[180px]">
                            <div className="truncate"><b className="text-neutral-500">Jemput:</b> {item.pickupLocation || item.meetingPoint || '-'}</div>
                            {item.dropoffLocation && (
                              <div className="truncate"><b className="text-neutral-500">Tujuan:</b> {item.dropoffLocation}</div>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-neutral-300">
                            <div>{item.customerPhone}</div>
                            {item.flightNumber ? (
                              <div className="text-amber-400 font-bold">{item.flightNumber}</div>
                            ) : null}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              LUNAS / CONFIRMED
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenDetail(item);
                              }}
                              className="p-1.5 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300"
                              title="Lihat Detail Pesanan"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. VIEW: ASSIGNMENT (PENUGASAN REAL ARMADA, DRIVER & GUIDE)
          ========================================================================= */}
      {activeTab === 'assignment' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black font-sans text-neutral-100">
                ALOKASI &amp; PENUGASAN OPERASIONAL LAPANGAN
              </h3>
              <p className="text-xs text-neutral-400">
                Penugasan supir (chauffeur), armada kendaraan (fleet unit), dan guide berlisensi untuk perjalanan resmi.
              </p>
            </div>

            {/* Assignment Filters */}
            <div className="flex items-center gap-2">
              <select
                value={assignmentStatusFilter}
                onChange={(e) => setAssignmentStatusFilter(e.target.value as any)}
                className={`${theme.input} px-3 py-1.5 rounded-xl text-xs`}
              >
                <option value="all">Semua Status Penugasan</option>
                <option value="unassigned">Belum Ditugaskan</option>
                <option value="assigned">Sudah Ditugaskan</option>
              </select>

              <select
                value={assignmentServiceFilter}
                onChange={(e) => setAssignmentServiceFilter(e.target.value as any)}
                className={`${theme.input} px-3 py-1.5 rounded-xl text-xs`}
              >
                <option value="all">Semua Layanan</option>
                <option value="tour">Private Tour</option>
                <option value="sharetour">Open Trip</option>
                <option value="airport">Airport Transfer</option>
                <option value="taxi">Taxi Service</option>
                <option value="car-rental">Car Rental</option>
              </select>
            </div>
          </div>

          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                  <tr>
                    <th className="p-3.5">Tanggal Trip</th>
                    <th className="p-3.5">Layanan &amp; Kode</th>
                    <th className="p-3.5">Pelanggan &amp; Pax</th>
                    <th className="p-3.5">Armada Ditugaskan</th>
                    <th className="p-3.5">Supir / Driver</th>
                    <th className="p-3.5">Pemandu / Guide</th>
                    <th className="p-3.5 text-center">Status Alokasi</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {assignmentBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-500 font-mono">
                        Tidak ada booking operasional yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    assignmentBookings.map((item) => {
                      const depDate = getOfficialDepartureDate(item);
                      const key = item.bookingCode || item.id;
                      const assignment = assignments[key];
                      const badge = getServiceBadge(item.serviceType);

                      return (
                        <tr key={item.id} className={`${theme.hover} transition-colors`}>
                          <td className="p-3.5 font-mono text-neutral-300 whitespace-nowrap">
                            <div className="font-bold text-amber-400">{depDate}</div>
                            <div className="text-[10px] text-neutral-500">{item.time || '08:00 WIB'}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-neutral-200 line-clamp-1">{item.serviceTitle}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${badge.color}`}>
                                {badge.label}
                              </span>
                              <span className="text-[10px] font-mono text-neutral-400 font-bold">
                                #{item.bookingCode}
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-neutral-200">{item.customerName}</div>
                            <div className="text-[10px] font-mono text-neutral-400">{item.passengers} Pax • {item.customerPhone}</div>
                          </td>
                          <td className="p-3.5">
                            {assignment?.vehicleName ? (
                              <div>
                                <span className="font-mono text-neutral-200 font-bold">{assignment.vehicleName}</span>
                                <div className="text-[10px] font-mono text-neutral-400">{assignment.plateNumber}</div>
                              </div>
                            ) : item.vehicleName ? (
                              <div>
                                <span className="font-mono text-neutral-300">{item.vehicleName}</span>
                                <div className="text-[10px] text-amber-500/80 font-mono">(Dari Pesanan, Belum Nopol)</div>
                              </div>
                            ) : (
                              <span className="text-neutral-500 font-mono text-[11px]">- Belum Ditugaskan -</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            {assignment?.driverName ? (
                              <div>
                                <span className="font-bold text-emerald-400">{assignment.driverName}</span>
                                <div className="text-[10px] font-mono text-neutral-400">{assignment.driverPhone}</div>
                              </div>
                            ) : (
                              <span className="text-amber-500/80 font-mono text-[11px]">Belum Ditugaskan</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            {assignment?.guideName ? (
                              <span className="font-medium text-purple-400">{assignment.guideName}</span>
                            ) : (
                              <span className="text-neutral-500 font-mono text-[11px]">-</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            {assignment ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                {assignment.status === 'Ready' ? 'Terkonfirmasi Ready' : assignment.status}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/10 text-amber-500 border border-amber-500/30">
                                Perlu Alokasi
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openAssignModalForBooking(item)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 text-[11px] font-bold cursor-pointer"
                              >
                                {assignment ? 'Ubah' : 'Tugaskan'}
                              </button>
                              <button
                                onClick={() => onOpenDetail(item)}
                                className="p-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
                                title="Lihat Detail Pesanan"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ALOKASI PENUGASAN OPERASIONAL (ARMADA, DRIVER & GUIDE)
          ========================================================================= */}
      {isAssignModalOpen && selectedBookingForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg ${theme.card} border rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between border-b border-neutral-700 pb-3">
              <div>
                <h3 className="text-sm font-black font-sans text-neutral-100 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-amber-500" />
                  <span>ALOKASI OPERASIONAL TRIP</span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Booking #{selectedBookingForAssign.bookingCode} • {selectedBookingForAssign.customerName}
                </p>
              </div>
              <button 
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Trip Info Snapshot */}
            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-neutral-500">Tanggal Resmi:</span>
                <span className="text-amber-400 font-bold">{getOfficialDepartureDate(selectedBookingForAssign)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Layanan:</span>
                <span className="text-neutral-300">{selectedBookingForAssign.serviceTitle} ({selectedBookingForAssign.passengers} Pax)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Titik Jemput:</span>
                <span className="text-neutral-300 truncate max-w-[220px]">{selectedBookingForAssign.pickupLocation || selectedBookingForAssign.meetingPoint || 'Sesuai Konfirmasi'}</span>
              </div>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-3.5 text-xs">
              {/* Armada Kendaraan */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                  Pilih Armada Kendaraan Resmi
                </label>
                <select
                  value={assignForm.vehicleName}
                  onChange={(e) => {
                    const sel = fleetList.find(f => f.name === e.target.value);
                    setAssignForm({
                      ...assignForm,
                      vehicleName: e.target.value,
                      plateNumber: sel?.plateNumber || assignForm.plateNumber
                    });
                  }}
                  className={`w-full ${theme.input} p-2 rounded-xl`}
                  required
                >
                  <option value="">-- Pilih Armada --</option>
                  {fleetList.map(f => (
                    <option key={f.id} value={f.name}>
                      {f.name} ({f.plateNumber}) - Kapasitas {f.capacity} Pax
                    </option>
                  ))}
                  {VEHICLES.map(v => (
                    <option key={v.id} value={v.name}>
                      {v.name} (Standar Rental/Tour - {v.passengers} Pax)
                    </option>
                  ))}
                </select>
              </div>

              {/* Plat Nomor */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                  Nomor Plat Polisi (Nopol)
                </label>
                <input
                  type="text"
                  value={assignForm.plateNumber}
                  onChange={(e) => setAssignForm({ ...assignForm, plateNumber: e.target.value })}
                  placeholder="Contoh: N 7088 SJ"
                  className={`w-full ${theme.input} p-2 rounded-xl font-mono`}
                  required
                />
              </div>

              {/* Supir / Driver */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                    Nama Driver / Supir
                  </label>
                  <select
                    value={assignForm.driverName}
                    onChange={(e) => {
                      const sel = driverList.find(d => d.name === e.target.value);
                      setAssignForm({
                        ...assignForm,
                        driverName: e.target.value,
                        driverPhone: sel?.phone || assignForm.driverPhone
                      });
                    }}
                    className={`w-full ${theme.input} p-2 rounded-xl`}
                    required
                  >
                    <option value="">-- Pilih Supir --</option>
                    {driverList.map(d => (
                      <option key={d.id} value={d.name}>
                        {d.name} {d.rating ? `(★${d.rating})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                    Kontak Telepon Driver
                  </label>
                  <input
                    type="text"
                    value={assignForm.driverPhone}
                    onChange={(e) => setAssignForm({ ...assignForm, driverPhone: e.target.value })}
                    placeholder="+62 8..."
                    className={`w-full ${theme.input} p-2 rounded-xl font-mono`}
                    required
                  />
                </div>
              </div>

              {/* Tour Guide / Pendamping (Opsional) */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                  Pemandu Wisata / Tour Guide (Opsional)
                </label>
                <select
                  value={assignForm.guideName}
                  onChange={(e) => setAssignForm({ ...assignForm, guideName: e.target.value })}
                  className={`w-full ${theme.input} p-2 rounded-xl`}
                >
                  <option value="">-- Tidak Memerlukan Guide Khusus --</option>
                  {guideList.map(g => (
                    <option key={g.id} value={g.name}>
                      {g.name} {g.languages ? `(${g.languages})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Alokasi */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                  Status Kesiapan Operasi
                </label>
                <select
                  value={assignForm.status}
                  onChange={(e) => setAssignForm({ ...assignForm, status: e.target.value as any })}
                  className={`w-full ${theme.input} p-2 rounded-xl font-bold`}
                >
                  <option value="Ready">Terkonfirmasi Siap (Ready)</option>
                  <option value="Assigned">Ditugaskan (Standby)</option>
                  <option value="On Trip">Sedang Berjalan (On Trip)</option>
                  <option value="Completed">Selesai Beroperasi</option>
                </select>
              </div>

              {/* Catatan Operasional */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                  Catatan Operasional / Instruksi Khusus
                </label>
                <textarea
                  rows={2}
                  value={assignForm.note}
                  onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })}
                  placeholder="Misal: Siapkan masker gas Bromo/Ijen, AC dingin, jemput tepat waktu di lobi hotel."
                  className={`w-full ${theme.input} p-2 rounded-xl text-xs`}
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-700/60">
                {assignments[selectedBookingForAssign.bookingCode || selectedBookingForAssign.id] ? (
                  <button
                    type="button"
                    onClick={handleRemoveAssignment}
                    className="px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Hapus Penugasan</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-black cursor-pointer shadow-md"
                  >
                    Simpan Penugasan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
