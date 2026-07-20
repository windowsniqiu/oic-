import React, { useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { Post, Setting } from "../types";
import { 
  Upload, LogOut, Settings, Plus, Edit2, Trash2, Save, FileText, Check, 
  ExternalLink, Key, UserPlus, Image as ImageIcon, Video, Star, ArrowLeft 
} from "lucide-react";

interface AdminPanelProps {
  onNavigate: (page: "home" | "scrapbook" | "admin", params?: any) => void;
  onRefreshData: () => void;
  currentSettings: Setting;
  currentPosts: Post[];
  lang?: "CN" | "EN";
  onToggleLang?: () => void;
}

// Helper to hash password with browser's native crypto Subtle API (100% serverless compatible)
async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function AdminPanel({ onNavigate, onRefreshData, currentSettings, currentPosts, lang, onToggleLang }: AdminPanelProps) {
  // Authentication State
  const [user, setUser] = useState<any>(() => {
    const localUser = localStorage.getItem("oicolatcho_logged_in_user");
    if (localUser) {
      try {
        return JSON.parse(localUser);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(() => {
    const cached = localStorage.getItem("oicolatcho_has_admin");
    return cached === "true" ? true : null;
  }); // Checked from server
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Active Tab: "settings" | "posts"
  const [activeTab, setActiveTab] = useState<"settings" | "posts">("settings");

  // Settings State Form
  const [settingsForm, setSettingsForm] = useState<Setting>(currentSettings);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Posts List and Form State
  const [posts, setPosts] = useState<Post[]>(currentPosts);
  const [editingPost, setEditingPost] = useState<Post | null>(null); // null means creating/not editing
  const [isPostFormOpen, setIsPostFormOpen] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [postVideoUrl, setPostVideoUrl] = useState("");
  const [postTags, setPostTags] = useState("");
  const [postIsPinned, setPostIsPinned] = useState(false);
  const [postDate, setPostDate] = useState(""); // Format: YYYY.MM.DD
  const [postLoading, setPostLoading] = useState(false);
  
  // Custom Card Border / Styling state
  const [postVersion, setPostVersion] = useState("");
  const [postLeftBorderColor, setPostLeftBorderColor] = useState("");
  const [postBorderPreset, setPostBorderPreset] = useState<"solid" | "striped" | "none">("solid");
  const [postTiltPreset, setPostTiltPreset] = useState<"random" | "none" | "custom">("random");
  const [postTiltAngle, setPostTiltAngle] = useState<number>(0);

  // Tag list editing states
  const [newTagInput, setNewTagInput] = useState("");
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editingTagValue, setEditingTagValue] = useState("");

  // Image Uploading indicators
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: boolean }>({});

  // 1. Check if admins already exist in system
  const checkAdminStatus = async () => {
    try {
      // Query Firestore directly with limit(1) to make the lookup lightning fast!
      const adminsColRef = collection(db, "admins");
      const q = query(adminsColRef, limit(1));
      const adminsSnap = await getDocs(q);
      const exists = !adminsSnap.empty;
      
      setHasAdmin(exists);
      if (!exists) {
        localStorage.removeItem("oicolatcho_has_admin");
        setIsRegistering(true);
      } else {
        localStorage.setItem("oicolatcho_has_admin", "true");
        setIsRegistering(false);
      }
    } catch (err) {
      console.warn("Firestore client-side admin check failed. Trying backend API route as fallback.", err);
      try {
        const res = await fetch("/api/admin/check");
        if (res.ok) {
          const data = await res.json();
          setHasAdmin(data.hasAdmin);
          if (!data.hasAdmin) {
            localStorage.removeItem("oicolatcho_has_admin");
            setIsRegistering(true);
          } else {
            localStorage.setItem("oicolatcho_has_admin", "true");
            setIsRegistering(false);
          }
        } else {
          throw new Error("API returned non-ok status");
        }
      } catch (backendErr) {
        console.error("Both client-side and backend admin checks failed.", backendErr);
        // Fallback: assume an admin exists to protect the login gate
        setHasAdmin(true);
        setIsRegistering(false);
      }
    }
  };

  useEffect(() => {
    checkAdminStatus();
    
    // Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        localStorage.setItem("oicolatcho_logged_in_user", JSON.stringify({ uid: currentUser.uid, email: currentUser.email }));
      }
    });

    return () => unsubscribe();
  }, []);

  // Update form values if parent state changes
  useEffect(() => {
    if (currentSettings) {
      setSettingsForm(currentSettings);
    }
    if (currentPosts) {
      setPosts(currentPosts);
    }
  }, [currentSettings, currentPosts]);

  // Auth: Log In
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    
    try {
      // 1. Attempt standard Firebase Auth
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const loggedUser = { uid: userCredential.user.uid, email: userCredential.user.email };
        setUser(loggedUser);
        localStorage.setItem("oicolatcho_logged_in_user", JSON.stringify(loggedUser));
        setHasAdmin(true);
        localStorage.setItem("oicolatcho_has_admin", "true");
        setAuthLoading(false);
        return;
      } catch (authErr: any) {
        console.warn("Firebase Auth login failed, trying Firestore database fallback login...", authErr);
      }

      // 2. Fallback: Query Firestore "admins" directly and match hashed password
      const adminsColRef = collection(db, "admins");
      const adminsSnap = await getDocs(adminsColRef);
      const hashedPassword = await hashPassword(password);
      
      let matchedAdmin: any = null;
      adminsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          data.email?.toLowerCase() === email.toLowerCase() &&
          (data.passwordHash === hashedPassword || data.password === password)
        ) {
          matchedAdmin = { uid: docSnap.id, email: data.email };
        }
      });

      if (matchedAdmin) {
        // Since they enabled Firebase Auth, let's try to upgrade/heal their session on-the-fly!
        let finalUser = matchedAdmin;
        try {
          // Attempt to create a real user in Firebase Auth with these credentials
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const realUid = userCredential.user.uid;
          
          // Copy/recreate their admin doc under the real UID
          await setDoc(doc(db, "admins", realUid), {
            uid: realUid,
            email: email,
            passwordHash: hashedPassword,
            createdAt: new Date().toISOString()
          });

          // Delete the old fallback doc with custom ID if it's different
          if (matchedAdmin.uid !== realUid) {
            try {
              await deleteDoc(doc(db, "admins", matchedAdmin.uid));
            } catch (delErr) {
              console.warn("Could not delete old fallback admin doc:", delErr);
            }
          }

          finalUser = { uid: realUid, email: email };
        } catch (upgradeErr: any) {
          console.warn("Could not auto-register fallback admin in Firebase Auth (might already exist or signup is disabled). Trying sign in...", upgradeErr);
          try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            finalUser = { uid: userCredential.user.uid, email: userCredential.user.email };
          } catch (signInErr) {
            console.warn("Sign in also failed. Using fallback user state.", signInErr);
          }
        }

        setUser(finalUser);
        localStorage.setItem("oicolatcho_logged_in_user", JSON.stringify(finalUser));
        setHasAdmin(true);
        localStorage.setItem("oicolatcho_has_admin", "true");
      } else {
        throw new Error("Invalid email or password.");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setAuthError(err.message || "Invalid credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Auth: Register First Admin
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      setAuthLoading(false);
      return;
    }

    try {
      const hashedPassword = await hashPassword(password);
      const customUid = "admin_" + Date.now();
      
      let uid = customUid;
      // Try registering via Firebase Auth if enabled, but catch failure (e.g. auth/operation-not-allowed)
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        uid = userCredential.user.uid;
      } catch (authErr: any) {
        console.warn("Firebase Auth sign up is disabled/not allowed, writing to Firestore directly.", authErr);
      }

      // Save admin credentials directly into Firestore
      await setDoc(doc(db, "admins", uid), {
        uid: uid,
        email: email,
        passwordHash: hashedPassword,
        createdAt: new Date().toISOString()
      });

      // Instantly log in this registered user
      const loggedUser = { uid, email };
      setUser(loggedUser);
      localStorage.setItem("oicolatcho_logged_in_user", JSON.stringify(loggedUser));

      setHasAdmin(true);
      localStorage.setItem("oicolatcho_has_admin", "true");
      setIsRegistering(false);
    } catch (err: any) {
      console.error("Registration error:", err);
      setAuthError(err.message || "Failed to register admin.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("oicolatcho_logged_in_user");
    setUser(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Firebase Auth signOut failed:", err);
    }
  };

  // File Upload Helper (Uses our custom backend upload API with safe client-side Base64 fallback)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(prev => ({ ...prev, [fieldKey]: true }));
    try {
      let uploadedUrl = "";
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          uploadedUrl = data.url;
        } else {
          throw new Error("Server upload endpoint returned non-OK status");
        }
      } catch (apiErr) {
        console.warn("Backend API upload failed, falling back to client-side Base64 URL...", apiErr);
        // Fallback: convert file to Base64 data URL
        uploadedUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to read file as data URL"));
            }
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      }

      if (!uploadedUrl) {
        throw new Error("No URL generated for upload.");
      }

      // Update forms based on target fields
      if (fieldKey === "avatar") {
        setSettingsForm(prev => ({ ...prev, avatarUrl: uploadedUrl }));
      } else if (fieldKey === "websiteIcon") {
        setSettingsForm(prev => ({ ...prev, websiteIconUrl: uploadedUrl }));
      } else if (fieldKey === "hero") {
        setSettingsForm(prev => ({ ...prev, topHeroGifUrl: uploadedUrl }));
      } else if (fieldKey === "postImage") {
        setPostImageUrl(uploadedUrl);
      } else if (fieldKey === "postVideo") {
        setPostVideoUrl(uploadedUrl);
      } else if (fieldKey.startsWith("scrapbook-")) {
        const index = parseInt(fieldKey.split("-")[1]);
        const updatedImages = [...(settingsForm.scrapbookThreeImages || [])];
        updatedImages[index] = uploadedUrl;
        setSettingsForm(prev => ({ ...prev, scrapbookThreeImages: updatedImages }));
      } else if (fieldKey === "corner-gif-new") {
        // Add new bottom corner GIF
        const currentUrls = settingsForm.bottomCornerGifUrls || [];
        setSettingsForm(prev => ({ 
          ...prev, 
          bottomCornerGifUrls: [...currentUrls, uploadedUrl],
          activeBottomCornerGifUrl: uploadedUrl
        }));
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload media asset.");
    } finally {
      setUploadProgress(prev => ({ ...prev, [fieldKey]: false }));
    }
  };

  // Remove a corner GIF URL from bottom list
  const handleRemoveCornerGif = (urlToRemove: string) => {
    const updatedUrls = (settingsForm.bottomCornerGifUrls || []).filter(u => u !== urlToRemove);
    let activeUrl = settingsForm.activeBottomCornerGifUrl;
    if (activeUrl === urlToRemove) {
      activeUrl = updatedUrls[0] || "";
    }
    setSettingsForm(prev => ({
      ...prev,
      bottomCornerGifUrls: updatedUrls,
      activeBottomCornerGifUrl: activeUrl
    }));
  };

  // Save Settings to Firestore
  const handleSaveSettings = async () => {
    setSaveLoading(true);
    setSaveSuccess(false);
    try {
      await setDoc(doc(db, "settings", "global"), settingsForm);
      setSaveSuccess(true);
      onRefreshData();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving settings:", err);
      alert("Failed to save settings. Make sure you are an approved Administrator.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Create or Update a Scrapbook Post
  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) {
      alert("Post content is required!");
      return;
    }

    setPostLoading(true);
    try {
      // Clean tags from comma-separated input (e.g. "#日記, #同人作品")
      const tagsArray = postTags
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .map(t => t.startsWith("#") ? t : `#${t}`);

      const formattedDate = postDate || new Date().toISOString().substring(0, 10).replace(/-/g, ".");

      const postData: Partial<Post> = {
        content: postContent,
        imageUrl: postImageUrl || "",
        videoUrl: postVideoUrl || "",
        tags: tagsArray,
        isPinned: postIsPinned,
        date: formattedDate,
        createdAt: editingPost ? editingPost.createdAt : Date.now(),
        version: postVersion,
        leftBorderColor: postLeftBorderColor,
        borderPreset: postBorderPreset,
        tiltPreset: postTiltPreset,
        tiltAngle: Number(postTiltAngle)
      };

      if (editingPost) {
        // Update existing
        await setDoc(doc(db, "posts", editingPost.id!), postData, { merge: true });
      } else {
        // Create new
        await addDoc(collection(db, "posts"), postData);
      }

      // Reset form states
      setIsPostFormOpen(false);
      setEditingPost(null);
      setPostContent("");
      setPostImageUrl("");
      setPostVideoUrl("");
      setPostTags("");
      setPostIsPinned(false);
      setPostDate("");
      setPostVersion("");
      setPostLeftBorderColor("");
      setPostBorderPreset("solid");
      setPostTiltPreset("random");
      setPostTiltAngle(0);

      // Refresh data
      onRefreshData();
    } catch (err) {
      console.error("Error saving post:", err);
      alert("Failed to save post.");
    } finally {
      setPostLoading(false);
    }
  };

  const handleEditPostClick = (post: Post) => {
    setEditingPost(post);
    setPostContent(post.content);
    setPostImageUrl(post.imageUrl || "");
    setPostVideoUrl(post.videoUrl || "");
    setPostTags(post.tags.join(", "));
    setPostIsPinned(post.isPinned);
    setPostDate(post.date);
    setPostVersion(post.version || "");
    setPostLeftBorderColor(post.leftBorderColor || "");
    setPostBorderPreset(post.borderPreset || "solid");
    setPostTiltPreset(post.tiltPreset || "random");
    setPostTiltAngle(post.tiltAngle || 0);
    setIsPostFormOpen(true);
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this scrapbook card? This action is irreversible.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "posts", postId));
      onRefreshData();
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Failed to delete post.");
    }
  };

  const handleSocialLinkChange = (index: number, val: string, key: "url" | "title" | "description" | "id") => {
    const updatedLinks = [...(settingsForm.socialLinks || [])];
    updatedLinks[index] = { ...updatedLinks[index], [key]: val };
    setSettingsForm(prev => ({ ...prev, socialLinks: updatedLinks }));
  };

  const handleAddSocialLink = () => {
    const updatedLinks = [...(settingsForm.socialLinks || [])];
    const newId = `link_${Date.now()}`;
    updatedLinks.push({
      id: newId,
      title: "New Link / 新链接",
      description: "Subtext / 子描述",
      url: "https://"
    });
    setSettingsForm(prev => ({ ...prev, socialLinks: updatedLinks }));
  };

  const handleRemoveSocialLink = (index: number) => {
    const updatedLinks = (settingsForm.socialLinks || []).filter((_, idx) => idx !== index);
    setSettingsForm(prev => ({ ...prev, socialLinks: updatedLinks }));
  };

  // Auth loading state screen
  if (hasAdmin === null) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4A3E3D]"></div>
      </div>
    );
  }

  // Auth Screen (Login / Register)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 md:p-8 soft-shadow border border-[#EFECE6]">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 bg-[#FAF7F2] rounded-full flex items-center justify-center text-[#8C7673] mb-3">
              {isRegistering ? <UserPlus className="w-6 h-6" /> : <Key className="w-6 h-6" />}
            </div>
            <h2 className="font-display font-bold text-xl text-[#3D2F2E]">
              {isRegistering ? "Register Admin Account" : "Admin Panel Login"}
            </h2>
            <p className="text-xs text-[#9E8B7A] mt-1.5 leading-relaxed">
              {isRegistering 
                ? "Setup the first administrator credentials to customize this website." 
                : "Enter credentials to access the customizing controls."}
            </p>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#8C7673] mb-1 uppercase tracking-wider">Email Address / User</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@oicolatcho.com"
                required
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C7673]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#8C7673] mb-1 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C7673]"
              />
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-bold text-[#8C7673] mb-1 uppercase tracking-wider">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C7673]"
                />
              </div>
            )}

            {authError && (
              <p className="text-xs font-semibold text-red-500 bg-red-50 p-3 rounded-xl">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-[#4A3E3D] hover:bg-[#3D3332] text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <span>{isRegistering ? "Register Admin" : "Sign In"}</span>
                </>
              )}
            </button>

            {!hasAdmin && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="text-xs text-[#8C7673] hover:underline"
                >
                  {isRegistering ? "Back to Login" : "Register Admin"}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Authenticated Admin Dashboard Screen
  return (
    <div className="min-h-screen bg-[#FAF7F2] px-4 py-8 md:py-12 w-full max-w-4xl mx-auto flex flex-col">
      {/* Header and Logout */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[#EFECE6]">
        <div>
          <button 
            onClick={() => onNavigate("home")} 
            className="flex items-center gap-1.5 text-xs text-[#8C7673] hover:text-[#4A3E3D] font-semibold mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回主页 (Go to Website)</span>
          </button>
          <h1 className="font-display font-bold text-2xl text-[#3D2F2E]">
            管理面板 (Administration Panel)
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-0.5">Logged in as: {user.email}</p>
          {user && !auth.currentUser && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl text-xs space-y-1.5 max-w-2xl">
              <p className="font-bold flex items-center gap-1.5 text-amber-900">
                <span>⚠️ 本地临时管理模式 (Local Backup Mode)</span>
              </p>
              <p className="leading-relaxed">
                检测到您当前使用本地紧急备用凭证登录（Firebase Auth 尚未同步）。由于您已经在 Firebase Console 中<strong>【都打开了】</strong>Email/Password 登录选项，<strong>请在右侧点击“安全登出（Log Out）”并重新输入账号密码登录</strong>。
              </p>
              <p className="leading-relaxed font-semibold text-amber-900">
                重新登录后，系统会自动为您完成云端权限关联并升级账号，即可完美支持创建、删除和上传媒体资产！
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors flex items-center gap-1.5 self-start md:self-auto"
        >
          <LogOut className="w-4 h-4" />
          <span>安全登出 (Log Out)</span>
        </button>
      </div>

      {/* Admin Tab Switching */}
      <div className="flex bg-white rounded-2xl p-1.5 soft-shadow mb-8 border border-[#EFECE6] max-w-sm self-center md:self-start w-full">
        <button
          onClick={() => { setActiveTab("settings"); setIsPostFormOpen(false); }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "settings" ? "bg-[#4A3E3D] text-white shadow" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>网站配置 (Website Config)</span>
        </button>
        <button
          onClick={() => { setActiveTab("posts"); }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "posts" ? "bg-[#4A3E3D] text-white shadow" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>帖子管理 (Manage Cards)</span>
        </button>
      </div>

      {/* --- PANEL VIEW: SETTINGS CUSTOMIZATION --- */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {/* Section 1: Texts */}
          <div className="bg-white rounded-3xl p-6 soft-shadow border border-[#EFECE6] space-y-4">
            <h3 className="font-display font-bold text-base text-[#3D2F2E] flex items-center gap-2 pb-3 border-b border-dashed border-gray-100">
              <Settings className="w-5 h-5 text-[#8C7673]" />
              <span>基本文本自定义 (Title & Subtitle)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#8C7673] mb-1.5">主标题 (Main Title)</label>
                <input
                  type="text"
                  value={settingsForm.title}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="おいこらしょのノート"
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C7673]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#8C7673] mb-1.5">副标题 (Subtitle / Description)</label>
                <input
                  type="text"
                  value={settingsForm.subtitle}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="こころのえいようざい。もちもち。"
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C7673]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#8C7673] mb-1.5">搜索框默认提示名字 (Search Placeholder)</label>
                <input
                  type="text"
                  value={settingsForm.searchPlaceholderName || ""}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, searchPlaceholderName: e.target.value }))}
                  placeholder="Oicolatcho"
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#8C7673]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Media Assets & GIFs */}
          <div className="bg-white rounded-3xl p-6 soft-shadow border border-[#EFECE6] space-y-6">
            <h3 className="font-display font-bold text-base text-[#3D2F2E] flex items-center gap-2 pb-3 border-b border-dashed border-gray-100">
              <ImageIcon className="w-5 h-5 text-[#8C7673]" />
              <span>图片与动态 GIF 自定义 (Images & GIFs)</span>
            </h3>

            {/* Profile Avatar, Hero GIF & Website Icon */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Avatar */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#8C7673] uppercase tracking-wider">个人头像 (Profile Avatar)</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden border bg-gray-50 flex items-center justify-center">
                    {settingsForm.avatarUrl ? (
                      <img src={settingsForm.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-xs text-gray-400">Empty</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={settingsForm.avatarUrl}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, avatarUrl: e.target.value }))}
                      placeholder="Avatar URL"
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#8C7673] mb-2"
                    />
                    <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-[#8C7673]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadProgress["avatar"] ? "Uploading..." : "Upload File"}</span>
                      <input type="file" onChange={(e) => handleFileUpload(e, "avatar")} className="hidden" accept="image/*" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Top Hero GIF */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#8C7673] uppercase tracking-wider">首页首图 GIF (Top Hero GIF)</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center">
                    {settingsForm.topHeroGifUrl ? (
                      <img src={settingsForm.topHeroGifUrl} alt="Hero" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-xs text-gray-400">Empty</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={settingsForm.topHeroGifUrl}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, topHeroGifUrl: e.target.value }))}
                      placeholder="Hero GIF URL"
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#8C7673] mb-2"
                    />
                    <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-[#8C7673]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadProgress["hero"] ? "Uploading..." : "Upload GIF"}</span>
                      <input type="file" onChange={(e) => handleFileUpload(e, "hero")} className="hidden" accept="image/gif,image/*" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Website Custom Icon */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#8C7673] uppercase tracking-wider">网站图标 (Website Icon / Favicon)</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center">
                    {settingsForm.websiteIconUrl ? (
                      <img src={settingsForm.websiteIconUrl} alt="Favicon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-xs text-gray-400">Empty</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={settingsForm.websiteIconUrl || ""}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, websiteIconUrl: e.target.value }))}
                      placeholder="Icon URL"
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#8C7673] mb-2"
                    />
                    <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-[#8C7673]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadProgress["websiteIcon"] ? "Uploading..." : "Upload Icon"}</span>
                      <input type="file" onChange={(e) => handleFileUpload(e, "websiteIcon")} className="hidden" accept="image/*" />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrapbook Three Images */}
            <div className="space-y-3 pt-4 border-t border-dashed border-gray-100">
              <label className="block text-xs font-bold text-[#8C7673] uppercase tracking-wider">Scrapbook 三张叠放首图 (Scrapbook 3 Images)</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Image {idx + 1}</span>
                    <div className="aspect-video w-full rounded-lg overflow-hidden border bg-white flex items-center justify-center relative">
                      {settingsForm.scrapbookThreeImages?.[idx] ? (
                        <img src={settingsForm.scrapbookThreeImages[idx]} alt={`Scrapbook ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-xs text-gray-400">Empty</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={settingsForm.scrapbookThreeImages?.[idx] || ""}
                      onChange={(e) => {
                        const updated = [...(settingsForm.scrapbookThreeImages || [])];
                        updated[idx] = e.target.value;
                        setSettingsForm(prev => ({ ...prev, scrapbookThreeImages: updated }));
                      }}
                      placeholder="Image URL"
                      className="w-full p-1.5 bg-white rounded-lg border border-gray-200 text-[10px] focus:outline-none"
                    />
                    <label className="cursor-pointer inline-flex items-center justify-center gap-1 px-3 py-1 bg-white hover:bg-gray-100 text-[10px] font-semibold text-gray-500 rounded border border-gray-200">
                      <Upload className="w-3 h-3" />
                      <span>{uploadProgress[`scrapbook-${idx}`] ? "..." : "Upload File"}</span>
                      <input type="file" onChange={(e) => handleFileUpload(e, `scrapbook-${idx}`)} className="hidden" accept="image/*" />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Corner Floating GIFs Directory */}
            <div className="space-y-4 pt-6 border-t border-dashed border-gray-100">
              <div>
                <label className="block text-xs font-bold text-[#8C7673] uppercase tracking-wider">右下角浮动 GIF 目录 (Bottom Corner Floating GIFs)</label>
                <p className="text-[10px] text-gray-400 mt-0.5">可以上传多个 GIF，每次进入网站会随机抽选一个展示。点击浮动 GIF 亦可随时切换。</p>
              </div>

              {/* Upload New Corner GIF */}
              <div className="flex items-center gap-4 bg-teal-50/50 p-4 rounded-2xl border border-teal-100 max-w-md">
                <div className="w-12 h-12 bg-white rounded-xl border border-teal-200 flex items-center justify-center text-teal-600">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="block text-xs font-semibold text-teal-800">上传新的右下角专属 GIF</span>
                  <p className="text-[10px] text-teal-600 mb-1.5">将会追加到备选库目录中</p>
                  <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-xs font-bold text-white shadow-sm">
                    <Plus className="w-3.5 h-3.5" />
                    <span>{uploadProgress["corner-gif-new"] ? "Uploading..." : "Upload GIF File"}</span>
                    <input type="file" onChange={(e) => handleFileUpload(e, "corner-gif-new")} className="hidden" accept="image/gif" />
                  </label>
                </div>
              </div>

              {/* List of current corner GIFs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(settingsForm.bottomCornerGifUrls || []).map((url, i) => (
                  <div key={i} className="bg-gray-50 rounded-2xl p-2.5 border border-gray-200 flex flex-col items-center relative group">
                    <button
                      type="button"
                      onClick={() => handleRemoveCornerGif(url)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors cursor-pointer"
                      title="Delete GIF"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-14 h-14 bg-white rounded-lg overflow-hidden border mb-2 flex items-center justify-center">
                      <img src={url} alt={`Corner mascot ${i}`} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <span className="text-[9px] font-mono text-gray-400 truncate max-w-full block px-1">{url.substring(url.lastIndexOf("/") + 1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Social Links Customization */}
          <div className="bg-white rounded-3xl p-6 soft-shadow border border-[#EFECE6] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-dashed border-gray-100">
              <h3 className="font-display font-bold text-base text-[#3D2F2E] flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-[#8C7673]" />
                <span>社交媒体外部链接自定义 (Social Links URL)</span>
              </h3>
              <button
                type="button"
                onClick={handleAddSocialLink}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加新社交链接</span>
              </button>
            </div>

            <div className="space-y-4">
              {settingsForm.socialLinks?.map((link, idx) => (
                <div key={link.id || idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-150 flex flex-col gap-3 relative">
                  <button
                    type="button"
                    onClick={() => handleRemoveSocialLink(idx)}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors cursor-pointer"
                    title="删除此社交链接"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase">平台/标题 (Title)</label>
                      <input
                        type="text"
                        value={link.title}
                        onChange={(e) => handleSocialLinkChange(idx, e.target.value, "title")}
                        placeholder="e.g. YouTube"
                        className="w-full p-2.5 bg-white rounded-xl border border-gray-200 text-xs font-bold text-[#4A3E3D] focus:outline-none focus:ring-2 focus:ring-[#8C7673]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase">副标题/描述 (Description)</label>
                      <input
                        type="text"
                        value={link.description}
                        onChange={(e) => handleSocialLinkChange(idx, e.target.value, "description")}
                        placeholder="e.g. ショート動画、ダンス動画"
                        className="w-full p-2.5 bg-white rounded-xl border border-gray-200 text-xs text-[#4A3E3D] focus:outline-none focus:ring-2 focus:ring-[#8C7673]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase">直达链接 (URL)</label>
                      <input
                        type="text"
                        value={link.url}
                        onChange={(e) => handleSocialLinkChange(idx, e.target.value, "url")}
                        placeholder="https://..."
                        className="w-full p-2.5 bg-white rounded-xl border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8C7673]"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {(!settingsForm.socialLinks || settingsForm.socialLinks.length === 0) && (
                <p className="text-xs text-center py-4 text-gray-400 font-medium">无外部社交链接。点击右上角“添加新社交链接”创建。</p>
              )}
            </div>
          </div>

          {/* Section 4: Custom Tag Directory Customization */}
          <div className="bg-white rounded-3xl p-6 soft-shadow border border-[#EFECE6] space-y-4">
            <h3 className="font-display font-bold text-base text-[#3D2F2E] flex items-center gap-2 pb-3 border-b border-dashed border-gray-100">
              <Check className="w-5 h-5 text-[#8C7673]" />
              <span>标签目录管理 (Tag Directory Manager)</span>
            </h3>

            <p className="text-xs text-gray-400">
              在此添加、修改或删除网站全局检索预设的标签目录。
            </p>

            <div className="flex gap-2.5 max-w-md">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="例如: 日記, 最新消息..."
                className="flex-1 p-2 bg-gray-50 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#8C7673]"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newTagInput.trim()) return;
                  const cleanTag = newTagInput.trim().startsWith("#") ? newTagInput.trim() : `#${newTagInput.trim()}`;
                  const currentTags = settingsForm.tagsList || ["#日記", "#同人作品", "#生日", "#照片", "#最新消息", "#手法", "#电脑", "#电影"];
                  if (currentTags.includes(cleanTag)) {
                    alert("该标签已存在！");
                    return;
                  }
                  setSettingsForm(prev => ({
                    ...prev,
                    tagsList: [...currentTags, cleanTag]
                  }));
                  setNewTagInput("");
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                添加标签 (Add)
              </button>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              {(settingsForm.tagsList || ["#日記", "#同人作品", "#生日", "#照片", "#最新消息", "#手法", "#电脑", "#电影"]).map((tag, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 font-semibold group">
                  {editingTagIndex === idx ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingTagValue}
                        onChange={(e) => setEditingTagValue(e.target.value)}
                        className="p-1 bg-white border border-gray-300 rounded text-xs w-20 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!editingTagValue.trim()) return;
                          const cleanTag = editingTagValue.trim().startsWith("#") ? editingTagValue.trim() : `#${editingTagValue.trim()}`;
                          const currentTags = [...(settingsForm.tagsList || ["#日記", "#同人作品", "#生日", "#照片", "#最新消息", "#手法", "#电脑", "#电影"])];
                          currentTags[idx] = cleanTag;
                          setSettingsForm(prev => ({ ...prev, tagsList: currentTags }));
                          setEditingTagIndex(null);
                        }}
                        className="text-green-600 hover:text-green-700 text-[10px] font-bold"
                      >
                        保存
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTagIndex(idx);
                          setEditingTagValue(tag);
                        }}
                        className="text-gray-400 hover:text-[#4A3E3D] text-[10px]"
                        title="编辑"
                      >
                        <Edit2 className="w-3 h-3 inline" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`确认删除标签 "${tag}" 吗？`)) return;
                          const currentTags = settingsForm.tagsList || ["#日記", "#同人作品", "#生日", "#照片", "#最新消息", "#手法", "#电脑", "#电影"];
                          setSettingsForm(prev => ({
                            ...prev,
                            tagsList: currentTags.filter(t => t !== tag)
                          }));
                        }}
                        className="text-red-400 hover:text-red-600 text-[10px]"
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3 inline" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Trigger Save Settings */}
          <div className="flex items-center justify-end gap-3 pt-4">
            {saveSuccess && (
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-xl flex items-center gap-1 animate-pulse">
                <Check className="w-4 h-4" />
                <span>网站参数更新成功！</span>
              </span>
            )}
            <button
              onClick={handleSaveSettings}
              disabled={saveLoading}
              className="px-6 py-3 bg-[#4A3E3D] hover:bg-[#3D3332] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-150 flex items-center gap-2 cursor-pointer"
            >
              {saveLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>保存配置 (Save Configurations)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* --- PANEL VIEW: POSTS MANAGEMENT --- */}
      {activeTab === "posts" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg text-[#3D2F2E]">
              所有帖子目录 ({posts.length})
            </h2>
            <button
              onClick={() => {
                setEditingPost(null);
                setPostContent("");
                setPostImageUrl("");
                setPostVideoUrl("");
                setPostTags("");
                setPostIsPinned(false);
                setPostDate("");
                setPostVersion("");
                setPostLeftBorderColor("");
                setPostBorderPreset("solid");
                setPostTiltPreset("random");
                setPostTiltAngle(0);
                setIsPostFormOpen(true);
              }}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>制作新帖子 (Create Post)</span>
            </button>
          </div>

          {/* POST FORM MODAL OR DRAWER */}
          {isPostFormOpen && (
            <div className="bg-[#FAFDF6] border border-[#CBDCC7] rounded-3xl p-6 soft-shadow space-y-4">
              <h3 className="font-display font-bold text-[#4F634E] text-base flex items-center gap-2 pb-2 border-b border-dashed border-[#CBDCC7]">
                {editingPost ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                <span>{editingPost ? "编辑帖子" : "发布新帖子"}</span>
              </h3>

              <form onSubmit={handleSavePost} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#4F634E] mb-1.5">正文内容 (Post Content)</label>
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="请输入你的碎碎念或动态说明文字..."
                    rows={4}
                    required
                    className="w-full p-3 bg-white rounded-xl border border-[#CBDCC7] text-sm focus:outline-none focus:ring-2 focus:ring-[#5A7259] text-gray-800"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Image asset */}
                  <div>
                    <label className="block text-xs font-bold text-[#4F634E] mb-1.5">图片附件 (Image Attachment - Optional)</label>
                    <input
                      type="text"
                      value={postImageUrl}
                      onChange={(e) => setPostImageUrl(e.target.value)}
                      placeholder="Image URL"
                      className="w-full p-2.5 bg-white rounded-xl border border-[#CBDCC7] text-xs focus:outline-none mb-2"
                    />
                    <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 border border-[#CBDCC7] text-xs font-semibold text-[#4F634E]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadProgress["postImage"] ? "Uploading..." : "Upload Image File"}</span>
                      <input type="file" onChange={(e) => handleFileUpload(e, "postImage")} className="hidden" accept="image/*" />
                    </label>
                  </div>

                  {/* Video asset */}
                  <div>
                    <label className="block text-xs font-bold text-[#4F634E] mb-1.5">视频附件 (Video Attachment - Optional)</label>
                    <input
                      type="text"
                      value={postVideoUrl}
                      onChange={(e) => setPostVideoUrl(e.target.value)}
                      placeholder="Video URL (mp4)"
                      className="w-full p-2.5 bg-white rounded-xl border border-[#CBDCC7] text-xs focus:outline-none mb-2"
                    />
                    <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 border border-[#CBDCC7] text-xs font-semibold text-[#4F634E]">
                      <Video className="w-3.5 h-3.5" />
                      <span>{uploadProgress["postVideo"] ? "Uploading..." : "Upload Video File"}</span>
                      <input type="file" onChange={(e) => handleFileUpload(e, "postVideo")} className="hidden" accept="video/mp4,video/*" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#4F634E] mb-1.5">
                      标签 (Tags - Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={postTags}
                      onChange={(e) => setPostTags(e.target.value)}
                      placeholder="日記, 同人作品, 生日"
                      className="w-full p-2.5 bg-white rounded-xl border border-[#CBDCC7] text-xs focus:outline-none focus:ring-2 focus:ring-[#5A7259]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4F634E] mb-1.5">
                      发布日期 (Custom Date)
                    </label>
                    <input
                      type="text"
                      value={postDate}
                      onChange={(e) => setPostDate(e.target.value)}
                      placeholder="2026.06.09"
                      className="w-full p-2.5 bg-white rounded-xl border border-[#CBDCC7] text-xs focus:outline-none focus:ring-2 focus:ring-[#5A7259]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    id="isPinned"
                    checked={postIsPinned}
                    onChange={(e) => setPostIsPinned(e.target.checked)}
                    className="w-4 h-4 text-teal-600 focus:ring-teal-500 rounded border-gray-300"
                  />
                  <label htmlFor="isPinned" className="text-xs font-bold text-[#4F634E] select-none flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-current text-yellow-500" />
                    <span>置顶此帖子 (Pin to Top)</span>
                  </label>
                </div>

                {/* Custom styling attributes for the Scrapbook Card */}
                <div className="bg-[#EBF5E8]/40 p-4 rounded-2xl border border-[#CBDCC7]/50 space-y-3">
                  <span className="block text-xs font-bold text-[#4F634E] uppercase tracking-wider">卡片样式自定义 (Custom Card Style)</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#5A7259] mb-1">版本号 (Version Badge)</label>
                      <input
                        type="text"
                        value={postVersion}
                        onChange={(e) => setPostVersion(e.target.value)}
                        placeholder="例如: v1.0.1"
                        className="w-full p-2 bg-white rounded-lg border border-[#CBDCC7] text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5A7259] mb-1">边框预设样式 (Border Preset)</label>
                      <select
                        value={postBorderPreset}
                        onChange={(e) => setPostBorderPreset(e.target.value as any)}
                        className="w-full p-2 bg-white rounded-lg border border-[#CBDCC7] text-xs focus:outline-none"
                      >
                        <option value="none">无 (None)</option>
                        <option value="solid">单色边框 (Solid Color)</option>
                        <option value="striped">双色条纹边框 (Striped)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#5A7259] mb-1">边缘主题色 (Theme Color)</label>
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="color"
                          value={postLeftBorderColor || "#2ECC71"}
                          onChange={(e) => setPostLeftBorderColor(e.target.value)}
                          className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0"
                        />
                        <input
                          type="text"
                          value={postLeftBorderColor}
                          onChange={(e) => setPostLeftBorderColor(e.target.value)}
                          placeholder="#2ECC71"
                          className="flex-1 p-2 bg-white rounded-lg border border-[#CBDCC7] text-xs focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#CBDCC7]/30">
                    <div>
                      <label className="block text-[11px] font-bold text-[#5A7259] mb-1">倾斜预设 (Card Tilt Preset)</label>
                      <select
                        value={postTiltPreset}
                        onChange={(e) => setPostTiltPreset(e.target.value as any)}
                        className="w-full p-2 bg-white rounded-lg border border-[#CBDCC7] text-xs focus:outline-none"
                      >
                        <option value="random">随机倾斜 (Random Tilt)</option>
                        <option value="none">无倾斜 (No Tilt)</option>
                        <option value="custom">自定义角度 (Custom Angle)</option>
                      </select>
                    </div>
                    {postTiltPreset === "custom" && (
                      <div>
                        <label className="block text-[11px] font-bold text-[#5A7259] mb-1">倾斜角度 (Tilt Angle: -5 到 5 度)</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="range"
                            min="-5"
                            max="5"
                            step="0.5"
                            value={postTiltAngle}
                            onChange={(e) => setPostTiltAngle(Number(e.target.value))}
                            className="flex-grow accent-[#5A7259]"
                          />
                          <span className="text-xs font-mono font-bold text-[#5A7259] min-w-[2.5rem] text-right">
                            {postTiltAngle}°
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsPostFormOpen(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                  >
                    取消 (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={postLoading}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    {postLoading ? "Saving..." : "确认发布 / 保存 (Confirm)"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LIST OF EXISITING CARDS */}
          <div className="space-y-4">
            {posts.slice().sort((a,b) => b.date.localeCompare(a.date)).map((post) => (
              <div 
                key={post.id} 
                className="bg-white rounded-2xl p-4 border border-[#EFECE6] flex flex-col md:flex-row md:items-center justify-between gap-4 soft-shadow hover:border-[#D6C7B7] transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {post.isPinned && (
                      <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 text-[9px] font-bold rounded flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-current" />
                        <span>置顶</span>
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{post.date}</span>
                    <div className="flex gap-1">
                      {post.tags.map(t => (
                        <span key={t} className="text-[9px] text-[#8C7673] bg-[#F4EDE2]/60 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 font-sans leading-relaxed truncate md:max-w-xl">
                    {post.content}
                  </p>
                  {(post.imageUrl || post.videoUrl) && (
                    <div className="flex gap-2 mt-2">
                      {post.imageUrl && <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded flex items-center gap-0.5">📸 Image</span>}
                      {post.videoUrl && <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-0.5">🎥 Video</span>}
                    </div>
                  )}
                </div>

                {/* Card Operation Actions */}
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <button
                    onClick={() => handleEditPostClick(post)}
                    className="p-2 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                    title="Edit card"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id!)}
                    className="p-2 bg-red-50 border border-red-200 text-red-600 rounded-xl hover:bg-red-100 transition-colors cursor-pointer"
                    title="Delete card"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
