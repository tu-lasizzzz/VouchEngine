import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  Copy, 
  Check, 
  QrCode, 
  MessageCircle, 
  Send, 
  Globe, 
  Smartphone, 
  Download, 
  RefreshCw,
  Sparkles,
  ExternalLink
} from 'lucide-react';

/**
 * ShareComponent
 * 
 * Task 1 & 2 Integration:
 * - Native Web Share API (`navigator.share()`) for OS share sheets (WhatsApp, Telegram, SMS)
 * - Fallback "Copy to Clipboard" using `navigator.clipboard.writeText()`
 * - Dynamic QR Code fetch from `/api/user/qrcode` endpoint
 */
export function ShareComponent({ referralCode = 'REF-DEMO123', userToken = '' }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrFormat, setQrFormat] = useState('png'); // 'png' or 'svg'
  const [showQrModal, setShowQrModal] = useState(false);
  const [nativeShareSupported, setNativeShareSupported] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');

  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}?ref=${referralCode}`;
  const shareTitle = 'Join me on VouchEngine!';
  const shareText = `Use my exclusive invite code "${referralCode}" to unlock $10 off your first purchase!`;

  useEffect(() => {
    // Check if Web Share API is available
    if (typeof navigator !== 'undefined' && !!navigator.share) {
      setNativeShareSupported(true);
    }
  }, []);

  // ── Fetch dynamic QR Code from backend API ──────────────────────────────────
  const fetchQrCode = async (format = qrFormat) => {
    setLoadingQr(true);
    try {
      const headers = {};
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }
      
      const res = await fetch(`/api/user/qrcode?referral_code=${referralCode}&format=${format}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setQrCodeData(data);
      } else {
        // Client-side SVG fallback if backend offline
        setQrCodeData({
          success: true,
          referralCode,
          referralLink: shareUrl,
          qrCode: `data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
              <rect width="100%" height="100%" fill="#111827"/>
              <rect x="20" y="20" width="50" height="50" fill="#6366f1" rx="8"/>
              <rect x="130" y="20" width="50" height="50" fill="#ec4899" rx="8"/>
              <rect x="20" y="130" width="50" height="50" fill="#a855f7" rx="8"/>
              <rect x="90" y="90" width="30" height="30" fill="#38bdf8" rx="6"/>
              <text x="100" y="190" fill="#ffffff" font-size="10" text-anchor="middle">QR CODE: ${referralCode}</text>
            </svg>`
          )}`
        });
      }
    } catch (err) {
      console.warn('QR Code fetch error:', err);
    } finally {
      setLoadingQr(false);
    }
  };

  useEffect(() => {
    fetchQrCode(qrFormat);
  }, [referralCode, qrFormat]);

  // ── Native Web Share API Trigger ───────────────────────────────────────────
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        setShareFeedback('Shared successfully!');
        setTimeout(() => setShareFeedback(''), 3000);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
          handleCopyLink(); // Fallback to copy on share failure
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // ── Fallback Copy to Clipboard ──────────────────────────────────────────────
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(referralCode);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (err) {
      console.error('Copy code failed:', err);
    }
  };

  // Direct Social Share URLs
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
  const twitterUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const smsUrl      = `sms:?body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;

  const handleDownloadQr = () => {
    if (!qrCodeData || !qrCodeData.qrCode) return;
    const link = document.createElement('a');
    link.href = qrCodeData.qrCode;
    link.download = `referral-qr-${referralCode}.${qrFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full bg-gray-800/80 backdrop-blur-lg border border-gray-700/60 rounded-2xl p-6 shadow-xl text-white space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              Share & Earn Rewards
            </h2>
            <p className="text-xs text-gray-400">Invite friends using your link or dynamic QR code</p>
          </div>
        </div>

        <button
          onClick={() => setShowQrModal(!showQrModal)}
          className="flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-indigo-300 rounded-lg transition-colors border border-gray-600"
        >
          <QrCode className="w-4 h-4" />
          <span>{showQrModal ? 'Hide QR' : 'View QR'}</span>
        </button>
      </div>

      {/* ── Referral Link & Code Inputs ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Share Link Input */}
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
            <span>Your Personal Referral Link</span>
            {copiedLink && <span className="text-emerald-400 text-xs font-medium animate-pulse">✓ Copied to clipboard!</span>}
          </label>
          <div className="flex items-center bg-gray-900/90 border border-gray-700 rounded-xl p-1.5 focus-within:border-indigo-500 transition-colors">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="bg-transparent text-sm text-gray-200 px-3 w-full focus:outline-none font-mono"
            />
            <button
              onClick={handleCopyLink}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                copiedLink 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Referral Code */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
            <span>Invite Code</span>
            {copiedCode && <span className="text-emerald-400 text-xs font-medium">✓ Copied</span>}
          </label>
          <div className="flex items-center bg-gray-900/90 border border-gray-700 rounded-xl p-1.5 focus-within:border-purple-500 transition-colors">
            <span className="bg-purple-900/40 text-purple-300 font-mono text-sm font-bold px-3 py-1.5 rounded-lg border border-purple-500/30 w-full text-center tracking-wider">
              {referralCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="p-2 ml-1 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Copy Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Native OS Share Sheet & Direct Social Triggers ──────────────────── */}
      <div className="pt-2 border-t border-gray-700/50 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Quick Share Actions</span>
          {shareFeedback && (
            <span className="text-xs font-semibold text-emerald-400 animate-pulse">{shareFeedback}</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {/* Primary Native OS Share Button */}
          <button
            onClick={handleNativeShare}
            className="col-span-2 sm:col-span-1 flex items-center justify-center space-x-2 py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5"
          >
            <Share2 className="w-4 h-4" />
            <span>{nativeShareSupported ? 'Native Share' : 'Share Link'}</span>
          </button>

          {/* WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-xl transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
          </a>

          {/* Telegram */}
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 text-xs font-semibold rounded-xl transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Telegram</span>
          </a>

          {/* Twitter / X */}
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-slate-700/40 hover:bg-slate-700/60 text-slate-300 border border-slate-600/30 text-xs font-semibold rounded-xl transition-all"
          >
            <Globe className="w-4 h-4" />
            <span>Twitter</span>
          </a>

          {/* SMS */}
          <a
            href={smsUrl}
            className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 border border-pink-500/30 text-xs font-semibold rounded-xl transition-all"
          >
            <Smartphone className="w-4 h-4" />
            <span>SMS</span>
          </a>
        </div>
      </div>

      {/* ── Dynamic QR Code Card / Preview ─────────────────────────────────── */}
      {showQrModal && (
        <div className="mt-4 p-5 bg-gray-900/90 border border-indigo-500/30 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all animate-fadeIn">
          <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-2xl relative group">
            {loadingQr ? (
              <div className="w-48 h-48 flex items-center justify-center text-gray-800">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : qrCodeData && qrCodeData.qrCode ? (
              <img
                src={qrCodeData.qrCode}
                alt={`QR Code for ${referralCode}`}
                className="w-48 h-48 object-contain"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-gray-500 text-xs">
                QR Unavailable
              </div>
            )}
            <span className="mt-2 text-[10px] font-mono text-gray-500 font-semibold tracking-wider uppercase">
              Format: {qrFormat.toUpperCase()}
            </span>
          </div>

          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <div className="flex items-center justify-center md:justify-start space-x-2 text-indigo-400 font-semibold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>On-The-Fly Dynamic QR Code</span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">Scan to Sign Up</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Generated via Node <code className="text-indigo-300 font-mono">qrcode</code> backend API endpoint (<code className="text-indigo-300 font-mono">/api/user/qrcode</code>).
              </p>
            </div>

            {/* Format Toggle & Download Buttons */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <div className="bg-gray-800 p-1 rounded-lg border border-gray-700 flex space-x-1">
                <button
                  onClick={() => setQrFormat('png')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    qrFormat === 'png' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  PNG Base64
                </button>
                <button
                  onClick={() => setQrFormat('svg')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    qrFormat === 'svg' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  SVG Data URL
                </button>
              </div>

              <button
                onClick={handleDownloadQr}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-emerald-600/20"
              >
                <Download className="w-4 h-4" />
                <span>Download QR</span>
              </button>

              <button
                onClick={() => fetchQrCode(qrFormat)}
                className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
                title="Regenerate QR Code"
              >
                <RefreshCw className={`w-4 h-4 ${loadingQr ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
