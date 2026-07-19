import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Share2, Maximize2, ChevronRight, ChevronDown, ChevronUp, Play, VolumeX, Volume2, Globe } from "lucide-react";
import { Post, Setting } from "../types";

interface MainBoardProps {
  settings: Setting;
  posts: Post[];
  onNavigate: (page: "home" | "scrapbook" | "admin", params?: any) => void;
  lang: "CN" | "EN";
  onToggleLang: () => void;
}

export default function MainBoard({ settings, posts, onNavigate, lang, onToggleLang }: MainBoardProps) {
  const [isHitorigotoExpanded, setIsHitorigotoExpanded] = useState(false);
  const [currentBottomGif, setCurrentBottomGif] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);

  const [gifScale, setGifScale] = useState(1);
  const gifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = gifRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const amount = -e.deltaY * 0.001;
      setGifScale((prev) => Math.max(0.5, Math.min(4, prev + amount)));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [currentBottomGif]);

  // Get hitorigoto entries (text-focused, or all sorted by date)
  const hitorigotoPosts = posts.slice().sort((a, b) => b.date.localeCompare(a.date));
  const latestHitorigoto = hitorigotoPosts[0];

  // Randomize the bottom right corner GIF on load
  useEffect(() => {
    if (settings.bottomCornerGifUrls && settings.bottomCornerGifUrls.length > 0) {
      const randomIndex = Math.floor(Math.random() * settings.bottomCornerGifUrls.length);
      setCurrentBottomGif(settings.bottomCornerGifUrls[randomIndex]);
    } else {
      setCurrentBottomGif(settings.activeBottomCornerGifUrl);
    }
  }, [settings]);

  // Cycle GIF on click for extra fun!
  const handleGifClick = () => {
    if (settings.bottomCornerGifUrls && settings.bottomCornerGifUrls.length > 1) {
      let nextIndex = settings.bottomCornerGifUrls.indexOf(currentBottomGif) + 1;
      if (nextIndex >= settings.bottomCornerGifUrls.length || nextIndex < 0) {
        nextIndex = 0;
      }
      setCurrentBottomGif(settings.bottomCornerGifUrls[nextIndex]);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: settings.title,
        text: settings.subtitle,
        url: window.location.href,
      }).catch(console.error);
    } else {
      setShowShareModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] relative px-4 py-8 md:py-12 flex flex-col items-center">
      
      {/* Decorative Ribbon / Bookmark (Top Right) with 3D Rotation Animation */}
      <motion.div 
        key={lang}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: 360 }}
        transition={{ duration: 0.6 }}
        id="lang-ribbon"
        className="absolute top-0 right-6 z-10 cursor-pointer group"
        onClick={onToggleLang}
      >
        <div className="bg-[#D9534F] text-white font-display font-semibold text-xs tracking-wider px-3.5 pt-3 pb-5 rounded-b shadow-sm hover:pt-4 transition-all duration-300 relative">
          {lang}
          <div className="absolute bottom-0 left-0 right-0 h-0 border-b-[8px] border-b-[#FAF7F2] border-x-[12px] border-x-transparent"></div>
        </div>
      </motion.div>

      {/* Floating Action Buttons (Top Left) */}
      <div className="absolute top-6 left-6 flex flex-col gap-3">
        <button
          id="btn-share"
          onClick={handleShare}
          className="w-10 h-10 rounded-full dashed-border bg-white flex items-center justify-center text-[#9E8B7A] hover:text-[#4A3E3D] hover:bg-[#F3EFE9] transition-all duration-200"
          title="Share Note"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          id="btn-fullscreen"
          onClick={() => setShowFullscreenModal(true)}
          className="w-10 h-10 rounded-full dashed-border bg-white flex items-center justify-center text-[#9E8B7A] hover:text-[#4A3E3D] hover:bg-[#F3EFE9] transition-all duration-200"
          title="View Avatar"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Profile Section */}
      <div className="flex flex-col items-center mt-6 mb-8 text-center max-w-md w-full">
        {/* Rounded Avatar with white padding and thick border */}
        <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white soft-shadow mb-4 relative bg-white">
          <img 
            src={settings.avatarUrl} 
            alt="Profile Avatar" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Customizable Title & Subtitle */}
        <h1 className="font-display font-bold text-3xl md:text-4xl text-[#3D2F2E] tracking-tight mb-2">
          {settings.title || "おいこらしょのノート"}
        </h1>
        <p className="font-sans text-sm md:text-base text-[#8C7673] font-medium tracking-wide">
          {settings.subtitle || "こころのえいようざい。もちもち。"}
        </p>
      </div>

      {/* Main Container - Desktop constraint */}
      <div className="w-full max-w-lg flex flex-col gap-6">

        {/* 1. Customizable Hero GIF card */}
        <div id="card-hero" className="bg-white rounded-3xl p-3 soft-shadow">
          <div className="rounded-2xl overflow-hidden aspect-square bg-[#EFECE6] relative flex items-center justify-center">
            <img 
              src={settings.topHeroGifUrl} 
              alt="Hero Display" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* 2. YouTube / VRChat Promo block */}
        <div id="card-promo" className="bg-[#1C1C1E] text-white rounded-3xl overflow-hidden soft-shadow relative group">
          <div className="p-4 flex flex-col gap-3">
            {/* VRChat Vlogger Avatar Header */}
            <div className="flex items-center gap-3">
              <img 
                src={settings.avatarUrl} 
                alt="Mini Avatar" 
                className="w-8 h-8 rounded-full border border-white/20"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-[#D6C7B7] truncate">v #エク #eku #vrchat</p>
                <p className="text-xs font-sans text-white/60 truncate">おいこらしょのぽけっと / oicolatcho's p...</p>
              </div>
            </div>

            {/* Custom YouTube Lookalike Video Frame */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black/80 flex items-center justify-center">
              {/* Overlay elements resembling YouTube thumbnail and play btn */}
              <img 
                src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=80" 
                alt="Promo video thumbnail" 
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
              
              <button 
                onClick={() => onNavigate("scrapbook", { searchTag: "#最新消息" })}
                className="w-14 h-14 rounded-full bg-[#FF0000] flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 z-10"
              >
                <Play className="w-6 h-6 fill-current translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. Hitorigoto (Monologue) Preview Section */}
        <div id="card-hitorigoto" className="bg-[#FAFDF6] border border-[#E1EDE0] rounded-3xl p-6 soft-shadow relative">
          {/* Wood pin at top center */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#B29E84] shadow-inner border border-white"></div>
          
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer group"
            onClick={() => onNavigate("scrapbook")}
          >
            <h2 className="font-display font-semibold text-lg text-[#324530] flex items-center gap-1.5">
              <span>{lang === "CN" ? "唠叨独白" : "Monologues"}</span>
            </h2>
            <ChevronRight className="w-5 h-5 text-[#869A84] group-hover:translate-x-1 transition-transform duration-200" />
          </div>

          {/* Interactive collapsible log container */}
          <div className="space-y-4">
            {latestHitorigoto ? (
              <div className="border-b border-dashed border-[#C5D9C2] pb-4">
                <span className="font-mono text-xs text-[#869A84] tracking-wider block mb-1">
                  {latestHitorigoto.date}
                </span>
                <p className="text-[#3E4F3C] text-sm leading-relaxed whitespace-pre-wrap">
                  {latestHitorigoto.content}
                </p>
                <button
                  onClick={() => onNavigate("scrapbook", { filterPostId: latestHitorigoto.id })}
                  className="mt-3.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#EBF5E8] border border-[#CBDCC7] text-xs font-semibold text-[#4F634E] hover:bg-[#DCECD8] transition-all duration-150"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>{lang === "CN" ? "打开剪贴簿" : "Open Scrapbook"}</span>
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">{lang === "CN" ? "暂无内容" : "No monologues found."}</p>
            )}

            {/* Toggle expanded posts list */}
            <AnimatePresence>
              {isHitorigotoExpanded && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-2 overflow-hidden"
                >
                  {hitorigotoPosts.slice(1, 4).map((post) => (
                    <div key={post.id} className="border-b border-dashed border-[#C5D9C2]/60 pb-3">
                      <span className="font-mono text-xs text-[#869A84] tracking-wider block mb-1">
                        {post.date}
                      </span>
                      <p className="text-[#3E4F3C] text-xs leading-relaxed truncate">
                        {post.content}
                      </p>
                      <button 
                        onClick={() => onNavigate("scrapbook", { filterPostId: post.id })}
                        className="mt-1.5 text-[10px] font-bold text-[#5A7259] hover:underline"
                      >
                        {lang === "CN" ? "打开剪贴簿 →" : "Open Scrapbook →"}
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => onNavigate("scrapbook")}
                    className="w-full text-center py-1.5 bg-[#E2ECE0]/50 rounded-xl text-xs font-semibold text-[#485C47] hover:bg-[#E2ECE0] transition-colors"
                  >
                    {lang === "CN" ? "更多碎碎念由此去 →" : "More monologues here →"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom arrow toggle buttons */}
            <div className="flex justify-center mt-3 -mb-3 pt-2">
              <button
                onClick={() => setIsHitorigotoExpanded(!isHitorigotoExpanded)}
                className="p-1 text-[#869A84] hover:text-[#3E4F3C] transition-colors"
                title={isHitorigotoExpanded ? "Collapse" : "Expand"}
              >
                {isHitorigotoExpanded ? (
                  <ChevronUp className="w-5 h-5 animate-bounce" />
                ) : (
                  <ChevronDown className="w-5 h-5 animate-bounce" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 4. Scrapbook Overlapping Pictures & Title Block */}
        <div 
          id="card-scrapbook" 
          onClick={() => onNavigate("scrapbook")}
          className="bg-white rounded-3xl p-6 soft-shadow flex flex-col items-center cursor-pointer group hover:scale-[1.01] transition-all duration-300 relative overflow-hidden"
        >
          {/* Overlapping, rotated photos (customizable via settings) */}
          <div className="relative h-44 w-full flex items-center justify-center mb-6 pt-4">
            {/* Left Rotated Photo */}
            <div className="absolute w-28 h-28 rounded-xl overflow-hidden border-4 border-white shadow-md transform -rotate-12 -translate-x-12 group-hover:-translate-x-14 group-hover:-rotate-15 transition-all duration-300 bg-gray-100">
              <img 
                src={settings.scrapbookThreeImages?.[0] || "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300&auto=format&fit=crop&q=80"} 
                alt="Scrapbook 1" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            
            {/* Right Rotated Photo */}
            <div className="absolute w-28 h-28 rounded-xl overflow-hidden border-4 border-white shadow-md transform rotate-12 translate-x-12 group-hover:translate-x-14 group-hover:rotate-15 transition-all duration-300 bg-gray-100">
              <img 
                src={settings.scrapbookThreeImages?.[2] || "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&auto=format&fit=crop&q=80"} 
                alt="Scrapbook 3" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Center Photo */}
            <div className="absolute w-28 h-28 rounded-xl overflow-hidden border-4 border-white shadow-lg z-10 transform group-hover:scale-105 transition-all duration-300 bg-gray-100">
              <img 
                src={settings.scrapbookThreeImages?.[1] || "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=300&auto=format&fit=crop&q=80"} 
                alt="Scrapbook 2" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <h2 className="font-display font-bold text-2xl text-[#8A5E4E] tracking-tight mb-2">
            {lang === "CN" ? "剪贴簿 / 收集物" : "Scrapbook"}
          </h2>
          <p className="text-xs text-center text-[#9E8B7A] tracking-wider leading-relaxed font-sans max-w-xs">
            {lang === "CN" ? "收到的礼物。制作的小物。日常公告与随笔。" : "Gifts received. Crafted items. Announcements & monologues."}
          </p>
        </div>

        {/* 5. External Link Cards (Social Media Links) */}
        <div id="social-links-list" className="space-y-3.5">
          {settings.socialLinks?.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-white hover:bg-[#FAF7F2] rounded-2xl dashed-border hover:border-[#4A3E3D] transition-all duration-200 group"
            >
              <div className="flex items-center gap-3.5">
                {/* Visual badge */}
                <div className="w-10 h-10 rounded-xl bg-[#F4EDE2] flex items-center justify-center font-bold text-[#8C7673] group-hover:bg-[#4A3E3D] group-hover:text-white transition-colors duration-200">
                  {link.title.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-display font-semibold text-sm text-[#4A3E3D]">
                    {link.title}
                  </h4>
                  <p className="text-xs text-[#9E8B7A] mt-0.5">
                    {link.description}
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#FAF7F2] group-hover:bg-[#4A3E3D] flex items-center justify-center transition-all duration-200">
                <Play className="w-3 h-3 text-[#8C7673] group-hover:text-white fill-current translate-x-0.5 transition-colors" />
              </div>
            </a>
          ))}
        </div>


      </div>

      {/* Floating Bottom Right Interactive GIF */}
      {currentBottomGif && (
        <motion.div 
          ref={gifRef}
          drag
          dragMomentum={false}
          dragElastic={0.1}
          id="floating-corner-gif"
          style={{ scale: gifScale, touchAction: "none" }}
          className="fixed bottom-4 right-4 z-40 w-24 h-24 md:w-28 md:h-28 cursor-pointer select-none group"
          onClick={handleGifClick}
          title="Click me to change character!"
        >
          <div className="relative w-full h-full">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white/95 px-2 py-0.5 rounded-full text-[10px] border border-[#EBE6DC] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              Tap me! 🐾
            </div>
            <img
              src={currentBottomGif}
              alt="Floating mascot"
              className="w-full h-full object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.1)] hover:scale-110 active:scale-95 transition-all duration-200"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>
      )}

      {/* Share Overlay Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl border border-[#EFECE6]"
            >
              <h3 className="font-display font-bold text-lg text-[#3D2F2E] mb-2">Share Note</h3>
              <p className="text-xs text-gray-500 mb-4">Copy the link below to share this notebook!</p>
              <input 
                type="text" 
                readOnly 
                value={window.location.href}
                className="w-full text-xs p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-center select-all font-mono text-gray-600 mb-4 focus:outline-none"
              />
              <button 
                onClick={() => setShowShareModal(false)}
                className="w-full py-2 bg-[#4A3E3D] text-white rounded-xl text-xs font-semibold hover:bg-[#3D3332] transition-colors"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Avatar Fullscreen Preview Modal */}
      <AnimatePresence>
        {showFullscreenModal && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-zoom-out"
            onClick={() => setShowFullscreenModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-lg max-h-[80vh] bg-white rounded-3xl overflow-hidden p-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={settings.avatarUrl} 
                alt="Fullscreen Avatar" 
                className="max-h-[70vh] max-w-full object-contain rounded-2xl"
                referrerPolicy="no-referrer"
              />
              <div className="text-center py-2 text-xs font-semibold text-gray-500">
                {settings.title} Avatar Profile
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
