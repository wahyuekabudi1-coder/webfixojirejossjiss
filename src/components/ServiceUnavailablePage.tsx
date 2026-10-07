import React from 'react';
import { useApp } from '../AppContext';
import { useLanguageCurrency } from '../sharetour/LanguageCurrencyContext';
import { 
  AlertCircle, Compass, Users, ArrowRight, ArrowLeft, 
  MessageSquare, ShieldCheck, Home 
} from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import ServiceNavTabs from './ServiceNavTabs';

interface ServiceUnavailablePageProps {
  serviceName?: string;
  serviceKey?: 'airport' | 'taxi' | 'car-rental' | string;
}

export default function ServiceUnavailablePage({ 
  serviceName, 
  serviceKey 
}: ServiceUnavailablePageProps) {
  const { setPage } = useApp();
  const { language, t } = useLanguageCurrency();

  // Resolved display name based on language and key
  const getResolvedName = () => {
    if (serviceName) return serviceName;
    switch (serviceKey) {
      case 'airport':
        return language === 'zh' ? '机场接送服务' : language === 'id' ? 'Layanan Transfer Bandara' : 'Airport Transfer Service';
      case 'taxi':
        return language === 'zh' ? '跨城出租车专车' : language === 'id' ? 'Layanan Taksi Antarkota' : 'Intercity Taxi Service';
      case 'car-rental':
        return language === 'zh' ? '包车与租车服务' : language === 'id' ? 'Layanan Sewa Mobil' : 'Car Rental Service';
      default:
        return language === 'zh' ? '该项服务' : language === 'id' ? 'Layanan Ini' : 'This Service';
    }
  };

  const currentServiceName = getResolvedName();

  const handleNavigate = (page: 'home' | 'tours' | 'share-tour') => {
    setPage(page);
    if (page === 'share-tour') {
      try {
        window.location.hash = '#/share-tour';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch {}
    } else if (page === 'tours') {
      try {
        window.location.hash = '#/tours';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch {}
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-neutral-900 flex flex-col justify-between pt-16 sm:pt-20">
      <div>
        <ServiceNavTabs />
        <Breadcrumbs items={[{ label: currentServiceName }, { label: 'Status' }]} />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl overflow-hidden text-center p-8 sm:p-12">
            
            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-mono font-bold uppercase tracking-wider mb-6">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>
                {language === 'zh' 
                  ? '服务暂未开放线上预订' 
                  : language === 'id' 
                  ? 'Layanan Sementara Tidak Tersedia' 
                  : 'Service Temporarily Unavailable'}
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-2xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight mb-4">
              {currentServiceName}
            </h1>

            {/* Description Paragraph */}
            <p className="text-sm sm:text-base text-neutral-600 max-w-xl mx-auto leading-relaxed mb-8">
              {language === 'zh' ? (
                <>
                  很抱歉，当前 <strong>{currentServiceName}</strong> 处于系统调度与运力优化阶段，线上自助预订功能已暂时停用。
                  您可以随时浏览并预订我们正常运营的 <strong>火山私家定制游</strong> 或 <strong>拼团 (Open Trip)</strong>。
                </>
              ) : language === 'id' ? (
                <>
                  Mohon maaf, saat ini <strong>{currentServiceName}</strong> sedang dalam tahap penyesuaian armada dan sementara tidak menerima reservasi online.
                  Silakan nikmati layanan kami yang sedang aktif: <strong>Private Tour</strong> dan <strong>Open Trip / Share Tour</strong> ke Bromo &amp; Ijen.
                </>
              ) : (
                <>
                  We apologize, online reservations for <strong>{currentServiceName}</strong> are temporarily paused during fleet schedule optimization.
                  Please explore our fully operational <strong>Private Tours</strong> and <strong>Open Trip / Share Tours</strong> to Mount Bromo &amp; Ijen Crater.
                </>
              )}
            </p>

            {/* Active Services Recommendations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left mb-8">
              
              {/* Option 1: Private Tours */}
              <div 
                onClick={() => handleNavigate('tours')}
                className="bg-neutral-50 hover:bg-amber-50/50 border border-neutral-200 hover:border-amber-400 p-5 rounded-2xl transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 group-hover:text-amber-700 transition-colors">
                      {language === 'zh' ? '火山探险私家包车游' : language === 'id' ? 'Paket Wisata Private Tour' : 'Private Tour Packages'}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      {language === 'zh' 
                        ? '布罗莫、宜珍神秘蓝火与赛武瀑布专属VIP包车行程。' 
                        : language === 'id' 
                        ? 'Wisata Bromo, Kawah Ijen, dan Tumpak Sewu eksklusif untuk keluarga & rombongan.' 
                        : 'Exclusive private expeditions to Mount Bromo, Ijen Blue Fire & Tumpak Sewu.'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-200/60 flex items-center justify-between text-xs font-bold text-amber-600">
                  <span>{language === 'zh' ? '查看私人行程' : language === 'id' ? 'Lihat Private Tour' : 'Explore Tours'}</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Option 2: Open Trip / Share Tour */}
              <div 
                onClick={() => handleNavigate('share-tour')}
                className="bg-neutral-50 hover:bg-emerald-50/50 border border-neutral-200 hover:border-emerald-400 p-5 rounded-2xl transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-neutral-900 group-hover:text-emerald-700 transition-colors">
                        Open Trip / Share Tour
                      </h3>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1 py-0.5 rounded font-mono font-bold uppercase">AKTIF</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      {language === 'zh'
                        ? '按位计费的高性价比排班拼团，单人或情侣优选。'
                        : language === 'id'
                        ? 'Keberangkatan reguler per kursi hemat untuk solo traveler dan pasangan.'
                        : 'Cost-effective per-seat group departures for solo & small group travelers.'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-200/60 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>{language === 'zh' ? '查看拼团排班' : language === 'id' ? 'Lihat Open Trip' : 'Join Open Trip'}</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

            </div>

            {/* Direct Navigation & WhatsApp Support */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-neutral-100">
              <button
                onClick={() => handleNavigate('home')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <Home className="h-4 w-4" />
                <span>{language === 'zh' ? '返回首页' : language === 'id' ? 'Kembali ke Beranda' : 'Back to Home'}</span>
              </button>

              <a
                href="https://wa.me/6285212347289?text=Halo%20Smart%20Journey,%20saya%20ingin%20menanyakan%20ketersediaan%20layanan%20transportasi."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <MessageSquare className="h-4 w-4" />
                <span>{language === 'zh' ? 'WhatsApp 人工客服' : language === 'id' ? 'Konsultasi via WhatsApp' : 'Customer Support via WhatsApp'}</span>
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
