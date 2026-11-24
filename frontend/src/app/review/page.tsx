'use client';

import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  MessageCircle, 
  Send, 
  Heart, 
  ShieldAlert,
  Award
} from 'lucide-react';

const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3001/api`;
  }
  return 'http://localhost:3001/api';
};

const PRESET_TAGS = [
  'Smooth Cloth 🎱',
  'Straight Cues 🎯',
  'Iced Cold Coffee ☕',
  'Chilled AC ❄️',
  'Banging Music 🎶',
  'Friendly Staff 🤝',
  'Clean & Aesthetic ✨',
  'PS4 Gaming 🎮'
];

export default function PublicReviewPage() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Star ratings
  const [ratings, setRatings] = useState<{ [key: string]: number }>({
    tables: 5,
    vibe: 5,
    food: 5,
    overall: 5
  });

  const [selectedTags, setSelectedTags] = useState<string[]>(['Smooth Cloth 🎱', 'Banging Music 🎶']);
  const [customNote, setCustomNote] = useState('');
  
  // Submission & Result state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [privateComplaint, setPrivateComplaint] = useState('');
  const [complaintSent, setComplaintSent] = useState(false);
  const [sendingComplaint, setSendingComplaint] = useState(false);

  // Dynamic Google review URL fallback
  const [googleReviewUrl, setGoogleReviewUrl] = useState('https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4');
  const [managerWhatsApp, setManagerWhatsApp] = useState('919876543210');

  useEffect(() => {
    // Fetch live config from backend
    fetch(`${getApiBase()}/reviews/config`)
      .then((res) => res.json())
      .then((data) => {
        if (data.googleReviewUrl) setGoogleReviewUrl(data.googleReviewUrl);
        if (data.managerWhatsApp) setManagerWhatsApp(data.managerWhatsApp);
      })
      .catch(() => {});
  }, []);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleRatingChange = (category: string, stars: number) => {
    setRatings((prev) => ({ ...prev, [category]: stars }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setCopied(false);
    try {
      const res = await fetch(`${getApiBase()}/reviews/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          ratings,
          tags: selectedTags,
          customNote
        })
      });

      const data = await res.json();
      setResult(data);
      if (data.googleReviewUrl) setGoogleReviewUrl(data.googleReviewUrl);
      if (data.managerWhatsApp) setManagerWhatsApp(data.managerWhatsApp);
    } catch (err) {
      console.error('Failed to generate review:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAndOpenGoogle = () => {
    if (!result?.reviewText) return;

    // 1. Copy to clipboard
    navigator.clipboard.writeText(result.reviewText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    });

    // 2. Notify backend
    if (result.feedbackId) {
      fetch(`${getApiBase()}/reviews/mark-copied`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackId: result.feedbackId })
      }).catch(() => {});
    }

    // 3. Open Google Review URL in new tab / Google Maps
    setTimeout(() => {
      window.open(googleReviewUrl, '_blank');
    }, 400);
  };

  const handleSendComplaint = async () => {
    if (!privateComplaint.trim()) return;
    setSendingComplaint(true);
    try {
      await fetch(`${getApiBase()}/reviews/submit-complaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackId: result?.feedbackId,
          customerName,
          customerPhone,
          privateFeedback: privateComplaint
        })
      });
      setComplaintSent(true);
    } catch (err) {
      console.error('Failed to send complaint:', err);
    } finally {
      setSendingComplaint(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      {/* Main Container */}
      <main className="relative z-10 max-w-md mx-auto w-full px-4 py-8 flex-1 flex flex-col justify-center">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <span>🎱 Rebound Snooker & Pool Club</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-display">
            Rate Your Frame & Get Hooked Up! ⚡
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tap your ratings below — our AI writes your review in seconds. Zero typing needed!
          </p>
        </div>

        {/* View 1: Review Form */}
        {!result ? (
          <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-5 shadow-2xl space-y-5">
            {/* Customer Name & Phone */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="For club perks"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                />
              </div>
            </div>

            {/* Star Rating Questions */}
            <div className="space-y-3.5 pt-2 border-t border-slate-800/80">
              {/* Question 1: Tables */}
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/50">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <span>🎱</span> Tables & Cues
                  </div>
                  <p className="text-[10px] text-slate-500">Cloth speed, true cushion roll & straight cues</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingChange('tables', star)}
                      className="p-0.5 focus:outline-none transition-transform active:scale-125"
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          star <= (ratings.tables || 0)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2: Vibe & Music */}
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/50">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <span>🎶</span> Music & Vibe
                  </div>
                  <p className="text-[10px] text-slate-500">Lounge playlist energy, AC & table lighting</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingChange('vibe', star)}
                      className="p-0.5 focus:outline-none transition-transform active:scale-125"
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          star <= (ratings.vibe || 0)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 3: Cafe & Drinks */}
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/50">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <span>☕</span> Cafe & Refreshments
                  </div>
                  <p className="text-[10px] text-slate-500">Iced drinks, cold coffee & snacks</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingChange('food', star)}
                      className="p-0.5 focus:outline-none transition-transform active:scale-125"
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          star <= (ratings.food || 0)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 4: Overall */}
              <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/50">
                <div className="pr-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <span>⚡</span> Overall Experience
                  </div>
                  <p className="text-[10px] text-slate-500">How much fun was your session today?</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingChange('overall', star)}
                      className="p-0.5 focus:outline-none transition-transform active:scale-125"
                    >
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          star <= (ratings.overall || 0)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Highlight Badges */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                What stood out? (Tap any to add)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold shadow-xs'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>AI Crafting Your Review...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Generate Magic Review ✨</span>
                </>
              )}
            </button>
          </div>
        ) : result.isPositive ? (
          /* View 2A: Positive Review Ready -> Copy & Direct to Google Maps */
          <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-5 shadow-2xl space-y-5 animate-fade-in">
            {/* Header Badge */}
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Award className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-white">Boom! Your Review is Ready 🎉</h2>
              <p className="text-xs text-slate-400">
                We drafted your review with AI. 1-click copies it and opens Google Maps!
              </p>
            </div>

            {/* Generated Review Box */}
            <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 text-sm leading-relaxed font-sans shadow-inner">
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3 h-3" /> AI Generated
              </div>
              <p className="pr-16 text-slate-100 italic">
                "{result.reviewText}"
              </p>
            </div>

            {/* Primary Action: Copy & Open Google */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleCopyAndOpenGoogle}
                className="w-full py-4 px-4 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 text-slate-950 stroke-[3]" />
                    <span>Copied! Opening Google Maps...</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 text-slate-950" />
                    <span>📋 Copy & Post on Google Maps</span>
                    <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                  </>
                )}
              </button>

              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
                <span>1. Tapping copies text</span>
                <span>•</span>
                <span>2. Paste into Google</span>
                <span>•</span>
                <span>3. Hit Post!</span>
              </div>
            </div>

            {/* Secondary Option: Regenerate or Edit */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Make it different / Regenerate</span>
              </button>

              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Change ratings
              </button>
            </div>
          </div>
        ) : (
          /* View 2B: Negative Rating Shield -> Private Owner Complaint Form */
          <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-5 shadow-2xl space-y-5 animate-fade-in">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-white">We're so sorry we fell short! 😔</h2>
              <p className="text-xs text-slate-400">
                We take our tables and customer experience seriously. Please tell our management directly what happened so we can make it right.
              </p>
            </div>

            {complaintSent ? (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 text-center space-y-2">
                <Check className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-white">Feedback received by management!</p>
                <p className="text-[11px] text-slate-400">
                  Thank you for helping us maintain top club standards. We will look into this immediately.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  placeholder="What went wrong? (e.g. cue tip, table level, AC, music, staff)..."
                  value={privateComplaint}
                  onChange={(e) => setPrivateComplaint(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />

                <button
                  type="button"
                  onClick={handleSendComplaint}
                  disabled={sendingComplaint || !privateComplaint.trim()}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingComplaint ? 'Sending...' : 'Send to Owner / Management'}</span>
                </button>

                {/* Direct WhatsApp Option */}
                <div className="pt-2 text-center">
                  <a
                    href={`https://wa.me/${managerWhatsApp}?text=${encodeURIComponent(`Hi Rebound Manager, I was playing at the club and wanted to share feedback: ${privateComplaint || 'regarding table/service'}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Or Chat Directly with Manager on WhatsApp</span>
                  </a>
                </div>
              </div>
            )}

            <div className="text-center pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                ← Back to ratings
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-[10px] text-slate-600 space-y-1">
          <p>© Rebound Snooker & Pool Club • Powered by Rebound ERP</p>
          <p className="flex items-center justify-center gap-1">
            <span>Made for cue sport lovers</span> <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
          </p>
        </div>
      </main>
    </div>
  );
}
