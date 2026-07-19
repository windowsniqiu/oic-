import React, { useState, useEffect } from "react";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  writeBatch,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "./firebase";
import { Post, Setting } from "./types";
import { DEFAULT_SETTINGS, DEFAULT_POSTS } from "./data";
import MainBoard from "./components/MainBoard";
import ScrapbookBoard from "./components/ScrapbookBoard";
import AdminPanel from "./components/AdminPanel";

export default function App() {
  const [activePage, setActivePage] = useState<"home" | "scrapbook" | "admin">("home");
  const [navParams, setNavParams] = useState<any>(null);

  const [settings, setSettings] = useState<Setting>(() => {
    const cached = localStorage.getItem("oicolatcho_settings_cache");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [posts, setPosts] = useState<Post[]>(() => {
    const cached = localStorage.getItem("oicolatcho_posts_cache");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [hasLoadedAllPosts, setHasLoadedAllPosts] = useState(false);

  const [lang, setLang] = useState<"CN" | "EN">(() => {
    const saved = localStorage.getItem("oicolatcho_lang");
    return (saved === "EN" || saved === "CN") ? saved : "CN";
  });

  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === "CN" ? "EN" : "CN";
      localStorage.setItem("oicolatcho_lang", next);
      return next;
    });
  };

  const loadAllPosts = async () => {
    try {
      const postsColRef = collection(db, "posts");
      const fetchPromise = getDocs(postsColRef);

      // Race fetching with a 1.5s timeout for ultra-fast fallback
      const postsSnap = await Promise.race([
        fetchPromise,
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500))
      ]);

      if (!postsSnap.empty) {
        const fetchedPosts: Post[] = [];
        postsSnap.forEach((docSnap) => {
          fetchedPosts.push({ id: docSnap.id, ...docSnap.data() } as Post);
        });
        setPosts(fetchedPosts);
        setHasLoadedAllPosts(true);
        localStorage.setItem("oicolatcho_posts_cache", JSON.stringify(fetchedPosts));
      }

      // Handle async resolution in background if it timed out initially
      fetchPromise.then((snap) => {
        if (!snap.empty) {
          const fetchedPosts: Post[] = [];
          snap.forEach((docSnap) => {
            fetchedPosts.push({ id: docSnap.id, ...docSnap.data() } as Post);
          });
          setPosts(fetchedPosts);
          setHasLoadedAllPosts(true);
          localStorage.setItem("oicolatcho_posts_cache", JSON.stringify(fetchedPosts));
        }
      }).catch(() => {});

    } catch (err) {
      if (err instanceof Error && (err.message.includes("offline") || err.message.includes("Timeout") || err.message.includes("Failed to get document"))) {
        console.warn("Offline or Timeout: loading all posts fallback enabled.", err);
      } else {
        console.error(err);
      }
    }
  };

  const syncDatabase = async () => {
    try {
      const settingsDocRef = doc(db, "settings", "global");
      const postsColRef = collection(db, "posts");
      const homePostsQuery = query(postsColRef, orderBy("date", "desc"), limit(5));

      const fetchPromise = Promise.all([
        getDoc(settingsDocRef),
        getDocs(homePostsQuery)
      ]);

      // Set up background handler so fresh data updates UI and local cache as soon as it arrives
      fetchPromise.then(([settingsSnap, postsSnap]) => {
        if (settingsSnap.exists()) {
          const fetchedSettings = settingsSnap.data() as Setting;
          setSettings(fetchedSettings);
          localStorage.setItem("oicolatcho_settings_cache", JSON.stringify(fetchedSettings));
        }
        if (!postsSnap.empty) {
          const fetchedPosts: Post[] = [];
          postsSnap.forEach((docSnap) => {
            fetchedPosts.push({ id: docSnap.id, ...docSnap.data() } as Post);
          });
          setPosts(fetchedPosts);
          localStorage.setItem("oicolatcho_posts_cache", JSON.stringify(fetchedPosts));
        }
      }).catch((err) => {
        console.warn("Background sync update failed:", err);
      });

      // Race connection with a 1.5s limit
      const [settingsSnap, postsSnap] = await Promise.race([
        fetchPromise,
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500))
      ]);
      
      let fetchedSettings = DEFAULT_SETTINGS;
      if (settingsSnap.exists()) {
        fetchedSettings = settingsSnap.data() as Setting;
        setSettings(fetchedSettings);
        localStorage.setItem("oicolatcho_settings_cache", JSON.stringify(fetchedSettings));
      } else {
        setDoc(settingsDocRef, DEFAULT_SETTINGS).catch(console.error);
        setSettings(DEFAULT_SETTINGS);
      }

      if (!postsSnap.empty) {
        const fetchedPosts: Post[] = [];
        postsSnap.forEach((docSnap) => {
          fetchedPosts.push({ id: docSnap.id, ...docSnap.data() } as Post);
        });
        setPosts(fetchedPosts);
        localStorage.setItem("oicolatcho_posts_cache", JSON.stringify(fetchedPosts));
      } else {
        // Asynchronously seed the database if completely empty to never block the main thread
        const seedDb = async () => {
          const batch = writeBatch(db);
          DEFAULT_POSTS.forEach((post) => {
            const newDocRef = doc(collection(db, "posts"));
            batch.set(newDocRef, post);
          });
          await batch.commit();
        };
        seedDb().catch(console.error);
        if (posts.length === 0) {
          setPosts(DEFAULT_POSTS);
        }
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes("offline") || err.message.includes("Timeout") || err.message.includes("Failed to get document"))) {
        console.warn("Offline or Timeout: sync database from Firestore. Loading local/cached defaults instantly.", err);
      } else {
        console.error(err);
      }
      
      // If we don't have posts in state yet, default them
      if (posts.length === 0) {
        setPosts(DEFAULT_POSTS);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncDatabase();

    const path = window.location.pathname;
    if (path === "/hellokipgel" || path.includes("hellokipgel")) {
      setActivePage("admin");
    } else if (path === "/scrapbook" || path.includes("scrapbook")) {
      setActivePage("scrapbook");
      loadAllPosts();
    }

    const handlePopState = () => {
      const currentPath = window.location.pathname;
      if (currentPath === "/hellokipgel" || currentPath.includes("hellokipgel")) {
        setActivePage("admin");
      } else if (currentPath === "/scrapbook" || currentPath.includes("scrapbook")) {
        setActivePage("scrapbook");
        loadAllPosts();
      } else {
        setActivePage("home");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (settings.websiteIconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.getElementsByTagName("head")[0].appendChild(link);
      }
      link.href = settings.websiteIconUrl;
    }
  }, [settings.websiteIconUrl]);

  const handleNavigate = (page: "home" | "scrapbook" | "admin", params?: any) => {
    setActivePage(page);
    setNavParams(params || null);

    if (page === "scrapbook" && !hasLoadedAllPosts) {
      loadAllPosts();
    }

    const newPath = page === "admin" ? "/hellokipgel" : page === "scrapbook" ? "/scrapbook" : "/";
    window.history.pushState(null, "", newPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#EFECE6] border-t-[#4A3E3D]"></div>
      </div>
    );
  }

  return (
    <>
      {activePage === "home" && (
        <MainBoard 
          settings={settings} 
          posts={posts} 
          onNavigate={handleNavigate} 
          lang={lang}
          onToggleLang={toggleLang}
        />
      )}

      {activePage === "scrapbook" && (
        <ScrapbookBoard 
          settings={settings} 
          posts={posts} 
          onNavigate={handleNavigate}
          initialParams={navParams}
          lang={lang}
          onToggleLang={toggleLang}
        />
      )}

      {activePage === "admin" && (
        <AdminPanel 
          onNavigate={handleNavigate}
          onRefreshData={syncDatabase}
          currentSettings={settings}
          currentPosts={posts}
          lang={lang}
          onToggleLang={toggleLang}
        />
      )}
    </>
  );
}
