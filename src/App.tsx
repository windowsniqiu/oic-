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

  const [settings, setSettings] = useState<Setting>(DEFAULT_SETTINGS);
  const [posts, setPosts] = useState<Post[]>([]);
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
      const postsSnap = await getDocs(postsColRef);
      if (!postsSnap.empty) {
        const fetchedPosts: Post[] = [];
        postsSnap.forEach((docSnap) => {
          fetchedPosts.push({ id: docSnap.id, ...docSnap.data() } as Post);
        });
        setPosts(fetchedPosts);
        setHasLoadedAllPosts(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const syncDatabase = async () => {
    try {
      const settingsDocRef = doc(db, "settings", "global");
      const postsColRef = collection(db, "posts");
      const homePostsQuery = query(postsColRef, orderBy("date", "desc"), limit(5));

      const [settingsSnap, postsSnap] = await Promise.all([
        getDoc(settingsDocRef),
        getDocs(homePostsQuery)
      ]);
      
      let fetchedSettings = DEFAULT_SETTINGS;
      if (settingsSnap.exists()) {
        fetchedSettings = settingsSnap.data() as Setting;
        setSettings(fetchedSettings);
      } else {
        await setDoc(settingsDocRef, DEFAULT_SETTINGS);
        setSettings(DEFAULT_SETTINGS);
      }

      if (!postsSnap.empty) {
        const fetchedPosts: Post[] = [];
        postsSnap.forEach((docSnap) => {
          fetchedPosts.push({ id: docSnap.id, ...docSnap.data() } as Post);
        });
        setPosts(fetchedPosts);
      } else {
        const batch = writeBatch(db);
        const preseededPosts: Post[] = [];
        
        DEFAULT_POSTS.forEach((post) => {
          const newDocRef = doc(collection(db, "posts"));
          batch.set(newDocRef, post);
          preseededPosts.push({ id: newDocRef.id, ...post });
        });
        
        await batch.commit();
        setPosts(preseededPosts);
      }
    } catch (err) {
      console.error(err);
      setPosts(DEFAULT_POSTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncDatabase();

    const path = window.location.pathname;
    if (path === "/kipfel" || path.includes("kipfel")) {
      setActivePage("admin");
    } else if (path === "/scrapbook" || path.includes("scrapbook")) {
      setActivePage("scrapbook");
      loadAllPosts();
    }

    const handlePopState = () => {
      const currentPath = window.location.pathname;
      if (currentPath === "/kipfel" || currentPath.includes("kipfel")) {
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

    const newPath = page === "admin" ? "/kipfel" : page === "scrapbook" ? "/scrapbook" : "/";
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
