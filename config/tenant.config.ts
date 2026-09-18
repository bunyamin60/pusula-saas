export type CompassIcon =
  | "snowflake"
  | "flame"
  | "milk"
  | "droplets"
  | "cookie"
  | "cherry"
  | "coffee"
  | "flower";

export type FlowStep =
  | "landing"
  | "compass"
  | "match"
  | "game"
  | "reward"
  | "talk-pick"
  | "talk-play"
  | "bill-spin"
  | "quiz-play";

export type ExperienceId = "compass" | "talk";

export type TalkCategoryId = "first-look" | "how-well" | "mix-table";
export type TalkPromptKind = "write" | "redflag";
export type TalkFlagVote = "red" | "green";

export interface TalkPrompt {
  id: string;
  text: string;
  kind: TalkPromptKind;
}

export interface TalkCategory {
  id: TalkCategoryId;
  icon: string;
  title: string;
  caption: string;
  prompts: TalkPrompt[];
}

export interface ThemeTokens {
  primary: string;
  primaryHover: string;
  background: string;
  surface: string;
  textDark: string;
  textMuted: string;
  onSurface: string;
  onSurfaceMuted: string;
  onPrimary: string;
  foam: string;
  pour: string;
  perfect: string;
  cup: string;
  lime: string;
  banner: string;
  border?: string;
}

export type GuestPaletteId =
  | "sun-mint"
  | "cream-pink"
  | "minimal-orange"
  | "modern-purple"
  | "neon-teal"
  | "dark-orange"
  | "midnight-pink"
  | "emerald-gold"
  | "cyber-purple";

export type ThemePresetId =
  | GuestPaletteId
  | "lounge"
  | "cyberpunk"
  | "velvet"
  | "terracotta"
  | "matcha"
  | "slate";
export type TenantCategory = "cafe" | "lounge" | "food" | "general";
export type LogoShape = "circle" | "square";

export interface TenantThemeConfig {
  preset: ThemePresetId;
  primary: string;
  bg: string;
  card_bg: string;
  accent: string;
  logo_shape?: LogoShape;
}

export interface ThemePresetDefinition {
  emoji: string;
  label: string;
  caption: string;
  config: Omit<TenantThemeConfig, "preset">;
  tokens: ThemeTokens;
}

export interface CompassOption {
  id: string;
  label: string;
  caption: string;
  desc?: string;
  icon: CompassIcon;
  tag?: string;
}

export interface CompassQuestion {
  id: string;
  prompt: string;
  title?: string;
  options: CompassOption[];
}

export interface RecipeVisual {
  liquid: string;
  foam: string;
  iced: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  originNote: string;
  notes: string[];
  profile: Record<string, string>;
  visual: RecipeVisual;
  imageUrl?: string;
  tags?: string[];
  tagline?: string;
  tastingNotes?: string[];
  accentColor?: string;
}

export interface CampaignProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  tags: string[];
  match_tags?: string[];
  tagline?: string;
  tastingNotes?: string[];
  accentColor?: string;
}

export type DuelGameId = "trivia" | "emoji" | "swipe" | "number" | "quiz";

export type CatalogGameId =
  | "draw"
  | "quiz"
  | "taboo"
  | "whoami"
  | "blockblast"
  | "talk"
  | "bill";

export type EnabledGames = Record<DuelGameId, boolean> & {
  draw?: boolean;
  talk?: boolean;
  bill?: boolean;
  taboo?: boolean;
  whoami?: boolean;
  blockblast?: boolean;
  pusulaFunnel?: boolean;
};

export interface MatchRule {
  when: Record<string, string>;
  recipeId: string;
}

export interface PlayRewardProgress {
  elapsedSeconds: number;
  isUnlocked: boolean;
  claimedCode: string | null;
  lastPing: number;
  recipeId?: string | null;
}

export interface WheelPrize {
  id: string;
  icon: string;
  label: string;
  caption: string;
  color: string;
  active: boolean;
}

