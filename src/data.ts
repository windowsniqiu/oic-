import { Post, Setting } from "./types";

export const DEFAULT_SETTINGS: Setting = {
  title: "おいこらしょのノート",
  subtitle: "こころのえいようざい。もちもち。",
  avatarUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80", // Cute anime girl drawing placeholder
  topHeroGifUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHIwd3pveDFpY201MDdwYjAwMW51Nzg0NXBscmlwdzUxbjB5OGpyZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/a01Z92pD66WvK/giphy.gif", // Beautiful starry sky landscape loop
  bottomCornerGifUrls: [
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Yxa2gybDZ3bXB4d3drZWU1NnYyMzkwMDlhdDVmd3g5d2I5eHFoZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/v9LrkP3X1vGco/giphy.gif", // Cute chibi cat waving
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHoycmM3dWxlbHcxOGF4MTNpeW1yMGh1c2M2cDFjNXhxODl6bHlwaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/X8baci2gOpX6E/giphy.gif", // Cute spinning bunny
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzB2enNjdWpqcDR0NndlMTUzN3dmdmF4djg1aGFxMTUxbW8wd2w0ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/66r7O7Oq4S8lW/giphy.gif"  // Dancing anime girl
  ],
  activeBottomCornerGifUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Yxa2gybDZ3bXB4d3drZWU1NnYyMzkwMDlhdDVmd3g5d2I5eHFoZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/v9LrkP3X1vGco/giphy.gif",
  scrapbookThreeImages: [
    "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500&auto=format&fit=crop&q=80", // Anime girl gamer
    "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=500&auto=format&fit=crop&q=80", // Beautiful Japanese street night
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=80"  // Colorful illustration
  ],
  socialLinks: [
    {
      id: "youtube",
      title: "YouTube",
      description: "ショート動画、ダンス動画",
      url: "https://youtube.com"
    },
    {
      id: "x",
      title: "X",
      description: "近況、ショート動画",
      url: "https://x.com"
    },
    {
      id: "instagram",
      title: "Instagram",
      description: "ショート動画",
      url: "https://instagram.com"
    },
    {
      id: "tiktok",
      title: "TikTok",
      description: "ショート動画",
      url: "https://tiktok.com"
    },
    {
      id: "giphy",
      title: "GIPHY",
      description: "GIF、ステッカー",
      url: "https://giphy.com"
    },
    {
      id: "bilibili",
      title: "bilibili",
      description: "ショート動画",
      url: "https://bilibili.com"
    }
  ],
  searchPlaceholderName: "Oicolatcho",
  websiteIconUrl: "/src/assets/images/website_icon_1784440258524.jpg"
};

export const DEFAULT_POSTS: Post[] = [
  {
    content: "今年もねこまたさんからお誕生日イラストいただいたー！！",
    imageUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80",
    tags: ["#日記", "#同人作品", "#生日", "#照片"],
    isPinned: true,
    date: "2026.06.09",
    createdAt: 1781116800000
  },
  {
    content: "我发布了一款 OSC 工具，它可以为 VRChat Stream 的标准摄像头添加类似手持相机拍摄时的轻微抖动效果。这款 PC 应用会根据虚拟形象的...",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-city-street-with-neon-lights-and-people-41712-large.mp4",
    tags: ["#最新消息", "#手法", "#电脑"],
    isPinned: false,
    date: "2026.05.12",
    createdAt: 1778611200000
  },
  {
    content: "SpacePinCam更新したよ。プリセット作るのめんどくさかったのでOSC経由で保存できるようにした...",
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80",
    tags: ["#最新消息", "#手法"],
    isPinned: false,
    date: "2026.05.09",
    createdAt: 1778352000000
  },
  {
    content: "現在、剪贴簿中会显示\"下载\"和\"备注\"按钮。我对下载页面设计进行了一些细微的调整，使其与页面风格保持一致。",
    imageUrl: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&auto=format&fit=crop&q=80",
    tags: ["#日記", "#最新消息"],
    isPinned: false,
    date: "2026.05.24",
    createdAt: 1779648000000
  },
  {
    content: "そういえばScrapbookに検索機能つけたよ。これでタグやテキストで絞り込みができるようになりました！",
    tags: ["#最新消息", "#日記"],
    isPinned: false,
    date: "2026.04.13",
    createdAt: 1776038400000
  },
  {
    content: "我发布了一个我自己制作的VRChat小玩意儿。它能将专用摄像头拍摄的视频映射到一个可以追踪头部移动的显示屏上。",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-flying-through-neon-city-tunnel-41662-large.mp4",
    tags: ["#最新消息", "#手法", "#电影"],
    isPinned: false,
    date: "2026.04.01",
    createdAt: 1775001600000
  },
  {
    content: "神秘的镜头（副产品）- 这个很有意思，是测试相机旋转和追踪时候产生的多余算法效果。",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    tags: ["#日記", "#电影"],
    isPinned: false,
    date: "2026.03.18",
    createdAt: 1773792000000
  }
];
