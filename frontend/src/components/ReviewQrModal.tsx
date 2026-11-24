'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  QrCode, 
  Printer, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles, 
  Star, 
  ShieldAlert, 
  MessageCircle,
  ThumbsUp,
  RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';

interface ReviewQrModalProps {
  onClose: () => void;
}

export const ReviewQrModal: React.FC<ReviewQrModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'feed'>('qr');
  const [copied, setCopied] = useState(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loadingFeed, setLoadingFeed] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const reviewUrl = `${origin}/review`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(reviewUrl)}&margin=10`;

  const fetchFeedbacks = async () => {
    try {
      setLoadingFeed(true);
      const data = await api.get('/reviews/admin/feedbacks');
      setFeedbacks(data.feedbacks || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Failed to load review feedbacks:', err);
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'feed') {
      fetchFeedbacks();
    }
  }, [activeTab]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rebound - Table QR Stand</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;700&display=swap');
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              font-family: 'Plus Jakarta Sans', sans-serif;
              background-color: #f8fafc;
            }
            .card {
              width: 320px;
              background: #090d16;
              color: white;
              border-radius: 24px;
              padding: 32px 24px;
              text-align: center;
              box-shadow: 0 20px 40px rgba(0,0,0,0.15);
              border: 2px solid #10b981;
            }
            .badge {
              display: inline-block;
              background: rgba(16, 185, 129, 0.15);
              border: 1px solid rgba(16, 185, 129, 0.4);
              color: #10b981;
              padding: 6px 14px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 1px;
              text-transform: uppercase;
              margin-bottom: 12px;
            }
            h1 {
              font-size: 22px;
              font-weight: 800;
              margin: 0 0 6px 0;
              line-height: 1.2;
            }
            p.sub {
              font-size: 11px;
              color: #94a3b8;
              margin: 0 0 20px 0;
            }
            .qr-box {
              background: white;
              padding: 14px;
              border-radius: 20px;
              display: inline-block;
              margin: 0 auto 20px auto;
              box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            }
            .qr-box img {
              width: 190px;
              height: 190px;
              display: block;
            }
            .callout {
              font-size: 12px;
              font-weight: 700;
              color: #e2e8f0;
              margin-bottom: 6px;
            }
            .stars {
              color: #f59e0b;
              font-size: 16px;
              letter-spacing: 2px;
            }
            @media print {
              body { background: transparent; padding: 0; }
              .card { box-shadow: none; border: 2px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">🎱 Rebound Snooker & Pool Club</div>
            <h1>Rate Your Frame ⚡</h1>
            <p class="sub">Scan with your camera • AI drafts your review in seconds!</p>
            <div class="qr-box">
              <img src="${qrImageUrl}" alt="Scan QR Code" />
            </div>
            <div class="callout">Zero typing needed — Just tap stars & paste!</div>
            <div class="stars">★★★★★</div>
          </div>
          <script>
            window.onload = () => { setTimeout(() => window.print(), 300); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Smart Review QR & Feedback Shield
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  AI Powered
                </span>
              </h2>
              <p className="text-xs text-slate-500">Table QR code for customers to write 5-star Google reviews</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/40">
          <button
            onClick={() => setActiveTab('qr')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'qr'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Table Stand QR Code</span>
          </button>
          <button
            onClick={() => setActiveTab('feed')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'feed'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Customer Feedback Feed</span>
            {stats && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
                {stats.totalCount}
              </span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'qr' ? (
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* QR Preview Card */}
              <div className="w-56 shrink-0 bg-slate-950 p-4 rounded-2xl text-center shadow-xl border border-slate-800 text-white">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">
                  🎱 Rebound
                </div>
                <h4 className="text-xs font-black mb-2">Rate Your Frame ⚡</h4>
                <div className="bg-white p-2 rounded-xl inline-block shadow-inner">
                  <img
                    src={qrImageUrl}
                    alt="Table QR Code"
                    className="w-40 h-40 rounded-lg object-contain"
                  />
                </div>
                <div className="text-[10px] text-amber-400 mt-2 font-mono">★★★★★</div>
                <p className="text-[9px] text-slate-400 mt-0.5">Scan to generate review</p>
              </div>

              {/* Information & Action buttons */}
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">How to use this at Rebound:</h3>
                  <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                    <li>Print this QR and place it on acrylic stands at each pool & snooker table.</li>
                    <li>Customers scan it on their smartphones while waiting or having coffee.</li>
                    <li>They tap 4 quick stars; our AI drafts a personalized 2-sentence review.</li>
                    <li>
                      <strong className="text-emerald-700">Google Shield:</strong> 4-5 stars are sent to Google Maps. 1-3 stars are diverted to your private inbox!
                    </li>
                  </ul>
                </div>

                {/* Direct Link Box */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Public Mobile URL:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={reviewUrl}
                      className="flex-1 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 select-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={reviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
                      title="Open test preview"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Print Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Table Stand Card</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Feed Tab */
            <div className="space-y-4">
              {/* Summary Stats */}
              {stats && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Average</p>
                    <p className="text-base font-black text-amber-500 font-mono">★ {stats.avgOverall}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Total Scans</p>
                    <p className="text-base font-black text-slate-900 font-mono">{stats.totalCount}</p>
                  </div>
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-[10px] text-emerald-600 font-bold uppercase">Google 5★</p>
                    <p className="text-base font-black text-emerald-700 font-mono">{stats.positiveCount}</p>
                  </div>
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                    <p className="text-[10px] text-rose-600 font-bold uppercase">Shielded</p>
                    <p className="text-base font-black text-rose-700 font-mono">{stats.negativeCount}</p>
                  </div>
                </div>
              )}

              {/* Feed List */}
              <div className="space-y-2.5">
                {loadingFeed ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading customer reviews...</span>
                  </div>
                ) : feedbacks.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No customer reviews submitted yet. Scan the QR code to test!
                  </div>
                ) : (
                  feedbacks.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {item.customerName || 'Anonymous Guest'}
                          </span>
                          {item.customerPhone && (
                            <span className="text-[10px] font-mono text-slate-400">
                              ({item.customerPhone})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 font-bold text-amber-500 font-mono">
                          <span>★ {item.ratingOverall}</span>
                          <span
                            className={`ml-2 text-[9px] uppercase px-1.5 py-0.2 rounded font-sans font-bold ${
                              item.sentiment === 'positive'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.sentiment === 'positive' ? 'Google 5★' : 'Shielded'}
                          </span>
                        </div>
                      </div>

                      {item.generatedReview && (
                        <p className="text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                          "{item.generatedReview}"
                        </p>
                      )}

                      {item.privateFeedback && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 space-y-0.5">
                          <p className="text-[10px] font-bold flex items-center gap-1 text-rose-700 uppercase">
                            <ShieldAlert className="w-3 h-3" /> Private Customer Complaint:
                          </p>
                          <p>{item.privateFeedback}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>{item.tags || 'General experience'}</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
