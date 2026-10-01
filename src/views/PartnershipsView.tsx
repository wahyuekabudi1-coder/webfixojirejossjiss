import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { 
  Handshake, 
  ArrowLeft 
} from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import { OFFICIAL_PARTNERS, PartnerApp, PARTNERS_DATA_VERSION } from '../data/partnersData';

export default function PartnershipsView() {
  const { setPage } = useApp();
  const [partners, setPartners] = useState<PartnerApp[]>([]);

  // Strictly Read-Only: Load partners on mount without mutating localStorage
  useEffect(() => {
    try {
      const version = localStorage.getItem('smartjourney_partners_version');
      const stored = localStorage.getItem('smartjourney_partners');
      
      if (stored && version === PARTNERS_DATA_VERSION) {
        const parsed: PartnerApp[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPartners(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to parse partners in PartnershipsView', e);
    }
    setPartners(OFFICIAL_PARTNERS);
  }, []);

  return (
    <div className="bg-[#f8faf9] min-h-screen text-neutral-900 pb-24 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'B2B Partnerships & Affiliates' }]} />
      </div>

      {/* Hero Header Section */}
      <section className="relative overflow-hidden pt-8 pb-14 bg-gradient-to-b from-emerald-950 via-[#132c25] to-[#1a3830] text-white">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 px-4 py-1.5 rounded-full text-amber-400 text-xs font-bold font-mono tracking-wider uppercase">
            <Handshake className="h-4 w-4" />
            <span>Digital Ecosystem &amp; Strategic Alliances</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Our Collaborators &amp; Partners
          </h1>
          
          <p className="text-neutral-300 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            SmartJourney operates in synergy with leading international travel networks, global booking systems, and premier luxury hotel groups across East Java &amp; Bali.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20 space-y-10">
        
        {/* Clean, Premium Partner Grid - Simple Read-Only Layout */}
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
            <div>
              <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                <span>Verified Partner Platforms (2026)</span>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold">
                  {partners.length} Active
                </span>
              </h2>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">
                Official integrations &amp; booking systems synced with SmartJourney
              </p>
            </div>
          </div>

          {partners.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Handshake className="h-12 w-12 text-neutral-300 mx-auto" />
              <h3 className="text-lg font-bold text-neutral-400">No partner logos registered yet</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">Collaborating partner platforms and verified booking channels.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="group relative bg-neutral-50/70 hover:bg-white border border-neutral-200 hover:border-amber-400/60 rounded-2xl h-32 flex flex-col items-center justify-between p-3.5 transition-all duration-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5"
                >
                  {/* Partner Clickable Link & Logo */}
                  <a
                    href={partner.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex-1 flex items-center justify-center cursor-pointer p-1"
                  >
                    <img
                      src={partner.logoUrl}
                      alt={partner.name}
                      className="max-h-12 max-w-[90%] object-contain group-hover:scale-105 transition-all duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as any).src = 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?auto=format&fit=crop&w=150&q=80';
                      }}
                    />
                  </a>
                  
                  {/* Subtle Label and Category on Bottom */}
                  <div className="w-full text-center mt-1 border-t border-neutral-100/80 pt-1">
                    <span className="text-[11px] font-bold text-neutral-700 group-hover:text-amber-600 transition-colors block truncate">
                      {partner.name}
                    </span>
                    {partner.category && (
                      <span className="text-[9px] text-neutral-400 block truncate font-medium">
                        {partner.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back to Home CTA */}
        <div className="text-center pt-4">
          <button
            onClick={() => setPage('home')}
            className="text-xs font-bold text-neutral-500 hover:text-amber-600 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Main Homepage</span>
          </button>
        </div>

      </div>
    </div>
  );
}