export const tenantConfig = {
  id: "arada_cadde54",
  brand: {
    name: "Arada Kahve Dükkanı",
    location: "Cadde 54 / Serdivan",
    wordmark: "Arada",
    wordmarkLine: "Kahve Dükkanı",
    logoUrl: "/brand/arada/logo.png",
    tagline: "Cadde 54’te, fincanın tam kıvamı.",
    tableName: "Masa #4",
  },
  brandAssets: {
    arada_cadde54: { logoUrl: "/brand/arada/logo.png" },
    boss_lounge: { logoUrl: "/brand/boss-lounge/boss_lounge.png" },
  } as const,
  loungeTenantIds: ["boss_lounge"] as const,
  adminPasswords: {
    arada_cadde54: "arada123",
    boss_lounge: "boss1903",
  } as const,
  duel: {
    enabledGames: {
      trivia: false,
      emoji: false,
      swipe: false,
      number: true,
      quiz: true,
      draw: true,
      talk: true,
      bill: true,
      taboo: true,
      whoami: true,
      blockblast: true,
      pusulaFunnel: true,
    } satisfies EnabledGames,
    nicknames: {
      aliases: [
        { nickname: "Babayiğit", avatar: "🦁" },
        { nickname: "Diva", avatar: "💅" },
        { nickname: "Yakışıklı Güvenlik", avatar: "🕶️" },
        { nickname: "Mahallenin İkonu", avatar: "💎" },
        { nickname: "Masanın CEO’su", avatar: "💼" },
        { nickname: "Sessiz Tehlike", avatar: "🤫" },
        { nickname: "Lokal Fenomen", avatar: "✨" },
        { nickname: "Cool Enişte", avatar: "🧿" },
        { nickname: "Dedikodu Bakanı", avatar: "📣" },
        { nickname: "Fincan Lordu", avatar: "👑" },
        { nickname: "Kahve Kontesi", avatar: "👸" },
        { nickname: "Ağır Abi Latte", avatar: "🥸" },
        { nickname: "Çaktırmadan Ünlü", avatar: "😎" },
        { nickname: "Kriz Masası Başkanı", avatar: "🚨" },
        { nickname: "Ortamın Neşesi", avatar: "🎉" },
        { nickname: "Son Masa Romantiği", avatar: "🌹" },
        { nickname: "Gece Vardiyası", avatar: "🌙" },
        { nickname: "Gizemli Müdavim", avatar: "🕵️" },
        { nickname: "Tatlı Bela", avatar: "🍒" },
        { nickname: "Başrol Enerjisi", avatar: "🎬" },
        { nickname: "Köpük Komutanı", avatar: "🫡" },
        { nickname: "Filtre Kahramanı", avatar: "🦸" },
        { nickname: "Espresso Mafyası", avatar: "☕" },
        { nickname: "VIP Bekleyen", avatar: "🪩" },
      ],
    },
    trivia: [
      {
        prompt: "“İki tane de bizden olsun” repliği hangi internet ikilisini hatırlatır?",
        options: ["Kalt", "Gibi", "Leyla ile Mecnun", "Prens"],
        answer: 0,
      },
      {
        prompt: "Spotify logosunun baskın rengi hangisidir?",
        options: ["Mor", "Yeşil", "Turuncu", "Mavi"],
        answer: 1,
      },
      {
        prompt: "Gibi dizisinin ana karakterlerinden biri hangisidir?",
        options: ["Yılmaz", "Behzat", "Ezel", "Sarp"],
        answer: 0,
      },
      {
        prompt: "“Stonks” internet memesinde hangi aksesuar öne çıkar?",
        options: ["Şapka", "Güneş gözlüğü", "Takım elbise", "Kulaklık"],
        answer: 2,
      },
      {
        prompt: "Bir şarkının tekrar tekrar çalmasına ne denir?",
        options: ["Shuffle", "Loop", "Skip", "Fade"],
        answer: 1,
      },
    ],
    quiz: [
      {
        prompt: "Espresso kelimesi hangi ülkede doğmuştur?",
        options: ["İtalya", "Brezilya", "Etiyopya", "Fransa"],
        answer: 0,
      },
      {
        prompt: "Oscar ödüllerinde En İyi Film kazanan ilk renkli film hangisidir?",
        options: ["Rüzgâr Gibi Geçti", "Casablanca", "Titanic", "Ben-Hur"],
        answer: 0,
      },
      {
        prompt: "Dünyanın yüzölçümü bakımından en büyük ülkesi hangisidir?",
        options: ["Kanada", "Çin", "Rusya", "ABD"],
        answer: 2,
      },
      {
        prompt: "Bir oktav kaç temel nota içerir?",
        options: ["5", "7", "8", "12"],
        answer: 1,
      },
      {
        prompt: "Kahvenin anavatanı kabul edilen ülke hangisidir?",
        options: ["Kolombiya", "Etiyopya", "Vietnam", "Endonezya"],
        answer: 1,
      },
      {
        prompt: "Yüzüklerin Efendisi filmlerini kim yönetmiştir?",
        options: ["James Cameron", "Peter Jackson", "Ridley Scott", "George Lucas"],
        answer: 1,
      },
      {
        prompt: "İstanbul Boğazı hangi iki denizi birbirine bağlar?",
        options: [
          "Karadeniz ve Marmara",
          "Ege ve Akdeniz",
          "Marmara ve Ege",
          "Karadeniz ve Ege",
        ],
        answer: 0,
      },
      {
        prompt: "Freddie Mercury hangi grubun solistiydi?",
        options: ["The Beatles", "Queen", "Nirvana", "Pink Floyd"],
        answer: 1,
      },
    ],
    emoji: [
      {
        emojis: "🚗💨🕶️",
        options: ["Hızlı ve Öfkeli", "Matrix", "Arabalar", "Top Gun"],
        answer: 0,
      },
      {
        emojis: "💔🌧️🎸",
        options: ["Duman", "Athena", "Manga", "Mor ve Ötesi"],
        answer: 0,
      },
      {
        emojis: "👑⚔️🐉",
        options: ["Prens", "Game of Thrones", "Vikings", "The Witcher"],
        answer: 1,
      },
      {
        emojis: "🏠🎈👴",
        options: ["Yukarı Bak", "Coco", "Ters Yüz", "Oyuncak Hikâyesi"],
        answer: 0,
      },
    ],
    swipe: [
      { text: "Ahtapotların üç kalbi vardır.", answer: true },
      { text: "Venüs, Güneş Sistemi’nin en sıcak gezegenidir.", answer: true },
      { text: "Penguenler Kuzey Kutbu’nda yaşar.", answer: false },
      { text: "Bal, uygun koşullarda binlerce yıl bozulmadan kalabilir.", answer: true },
      { text: "İnsan vücudundaki en büyük organ kalptir.", answer: false },
      { text: "Kahve çekirdeği aslında bir meyvenin çekirdeğidir.", answer: true },
      { text: "Şimşek hiçbir zaman aynı yere iki kez düşmez.", answer: false },
      { text: "Bir gün 86.400 saniyedir.", answer: true },
      { text: "Develer hörgüçlerinde su depolar.", answer: false },
      { text: "Muz botanik olarak bir meyvedir.", answer: true },
      { text: "Ses boşlukta yayılabilir.", answer: false },
      { text: "Dünyanın en büyük okyanusu Pasifik’tir.", answer: true },
    ],
    draw: {
      colors: [
        { id: "black", hex: "#1A1716" },
        { id: "red", hex: "#C62828" },
        { id: "blue", hex: "#1565C0" },
      ],
      brushes: { thin: 3, thick: 9 },
      winScore: 100,
      guessPoints: [25, 18, 12, 8, 5],
      painterBonus: 10,
      words: [
        "Kruvasan",
        "Filtre kahve",
        "San Sebastian",
        "Cortado",
        "Havuçlu kek",
        "Cheesecake",
        "Cold brew",
        "Latte art",
        "Kurabiye",
        "Tiramisu",
        "Espresso",
        "Flat white",
        "Americano",
        "Mocha",
        "Macchiato",
        "Türk kahvesi",
        "Sahlep",
        "Simit",
        "Poğaça",
        "Brownie",
        "Fincan",
        "Kahve değirmeni",
        "Pipet",
        "Peçetelik",
        "Masa numarası",
        "Barista önlüğü",
        "POS cihazı",
        "Karafe",
        "Chemex",
        "French press",
        "Süt jug",
        "Demlik",
        "Tepsi",
        "Şekerlik",
        "Menü tahtası",
        "Hesap ödeme",
        "Wifi şifresi",
        "İlk buluşma",
        "Dedikodu",
        "Fal bakma",
        "Self servis",
        "Priz aramak",
        "Bahşiş bırakmak",
        "Laptop açmak",
        "Rezervasyon",
        "Kasa kuyruğu",
        "Masa birleştirmek",
        "Barista",
        "Vitrin tatlısı",
        "Ice latte",
        "Matcha",
        "Affogato",
        "Croissant",
        "Bagel",
        "Granola kase",
      ],
    },
  },
  assets: {
    hookahGif: "/hookah.gif",
  },
  hookah: {
    accents: {
      ice: "#00D2FF",
      berry: "#FF2A6D",
      mint: "#05FFA1",
    },
  },
  theme: {
    primary: "#ffd803",
    primaryHover: "#f0c800",
    background: "#fffffe",
    surface: "#e3f6f5",
    textDark: "#272343",
    textMuted: "#2d334a",
    onSurface: "#272343",
    onSurfaceMuted: "#2d334a",
    onPrimary: "#272343",
    foam: "#bae8e8",
    pour: "#ffd803",
    perfect: "#ffd803",
    cup: "#e3f6f5",
    lime: "#ffd803",
    banner: "#bae8e8",
  } satisfies ThemeTokens,
  themePresets: {
    "sun-mint": {
      emoji: "",
      label: "Güneş & Su Yeşili",
      caption: "Varsayılan ferah arcade paleti",
      config: {
        primary: "#ffd803",
        bg: "#fffffe",
        card_bg: "#e3f6f5",
        accent: "#272343",
      },
      tokens: {
        primary: "#ffd803",
        primaryHover: "#f0c800",
        background: "#fffffe",
        surface: "#e3f6f5",
        textDark: "#272343",
        textMuted: "#2d334a",
        onSurface: "#272343",
        onSurfaceMuted: "#2d334a",
        onPrimary: "#272343",
        foam: "#bae8e8",
        pour: "#ffd803",
        perfect: "#ffd803",
        cup: "#e3f6f5",
        lime: "#ffd803",
        banner: "#bae8e8",
      },
    },
    "cream-pink": {
      emoji: "",
      label: "Krem & Pudra Pembe",
      caption: "Sıcak krem zemin, pudra buton",
      config: {
        primary: "#f582ae",
        bg: "#fef6e4",
        card_bg: "#8bd3dd",
        accent: "#001858",
      },
      tokens: {
        primary: "#f582ae",
        primaryHover: "#ef6d9e",
        background: "#fef6e4",
        surface: "#8bd3dd",
        textDark: "#001858",
        textMuted: "#172c66",
        onSurface: "#001858",
        onSurfaceMuted: "#172c66",
        onPrimary: "#001858",
        foam: "#c3ecf1",
        pour: "#f582ae",
        perfect: "#f582ae",
        cup: "#8bd3dd",
        lime: "#f582ae",
        banner: "#c3ecf1",
      },
    },
    "minimal-orange": {
      emoji: "",
      label: "Minimalist Turuncu",
      caption: "Açık gri zemin, turuncu vurgu",
      config: {
        primary: "#ff8e3c",
        bg: "#eff0f3",
        card_bg: "#ffffff",
        accent: "#0d0d0d",
      },
      tokens: {
        primary: "#ff8e3c",
        primaryHover: "#f07d2b",
        background: "#eff0f3",
        surface: "#ffffff",
        textDark: "#0d0d0d",
        textMuted: "#2a2a2a",
        onSurface: "#0d0d0d",
        onSurfaceMuted: "#2a2a2a",
        onPrimary: "#0d0d0d",
        foam: "#ffffff",
        pour: "#ff8e3c",
        perfect: "#ff8e3c",
        cup: "#ffffff",
        lime: "#ff8e3c",
        banner: "#ffffff",
      },
    },
    "modern-purple": {
      emoji: "",
      label: "Modern Mor",
      caption: "Beyaz zemin, mor buton",
      config: {
        primary: "#6246ea",
        bg: "#fffffe",
        card_bg: "#d1d1e9",
        accent: "#fffffe",
      },
      tokens: {
        primary: "#6246ea",
        primaryHover: "#5138d4",
        background: "#fffffe",
        surface: "#d1d1e9",
        textDark: "#2b2c34",
        textMuted: "#2b2c34",
        onSurface: "#2b2c34",
        onSurfaceMuted: "#2b2c34",
        onPrimary: "#fffffe",
        foam: "#e7e7f4",
        pour: "#6246ea",
        perfect: "#6246ea",
        cup: "#d1d1e9",
        lime: "#6246ea",
        banner: "#e7e7f4",
      },
    },
    "neon-teal": {
      emoji: "",
      label: "Neon Turkuaz & Kırmızı",
      caption: "Turkuaz buton, kırmızı kart",
      config: {
        primary: "#00ebc7",
        bg: "#fffffe",
        card_bg: "#ff5470",
        accent: "#00214d",
      },
      tokens: {
        primary: "#00ebc7",
        primaryHover: "#00d4b3",
        background: "#fffffe",
        surface: "#ff5470",
        textDark: "#00214d",
        textMuted: "#1b2d45",
        onSurface: "#fffffe",
        onSurfaceMuted: "#fffffe",
        onPrimary: "#00214d",
        foam: "#ffd0d8",
        pour: "#00ebc7",
        perfect: "#00ebc7",
        cup: "#ff5470",
        lime: "#00ebc7",
        banner: "#ffd0d8",
      },
    },
    "dark-orange": {
      emoji: "",
      label: "Gece & Neon Turuncu",
      caption: "Sıcak gece modu",
      config: {
        primary: "#ff8906",
        bg: "#0f0e17",
        card_bg: "#1b1928",
        accent: "#f25f4c",
      },
      tokens: {
        primary: "#ff8906",
        primaryHover: "#f25f4c",
        background: "#0f0e17",
        surface: "#1b1928",
        textDark: "#fffffe",
        textMuted: "#a7a9be",
        onSurface: "#fffffe",
        onSurfaceMuted: "#a7a9be",
        onPrimary: "#fffffe",
        foam: "#242233",
        pour: "#ff8906",
        perfect: "#f25f4c",
        cup: "#1b1928",
        lime: "#ff8906",
        banner: "#1b1928",
        border: "rgba(255, 255, 255, 0.12)",
      },
    },
    "midnight-pink": {
      emoji: "",
      label: "Gece Mavisi & Pudra",
      caption: "Soft gece arcade",
      config: {
        primary: "#eebbc3",
        bg: "#232946",
        card_bg: "#121629",
        accent: "#fffffe",
      },
      tokens: {
        primary: "#eebbc3",
        primaryHover: "#fffffe",
        background: "#232946",
        surface: "#121629",
        textDark: "#fffffe",
        textMuted: "#b8c1ec",
        onSurface: "#fffffe",
        onSurfaceMuted: "#b8c1ec",
        onPrimary: "#232946",
        foam: "#1a1f38",
        pour: "#eebbc3",
        perfect: "#eebbc3",
        cup: "#121629",
        lime: "#eebbc3",
        banner: "#121629",
        border: "rgba(255, 255, 255, 0.1)",
      },
    },
    "emerald-gold": {
      emoji: "",
      label: "Zümrüt & Altın",
      caption: "Derin yeşil kontrast",
      config: {
        primary: "#f9bc60",
        bg: "#004643",
        card_bg: "#0c3836",
        accent: "#e16162",
      },
      tokens: {
        primary: "#f9bc60",
        primaryHover: "#e16162",
        background: "#004643",
        surface: "#0c3836",
        textDark: "#fffffe",
        textMuted: "#abd1c6",
        onSurface: "#fffffe",
        onSurfaceMuted: "#abd1c6",
        onPrimary: "#001e1d",
        foam: "#0a524e",
        pour: "#f9bc60",
        perfect: "#e16162",
        cup: "#0c3836",
        lime: "#f9bc60",
        banner: "#0c3836",
        border: "rgba(171, 209, 198, 0.2)",
      },
    },
    "cyber-purple": {
      emoji: "",
      label: "Mat Siyah & Neon Mor",
      caption: "Cyberpunk arcade",
      config: {
        primary: "#7f5af0",
        bg: "#16161a",
        card_bg: "#242629",
        accent: "#2cb67d",
      },
      tokens: {
        primary: "#7f5af0",
        primaryHover: "#2cb67d",
        background: "#16161a",
        surface: "#242629",
        textDark: "#fffffe",
        textMuted: "#94a1b2",
        onSurface: "#fffffe",
        onSurfaceMuted: "#94a1b2",
        onPrimary: "#fffffe",
        foam: "#2c2e33",
        pour: "#7f5af0",
        perfect: "#2cb67d",
        cup: "#242629",
        lime: "#2cb67d",
        banner: "#242629",
        border: "rgba(255, 255, 255, 0.12)",
      },
    },
    lounge: {
      emoji: "💠",
      label: "Duman & Neon Cyan",
      caption: "Koyu zemin, neon buz mavisi",
      config: {
        primary: "#00D2FF",
        bg: "#0B0C10",
        card_bg: "#16181F",
        accent: "#E6F8FF",
      },
      tokens: {
        primary: "#00D2FF",
        primaryHover: "#E6F8FF",
        background: "#0B0C10",
        surface: "#16181F",
        textDark: "#F8FAFC",
        textMuted: "#D6D3D1",
        onSurface: "#F8FAFC",
        onSurfaceMuted: "#D6D3D1",
        onPrimary: "#0B0C10",
        foam: "#1A1D26",
        pour: "#E6F8FF",
        perfect: "#05FFA1",
        cup: "#16181F",
        lime: "#CCFF00",
        banner: "#190A36",
      },
    },
    cyberpunk: {
      emoji: "💗",
      label: "Cyberpunk & Fuşya",
      caption: "Gece kulübü ve lounge için neon pembe/mor",
      config: {
        primary: "#FF2A6D",
        bg: "#0D0221",
        card_bg: "#190A36",
        accent: "#FFE5EC",
      },
      tokens: {
        primary: "#FF2A6D",
        primaryHover: "#FFE5EC",
        background: "#0D0221",
        surface: "#190A36",
        textDark: "#F8FAFC",
        textMuted: "#D6D3D1",
        onSurface: "#F8FAFC",
        onSurfaceMuted: "#D6D3D1",
        onPrimary: "#0D0221",
        foam: "#24104A",
        pour: "#FFE5EC",
        perfect: "#05FFA1",
        cup: "#190A36",
        lime: "#CCFF00",
        banner: "#24104A",
      },
    },
    velvet: {
      emoji: "👑",
      label: "Velvet & Gold",
      caption: "Koyu siyah zemin, lüks altın sarısı",
      config: {
        primary: "#D4AF37",
        bg: "#121212",
        card_bg: "#1E1E1E",
        accent: "#FFF8E7",
      },
      tokens: {
        primary: "#D4AF37",
        primaryHover: "#FFF8E7",
        background: "#121212",
        surface: "#1E1E1E",
        textDark: "#F8FAFC",
        textMuted: "#D6D3D1",
        onSurface: "#F8FAFC",
        onSurfaceMuted: "#D6D3D1",
        onPrimary: "#121212",
        foam: "#2A2A2A",
        pour: "#FFF8E7",
        perfect: "#D4AF37",
        cup: "#1E1E1E",
        lime: "#CCFF00",
        banner: "#2A2A2A",
      },
    },
    terracotta: {
      emoji: "☕",
      label: "Happy Hues Light Arcade",
      caption: "Ferah açık zemin, sarı vurgu, su yeşili kart",
      config: {
        primary: "#ffd803",
        bg: "#fffffe",
        card_bg: "#e3f6f5",
        accent: "#bae8e8",
      },
      tokens: {
        primary: "#ffd803",
        primaryHover: "#f0c800",
        background: "#fffffe",
        surface: "#e3f6f5",
        textDark: "#272343",
        textMuted: "#2d334a",
        onSurface: "#272343",
        onSurfaceMuted: "#2d334a",
        onPrimary: "#272343",
        foam: "#bae8e8",
        pour: "#ffd803",
        perfect: "#ffd803",
        cup: "#e3f6f5",
        lime: "#ffd803",
        banner: "#bae8e8",
      },
    },
    matcha: {
      emoji: "🌿",
      label: "Fresh & Matcha",
      caption: "Doğal kum zemin, matcha yeşili",
      config: {
        primary: "#2D5A27",
        bg: "#F5F5EE",
        card_bg: "#FFFFFF",
        accent: "#1F3D1A",
      },
      tokens: {
        primary: "#2D5A27",
        primaryHover: "#1F3D1A",
        background: "#F5F5EE",
        surface: "#FFFFFF",
        textDark: "#1C1A14",
        textMuted: "#6F6A5C",
        onSurface: "#1C1A14",
        onSurfaceMuted: "#6F6A5C",
        onPrimary: "#F7F4EA",
        foam: "#F7F2E6",
        pour: "#2A3B1C",
        perfect: "#2F7A5B",
        cup: "#F6F1E6",
        lime: "#CCFF00",
        banner: "#ECFCCB",
      },
    },
    slate: {
      emoji: "🌃",
      label: "Midnight Slate",
      caption: "Derin lacivert antrasit, gök mavisi",
      config: {
        primary: "#38BDF8",
        bg: "#0F172A",
        card_bg: "#1E293B",
        accent: "#F1F5F9",
      },
      tokens: {
        primary: "#38BDF8",
        primaryHover: "#F1F5F9",
        background: "#0F172A",
        surface: "#1E293B",
        textDark: "#F8FAFC",
        textMuted: "#D6D3D1",
        onSurface: "#F8FAFC",
        onSurfaceMuted: "#D6D3D1",
        onPrimary: "#0F172A",
        foam: "#243044",
        pour: "#F1F5F9",
        perfect: "#38BDF8",
        cup: "#1E293B",
        lime: "#CCFF00",
        banner: "#1E293B",
      },
    },
  } satisfies Record<ThemePresetId, ThemePresetDefinition>,
  copy: {
    splash: {
      message: "Hazırlanıyor...",
      messageTemplate: "{brand} lezzetleri hazırlanıyor...",
      hookahSrc: "/hookah.gif",
    },
    landing: {
      kickerTemplate: "{brand} Masalarına Özel",
      kicker: "Cadde 54 Masalarına Özel Etkinlik",
      greeting: "Damak zevkin bugün hangi fincanda saklı?",
      greetingAccent: "hangi fincanda saklı?",
      subhead:
        "30 saniyede sana özel reçeteyi bul, baristanın ikramını masana taşı.",
      byCategory: {
        cafe: {
          greeting: "Damak zevkin bugün hangi fincanda saklı?",
          greetingAccent: "hangi fincanda saklı?",
          subhead:
            "30 saniyede sana özel reçeteyi bul, baristanın ikramını masana taşı.",
        },
        coffee: {
          greeting: "Damak zevkin bugün hangi fincanda saklı?",
          greetingAccent: "hangi fincanda saklı?",
          subhead:
            "30 saniyede sana özel reçeteyi bul, baristanın ikramını masana taşı.",
        },
        lounge: {
          greeting: "Dumanın ritmi hangi karışımda saklı?",
          greetingAccent: "hangi karışımda saklı?",
          subhead:
            "Kısa bir turda sana özel öneriyi bul, masandaki ikramı aç.",
        },
        food: {
          greeting: "Damak zevkin bugün hangi tabağında saklı?",
          greetingAccent: "hangi tabağında saklı?",
          subhead:
            "Kısa bir turda sana özel öneriyi bul, masandaki ikramı aç.",
        },
        general: {
          greeting: "Damak zevkin bugün hangi lezzette saklı?",
          greetingAccent: "hangi lezzette saklı?",
          subhead:
            "Kısa bir turda sana özel öneriyi bul, masandaki ikramı aç.",
        },
      },
      cta: "Damak Pusulasını Başlat",
      clubTitle: "Masa Eğlence Kulübü",
      clubLead:
        "Masada oyna, kapış, 20 dakikayı doldurunca baristanın ikramını kap.",
      heroFallbackTitle: "Masa Eğlence Kulübü",
      heroFallbackSubtitle:
        "20 dakika oyun oyna, baristanın ikramını masana taşı",
      venueLine: "{table} • {brand}",
      hallTitle: "{brand} • {hall}",
      hallName: "Dijital Oyun Salonu",
      loginBanner: "Skorlarını ve ödüllerini kaydetmek için giriş yap",
      loginCta: "Giriş Yap",
      authTitle: "Skorlarını ve Ödüllerini Kaydet",
      authName: "İsim veya Lakap",
      authPhone: "Telefon Numarası / E-posta",
      authSubmit: "Giriş Yap",
      authBadge: "Müdavim: {name}",
      welcomeBadge: "Hoş geldin, {name} 👋",
      welcomeLead:
        "Hoş geldin! Oyununu seç, siparişin gelene kadar oyna.",
      playCta: "Oyunlara Başla",
      welcomeBack: "Geri",
      googleReviewChip: "Google'da Değerlendir",
      instagramChip: "Instagram",
      instagramHandle: "@{handle}",
      tabs: {
        games: "Oyunlar",
        events: "Etkinlikler",
        surveys: "Anketler",
      },
      eventsEmpty: "Bu mekânda henüz etkinlik yok.",
      surveysEmpty: "Bu mekânda henüz anket yok.",
      race: {
        kicker: "Günün Rekabeti • Top 5",
        title: "Kafenin Bilgi Ustaları",
        cta: "Bilgi Yarışmasına Katıl →",
        loading: "Sıralama hazırlanıyor…",
        empty: "İlk rekoru sen bırak.",
        points: "{score} puan",
      },
      blastRace: {
        kicker: "Arcade • Top 5",
        title: "Block Blast Efsaneleri (Top 5)",
        cta: "Kendi Rekorunu Kır →",
        loading: "Sıralama hazırlanıyor…",
        empty: "İlk Block Blast rekorunu sen bırak.",
        points: "{score}",
      },
      stamps: {
        title: "{brand} Damga Kartı",
        badge: "{count} / {max} Damga",
        lead: "Her masaya oturduğunda 1 damga kazan, 5. kahven {brand}'dan hediye!",
        gift: "Hediye",
        demo: "Ziyareti Onayla (Demo)",
        rewarded: "5. kahven hediye. Kodun: {code}",
        busy: "Damga işleniyor…",
      },
      gossip: {
        kicker: "Günün Sorusu • Masalar Arası",
        placeholder: "Cevabını yaz…",
        send: "Gönder",
        wait: "Aynı soruya 2 dakikada bir yanıt düşebilir.",
        blocked: "Bu mesaj gönderilemez.",
        empty: "Henüz yanıt yok. İlk düşünceni sen paylaş!",
        hiddenOwn:
          "Son gönderdiğin yanıt denetim kuralları nedeniyle gizlendi. (Kalan süre: {time})",
        offline: "Akış şu an bağlanamadı.",
        noQuestion: "Bugün henüz soru yok.",
        like: "Beğen",
        liked: "Beğenildi",
        counter: "{used}/{max}",
      },
      dock: {
        games: "Oyunlar",
        chat: "Sohbet",
        profile: "Profil & Ödüllerim",
      },
      profileLead: "Masadaki kimliğin bu oturumda skor ve sohbet kartlarında görünür.",
      profileTableLabel: "Mevcut Masa",
      profileCouponsLabel: "Kazanılan Kuponlar",
      profileCouponsEmpty: "Henüz kuponun yok. 20 dakikayı doldurunca burada görünür.",
      profileSave: "Ödülü Telefona Kaydet",
      profileSaveDone: "Kupon panoya kopyalandı",
      profileSaveEmpty: "Kaydedilecek kuponun yok.",
      profileGuest: "Misafir",
      profileLogout: "Çıkış Yap",
      profileDelete: "Hesabımı ve kayıtlarımı sil",
      profileDeleteConfirm: "Emin misin? Sil",
      profileDeleteCancel: "Vazgeç",
      profileDeleteDone: "Kayıtların bu cihazdan silindi.",
      profileSaveFailed: "Kupon kopyalanamadı. İzinleri kontrol et.",
      recoverTitle: "Bir şey ters gitti",
      recoverLead:
        "Sayfa yüklenemedi. Bağlantını kontrol edip tekrar dene.",
      recoverRetry: "Tekrar dene",
      offlineBanner: "Çevrimdışısın. Kayıtlı oyunların bu cihazda duruyor.",
      offlineTitle: "Bağlantı Koptu!",
      offlineLead:
        "Kafenin Wi-Fi ağı biraz dalgalanıyor olabilir. Masanın keyfini kaçırma, bağlantın gelince oyun hazır!",
      offlineRetry: "Tekrar Dene",
      gameShell: {
        back: "← Masaya Dön",
        reset: "Sıfırla / Yeni Oyun",
        resetShort: "Sıfırla",
        tableFallback: "Masa",
        countdownReady: "Hazırlan...",
        countdownGo: "Başla!",
      },
      filters: {
        all: "Tümü",
        cafe: "🔥 Masalar Arası",
        duel: "⚔️ Düellolar",
        together: "☕ Masada Baş Başa",
      },
      showcase: {
        drawBadge: "👥 En az 2 kişi",
        drawTitle: "Çiz & Bil",
        drawCaption: "Kafeyle çiz ve tahmin et",
        drawMono: "ÇB",
        quizBadge: "Tek kişilik",
        quizTitle: "Bilgi Yarışması",
        quizCaption: "Bilgini yarıştır, skoru kap",
        quizMono: "BY",
        tabooBadge: "En az 2 kişi",
        tabooTitle: "Kafe Tabu",
        tabooCaption: "Anlat, yasakları söyleme",
        tabooMono: "KT",
        whoamiBadge: "En az 2 kişi",
        whoamiTitle: "Ben Kimim?",
        whoamiCaption: "Sor, kim olduğunu bul",
        whoamiMono: "BK",
        blockblastBadge: "Tek Kişilik",
        blockblastTitle: "Block Blast",
        blockblastCaption: "Blokları patlat, rekor kır",
        blockblastMono: "BB",
        talkBadge: "En az 2 kişi",
        talkTitle: "Sohbet Kartları",
        talkCaption: "Masada sohbeti aç",
        talkMono: "BK",
        billBadge: "👥 En az 2 kişi",
        billTitle: "Hesap Kimde?",
        billCaption: "Çark çevir, hesabı seç",
        billMono: "HK",
      },
      gameLobby: {
        tableKicker: "Masa Lobisi",
        playersTemplate: "Masada {count} kişi",
        searching: "Masadakiler toplanıyor…",
        start: "Oyunu Başlat",
        join: "Odaya Katıl",
        close: "Kapat",
      },
      duelIcon: "⚔️",
      duelTitle: "Masa Düelloları",
      duelCaption: "Kafedeki diğer oyuncularla 60 saniyelik canlı yarış",
      compassTitle: "Damak Pusulası",
      compassTitleByCategory: {
        cafe: "Damak Pusulası",
        coffee: "Damak Pusulası",
        lounge: "Duman Pusulası",
        food: "Lezzet Pusulası",
        general: "Damak Pusulası",
      },
      compassCaption:
        "Vitrinden seçeceğin tatlının yanına kahven Arada’dan ikram!",
      talkTitle: "Masa Sohbet Kartları",
      talkCaption: "Masadaki sohbeti canlandıracak kart destesi",
      compassIcon: "☕",
      talkIcon: "🃏",
      home: "Ana sayfa",
      openReward: "İkram kuponun duruyor",
      footnote: "Uygulama yok. Kuyruk yok. Sadece bu tarayıcı.",
      socialHint: "Masadayken bize de uğra",
      instagram: "Instagram",
      google: "Google",
    },
    compass: {
      eyebrow: "Damak Pusulası",
      eyebrowByCategory: {
        cafe: "Damak Pusulası",
        coffee: "Damak Pusulası",
        lounge: "Duman Pusulası",
        food: "Lezzet Pusulası",
        general: "Damak Pusulası",
      },
      progressTemplate: "{current}/{total}",
      back: "Geri",
    },
    talk: {
      eyebrow: "Masa Sohbeti",
      pickTitle: "Masanın modu ne?",
      pickLead:
        "İkiniz de kendi telefonunuzdan oynayın. Cevapları yazın, red flag’leri kaydırın, sonda yan yana karşılaştırın.",
      next: "Sonraki kart",
      prev: "Önceki",
      tapHint: "Kaydır veya karta dokun",
      progress: "{current} / {total}",
      writeHint: "Cevabını sen yaz. Karşı taraf kendi telefonunda yazsın.",
      writePlaceholder: "Senin cevabın…",
      writeSave: "Kaydet",
      writeSaved: "Kilitlendi. Telefonları yaklaştırıp bakın.",
      writeEdit: "Düzenle",
      flagHint: "Red flag ise sola kaydır · değilse sağa",
      flagLeft: "Red Flag",
      flagRight: "Pas",
      swipeRed: "RED FLAG",
      swipePass: "PAS",
      tabs: {
        "first-look": "İlk Bakış",
        "how-well": "Derin Sohbet",
        "mix-table": "Red Flag",
      },
      compareTitle: "Senin desten",
      compareLead:
        "Telefonları yan yana getirin. Yazdıklarınızı ve flag’leri karşılaştırın.",
      compareWrites: "Yazdıkların",
      compareFlags: "Flag’lerin",
      compareRed: "Red flag",
      compareGreen: "Green flag",
      emptyAnswer: "—",
      endTitle: "Sıra karşılaştırmada",
      endBody: "İstersen desteyi baştan aç, ya da başka moda geç.",
      again: "Desteyi baştan aç",
      otherMood: "Başka bir mod",
      surpriseEyebrow: "Masaya özel",
      surpriseTitle: "Muhabbet koyulaştı, kahveler tazelensin mi?",
      surpriseBody:
        "Masaya özel 2. siparişte ikram için kuponunu aç.",
      surpriseCta: "İkram Kodunu Aç",
      surpriseSkip: "Kartlara devam",
    },
    match: {
      eyebrow: "GÜNÜN TAVSİYESİ",
      invite: "Bugün bunu denemeye ne dersin?",
      notesLabel: "Tadım notları",
      offer:
        "Vitrinden seçeceğin tatlının yanına bu fincan baristanın ikramı!",
      cta: "İkram Kodunu Aç",
      ctaTemplate: "İkram Kodunu Aç",
      aside: "Tatlı senden, fincan Arada’dan.",
      asideTemplate: "{gift} senden, ikram {brand}’dan.",
      asideGift: {
        cafe: "Tatlı",
        coffee: "Tatlı",
        lounge: "Duman",
        food: "Lezzet",
        general: "Lezzet",
      },
      inactiveNote: "Bu hafta kasada ek bir ikram yok. Fincanın yine senin.",
      backToSelections: "Seçimleri Değiştir",
      restartSelections: "Pek havamda değilim, seçimlerimi güncelle",
      perkBadge: "BU SEÇİME ÖZEL İKRAM",
      perkConditionByCategory: {
        cafe: "Bu fincan, vitrinden seçeceğin tatlı masaya sipariş edildiğinde geçerlidir.",
        coffee: "Bu fincan, vitrinden seçeceğin tatlı masaya sipariş edildiğinde geçerlidir.",
        lounge:
          "İmza Kokteyl Masaya Hediye! (Bu nargile masaya sipariş edildiğinde geçerlidir)",
        food: "Bu öneri, sipariş masaya geldiğinde geçerlidir.",
        general: "Bu öneri, sipariş masaya geldiğinde geçerlidir.",
      },
      ctaOrder: "Siparişi Ver & İkram Kodunu Aç",
      socialInstagram: "Instagram",
      socialMaps: "Harita",
      resetDevice: "Cihaz test hafızasını sıfırla",
      resetDeviceConfirm: "Emin misin? Sil",
      resetDeviceCancel: "Vazgeç",
      resetDeviceDone: "Cihaz kayıtları silindi.",
      demoComplete: "⚡ 20 Dk Tamamla (Demo)",
    },
    taboo: {
      title: "KAFE TABU",
      correctStat: "Doğru: {n}",
      passStat: "Pas: {n}",
      burnStat: "Tabu: {n}",
      burn: "Tabu",
      pass: "Pas (Hak: {n})",
      correct: "Doğru",
      stampCorrect: "DOĞRU",
      stampBurn: "TABU",
      stampPass: "PAS",
      winTitle: "Tebrikler Masanın Yıldızları!",
      winLead: "Sadakat kartına bir damga eklendi.",
      retryTitle: "Güzel deneme!",
      retryLead: "Bir tur daha oynamak ister misiniz?",
      retryCta: "Bir tur daha",
      modeTeams: "Takımlı Maç",
      modeTeamsLead: "Takım A ve Takım B sırayla anlatır. Hedef: {n} puan.",
      modeTable: "Masa Görevi",
      modeTableLead: "60 saniyede 6 doğru bil, masaca kahve damgası kap!",
      teamADefault: "Takım Kırmızı",
      teamBDefault: "Takım Mavi",
      teamALabel: "Takım A",
      teamBLabel: "Takım B",
      howTitle: "Nasıl Oynanır?",
      howTell: "Anlatan kişi telefonu eline alır.",
      howWatch: "Karşı takımdan biri ekrandaki yasak kelimeleri söylerse Tabu’ya basar.",
      setupCta: "Oyunu Kur & Başla",
      turnTitle: "Sıra: {team}",
      readyLead:
        "Telefonu anlatan oyuncu alsın. Rakip takım yasak kelimeleri denetlemek için ekrana baksın!",
      readyCta: "3-2-1 Başla!",
      nextTeamCta: "Sıra {team}’de →",
      roundTitle: "Tur bitti",
      scoreboard: "Skor",
      winnerTitle: "{team} kazandı!",
      tableWinTitle: "Masa görevi tamam!",
      lobbyCta: "Lobiye dön",
      passLeftLabel: "Pas {n}",
      resetCta: "Sıfırla / Yeni Oyun",
    },
    whoami: {
      title: "Ben Kimim?",
      howTitle: "Nasıl Oynanır?",
      howHold:
        "Telefonu alnına yatay tut; ekran karşıdaki arkadaşlarına baksın.",
      howAsk:
        "Alnını aşağı eğince doğru, tavana kaldırınca pas. Karşı taraf taklit yapar veya Evet / Hayır der.",
      startCta: "Devam",
      holdTitle: "Telefonu alnına tut",
      holdLead: "Telefonu alnına yatay tut! Ekran karşıdaki arkadaşlarına baksın.",
      holdCta: "Alnıma Koydum, Başla!",
      pass: "Pas",
      correct: "Doğru",
      tapPass: "Sol: Pas",
      tapCorrect: "Sağ: Doğru",
      flashPass: "PAS",
      flashCorrect: "DOĞRU",
      resetCta: "Sıfırla / Yeni Oyun",
      scoreStat: "Doğru: {n}",
      winTitle: "Tebrikler Masanın Yıldızları!",
      winLead: "Sadakat kartına bir damga eklendi.",
      retryTitle: "Güzel deneme!",
      retryLead: "Bir tur daha oynamak ister misiniz?",
      retryCta: "Bir tur daha",
      lobbyCta: "Kategoriye dön",
      empty: "Kart yok",
      categories: {
        pop: "Pop-Kültür",
        legends: "Efsaneler",
        cafe: "Kafe Tipleri",
        mix: "Karışık",
      },
    },
    blockblast: {
      title: "Block Blast",
      score: "Skor",
      best: "Rekor",
      restart: "Yeniden Başlat",
      dragHint: "Bloğu tahtaya sürükle",
      overTitle: "Game Over",
      overLead: "Tahtada sığacak yer kalmadı.",
      overCta: "Tekrar Oyna",
      exitCta: "Masaya Dön",
      combo: "+{n}",
      comboDouble: "+{n} 💥 DOUBLE!",
      comboTriple: "+{n} 💥 TRIPLE!",
      comboHot: "+{n} 🔥 COMBO x{c}!",
      rewardLead: "Sadakat kartına bir damga eklendi.",
      goalLabel: "Hedef: 10.000 Puan (Ücretsiz Kahve Damgası)",
      rewardGoal: "Efsane Skor! 10.000 barajını aştın, +1 kahve damgası kazandın!",
    },
    duel: {
      entry: "Kafedekilerle Kapış",
      liveBadge: "CANLI",
      lobbyTitle: "Düello Lobisi",
      lobbyLead: "Kafedeki başka bir oyuncuyla anında eşleş.",
      nicknameLabel: "Güvenli lakabın",
      rerollNickname: "Zar At",
      chooseNickname: "Lakap Seç",
      nicknamePickerTitle: "Kült Lakabını Seç",
      nicknamePickerLead: "Kafedeki karakterini seç; hepsi güvenli listeden.",
      selectGameTitle: "Oyun Seç",
      randomGameLabel: "Rastgele",
      randomGameDescription: "Sürpriz oyunla eşleş",
      onlineTemplate: "Şu an kafede {count} oyuncu hazır",
      noPlayers: "Henüz başka hazır oyuncu yok.",
      matchRandom: "Rastgele Rakiple Eşleş",
      connecting: "Canlı lobiye bağlanıyor…",
      unavailable: "Canlı oyun bağlantısı şu anda kullanılamıyor.",
      close: "Lobiyi kapat",
      waitingOpponent: "Rakip oyuna bağlanıyor…",
      connectionFailed: "Bağlantı zaman aşımına uğradı.",
      opponent: "Rakip",
      you: "Sen",
      roundTemplate: "Tur {current}/{total}",
      seconds: "{seconds} sn",
      optionLetters: ["A", "B", "C", "D"],
      true: "DOĞRU",
      false: "YANLIŞ",
      swipeHint: "Sağa doğru, sola yanlış",
      numberPrompt: "1 ile 100 arasında bir sayı tahmin et",
      numberPlaceholder: "Tahminin",
      numberSubmit: "Tahmin Et",
      numberHigher: "DAHA BÜYÜK ↑",
      numberLower: "DAHA KÜÇÜK ↓",
      numberHot: "Çok sıcak!",
      numberWarm: "Yaklaşıyorsun",
      numberCold: "Soğuk",
      winner: "Düelloyu Kazandın!",
      loser: "Bu raund rakibin.",
      tie: "Berabere!",
      rematch: "Rövanş İste",
      rematchIncoming: "Rakip rövanş istiyor…",
      rematchWaiting: "Rövanş yanıtı bekleniyor…",
      opponentReturnedToLobby: "Rakip masaya döndü",
      rematchOpponentLeft:
        "Rakip oyundan ayrıldı, lobiye dönülüyor.",
      returnToTable: "Masaya Dön",
      countdownGo: "BAŞLA!",
      finishedTitle: "Tüm soruları tamamladın! 🎯",
      finishedScoreTemplate:
        "Senin Skorun: {score} — Rakibin bitirmesi bekleniyor…",
      challengeSendingTemplate:
        "{nickname} adlı oyuncuya {game} daveti gönderildi… ({seconds} sn)",
      challengeCancel: "İsteği Geri Çek",
      challengeIncomingTemplate:
        "{nickname} seni {game} düellosuna davet ediyor!",
      challengeAccept: "Kabul Et",
      challengeDecline: "Pas Geç",
      challengeExpired: "Davet kabul edilmedi ya da zaman aşımına uğradı.",
      challengeDeclinedNotice: "Rakip düelloyu pas geçti.",
      challengeCancelledNotice:
        "⚔️ {nickname} düello isteğini geri çekti.",
      opponentDisconnected: "Rakibinin bağlantısı koptu ya da oyundan ayrıldı.",
      claimForfeitWin: "Hükmen Galibiyeti Onayla",
      forfeitWinNote: "Rakibin bağlantısı kesildiği için hükmen kazandın.",
      leaderboardTitle: "Kafenin Bilgi Ustaları",
      leaderboardAllTime: "Tüm Zamanlar · Top 10",
      leaderboardLoading: "Sıralama hazırlanıyor…",
      leaderboardEmpty: "İlk rekoru sen bırak.",
      leaderboardPointsTemplate: "{score} puan",
      leaderboardYou: "Sen",
      leaderboardRankTemplate: "Kafe sıralaman: #{rank}",
      leaderboardRecord: "Yeni kafe rekoru!",
      leaderboardGapTemplate: "Rekora {score} puan kaldı",
      guestPlayer: "{table} Misafiri",
      saveScoreCta: "Bu Skoru Adına Kaydet",
      nextQuestion: "Sonraki Soru →",
      seeResults: "Sonuçları Gör 🏆",
      gameLabels: {
        trivia: "Replik & Pop-Kültür Trivia",
        emoji: "Emojiyle Dizi / Şarkı Tahmini",
        swipe: "Doğru mu / Yanlış mı?",
        number: "Sayıyı Yakala",
        quiz: "Kafe Bilgi Yarışması",
      },
      gameDescriptions: {
        trivia: "Replikleri ve pop kültürü yakala",
        emoji: "Emojilerden doğru cevabı bul",
        swipe: "Hızlı karar ver, seriyi büyüt",
        number: "İpuçlarıyla gizli sayıyı bul",
        quiz: "Genel kültürünü hızınla birleştir",
      },
      draw: {
        title: "Çiz & Bil",
        description: "Birlikte çiz, birlikte bil",
        cafeRoom: "Açık odaya gir",
        cafeRoomHint: "Kod yok. Kafedeki herkes aynı tuvalde.",
        privateRoom: "Özel masa",
        privateRoomHint: "Kendi masanı kur veya arkadaşının koduyla katıl.",
        createPin: "Yeni oda kur",
        createPinHint: "Sana 4 haneli bir kod verir. Arkadaşın o kodla gelir.",
        joinPin: "Koda katıl",
        joinPinHint: "Arkadaşının kodunu yaz",
        pinPlaceholder: "0000",
        pinInvalid: "Dört haneli kodu yaz, sonra katıl.",
        waitingPlayers: "Oyuncular toplanıyor…",
        startGame: "Oyunu Başlat",
        startNeed: "Başlamak için en az {count} kişi gerekir.",
        eraser: "Silgi",
        sharePin: "Bu kodu arkadaşınla paylaş",
        insideCount: "{count} kişi masada",
        roomCode: "Oda kodu {pin}",
        publicRoomBadge: "Açık oda",
        painter: "Ressam",
        guesser: "Tahmin et",
        pickTitle: "Çizeceğin kelimeyi seç",
        pickSeconds: "{seconds} sn",
        nextPainter: "Sıradaki Ressam Belirleniyor...",
        painterPreparing: "Ressam çizmeye hazırlanıyor...",
        secretWord: "Çizeceğin kelime: {word}",
        warnTitle: "Harf, rakam veya yazı çizmek yasaktır!",
        intermission: "ARA",
        restLead: "Dinlenmek için biraz zaman",
        wordWas: "Kelime: {word}",
        nobodyGuessed: "Kimse cevabı bulamadı :(",
        guessedCount: "{count} kişi bildi",
        gameOver: "Oyun bitti",
        winnerLine: "{nickname} kazandı",
        scoreGoal: "Hedef {score} puan",
        hintLabel: "İpucu",
        reportDrawing: "Bu çizimi şikayet etmek istediğine emin misin?",
        reportYes: "Evet",
        reportNo: "Hayır",
        chatTitle: "Cevaplar",
        guessPlaceholder: "Cevabını buraya yaz...",
        guessSend: "Gönder",
        closeGuess: "Çok yaklaştın!",
        correctBanner: "{nickname} doğru cevabı buldu!",
        lockedGuess: "🎉 Doğru bildin! Sıradaki turu bekle.",
        waitingGuesses: "Oyuncuların tahminleri bekleniyor...",
        answersTab: "Cevaplar",
        logsTab: "Kayıtlar",
        logJoined: "{nickname} katıldı",
        logLeft: "{nickname} ayrıldı",
        logVote: "{from}, {target} adlı oyuncuyu atmak için oy verdi",
        logKicked: "{nickname} odadan çıkarıldı",
        logSkip: "{nickname} sırasını kaybetti",
        skippedTitle: "Pasif",
        skippedLead: "{nickname} sırasını kaybetti",
        wordReveal: "Cevap: {word}",
        nextTurn: "Yeni tur",
        nextPainterLabel: "Sıradaki",
        drawingWait: "Çizim bekleniyor",
        turnOf: "{nickname} adlı oyuncunun sırası",
        previousWord: "Önceki turun cevabı: {word}",
        openLogs: "Kayıtlar",
        closeLogs: "Kapat",
        clear: "Temizle",
        undo: "Geri Al",
        thinBrush: "İnce",
        thickBrush: "Kalın",
        leave: "Odadan Çık",
        leaveConfirm: "Oyundan çıkmak istediğine emin misin?",
        leaveYes: "Evet",
        leaveNo: "Hayır",
        voteKick: "Bu oyuncuyu odadan at?",
        voteYes: "At",
        voteNo: "Vazgeç",
        voteProgress: "{votes}/{need} oy",
        kicked: "Odadan oy ile çıkarıldın.",
        mute: "Yoksay",
        unmute: "Aç",
        connecting: "Çizim odasına bağlanıyor…",
        unavailable: "Çizim odası şu anda kullanılamıyor.",
      },
    },
    wheel: {
      eyebrow: "Şans Çarkı",
      title: "Çevir, ikramını gör",
      lead: "Ortadaki düğmeye dokun. Çark durunca kasa kodun açılır.",
      spin: "ÇEVİR",
      spinning: "···",
      won: "Bu senin ikramın",
      backToTalk: "Kartlara dön",
    },
    billWheel: {
      eyebrow: "Hesabı Kim Öder?",
      title: "Çevir, şanslıyı gör",
      lead: "Ortadaki düğmeye dokun. Çark kimin hesabı ödeyeceğini seçer.",
      spin: "ÇEVİR",
      spinning: "···",
      again: "Bir daha çevir",
      close: "Masaya dön",
      resultTitle: "Hesap Bu Masaya Kaldı!",
      resultName: "Hesap {name}'e Kaldı!",
      resultCta: "Bir daha çevir",
      namePlaceholder: "İsim yaz",
      nameAdd: "Ekle",
      nameHint: "Çevirmek için en az 2 kişi ekle.",
      defaultNames: ["Ahmet", "Mehmet", "Barista"],
    },
    reward: {
      congrats: "Fincan senin, ikram masada.",
      liveBadge: "Masada Aktif Oturum",
      screenshotWarning: "Ekran görüntüsü geçersizdir",
      codeLabel: "Kasa kodu",
      timerLabel: "Kalan süre",
      cupLabel: "Günün tavsiyesi",
      validityNote: "Vitrinden seçeceğin tatlının yanında geçerlidir",
      baristaPrompt: "Barista doğrulaması",
      baristaHint: "Kasada yalnızca barista kendi onay kodunu girer.",
      baristaCta: "Kullanıldı olarak işaretle",
      usedTitle: "Bu ikram kasada karşılandı",
      usedBody: "Afiyet olsun. Bir sonraki fincanda pusula yine burada.",
      expiredTitle: "Süre doldu",
      expiredBody:
        "Bu kod artık geçerli değil. Barista’ya bir sor — belki bir sonraki demlemede şansın döner.",
      restartCta: "Yeni bir pusula aç",
      lockedBody:
        "Bu cihazdaki ikram kullanıldı. Süre bitince pusula yeniden açılır.",
      enjoyTitle: "Afiyet Olsun!",
      enjoyRedeemed: "Bu masanın ikramı alındı.",
      homeCta: "Ana sayfaya dön",
      gateTitle: "İkram kuponu",
      gateBody:
        "İkramını açmak için deneyimini Google’da paylaşman yeterli. Puan zorunlu değil.",
      gateReturnedBody:
        "Paylaşımı tamamladıktan sonra bu ekrana dönmen yeterli.",
      gateStepGoogle: "Deneyimini Google’da Paylaş & Kuponu Aç",
      gateStepConfirm: "Paylaşımı tamamladım",
      returningTitle: "Tekrar hoş geldin",
      returningBody: "Kuponun bu cihazda tanımlı. Personel girişi ile ikramı masaya işletebilirsin.",
      cashierHint: "Kupon kodunu kasada baristaya göstermen yeterlidir.",
      enjoyClose: "Kapat",
      gateGoogle: "Deneyimini Google’da Paylaş",
      gateInstagram: "Instagram’da Takip Et",
      gateVerifying: "Google Haritalar yönlendirmesi kontrol ediliyor...",
      gateStarsCheck: "Google Haritalar yönlendirmesi kontrol ediliyor...",
      gateStarsProfile: "Google Haritalar yönlendirmesi kontrol ediliyor...",
      gateStarsReview: "Google Haritalar yönlendirmesi kontrol ediliyor...",
      gateStarsContent: "Google Haritalar yönlendirmesi kontrol ediliyor...",
      gateStarsVerified: "Değerlendirmeniz için teşekkürler! İkram kuponunuz hazır 🎉",
      couponReadyTitle: "Tebrikler! İkramınız Tanımlanmaya Hazır",
      couponReadyBodyByCategory: {
        cafe: "Seçtiğiniz içeceği masaya sipariş ederken bu ekranı servis personeline gösteriniz.",
        coffee:
          "Seçtiğiniz içeceği masaya sipariş ederken bu ekranı servis personeline gösteriniz.",
        lounge:
          "Seçtiğiniz nargileyi masaya sipariş ederken bu ekranı servis personeline gösteriniz.",
        food: "Seçtiğiniz lezzeti masaya sipariş ederken bu ekranı servis personeline gösteriniz.",
        general:
          "Siparişinizi verirken bu ekranı servis personeline gösteriniz.",
      },
      couponStaffCta: "İkramı Tanımlat (Personel Girişi)",
      couponUsedStamp: "Kullanıldı",
      alreadyUsedNotice: "Bu ikram kodu daha önce kullanılmıştır.",
      instagramFollowCta: "Bizi Instagram’da Takip Edin",
      gatePinCta: "İkramı Tanımlat (Personel Girişi)",
      gateUnlocked: "Kilit açıldı",
      instagramCta: "Kahven demlenirken Instagram’da bize katıl",
      googleCta: "Bizi Google’da Puanla",
      followCta: "Instagram’da Takip Et",
    },
    playReward: {
      barLabel: "20 dk oyna, ikramı kap",
      clockTemplate: "{elapsed} / {target}",
      pausedLabel: "Oyun oynayarak süreyi ilerlet ({clock})",
      readyCta: "İkramın hazır",
      readyCtaShort: "İkramın hazır",
      readyOpen: "Al",
      congratsTitle: "İkramın Masanda!",
      congratsBody:
        "20 dakikalık süreyi tamamladın. İkramını nasıl almak istersin?",
      startCompass: "Ne İçeceğime Karar Veremedim (Damak Pusulası)",
      skipFunnelCta: "Kasa Kodunu Göster",
      questionProgress: "{current}/{total}",
      resultEyebrow: "Sana özel reçete",
      directEyebrow: "İkramın hazır",
      resultCompassLead: "Hangisi sana yakışır emin değil misin? Kısa damak testiyle kahveni bul.",
      resultCompassCta: "Damak Pusulası’nı dene",
      couponLabel: "Kasa kodu",
      couponHint: "Kupon kodunu kasada baristaya göstermen yeterlidir.",
      googleOptional: "Kafeyi Google’da değerlendir",
      close: "Kapat",
      back: "Geri",
    },
    pinModal: {
      title: "Barista Onay Kodu",
      warning: "Bu kodu yalnızca servis personeli / barista girmelidir.",
      error: "Hatalı barista kodu",
      cancel: "Vazgeç",
      close: "Kapat",
      success: "Onaylandı",
      deleteLabel: "Sil",
    },
    kasa: {
      kicker: "Kasa",
      title: "Kupon doğrula",
      lead: "Misafirin kodunu yaz, ikramı masaya işle.",
      pinLabel: "Barista PIN",
      pinPlaceholder: "••••",
      pinCta: "Kasayı aç",
      pinError: "PIN uyuşmadı.",
      codeLabel: "Kupon kodu",
      codePlaceholder: "Kupon Kodu (Örn: ARADA-4892)",
      submit: "Kuponu Sorgula & Kullan",
      success: "{table} - İkram Onaylandı!",
      used: "Bu kod daha önce kullanıldı!",
      usedAt: "Bu kod daha önce kullanıldı! (Saat: {time})",
      missing: "Bu kod sistemde yok.",
      offline: "Kasa şu an bağlanamadı. Bağlantını kontrol et.",
      another: "Başka kod sorgula",
    },
    desk: {
      title: "İşletmeci Masası",
      guestView: "← Müşteri Görünümüne Dön",
      logout: "Çıkış",
      tabs: {
        kasa: "Kasa",
        venue: "Mekan",
        gossip: "Soru",
        metrics: "Metrikler",
      },
      kasa: {
        lead: "Kodu yaz, kasadan ikramı onayla.",
        history: "Bugün onaylananlar",
        historyEmpty: "Bugün henüz kupon onaylanmadı.",
        historyTable: "{table}",
      },
      venue: {
        identityTitle: "Görsel Kimlik & Tema",
        brandLabel: "Marka adı",
        brandPlaceholder: "Arada Kahve Dükkanı",
        logoLabel: "Logo URL",
        logoPlaceholder: "https://… veya /brand/arada/logo.png",
        paletteLabel: "Hazır paletler",
        paletteHint:
          "Uygula’ya basınca tüm müşteri ekranları bu palete geçer. Kartlara dokunmak temayı değiştirmez.",
        applyCta: "Uygula",
        activeTheme: "Aktif Tema",
        activeBadge: "✓ Aktif",
        passwordTitle: "Yönetici Şifresini Değiştir",
        passwordCurrent: "Mevcut PIN",
        passwordNew: "Yeni PIN",
        passwordSave: "Kaydet",
        passwordMismatch: "Mevcut şifre uyuşmadı.",
        passwordNeed: "Yeni şifre en az 4 karakter olmalı.",
        passwordSaved: "Şifre güncellendi.",
        palettes: [
          {
            id: "sun-mint",
            label: "Güneş & Su Yeşili",
            caption: "Varsayılan",
          },
          {
            id: "cream-pink",
            label: "Krem & Pudra Pembe",
            caption: "Sıcak krem",
          },
          {
            id: "minimal-orange",
            label: "Minimalist Turuncu",
            caption: "Sade arcade",
          },
          {
            id: "modern-purple",
            label: "Modern Mor",
            caption: "Mor vurgu",
          },
          {
            id: "neon-teal",
            label: "Neon Turkuaz & Kırmızı",
            caption: "Neon kontrast",
          },
          {
            id: "dark-orange",
            label: "Gece & Neon Turuncu",
            caption: "Sıcak gece modu",
          },
          {
            id: "midnight-pink",
            label: "Gece Mavisi & Pudra",
            caption: "Soft gece arcade",
          },
          {
            id: "emerald-gold",
            label: "Zümrüt & Altın",
            caption: "Derin yeşil kontrast",
          },
          {
            id: "cyber-purple",
            label: "Mat Siyah & Neon Mor",
            caption: "Cyberpunk arcade",
          },
        ],
        perkTitle: "☕ İkram Kurgusu & Pusula Tüneli",
        durationLabel: "İkram süresi",
        durationHint: "Misafir oyun oynayarak bu süreyi doldurunca kupon açılır.",
        durationValue: "{minutes} dakika",
        hookLabel: "İkram başlığı",
        hookPlaceholder: "Vitrin tatlısının yanına filtre kahve ikram",
        funnelLabel: "Ödül Öncesi Damak Pusulası Çözdür",
        funnelHint:
          "Açıkken müşteri 20 dk sonunda 3 soruluk damak testini çözer ve önerilen reçeteyi alır. Kapalıyken süre biter bitmez doğrudan kupon kodu çıkar.",
        gamesLabel: "Oyun listesi",
        gamesHint: "Kapalı oyunlar müşteri vitrininde gizlenir.",
        gameLabels: {
          draw: "Çiz & Bil",
          quiz: "Kafe Bilgi Yarışması",
          taboo: "Kafe Tabu",
          whoami: "Ben Kimim?",
          blockblast: "Block Blast",
          talk: "Buz Kırıcı Sohbet Kartları",
          bill: "Hesap Kimde? Çark",
        },
        gameCaptions: {
          draw: "Birlikte çiz, birlikte bil",
          quiz: "Genel kültürünü hızınla birleştir",
          taboo: "Kelimeyi anlat, yasaklıları söyleme",
          whoami: "Arkadaşlarına sor, kim olduğunu tahmin et",
          blockblast: "Blokları yerleştir, satırları patlat",
          talk: "Masada sohbeti başlat",
          bill: "Çark çevir, hesabı seç",
        },
      },
      gossip: {
        title: "Günün Sorusu",
        lead: "Masalara yeni soru yayınla, gelen yanıtları denetle.",
        promptLabel: "Soru metni",
        promptPlaceholder: "Bu masada duyduğun en saçma sipariş neydi?",
        publish: "Yayına Al",
        publishing: "Yayınlanıyor…",
        published: "Soru masalara düştü.",
        publishError: "Soru yayınlanamadı.",
        moderationTitle: "Canlı yanıtlar",
        moderationEmpty: "Henüz yanıt yok.",
        hide: "Gizle / Sil",
        hidden: "Gizlendi",
        offline: "Bağlantı yok.",
      },
      metrics: {
        dwell: "Ortalama Masada Kalma",
        dwellValue: "~{minutes} dk",
        issued: "Üretilen İkram Kuponu",
        redeemed: "Kasada Teslim Edilen İkram",
        empty: "Henüz kupon üretilmedi.",
      },
    },
    admin: {
      kicker: "İşletmeci masası",
      title: "İşletmeci Masası",
      loginLead: "Kasa, ikram süresi, oyunlar ve canlı metrikler tek masada.",
      passwordLabel: "Yönetici şifresi",
      passwordPlaceholder: "Şifreni gir",
      loginCta: "Giriş Yap",
      loginError: "Şifre uyuşmadı.",
      logout: "Çıkış",
      save: "Değişiklikleri Kaydet",
      saved: "Ayarlar tüm cihazlara güncellendi.",
      saving: "Kaydediliyor…",
      saveError: "Kayıt Supabase’e yazılamadı. Bağlantını kontrol et.",
      reset: "Varsayılan Ayarlara Dön",
      openApp: "← Müşteri Görünümüne Dön",
      pinError: "PIN tam dört haneli olmalı.",
      adminPasswordError: "Admin şifresi en az 4 karakter olmalı.",
      durationError: "Süre 10 ile 45 dakika arasında olmalı.",
      fields: {
        hook: {
          label: "Kampanya teklifi",
          hint: "Tavsiye ekranında görünen ikram cümlesi. Örn: tatlı yanında fincan ikramı.",
        },
        alternative: {
          label: "Alternatif ikram metni",
          hint: "Brownie yoksa sunulacak ikinci ikram.",
        },
        duration: {
          label: "Geri sayım süresi (dakika)",
          hint: "Kuponun kasada geçerli kalacağı süre.",
        },
        pin: {
          label: "Kasa barista PIN kodu",
          hint: "Dört haneli. Müşteri görmemeli.",
        },
        adminPassword: {
          label: "Admin paneli şifresi",
          hint: "Boş bırakılırsa girişte barista PIN veya bu mekanın varsayılan şifresi geçerli olur.",
        },
        active: {
          label: "Kampanya durumu",
          on: "Aktif",
          off: "Pasif",
        },
        cta: {
          label: "Öneri ekranı buton metni",
          hint: "Tavsiye ekranındaki turuncu buton. İkram kuponunu açar.",
        },
        wheelIcon: {
          label: "İkon",
          hint: "Dilimde görünen küçük simge.",
        },
        wheelLabel: {
          label: "Ödül başlığı",
          hint: "Çark diliminde 1-2 kelimelik kısa ad.",
        },
        wheelCaption: {
          label: "Kuponda yazacak açıklama",
          hint: "Kasa kodunun altında müşteriye gösterilir.",
        },
        wheelColor: {
          label: "Dilim rengi",
          hint: "Çarktaki dilimin rengi.",
        },
        google: {
          label: "Google Haritalar yorum linki",
          hint: "Sosyal kilitte ve Afiyet Olsun ekranında 5 yıldız yorum sayfasını açar. search.google.com/local/writereview linki kullan.",
          placeholder: "https://search.google.com/local/writereview",
        },
        instagram: {
          label: "Instagram profil linki",
          hint: "Kaydetince giriş, ödül ve teşekkür ekranlarında takip butonu olur.",
          placeholder: "https://instagram.com/aradakahvedukkani",
        },
        landingBadge: {
          label: "Giriş rozeti",
          hint: "Yeşil noktalı üst etiket. Örn: Cadde 54 Masalarına Özel Etkinlik.",
        },
        landingTitle: {
          label: "Ana başlık",
          hint: "Boş bırakırsan kahve veya lounge şablonu otomatik gelir.",
        },
        landingAccent: {
          label: "Başlık vurgu metni",
          hint: "Başlığın turuncu kısmı. Ana başlığın içinde geçmeli.",
        },
        landingSubhead: {
          label: "Alt açıklama",
          hint: "Boş bırakırsan işletme tipine göre varsayılan cümle kullanılır.",
        },
        heroSection: "Karşılama Metinleri (Hero)",
        heroTitle: {
          label: "Ana başlık (hero_title)",
          hint: "Landing’deki büyük karşılama cümlesi. Boşsa kahve veya lounge şablonu kullanılır.",
        },
        heroSubtitle: {
          label: "Alt açıklama (hero_subtitle)",
          hint: "Başlığın altındaki kısa davet. Boşsa işletme tipine göre üretilir.",
        },
        brandName: {
          label: "İşletme adı",
          hint: "Sayfa başlığı ve logo altı metinde görünür.",
        },
        logoUrl: {
          label: "Logo URL’si",
          hint: "Yerel yol (/brand/arada/logo.png veya /brand/boss-lounge/boss_lounge.png) ya da harici görsel adresi.",
        },
        themePreset: {
          label: "Hazır tema",
          hint: "Renk paletini seç. Butonlar, zemin ve kartlar bu temaya bağlanır.",
        },
        logoShape: {
          label: "Logo Şekli",
          hint: "Dairesel rozet nargile/lounge logoları, doğal kare kutu kahve logoları için.",
          circle: "Dairesel Rozet",
          square: "Doğal / Kare",
        },
        category: {
          label: "İşletme tipi",
          hint: "Karşılama metni ve öneri dili bu tipe göre değişir. Kayıt, veritabanındaki category alanına yazılır.",
          cafe: "Kahve dükkanı",
          coffee: "Kahve dükkanı",
          lounge: "Lounge / bar",
          food: "Yemek / burger",
          general: "Genel",
        },
      },
      menuLead: "Düzenlemek istediğin alanı seç. Aşağı kaydırmana gerek yok.",
      stats: {
        quiz: "Pusula Çözen Misafir",
        google: "Google’a Yönlendirilen",
        redeemed: "Teslim Edilen İkram",
        today: "Bugün",
        allTime: "Tüm Zamanlar",
        refresh: "Yenile",
        resetLogs: "Test Verilerini Sıfırla",
        resetLogsConfirm:
          "Bu işletmeye ait tüm test logları silinecek, emin misiniz?",
        resetLogsError: "Loglar silinemedi. Yetki veya bağlantıyı kontrol et.",
      },
      backToMenu: "Kategoriler",
      backToTalk: "Sohbet desteleri",
      sections: {
        theme: "Görsel Kimlik & Tema",
        landing: "Giriş ekranı",
        campaign: "Kampanya & kasa",
        wheel: "Şans Çarkı ödülleri",
        compass: "Damak Pusulası soruları",
        products: "Ürün & Menü Önerileri",
        talk: "Masa Sohbet Kartları",
        social: "Sosyal & haritalar",
        games: "Masa Oyunları & Düello Yönetimi",
        security: "Güvenlik & Giriş Şifresi",
      },
      sectionHints: {
        theme: "İşletme adı, logo ve hazır renk paleti",
        landing: "Rozet, başlık ve karşılama metni",
        campaign: "Teklif, buton metni, PIN, süre ve kampanya durumu",
        wheel: "Çark dilimleri ve ikramlar",
        compass: "Üç pusula sorusu, seçenekler ve filtre etiketleri",
        products: "Ürün adı, görsel ve hangi cevaplarda önerileceği",
        talk: "Yazışmalı sorular ve red flag destesi",
        social: "Instagram ve Google linkleri",
        games: "Canlı masa düellolarını tek tek aç veya kapat",
        security: "Panel giriş şifresini buradan değiştir",
      },
      sectionIcons: {
        theme: "🎨",
        landing: "🏠",
        campaign: "☕",
        wheel: "🎡",
        compass: "🧭",
        products: "🍵",
        talk: "🃏",
        social: "✨",
        games: "⚔️",
        security: "🔐",
      },
      games: {
        title: "Masa Oyunları & Düello Yönetimi",
        lead: "Açık oyunlar müşteri lobisinde anında görünür. Tümünü kapatırsan düello girişi gizlenir.",
        labels: {
          number: "Sayıyı Yakala (Sıcak / Soğuk)",
          quiz: "Kafe Bilgi Yarışması (Genel Kültür)",
          taboo: "Kafe Tabu",
        },
      },
      wheelAdd: "Ödül ekle",
      wheelDelete: "Sil",
      wheelMinError: "En az 4 aktif dilim kalmalı.",
      wheelEmptyLabel: "Yeni ödül",
      talkAdd: "Soru ekle",
      talkDelete: "Sil",
      talkEmptyPrompt: "Yeni sohbet sorusu",
      talkMinError: "Her kategoride en az 3 soru kalmalı.",
      talkPromptLabel: "Kart sorusu",
      talkKindLabel: "Kart tipi",
      talkKindWrite: "İki kişi yazar",
      talkKindFlag: "Red flag kaydır",
      questionTitle: "Soru {n} başlığı",
      optionTitle: "Seçenek {n} başlığı",
      optionCaption: "Seçenek {n} açıklaması",
      optionTag: "Filtre etiketi",
      optionTagHint: {
        cafe: "Örn: Sıcak, Soğuk, Sütlü, Filtre. Kahve eşleşmesi bu etikete bakar.",
        coffee: "Örn: Sıcak, Soğuk, Sütlü, Filtre. Kahve eşleşmesi bu etikete bakar.",
        lounge: "Örn: Buzlu, Meyveli, Ferah, Sert. Ürün ve duman eşleşmesi bu etikete bakar.",
        food: "Örn: Acılı, Peynirli, Tavuk, Et. Menü önerisi bu filtre etiketine bakar.",
        general: "Örn: Tatlı, Ekşi, Hafif. Menü önerisi bu filtre etiketine bakar.",
      },
      productAdd: "Ürün ekle",
      productDelete: "Ürünü sil",
      productName: "Ürün adı",
      productDescription: "Ürün açıklaması",
      productTagline: "Tagline",
      productTaglineHint: "Kartın altındaki kısa satır. Örn: Çift ristretto · mikro köpük",
      productNotes: "Tadım notları",
      productNotesHint: "Her satıra bir not. Sonuç kartında listelenir.",
      productAccent: "Vurgu rengi",
      productAccentHint: "Nargile animasyonunun neon rengi. Örn: #00D2FF",
      productImage: "Görsel",
      productImageHint: "Yerel yol (/products/flat-white.png) veya harici görsel URL’si.",
      productTags: "Bu ürün hangi tercihlerde önerilsin?",
      productTagsHint:
        "Pusula sorularındaki şıklardan işaretle. Öneri, seçilen şıkların etiketleriyle eşleşir.",
      productEmpty: "Yeni ürün",
      productMinError: "En az bir ürün kalmalı.",
    },
  },
  admin: {
    password: "arada123",
  },
  reward: {
    hook: "Vitrinden seçeceğin tatlının yanına kahven Arada’dan ikram!",
    alternativePerk: "Ücretsiz Büyük Boya (Venti) Yükseltme",
    durationMinutes: 20,
    baristaPin: "5454",
    active: true,
    ctaText: "İkram Kodunu Aç",
    googleReviewUrl:
      "https://search.google.com/local/writereview?placeid=ChIJTU8mJJazzBQRNz9tD1UZ_Vs",
    instagramUrl: "https://www.instagram.com/aradakahvedukkani/",
    codePrefix: "ARD-",
    codeDigits: 4,
    displayHash: true,
  },
  playReward: {
    storageKey: "cafe_reward_progress",
    targetSeconds: 1200,
    tickMs: 1000,
    maxCreditSeconds: 2,
    codePrefix: "ARADA-",
    codeLength: 4,
    codeAlphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    barFill: "#ffd803",
    barReady: "#ffd803",
    vibrate: [40, 30, 80, 30, 40],
    questions: [
      {
        id: "strength",
        prompt: "Sertlik tercihin hangisi?",
        options: [
          {
            id: "soft",
            label: "Yumuşak",
            caption: "Kadife gövde, kolay içim.",
            icon: "milk",
          },
          {
            id: "balanced",
            label: "Dengeli",
            caption: "Orta gövde, net denge.",
            icon: "coffee",
          },
          {
            id: "intense",
            label: "Yoğun",
            caption: "Kalın gövde, belirgin kahve.",
            icon: "flame",
          },
        ],
      },
      {
        id: "temp",
        prompt: "Sıcaklık nasıl olsun?",
        options: [
          {
            id: "iced",
            label: "Buzlu",
            caption: "Ferah, buzlu bir yudum.",
            icon: "snowflake",
          },
          {
            id: "hot",
            label: "Sıcak",
            caption: "Avuçları ısıtan fincan.",
            icon: "flame",
          },
        ],
      },
      {
        id: "notes",
        prompt: "Damakta hangi not kalsın?",
        options: [
          {
            id: "fruit",
            label: "Meyvemsi-Asidik",
            caption: "Parlak meyve, canlı asidite.",
            icon: "cherry",
          },
          {
            id: "chocolate",
            label: "Çikolata-Karamel",
            caption: "Yuvarlak, fırın tatlılığı.",
            icon: "cookie",
          },
        ],
      },
    ] satisfies CompassQuestion[],
    recipes: [
      {
        id: "v60-huila",
        name: "V60 Kolombiya Huila",
        originNote: "Tek origin · filtre · kırmızı meyve",
        notes: ["Narenciye kabuğu", "Kırmızı elma", "Temiz, uzun bitiş"],
        profile: { strength: "intense", temp: "hot", notes: "fruit" },
        visual: { liquid: "#6B3A24", foam: "#E8D2B8", iced: false },
      },
      {
        id: "ethiopia-filter",
        name: "Etiyopya Filtre",
        originNote: "Çiçeksi · yumuşak gövde · sıcak demleme",
        notes: ["Jasmine", "Şeftali", "Çay gibi şeffaf kupa"],
        profile: { strength: "soft", temp: "hot", notes: "fruit" },
        visual: { liquid: "#7A4A2C", foam: "#F0DCC4", iced: false },
      },
      {
        id: "balanced-v60",
        name: "Dengeli V60",
        originNote: "Orta gövde · sıcak filtre",
        notes: ["Bal", "Kuru kayısı", "Yuvarlak asidite"],
        profile: { strength: "balanced", temp: "hot", notes: "fruit" },
        visual: { liquid: "#704028", foam: "#EAD4BC", iced: false },
      },
      {
        id: "caramel-cold-brew",
        name: "Karamel Soğuk Demleme",
        originNote: "Soğuk demleme · karamel · buz",
        notes: ["Karamel", "Kakao", "Yumuşak, uzun tatlılık"],
        profile: { strength: "soft", temp: "iced", notes: "chocolate" },
        visual: { liquid: "#5C3A24", foam: "#E8D5C4", iced: true },
      },
      {
        id: "nitro-cold-brew",
        name: "Nitro Soğuk Demleme",
        originNote: "Yoğun gövde · buzsuz kadife",
        notes: ["Bitter çikolata", "Fındık", "Kremamsı nitro"],
        profile: { strength: "intense", temp: "iced", notes: "chocolate" },
        visual: { liquid: "#3C2415", foam: "#D9C4B0", iced: true },
      },
      {
        id: "iced-fruit-filter",
        name: "Buzlu V60",
        originNote: "Soğuk filtre · meyvemsi asidite",
        notes: ["Bergamot", "Kırmızı meyve", "Buzla açılan parlaklık"],
        profile: { strength: "balanced", temp: "iced", notes: "fruit" },
        visual: { liquid: "#8B4A32", foam: "#F3D0D4", iced: true },
      },
      {
        id: "flat-white-play",
        name: "Artisan Flat White",
        originNote: "Çift ristretto · mikro köpük",
        notes: ["Kakao", "Karamel", "İpeksi süt"],
        profile: { strength: "balanced", temp: "hot", notes: "chocolate" },
        visual: { liquid: "#8B5A3C", foam: "#F4E6D4", iced: false },
      },
      {
        id: "ristretto-play",
        name: "Double Ristretto",
        originNote: "Yoğun espresso · kısa fincan",
        notes: ["Bitter çikolata", "Kavrulmuş şeker", "Kalın crema"],
        profile: { strength: "intense", temp: "hot", notes: "chocolate" },
        visual: { liquid: "#3C2415", foam: "#C4A484", iced: false },
      },
    ] satisfies Recipe[],
    rules: [
      { when: { temp: "hot", notes: "fruit", strength: "intense" }, recipeId: "v60-huila" },
      { when: { temp: "hot", notes: "fruit", strength: "soft" }, recipeId: "ethiopia-filter" },
      { when: { temp: "hot", notes: "fruit", strength: "balanced" }, recipeId: "balanced-v60" },
      { when: { temp: "iced", notes: "chocolate", strength: "soft" }, recipeId: "caramel-cold-brew" },
      { when: { temp: "iced", notes: "chocolate" }, recipeId: "nitro-cold-brew" },
      { when: { temp: "iced", notes: "fruit" }, recipeId: "iced-fruit-filter" },
      { when: { temp: "hot", notes: "chocolate", strength: "intense" }, recipeId: "ristretto-play" },
      { when: { temp: "hot", notes: "chocolate" }, recipeId: "flat-white-play" },
    ] satisfies MatchRule[],
    fallbackRecipeId: "flat-white-play",
  },
  billWheel: {
    spinMs: 3800,
    options: [
      { id: "you", icon: "😎", label: "Sen ödersin", caption: "Bu tur hesap sende.", color: "#D85A38" },
      { id: "them", icon: "☕", label: "Karşı taraf", caption: "Karşıdaki fincanı kapar.", color: "#3C2415" },
      { id: "split", icon: "✂️", label: "Hesabı bölün", caption: "Yarı yarıya, kavgasız.", color: "#C4A484" },
      { id: "house", icon: "🎉", label: "Şanslı masa", caption: "Barista bir ikram bakış atar.", color: "#E8D5C4" },
    ],
  },
  wheel: {
    minActive: 4,
    spinMs: 4600,
    celebrateMs: 1600,
    palette: ["#D85A38", "#E8D5C4", "#C4A484", "#3C2415", "#F2EAE1", "#8B5A3C"],
    prizes: [
      {
        id: "brownie-35",
        icon: "🍰",
        label: "Brownie 35₺",
        caption: "Kahvenin yanına fırından brownie 35 TL.",
        color: "#D85A38",
        active: true,
      },
      {
        id: "venti-upgrade",
        icon: "☕",
        label: "Büyük Boy",
        caption: "Ücretsiz büyük boya (Venti) yükseltme.",
        color: "#E8D5C4",
        active: true,
      },
      {
        id: "cookie-25",
        icon: "🍪",
        label: "Cookie 25₺",
        caption: "Kahvenin yanına cookie 25 TL.",
        color: "#C4A484",
        active: true,
      },
      {
        id: "extra-shot",
        icon: "✨",
        label: "Ekstra Shot",
        caption: "Ekstra shot veya şurup ikramı.",
        color: "#3C2415",
        active: true,
      },
      {
        id: "croissant-20",
        icon: "🥐",
        label: "Kruvasan %20",
        caption: "Kruvasanda yüzde 20 indirim.",
        color: "#F2EAE1",
        active: true,
      },
      {
        id: "daily-surprise",
        icon: "🎁",
        label: "Sürpriz İkram",
        caption: "Baristanın günlük sürprizi.",
        color: "#8B5A3C",
        active: true,
      },
    ] satisfies WheelPrize[],
  },
  talk: {
    surpriseAfter: 10,
    minPrompts: 3,
    flagRed: "#C23B3B",
    flagGreen: "#2F7A5B",
    categories: [
      {
        id: "first-look",
        icon: "✨",
        title: "İlk Bakış",
        caption: "İkiniz de yazın, sonra bakın",
        prompts: [
          { id: "fl-1", kind: "write", text: "Karşı tarafta ilk dikkatini çeken ayrıntı neydi?" },
          { id: "fl-2", kind: "write", text: "Bu masada seni en çok ne gülümsetti?" },
          { id: "fl-3", kind: "write", text: "Siparişi / kahvesi onun kişiliği hakkında ne söylüyor?" },
          { id: "fl-4", kind: "write", text: "Bu akşam bir şehri birlikte kaçırabilsek, sen hangisini seçerdin?" },
          { id: "fl-5", kind: "write", text: "Onun gülüşünü tek kelimeyle yaz." },
          { id: "fl-6", kind: "write", text: "Bu sohbetin filmi olsa, afişteki adı ne olurdu?" },
          { id: "fl-7", kind: "write", text: "Kahve soğumadan anlatacağın küçük sırrı yaz." },
          { id: "fl-8", kind: "write", text: "Masadan kalkınca aklında kalacak cümle ne?" },
        ],
      },
      {
        id: "how-well",
        icon: "☕",
        title: "Derin Sohbet",
        caption: "Tahminini yaz, karşı tarafınkiyle kıyasla",
        prompts: [
          { id: "hw-1", kind: "write", text: "Karşı taraf sabah insanı mı, gece kuşu mu? Neden?" },
          { id: "hw-2", kind: "write", text: "Hesabı kim ben bakarım der, kim cüzdanı unutur?" },
          { id: "hw-3", kind: "write", text: "Onun aşk dilini üç kelimeyle yaz." },
          { id: "hw-4", kind: "write", text: "Planı kim bozar, kim kurtarır?" },
          { id: "hw-5", kind: "write", text: "Onu en çok hangi küçük alışkanlığı çileden çıkarır?" },
          { id: "hw-6", kind: "write", text: "Telefon şifresi ne olurdu? Tahminini yaz." },
          { id: "hw-7", kind: "write", text: "Barista zannetseler, kim daha inandırıcı olur?" },
          { id: "hw-8", kind: "write", text: "Son tartışmanızın asıl sebebini tek cümleyle yaz." },
        ],
      },
      {
        id: "mix-table",
        icon: "🚩",
        title: "Red Flag",
        caption: "Sola kaydır: red flag · Sağa kaydır: değil",
        prompts: [
          { id: "rf-1", kind: "redflag", text: "Mesajı görüp saatler sonra cevaplamak" },
          { id: "rf-2", kind: "redflag", text: "Hesabı sürekli karşı tarafa bırakmak" },
          { id: "rf-3", kind: "redflag", text: "Masada telefona gizlice bakmak" },
          { id: "rf-4", kind: "redflag", text: "Eski sevgiliden sadece arkadaşız diye bahsetmek" },
          { id: "rf-5", kind: "redflag", text: "Planı son anda, haber vermeden bozmak" },
          { id: "rf-6", kind: "redflag", text: "Kıskançlık diye her bakışı sorgulamak" },
          { id: "rf-7", kind: "redflag", text: "Kahveni / yemeğini sormadan tatmak" },
          { id: "rf-8", kind: "redflag", text: "Şaka ya deyip kırıcı olmak" },
        ],
      },
    ] satisfies TalkCategory[],
  },
  compass: {
    questions: [
      {
        id: "temp",
        prompt: "Fincanın ısısı nasıl olsun?",
        options: [
          {
            id: "iced",
            label: "Buz Gibi Ferahlatıcı",
            caption: "Buz, parlaklık, yaz gibi bir yudum.",
            icon: "snowflake",
            tag: "Soğuk",
          },
          {
            id: "hot",
            label: "İç Isıtan Sıcak",
            caption: "Avuçları ısıtan, yavaş içilen bir fincan.",
            icon: "flame",
            tag: "Sıcak",
          },
        ],
      },
      {
        id: "body",
        prompt: "Gövdeyi nasıl istersin?",
        options: [
          {
            id: "milky",
            label: "Yumuşak & Bol Sütlü",
            caption: "Kadife dokunuş, espresso geride kalsın.",
            icon: "milk",
            tag: "Sütlü",
          },
          {
            id: "clear",
            label: "Sert & Net Kahve",
            caption: "Çekirdeğin kendisi konuşsun.",
            icon: "droplets",
            tag: "Sade",
          },
        ],
      },
      {
        id: "taste",
        prompt: "Damakta ne kalsın?",
        options: [
          {
            id: "sweet",
            label: "Karamel / Çikolata Tatlılığı",
            caption: "Yuvarlak, rahat, fırın kokulu bir bitiş.",
            icon: "cookie",
            tag: "Yoğun",
          },
          {
            id: "fruity",
            label: "Meyvemsi & Ferahlatıcı Asidite",
            caption: "Çiçeksi, narenciye, canlı bir parlaklık.",
            icon: "cherry",
            tag: "Hafif",
          },
        ],
      },
    ] satisfies CompassQuestion[],
    recipes: [
      {
        id: "iced-white-mocha",
        name: "Iced White Mocha",
        originNote: "Beyaz çikolata · espresso · soğuk süt",
        notes: [
          "Beyaz çikolatanın kadifesi",
          "Espressonun kısa, kavruk omurgası",
          "Buzla açılan yumuşak bir bitiş",
        ],
        profile: { temp: "iced", body: "milky", taste: "sweet" },
        visual: { liquid: "#C4A484", foam: "#F6E7D4", iced: true },
      },
      {
        id: "v60-pour-over",
        name: "Single Origin V60 Pour-Over",
        originNote: "Tek origin · filtre · temiz kupa",
        notes: [
          "Çiçeksi parlaklık, şeffaf gövde",
          "Meyvemsi asidite, uzun tatlılık",
          "Demliğin en sakin hali",
        ],
        profile: { temp: "hot", body: "clear", taste: "fruity" },
        visual: { liquid: "#6B3A24", foam: "#E8D2B8", iced: false },
      },
      {
        id: "berry-hibiscus-punch",
        name: "Berry Hibiscus Punch",
        originNote: "Hibiskus · kırmızı meyve · buz",
        notes: [
          "Hibiskusun ekşi-çiçekli omurgası",
          "Orman meyvesi ve narenciye kabuğu",
          "Kafeinsiz, masaya ferahlık",
        ],
        profile: { temp: "iced", body: "clear", taste: "fruity" },
        visual: { liquid: "#A83A4B", foam: "#F3D0D4", iced: true },
      },
      {
        id: "artisan-flat-white",
        name: "Artisan Flat White",
        originNote: "Çift ristretto · mikro köpük",
        notes: [
          "Yoğun espresso, ipeksi süt",
          "İnce kremanın fındıksı tatlılığı",
          "Küçük fincan, büyük gövde",
        ],
        profile: { temp: "hot", body: "milky", taste: "sweet" },
        visual: { liquid: "#8B5A3C", foam: "#F4E6D4", iced: false },
      },
    ] satisfies Recipe[],
    rules: [
      { when: { temp: "iced", taste: "sweet" }, recipeId: "iced-white-mocha" },
      {
        when: { temp: "iced", taste: "fruity" },
        recipeId: "berry-hibiscus-punch",
      },
      { when: { temp: "hot", body: "milky" }, recipeId: "artisan-flat-white" },
      { when: { temp: "hot", body: "clear" }, recipeId: "v60-pour-over" },
    ] satisfies MatchRule[],
    fallbackRecipeId: "artisan-flat-white",
  },
} as const;

export type TenantConfig = typeof tenantConfig;
export type RecipeId = (typeof tenantConfig.compass.recipes)[number]["id"];
