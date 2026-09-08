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
  | "talk-play";

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
}

export type ThemePresetId =
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

export interface MatchRule {
  when: Record<string, string>;
  recipeId: string;
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
    primary: "#D85A38",
    primaryHover: "#C04828",
    background: "#FAF6F0",
    surface: "#F2EAE1",
    textDark: "#1A1716",
    textMuted: "#7A726D",
    onSurface: "#1A1716",
    onSurfaceMuted: "#7A726D",
    onPrimary: "#FFF8F4",
    foam: "#FFF6ED",
    pour: "#3C2415",
    perfect: "#2F7A5B",
    cup: "#F7F1EA",
  } satisfies ThemeTokens,
  themePresets: {
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
      },
    },
    terracotta: {
      emoji: "☕",
      label: "Kahve & Terracotta",
      caption: "Sıcak krem zemin, terracotta kiremit",
      config: {
        primary: "#D85A38",
        bg: "#FAF7F2",
        card_bg: "#FFFFFF",
        accent: "#2B1810",
      },
      tokens: {
        primary: "#D85A38",
        primaryHover: "#2B1810",
        background: "#FAF7F2",
        surface: "#FFFFFF",
        textDark: "#1A1716",
        textMuted: "#7A726D",
        onSurface: "#1A1716",
        onSurfaceMuted: "#7A726D",
        onPrimary: "#FFF8F4",
        foam: "#FFF6ED",
        pour: "#3C2415",
        perfect: "#2F7A5B",
        cup: "#F7F1EA",
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
      chooseLead: "Masada ne oynayalım?",
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
      flagLeft: "Red flag",
      flagRight: "Değil",
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
      homeCta: "Ana sayfaya dön",
      gateTitle: "İkram Kuponu Kilitli",
      gateBody:
        "Bu ikram masana özeldir. Kilidi açmak için Google’da bizi değerlendir.",
      gateReturnedBody:
        "Yorumunu gönderdikten sonra buraya dön ve doğrulamayı başlat.",
      gateStepGoogle: "1. Adım: Google’da Değerlendir & Yıldız Ver",
      gateStepConfirm: "Yorumumu Yaptım, Doğrulamayı Başlat",
      gateGoogle: "Google’da Değerlendir & İkramı Aç",
      gateInstagram: "Instagram’da Takip Et ve Kilidi Aç",
      gateVerifying: "Destek algılanıyor…",
      gateStarsCheck: "Google Haritalar eşleşmesi kontrol ediliyor...",
      gateStarsProfile: "Kullanıcı profili ve puan taranıyor...",
      gateStarsReview: "Yeni değerlendirme inceleniyor...",
      gateStarsContent: "Yorum içeriği sistemle doğrulanıyor...",
      gateStarsVerified: "5 Yıldızlı değerlendirme doğrulandı! 🎉",
      gatePinCta: "İkramı Masaya İste (Garson PIN)",
      gateUnlocked: "Kilit açıldı",
      instagramCta: "Kahven demlenirken Instagram’da bize katıl",
      googleCta: "Bizi Google’da Puanla",
      followCta: "Instagram’da Takip Et",
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
    admin: {
      kicker: "İşletmeci masası",
      title: "Kampanya yönetimi",
      loginLead: "Haftalık kanca, pusula soruları, PIN ve sosyal linkler burada.",
      passwordLabel: "Yönetici şifresi",
      passwordPlaceholder: "Şifreni gir",
      loginCta: "Giriş yap",
      loginError: "Şifre uyuşmadı.",
      logout: "Güvenli Çıkış Yap",
      save: "Değişiklikleri Kaydet",
      saved: "Kampanya tüm cihazlara güncellendi.",
      saving: "Kaydediliyor…",
      saveError: "Kayıt Supabase’e yazılamadı. Bağlantını kontrol et.",
      reset: "Varsayılan Ayarlara Dön",
      openApp: "Müşteri akışına dön",
      pinError: "PIN tam dört haneli olmalı.",
      adminPasswordError: "Admin şifresi en az 4 karakter olmalı.",
      durationError: "Süre 1 ile 120 dakika arasında olmalı.",
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
        security: "🔐",
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
    durationMinutes: 15,
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
        title: "Birbirimizi Ne Kadar Tanıyoruz?",
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
        title: "Red Flag mı?",
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
