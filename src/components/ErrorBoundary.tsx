/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, MessageSquare, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  isRoot?: boolean;
  title?: string;
  subtitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;
  declare setState: (update: any, callback?: () => void) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[Smart Journey ErrorBoundary] Caught component render error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = (): void => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, showDetails } = this.state;
    const { children, fallback, isRoot, title, subtitle } = this.props;

    if (!hasError) {
      return children;
    }

    if (typeof fallback === 'function' && error) {
      return fallback(error, this.resetError);
    }

    if (fallback) {
      return fallback;
    }

    const headingText = title || (isRoot ? 'Terjadi Kendala Memuat Aplikasi' : 'Gagal Memuat Komponen Halaman');
    const descriptionText =
      subtitle ||
      'Versi sistem baru mungkin baru saja diperbarui atau koneksi internet Anda mengalami gangguan sejenak. Silakan muat ulang halaman untuk menyinkronkan data terbaru.';

    const isChunkLoadError =
      error?.message?.includes('dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('preload') ||
      error?.message?.includes('Unexpected token');

    // Root full-page fallback
    if (isRoot) {
      return (
        <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-4 sm:p-6 text-neutral-900 font-sans selection:bg-[#315B4F] selection:text-white">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-neutral-100 text-center relative overflow-hidden">
            {/* Ambient accent banner */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-[#315B4F] to-emerald-600" />

            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-5 text-amber-600 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 mb-3">
              {isChunkLoadError ? 'Pembaruan Sistem / Update Rilis' : 'Pemberitahuan Sistem'}
            </span>

            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 mb-2 leading-tight">
              {headingText}
            </h1>

            <p className="text-sm text-neutral-600 leading-relaxed mb-6">
              {isChunkLoadError
                ? 'Sistem Smart Journey telah diperbarui ke versi terbaru. Muat ulang halaman ini untuk mengambil versi teranyar.'
                : descriptionText}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#315B4F] hover:bg-[#284a40] text-white font-semibold text-sm transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 animate-spin-hover" />
                Muat Ulang Halaman
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-sm transition-all active:scale-95 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Kembali ke Beranda
              </button>
            </div>

            <div className="pt-4 border-t border-neutral-100 flex flex-col gap-3">
              <a
                href="https://wa.me/6281234567890?text=Halo%20Smart%20Journey%2C%20saya%20mengalami%20kendala%20saat%20memuat%20halaman%20website."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Hubungi Bantuan Layanan WhatsApp (24 Jam)
              </a>

              {error && (
                <div className="text-left mt-2">
                  <button
                    type="button"
                    onClick={this.toggleDetails}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                  >
                    <span>{showDetails ? 'Sembunyikan' : 'Tampilkan'} detail teknis</span>
                    {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showDetails && (
                    <div className="mt-2 p-3 bg-neutral-900 text-neutral-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-40 leading-normal">
                      <p className="font-bold text-red-400 mb-1">{error.name}: {error.message}</p>
                      {errorInfo?.componentStack && (
                        <pre className="text-neutral-400 text-[10px] whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // View-level inline fallback (inside Header and Footer)
    return (
      <div className="w-full max-w-2xl mx-auto my-12 px-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-neutral-200 text-center relative overflow-hidden">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 text-amber-600 shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <span className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 mb-2">
            Pemberitahuan Sistem
          </span>

          <h2 className="text-xl font-black text-neutral-900 mb-2">
            {headingText}
          </h2>

          <p className="text-sm text-neutral-600 leading-relaxed mb-6 max-w-md mx-auto">
            {isChunkLoadError
              ? 'Terjadi pembaruan rilis sistem atau modul halaman ini terhambat jaringan. Silakan muat ulang halaman untuk memperbarui.'
              : descriptionText}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#315B4F] hover:bg-[#284a40] text-white font-semibold text-sm transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Halaman
            </button>

            <button
              type="button"
              onClick={this.handleGoHome}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-sm transition-all active:scale-95 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Kembali ke Beranda
            </button>
          </div>

          {error && (
            <div className="text-left pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
              >
                <span>{showDetails ? 'Sembunyikan' : 'Tampilkan'} detail teknis</span>
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showDetails && (
                <div className="mt-2 p-3 bg-neutral-900 text-neutral-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-36 leading-normal">
                  <p className="font-bold text-red-400 mb-1">{error.name}: {error.message}</p>
                  {errorInfo?.componentStack && (
                    <pre className="text-neutral-400 text-[10px] whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
