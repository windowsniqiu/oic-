import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Home, Tag, Search, Clock, Trash2, X, Play, Pause, 
  Volume2, VolumeX, Share2, Pin, ChevronLeft, ChevronRight, 
  Languages, Tv, Minimize2, Maximize2, ChevronsUpDown
} from "lucide-react";
import { Post, Setting } from "../types";

interface ScrapbookBoardProps {
  settings: Setting;
  posts: Post[];
  onNavigate: (page: "home" | "scrapbook" | "admin", params?: any) => void;
  initialParams?: any;
  lang: "CN" | "EN";
  onToggleLang: () => void;
}

export default function ScrapbookBoard({ 
  settings, 
  posts, 
  onNavigate, 
  initialParams, 
  lang, 
  onToggleLang 
}: ScrapbookBoardProps) {
  // Filter & Search state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [operator, setOperator] = useState<"AND" | "OR">("OR"); // "和" (AND) / "尿素" (OR)
  
  // Active panels: "tags" | "search" | "timeline" | null
  const [activePanel, setActivePanel] = useState<"tags" | "search" | "timeline" | null>(null);

  // Sound & Playback states across lists
  const [mutedVideos, setMutedVideos] = useState<{ [postId: string]: boolean }>({});
  const [playingVideos, setPlayingVideos] = useState<{ [postId: string]: boolean }>({});
  const [globalMuted, setGlobalMuted] = useState(true);
  const [globalPaused, setGlobalPaused] = useState(false);

  // Media Overlays & Modals
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [zoomedVideoUrl, setZoomedVideoUrl] = useState<string | null>(null);
  const [zoomedVideoPost, setZoomedVideoPost] = useState<Post | null>(null);

  // Immersive Reels Mode State (Douyin / TikTok style)
  const [isImmersiveOpen, setIsImmersiveOpen] = useState(false);
  const [immersiveIndex, setImmersiveIndex] = useState(0);
  const [isImmersivePlaying, setIsImmersivePlaying] = useState(true);
  const [isImmersiveMuted, setIsImmersiveMuted] = useState(true);
  const [showGestureHelper, setShowGestureHelper] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const snapContainerRef = useRef<HTMLDivElement>(null);

  // Time Slider Track State
  const [timelineSliderVal, setTimelineSliderVal] = useState(100);

  const [visibleCount, setVisibleCount] = useState(5);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [immersivePlayingVideos, setImmersivePlayingVideos] = useState<{ [postId: string]: boolean }>({});

  // Shared Link Overlay
  const [sharedPostUrl, setSharedPostUrl] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = Array.from(new Set(posts.flatMap((p) => p.tags)));

  const [activeTimelineMonth, setActiveTimelineMonth] = useState<string | null>(null);

  // Filter posts logic
  const filteredPosts = posts.filter((post) => {
    if (selectedTags.length > 0) {
      if (operator === "AND") {
        const hasAll = selectedTags.every((t) => post.tags.includes(t));
        if (!hasAll) return false;
      } else {
        const hasAny = selectedTags.some((t) => post.tags.includes(t));
        if (!hasAny) return false;
      }
    }

    if (searchQuery.trim() !== "") {
      const normalizedQuery = searchQuery.toLowerCase();
      const matchesContent = post.content.toLowerCase().includes(normalizedQuery);
      const matchesTags = post.tags.some((t) => t.toLowerCase().includes(normalizedQuery));
      if (!matchesContent && !matchesTags) return false;
    }

    return true;
  });

  // Sort posts: pinned first, then date newest
  const sortedPosts = filteredPosts.slice().sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.date.localeCompare(a.date);
  });

  // Timeline list (Distinct Months)
  const timelineMonths = Array.from(
    new Set(posts.map((p) => p.date.substring(0, 7)))
  ).sort((a, b) => b.localeCompare(a));

  const displayedPosts = activeTimelineMonth 
    ? sortedPosts.filter((p) => p.date.startsWith(activeTimelineMonth))
    : sortedPosts;

  // Sync initial parameters
  useEffect(() => {
    if (initialParams) {
      if (initialParams.searchTag) {
        setSelectedTags([initialParams.searchTag]);
      }
      if (initialParams.filterPostId) {
        const post = posts.find((p) => p.id === initialParams.filterPostId);
        if (post) {
          setSearchQuery(post.content.slice(0, 15));
        }
      }
    }
  }, [initialParams, posts]);

  // Gestures and swipe helpers for Immersive mode
  useEffect(() => {
    if (isImmersiveOpen) {
      setShowGestureHelper(true);
      const timer = setTimeout(() => {
        setShowGestureHelper(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isImmersiveOpen]);

  // Autoplay (slideshow auto-scroll) for Immersive reels mode
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isImmersiveOpen && isImmersivePlaying && displayedPosts.length > 1) {
      interval = setInterval(() => {
        setImmersiveIndex((prev) => {
          const nextIdx = (prev + 1) % displayedPosts.length;
          // Smooth scroll snap container
          if (snapContainerRef.current) {
            const h = snapContainerRef.current.clientHeight;
            snapContainerRef.current.scrollTo({
              top: nextIdx * h,
              behavior: "smooth"
            });
          }
          return nextIdx;
        });
      }, 6000);
    }
    return () => clearInterval(interval);
  }, [isImmersiveOpen, isImmersivePlaying, displayedPosts.length]);

  // Sync scroll position upon opening immersive view
  useEffect(() => {
    if (isImmersiveOpen) {
      // Small timeout to allow container element to render and acquire dimensions
      const timer = setTimeout(() => {
        if (snapContainerRef.current) {
          const h = snapContainerRef.current.clientHeight;
          snapContainerRef.current.scrollTop = immersiveIndex * h;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isImmersiveOpen]);

  useEffect(() => {
    setVisibleCount(5);
  }, [selectedTags, searchQuery, activeTimelineMonth]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 5, displayedPosts.length));
        }
      },
      { threshold: 0.1 }
    );
    const el = loadMoreRef.current;
    if (el) {
      observer.observe(el);
    }
    return () => {
      if (el) {
        observer.unobserve(el);
      }
    };
  }, [displayedPosts.length, visibleCount]);

  useEffect(() => {
    if (!isImmersiveOpen) return;
    displayedPosts.forEach((post, idx) => {
      if (post.videoUrl && post.id) {
        const videoEl = document.getElementById(`immersive-video-${post.id}`) as HTMLVideoElement | null;
        if (videoEl) {
          const isCurrent = idx === immersiveIndex;
          const isPlaying = isCurrent && (immersivePlayingVideos[post.id] !== false);
          if (isPlaying) {
            videoEl.play().catch(() => {});
          } else {
            videoEl.pause();
          }
        }
      }
    });
  }, [immersiveIndex, isImmersiveOpen, immersivePlayingVideos, displayedPosts]);

  useEffect(() => {
    const currentPost = displayedPosts[immersiveIndex];
    if (currentPost && currentPost.id && currentPost.videoUrl) {
      setImmersivePlayingVideos(prev => {
        if (prev[currentPost.id!] === undefined) {
          return { ...prev, [currentPost.id!]: isImmersivePlaying };
        }
        return prev;
      });
    }
  }, [immersiveIndex, isImmersivePlaying, displayedPosts]);

  // Video controller handlers
  const toggleMute = (postId: string) => {
    setMutedVideos((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const togglePlay = (postId: string) => {
    setPlayingVideos((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };



  // Handle Share Post
  const handleSharePost = (post: Post) => {
    const shareUrl = window.location.origin + "?postId=" + post.id;
    if (navigator.share) {
      navigator.share({
        title: "Scrapbook Item",
        text: post.content,
        url: shareUrl,
      }).catch(console.error);
    } else {
      setSharedPostUrl(shareUrl);
    }
  };

  const handleSnapScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const clientHeight = e.currentTarget.clientHeight;
    if (clientHeight > 0) {
      const idx = Math.round(scrollTop / clientHeight);
      if (idx !== immersiveIndex && idx >= 0 && idx < displayedPosts.length) {
        setImmersiveIndex(idx);
      }
    }
  };

  // Generate a stable random tilt based on card index or ID characters
  const getCardTilt = (post: Post) => {
    if (!post) return 0;
    if (post.tiltPreset === "none") return 0;
    if (post.tiltPreset === "custom" && typeof post.tiltAngle === "number") {
      return post.tiltAngle;
    }
    const id = post.id || "";
    let sum = 0;
    for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
    const tiltAngles = [-2.5, -1.8, -1.2, -0.6, 0.6, 1.2, 1.8, 2.5, -1.5, 1.5, -2, 2];
    return tiltAngles[sum % tiltAngles.length];
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] relative px-4 py-8 md:py-12 flex flex-col items-center">
      <style>{`
        /* Disable long-press context menu, callout, and select/copy overlays */
        img, video, button, a, [role="button"], span, p, div, h1, h2, h3 {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -khtml-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-user-drag: none !important;
          user-drag: none !important;
        }
        input, textarea {
          -webkit-touch-callout: default !important;
          -webkit-user-select: text !important;
          user-select: text !important;
        }
      `}</style>
      
      {/* 3D Rotating Language Ribbon */}
      <motion.div 
        key={lang}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: 360 }}
        transition={{ duration: 0.6 }}
        className="absolute top-0 right-6 z-10 cursor-pointer"
        onClick={onToggleLang}
      >
        <div className="bg-[#D9534F] text-white font-display font-semibold text-xs tracking-wider px-3.5 pt-3 pb-5 rounded-b shadow-sm hover:pt-4 transition-all duration-300 relative">
          {lang}
          <div className="absolute bottom-0 left-0 right-0 h-0 border-b-[8px] border-b-[#FAF7F2] border-x-[12px] border-x-transparent"></div>
        </div>
      </motion.div>

      {/* Navigation Buttons on Left */}
      <div className="fixed top-6 left-6 flex flex-col gap-3.5 z-40">
        <button
          id="btn-home"
          onClick={() => onNavigate("home")}
          className="w-11 h-11 rounded-full dashed-border bg-white flex items-center justify-center text-[#9E8B7A] hover:text-[#4A3E3D] hover:bg-[#F3EFE9] transition-all duration-200 shadow-sm cursor-pointer"
          title="Home"
        >
          <Home className="w-4 h-4" />
        </button>

        <button
          id="btn-tag-panel"
          onClick={() => setActivePanel(activePanel === "tags" ? null : "tags")}
          className={`w-11 h-11 rounded-full dashed-border flex items-center justify-center transition-all duration-200 shadow-sm cursor-pointer ${
            activePanel === "tags" ? "bg-[#E67E22] text-white border-transparent" : "bg-white text-[#9E8B7A] hover:text-[#4A3E3D]"
          }`}
          title="Filter by Tags"
        >
          <Tag className="w-4 h-4" />
        </button>

        <button
          id="btn-search-panel"
          onClick={() => setActivePanel(activePanel === "search" ? null : "search")}
          className={`w-11 h-11 rounded-full dashed-border flex items-center justify-center transition-all duration-200 shadow-sm cursor-pointer ${
            activePanel === "search" ? "bg-[#34495E] text-white border-transparent" : "bg-white text-[#9E8B7A] hover:text-[#4A3E3D]"
          }`}
          title="Text Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Floating/Interactive Clock Toggle */}
        <button
          id="btn-timeline-panel-left"
          onClick={() => setActivePanel(activePanel === "timeline" ? null : "timeline")}
          className={`w-11 h-11 rounded-full dashed-border flex items-center justify-center transition-all duration-200 shadow-sm cursor-pointer ${
            activePanel === "timeline" ? "bg-[#2ECC71] text-white border-transparent" : "bg-white text-[#9E8B7A] hover:text-[#4A3E3D]"
          }`}
          title="Timeline Navigation"
        >
          <Clock className="w-4 h-4" />
        </button>
      </div>

      {/* Decorative Green Sidebar Badge (Timeline Trigger) */}
      <div className="fixed top-24 right-0 z-40 flex items-center hidden md:flex">
        <button
          id="btn-timeline-panel"
          onClick={() => setActivePanel(activePanel === "timeline" ? null : "timeline")}
          className={`px-3.5 py-4 rounded-l-2xl shadow-md border-y border-l transition-all duration-200 flex flex-col items-center gap-1.5 cursor-pointer ${
            activePanel === "timeline" 
              ? "bg-[#2ECC71] text-white border-[#27AE60]" 
              : "bg-[#E8F8F5] text-[#16A085] border-[#D1F2EB] hover:bg-[#D1F2EB]"
          }`}
          title="Timeline Navigation"
        >
          <Clock className="w-4 h-4" />
          <span className="text-[10px] font-mono tracking-tighter vertical-text font-bold">TIMELINE</span>
        </button>
      </div>

      {/* Core Header Section */}
      <div className="flex flex-col items-center text-center mt-6 mb-12 max-w-md w-full">
        <h1 className="font-display font-bold text-3xl text-[#3D2F2E] tracking-tight mb-2 flex items-center gap-2">
          <span>{lang === "CN" ? "剪贴簿" : "Scrapbook"}</span>
        </h1>
        <p className="text-xs text-[#9E8B7A] tracking-wider leading-relaxed max-w-xs font-sans">
          {lang === "CN" ? "我收到的礼物。我制作的小物。公告。随笔碎碎念等等。" : "Things I received. Crafted items. Announcements. Monologues, etc."}
        </p>

        {activeTimelineMonth && (
          <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-full text-xs font-mono">
            <span>Filtering: {activeTimelineMonth}</span>
            <button onClick={() => setActiveTimelineMonth(null)} className="hover:text-red-500 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>



      {/* Grid container for scrapbook post cards */}
      <div className="w-full max-w-md md:max-w-xl flex flex-col gap-8 mb-24">
        <AnimatePresence mode="popLayout">
          {displayedPosts.length > 0 ? (
            displayedPosts.slice(0, visibleCount).map((post) => {
              const isVideoMuted = mutedVideos[post.id!] !== false; // Default to muted
              const isVideoPlaying = playingVideos[post.id!] !== false; // Default to autoplay/playing
              const tilt = getCardTilt(post);

              // Custom styles
              const borderStyle = post.borderPreset === "striped" 
                ? "striped-border-pattern border-2 border-dashed border-[#CBDCC7]" 
                : post.borderPreset === "none" 
                  ? "border-transparent shadow-none" 
                  : "border-[#EFECE6]";

              return (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-120px" }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => {
                    const idx = displayedPosts.indexOf(post);
                    if (idx !== -1) {
                      setImmersiveIndex(idx);
                      setIsImmersiveOpen(true);
                    }
                  }}
                  style={{
                    rotate: tilt,
                    borderLeftColor: post.leftBorderColor || undefined,
                    borderLeftWidth: post.leftBorderColor ? "6px" : undefined
                  }}
                  className={`bg-white rounded-3xl p-5 soft-shadow relative flex flex-col border ${borderStyle} transition-all hover:scale-[1.02] duration-300 cursor-pointer select-none`}
                >
                  {/* Pin badge */}
                  {post.isPinned && (
                    <div className="absolute top-4 left-4 z-10 text-red-500 flex items-center justify-center transform -rotate-12">
                      <Pin className="w-5 h-5 fill-current" />
                    </div>
                  )}

                  {/* Custom Version badge (customized on admin panel) */}
                  {post.version && (
                    <div className="absolute top-4 right-4 z-10 bg-[#FAF7F2] border border-[#EFECE6] text-[10px] font-mono text-[#8C7673] px-2 py-0.5 rounded-md shadow-2xs font-semibold">
                      {post.version}
                    </div>
                  )}

                  {/* Media Content - Image */}
                  {post.imageUrl && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedImageUrl(post.imageUrl!);
                      }}
                      className="rounded-2xl overflow-hidden bg-[#F3EFE9] mb-4 aspect-auto max-h-[350px] flex items-center justify-center relative group cursor-zoom-in"
                    >
                      <img
                        src={post.imageUrl}
                        alt="Scrapbook illustration"
                        className="w-full h-full object-cover rounded-2xl group-hover:scale-101 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {/* Media Content - Video with immersive expand */}
                  {post.videoUrl && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedVideoUrl(post.videoUrl!);
                        setZoomedVideoPost(post);
                      }}
                      className="rounded-2xl overflow-hidden bg-black mb-4 aspect-video relative flex items-center justify-center cursor-pointer"
                    >
                      <video
                        src={post.videoUrl}
                        loop
                        muted={isVideoMuted}
                        autoPlay={isVideoPlaying}
                        playsInline
                        className="w-full h-full object-contain"
                      />
                      {/* Video indicator badge */}
                      <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white rounded-full px-2.5 py-1 text-[10px] font-bold flex items-center gap-1">
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>VIDEO</span>
                      </div>
                    </div>
                  )}

                  {/* Text Content */}
                  <div className="px-1 mb-4 flex-1">
                    <p className="text-[#4A3E3D] text-sm md:text-base leading-relaxed whitespace-pre-wrap font-sans font-medium">
                      {post.content}
                    </p>
                  </div>

                  {/* Tags Badges list with Custom hover rotation & exit animations */}
                  <div className="flex flex-wrap gap-2.5 mb-4 px-1">
                    {post.tags.map((tag) => (
                      <motion.span
                        key={tag}
                        whileHover={{ scale: 1.05, rotate: 6 }}
                        whileTap={{ scale: 0.95, rotate: -360 }}
                        transition={{ type: "spring", stiffness: 320, damping: 14 }}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent opening immersive view when clicking a tag
                          handleTagToggle(tag);
                        }}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border border-dashed cursor-pointer transition-colors ${
                          selectedTags.includes(tag)
                            ? "bg-[#E67E22] border-transparent text-white"
                            : "bg-white border-[#D6C7B7] text-[#8C7673] hover:border-[#4A3E3D] hover:text-[#4A3E3D]"
                        }`}
                      >
                        {tag}
                      </motion.span>
                    ))}
                  </div>

                  {/* Card Footer Info */}
                  <div className="border-t border-dashed border-[#EFECE6] pt-3 flex items-center justify-between text-[#9E8B7A] text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent opening immersive view when sharing
                          handleSharePost(post);
                        }}
                        className="p-1 hover:text-[#4A3E3D] transition-colors cursor-pointer"
                        title="Share this post"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="font-mono font-medium">{post.date}</span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl soft-shadow border border-[#EFECE6] px-4">
              <p className="text-sm text-gray-500">{lang === "CN" ? "当前过滤条件下没有找到收集物卡片。" : "No scrapbook cards match your filter criteria."}</p>
              <button
                onClick={() => {
                  setSelectedTags([]);
                  setSearchQuery("");
                  setActiveTimelineMonth(null);
                }}
                className="mt-4 px-4 py-2 bg-[#4A3E3D] text-white text-xs font-semibold rounded-xl hover:bg-[#3D3332] cursor-pointer"
              >
                {lang === "CN" ? "清空所有过滤条件" : "Clear All Filters"}
              </button>
            </div>
          )}
        </AnimatePresence>

        {visibleCount < displayedPosts.length && (
          <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
            <div className="animate-pulse text-xs font-mono text-[#8C7673]">
              Loading more...
            </div>
          </div>
        )}
      </div>

      {/* --- SIDE/DRAWER PANELS --- */}

      {/* 1. Tag Filter Side Panel */}
      <AnimatePresence>
        {activePanel === "tags" && (
          <>
            <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-xs" onClick={() => setActivePanel(null)}></div>
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed top-0 left-0 h-full w-72 bg-[#FAF8F5] border-r border-[#EFECE6] z-50 p-6 flex flex-col shadow-2xl custom-scrollbar overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-bold text-[#4A3E3D] text-lg flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#E67E22]" />
                  <span>{lang === "CN" ? "标签检索" : "Tags Index"}</span>
                </h3>
                <button onClick={() => setActivePanel(null)} className="text-[#9E8B7A] hover:text-[#4A3E3D] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* AND/OR Operator Toggle */}
              <div className="bg-[#EFECE6] p-1.5 rounded-2xl flex items-center justify-between mb-6">
                <span className="text-xs font-semibold text-[#8C7673] px-3">{lang === "CN" ? "匹配模式" : "Operator"}</span>
                <div className="flex items-center bg-white rounded-xl shadow-xs overflow-hidden">
                  <button
                    onClick={() => setOperator("OR")}
                    className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      operator === "OR" ? "bg-[#E67E22] text-white" : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {lang === "CN" ? "或 (OR)" : "OR"}
                  </button>
                  <button
                    onClick={() => setOperator("AND")}
                    className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      operator === "AND" ? "bg-[#34495E] text-white" : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {lang === "CN" ? "和 (AND)" : "AND"}
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-8 flex-1 overflow-y-auto">
                <button
                  onClick={() => setSelectedTags([])}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all cursor-pointer ${
                    selectedTags.length === 0
                      ? "bg-[#4A3E3D] border-transparent text-white"
                      : "bg-white border-[#D6C7B7] text-[#8C7673] hover:border-[#4A3E3D]"
                  }`}
                >
                  {lang === "CN" ? "全部标签" : "All Tags"}
                </button>

                {allTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagToggle(tag)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border border-dashed text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-[#E67E22] border-transparent text-white"
                          : "bg-white border-[#D6C7B7] text-[#8C7673] hover:border-[#4A3E3D]"
                      }`}
                    >
                      <span>{tag}</span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-white"></span>}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setActivePanel(null)}
                className="w-full py-3 bg-[#4A3E3D] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#3D3332] cursor-pointer"
              >
                {lang === "CN" ? "完成" : "Done"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 2. Text Search Side Panel */}
      <AnimatePresence>
        {activePanel === "search" && (
          <>
            <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-xs" onClick={() => setActivePanel(null)}></div>
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              className="fixed top-0 left-0 right-0 bg-white border-b border-[#EFECE6] z-50 p-6 shadow-2xl flex flex-col items-center"
            >
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-[#34495E] text-base flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    <span>{lang === "CN" ? "全文检索" : "Fulltext Search"}</span>
                  </h3>
                  <button onClick={() => setActivePanel(null)} className="text-[#9E8B7A] hover:text-[#4A3E3D] cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={settings.searchPlaceholderName || (lang === "CN" ? "输入关键词检索..." : "Search text or tags...")}
                    className="w-full p-3 pr-12 bg-gray-50 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#34495E] text-gray-800"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 text-gray-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-[10px] text-gray-400 self-center uppercase tracking-wide mr-1 font-mono">Quick:</span>
                  {allTags.slice(0, 5).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSearchQuery(tag)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-[#8C7673] cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 3. Chronological Timeline Navigation Drawer */}
      <AnimatePresence>
        {activePanel === "timeline" && (
          <>
            <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-xs" onClick={() => setActivePanel(null)}></div>
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-72 bg-[#FAF8F5] border-l border-[#EFECE6] z-50 p-6 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display font-bold text-[#16A085] text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>{lang === "CN" ? "时间轴控制" : "Timeline Navigation"}</span>
                </h3>
                <button onClick={() => setActivePanel(null)} className="text-[#9E8B7A] hover:text-[#4A3E3D] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* INTERACTIVE TIMELINE SLIDER (时间轴滑块) */}
              <div className="mb-6 p-4 bg-teal-50/50 border border-teal-100 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-[10px] font-mono text-teal-800 font-bold">
                  <span>{timelineMonths[timelineMonths.length - 1] || "START"}</span>
                  <span className="bg-teal-600 text-white px-2 py-0.5 rounded-full text-[9px]">
                    {activeTimelineMonth ? activeTimelineMonth.replace(".", "年 ") + "月" : (lang === "CN" ? "全部时间" : "All Time")}
                  </span>
                  <span>{timelineMonths[0] || "END"}</span>
                </div>
                
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={timelineSliderVal}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setTimelineSliderVal(val);
                    if (timelineMonths.length > 0) {
                      // Map range 0-100 to reverse index
                      const idx = Math.min(
                        Math.floor((val / 100) * timelineMonths.length),
                        timelineMonths.length - 1
                      );
                      const targetMonth = timelineMonths[timelineMonths.length - 1 - idx];
                      setActiveTimelineMonth(targetMonth);
                    }
                  }}
                  className="w-full h-2 bg-teal-100 rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-none"
                />
                <span className="block text-[10px] text-teal-600 text-center font-semibold font-sans">
                  {lang === "CN" ? "← 按住拖动快速定位时间节点 →" : "← Drag to scrub timeline →"}
                </span>
              </div>

              <div className="flex-1 space-y-3 relative pl-4 border-l-2 border-dashed border-teal-100 py-2 overflow-y-auto custom-scrollbar">
                <button
                  onClick={() => {
                    setActiveTimelineMonth(null);
                    setTimelineSliderVal(100);
                    setActivePanel(null);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border border-dashed text-xs font-bold transition-all relative flex items-center cursor-pointer ${
                    activeTimelineMonth === null
                      ? "bg-teal-600 text-white border-transparent shadow-md"
                      : "bg-white border-[#D6C7B7] text-[#8C7673] hover:border-teal-500"
                  }`}
                >
                  <div className="absolute -left-[23px] w-3.5 h-3.5 rounded-full bg-teal-500 border-4 border-white shadow-xs"></div>
                  {lang === "CN" ? "显示全部时间" : "All Time"}
                </button>

                {timelineMonths.map((month) => {
                  const isSelected = activeTimelineMonth === month;
                  return (
                    <button
                      key={month}
                      onClick={() => {
                        setActiveTimelineMonth(month);
                        // find relative index percentage
                        const idx = timelineMonths.indexOf(month);
                        const pct = 100 - Math.floor((idx / timelineMonths.length) * 100);
                        setTimelineSliderVal(pct);
                        setActivePanel(null);
                      }}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border border-dashed text-xs font-mono font-semibold transition-all relative flex items-center cursor-pointer ${
                        isSelected
                          ? "bg-teal-600 text-white border-transparent shadow-md"
                          : "bg-white border-[#D6C7B7] text-[#8C7673] hover:border-teal-500"
                      }`}
                    >
                      <div className={`absolute -left-[23px] w-3.5 h-3.5 rounded-full border-4 border-white shadow-xs transition-colors ${
                        isSelected ? "bg-teal-600" : "bg-teal-200"
                      }`}></div>
                      <span>{month.replace(".", "年 ") + "月"}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- PREMIUM DEDICATED FULL-SCREEN IMAGE MODAL --- */}
      <AnimatePresence>
        {zoomedImageUrl && (
          <div 
            className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-50 cursor-zoom-out"
            onClick={() => setZoomedImageUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-2xl w-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={zoomedImageUrl}
                alt="Zoomed image"
                className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => setZoomedImageUrl(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DEDICATED CINEMA VIDEO PLAYBACK MODAL (含版本、视频播放界面版块) --- */}
      <AnimatePresence>
        {zoomedVideoUrl && zoomedVideoPost && (
          <div 
            className="fixed inset-0 bg-black/95 backdrop-blur-lg flex flex-col items-center justify-center p-4 z-50"
            onClick={() => {
              setZoomedVideoUrl(null);
              setZoomedVideoPost(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative max-w-3xl w-full bg-[#18181B] rounded-3xl overflow-hidden shadow-2xl border border-white/5 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Title Bar */}
              <div className="flex items-center justify-between p-4 bg-[#27272A]/50 border-b border-white/5 text-white">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="font-display font-bold text-sm tracking-wide">{lang === "CN" ? "影片媒体播放器" : "Cinema Media Stream"}</span>
                  {zoomedVideoPost.version && (
                    <span className="bg-white/10 border border-white/10 text-[9px] font-mono text-gray-300 px-1.5 py-0.5 rounded-md">
                      {zoomedVideoPost.version}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setZoomedVideoUrl(null);
                    setZoomedVideoPost(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white/5 text-gray-400 hover:text-white flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Video stage */}
              <div className="aspect-video bg-black flex items-center justify-center relative">
                <video
                  src={zoomedVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Metadata content */}
              <div className="p-5 text-gray-300 space-y-3.5 bg-[#1C1C1F]">
                <p className="text-xs font-mono text-teal-400">{zoomedVideoPost.date}</p>
                <p className="text-sm leading-relaxed text-gray-200">{zoomedVideoPost.content}</p>
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {zoomedVideoPost.tags.map(t => (
                    <span key={t} className="text-[10px] font-bold text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DISTRACTION-FREE VERTICAL REELS / IMMERSIVE VIEW MODAL --- */}
      <AnimatePresence>
        {isImmersiveOpen && displayedPosts.length > 0 && (
          <div 
            onClick={() => setIsImmersiveOpen(false)}
            className="fixed inset-0 bg-[#FAF7F2] z-50 flex flex-col items-center justify-center select-none overflow-hidden cursor-pointer"
          >
            
            {/* Fixed Top Controls Overlay */}
            <div 
              onClick={(e) => e.stopPropagation()}
              className="fixed top-6 left-6 right-6 z-50 flex items-center justify-between pointer-events-none"
            >
              {/* Left Circular Outline Buttons */}
              <div className="flex items-center gap-3 pointer-events-auto">
                {/* Vertical fast scroll autoplay switcher */}
                <button
                  onClick={() => setIsImmersivePlaying(!isImmersivePlaying)}
                  className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                    isImmersivePlaying 
                      ? "border-teal-600 bg-teal-50/25 text-teal-700 font-bold shadow-xs animate-pulse" 
                      : "border-[#9E8B7A] text-[#9E8B7A] hover:bg-black/5"
                  }`}
                  title={isImmersivePlaying ? "Disable Auto-scroll" : "Enable Auto-scroll"}
                >
                  <ChevronsUpDown className="w-4.5 h-4.5" />
                </button>

                <button
                  onClick={() => setIsImmersiveMuted(!isImmersiveMuted)}
                  className="w-10 h-10 rounded-full border-2 border-[#9E8B7A] bg-[#FAF7F2]/80 backdrop-blur-xs text-[#9E8B7A] flex items-center justify-center hover:bg-black/5 transition-colors cursor-pointer"
                  title={isImmersiveMuted ? "Unmute Sound" : "Mute Sound"}
                >
                  {isImmersiveMuted ? (
                    <VolumeX className="w-4 h-4 text-[#9E8B7A]" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-[#9E8B7A]" />
                  )}
                </button>

                {displayedPosts[immersiveIndex]?.videoUrl && (
                  <button
                    onClick={() => {
                      const currentPost = displayedPosts[immersiveIndex];
                      if (currentPost && currentPost.id) {
                        setImmersivePlayingVideos(prev => ({
                          ...prev,
                          [currentPost.id!]: !prev[currentPost.id!]
                        }));
                      }
                    }}
                    className="w-10 h-10 rounded-full border-2 border-[#9E8B7A] bg-[#FAF7F2]/80 backdrop-blur-xs text-[#9E8B7A] flex items-center justify-center hover:bg-black/5 transition-colors cursor-pointer"
                    title={immersivePlayingVideos[displayedPosts[immersiveIndex]?.id || ""] !== false ? "Pause Video" : "Play Video"}
                  >
                    {immersivePlayingVideos[displayedPosts[immersiveIndex]?.id || ""] !== false ? (
                      <Pause className="w-4 h-4 text-[#9E8B7A] fill-current" />
                    ) : (
                      <Play className="w-4 h-4 text-[#9E8B7A] fill-current translate-x-0.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Right: Hanging language Ribbon Bookmark (Image 1 style) */}
              <div className="relative pointer-events-auto">
                <div 
                  onClick={onToggleLang}
                  className="bg-[#D9534F] text-white font-display font-bold text-xs tracking-wider pt-3 pb-5 shadow-md hover:pt-4 cursor-pointer transition-all duration-200 flex items-center justify-center"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 86%, 0 100%)",
                    width: "42px",
                    height: "60px"
                  }}
                  title="Switch Language"
                >
                  <span className="translate-y-[-2px]">{lang}</span>
                </div>
              </div>
            </div>

            {/* Native Snap-scroll vertical slider container */}
            <div 
              ref={snapContainerRef}
              onScroll={handleSnapScroll}
              className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
              style={{ scrollbarWidth: "none" }}
            >
              {displayedPosts.map((post, idx) => {
                const tilt = getCardTilt(post);
                const isCurrent = idx === immersiveIndex;

                return (
                  <div 
                    key={post.id || idx}
                    onClick={() => setIsImmersiveOpen(false)}
                    className="w-full h-full flex items-center justify-center p-4 snap-start snap-always relative select-none cursor-pointer"
                  >
                    {/* Immersive Physical Post Card (Styled exactly like Image 1) */}
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0.9 }}
                      animate={isCurrent ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 0.5 }}
                      transition={{ type: "spring", stiffness: 220, damping: 20 }}
                      style={{ rotate: tilt }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white rounded-[32px] p-6 shadow-xl relative flex flex-col border border-gray-150 w-full max-w-sm max-h-[75vh] overflow-y-auto custom-scrollbar transition-all duration-300 cursor-default"
                    >
                      {/* Media Image */}
                      {post.imageUrl && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomedImageUrl(post.imageUrl!);
                          }}
                          className="rounded-[24px] overflow-hidden bg-[#F3EFE9] mb-4 aspect-auto max-h-[280px] flex items-center justify-center relative shadow-sm cursor-zoom-in"
                        >
                          <img
                            src={post.imageUrl}
                            alt="Reels illustration"
                            className="w-full h-full object-cover rounded-[24px]"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {post.videoUrl && (
                        <div className="rounded-[24px] overflow-hidden bg-black mb-4 aspect-video relative flex items-center justify-center shadow-sm">
                          <video
                            id={`immersive-video-${post.id}`}
                            src={post.videoUrl}
                            loop
                            muted={isImmersiveMuted}
                            playsInline
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}

                      {/* Content Text */}
                      <div className="px-1 mb-4 flex-1">
                        <p className="text-[#4A3E3D] text-sm md:text-base leading-relaxed whitespace-pre-wrap font-sans font-medium">
                          {post.content}
                        </p>
                      </div>

                      {/* Dashed Tags list (Image 1 style) */}
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4 px-1">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-dashed border-[#D6C7B7] text-[#8C7673]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Card Footer row (Image 1 layout) */}
                      <div className="border-t border-dashed border-[#EFECE6] pt-4 flex items-center justify-between">
                        {/* Left Side: Pin, Share, Info icons */}
                        <div className="flex items-center gap-3.5 text-[#9E8B7A]">
                          {post.isPinned ? (
                            <Pin className="w-4 h-4 text-red-500 fill-current transform -rotate-12" title="Pinned" />
                          ) : (
                            <Pin className="w-4 h-4 text-gray-300 transform -rotate-12" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSharePost(post);
                            }}
                            className="hover:text-[#4A3E3D] transition-colors cursor-pointer"
                            title="Share Link"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowHelpModal(true);
                            }}
                            className="hover:text-[#4A3E3D] transition-colors cursor-pointer"
                            title="Information"
                          >
                            <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[10px] font-bold">i</div>
                          </button>
                        </div>

                        {/* Right Side: Monospace Date */}
                        <span className="font-mono text-xs font-semibold text-[#9E8B7A] tracking-wider">{post.date}</span>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>

            {/* Gesture scroll helper guide overlay (Video 1 style) */}
            {showGestureHelper && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 bg-black/5 animate-fade-out">
                <div className="bg-white/95 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-gray-100 flex flex-col items-center gap-2 shadow-2xl">
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-[#8C7673] animate-bounce flex items-center justify-center text-lg font-bold text-[#8C7673]">
                    ↑
                  </div>
                  <span className="text-[10px] font-bold text-[#8C7673] tracking-wide uppercase">
                    {lang === "CN" ? "向上/下滑动切换" : "Swipe Up/Down to Switch"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Direct Card link share overlay notification */}
      <AnimatePresence>
        {sharedPostUrl && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl border border-[#EFECE6]"
            >
              <h3 className="font-display font-bold text-lg text-[#3D2F2E] mb-2">{lang === "CN" ? "分享卡片" : "Share Card"}</h3>
              <p className="text-xs text-gray-500 mb-4">{lang === "CN" ? "复制下方直达链接分享本张卡片！" : "Copy the direct card link below!"}</p>
              <input
                type="text"
                readOnly
                value={sharedPostUrl}
                className="w-full text-xs p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-center select-all font-mono text-gray-600 mb-4 focus:outline-none"
              />
              <button
                onClick={() => setSharedPostUrl(null)}
                className="w-full py-2 bg-[#4A3E3D] text-white rounded-xl text-xs font-semibold hover:bg-[#3D3332] cursor-pointer"
              >
                {lang === "CN" ? "完成" : "Done"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
