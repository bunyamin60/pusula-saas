export interface TabooCard {
  word: string;
  forbidden: string[];
}

export const TABOO_CARDS: TabooCard[] = [
  {
    word: "ESPRESSO",
    forbidden: ["Kahve", "Sert", "Shot", "Makine", "Küçük"],
  },
  {
    word: "HESAP",
    forbidden: ["Adisyon", "Para", "Ödemek", "Kart", "Bahşiş"],
  },
  {
    word: "WIFI ŞİFRESİ",
    forbidden: ["İnternet", "Modem", "Bağlanmak", "Garson", "Sormak"],
  },
  {
    word: "LATTE",
    forbidden: ["Süt", "Köpük", "Bardak", "Kahve", "Sanat"],
  },
  {
    word: "BARİSTA",
    forbidden: ["Garson", "Kahve", "Makine", "Çalışan", "Sipariş"],
  },
  {
    word: "FİLTRE",
    forbidden: ["Kahve", "Damlama", "Americano", "Bardak", "Sade"],
  },
  {
    word: "TİRAMİSU",
    forbidden: ["Tatlı", "Kakao", "Kedi", "Krema", "İtalyan"],
  },
  {
    word: "KRUVASAN",
    forbidden: ["Tereyağı", "Hamur", "Kahvaltı", "Fransız", "Katmer"],
  },
  {
    word: "MATCHA",
    forbidden: ["Yeşil", "Çay", "Japon", "Toz", "Latte"],
  },
  {
    word: "CHEESECAKE",
    forbidden: ["Peynir", "Tatlı", "Dilimi", "Frambuaz", "Fırın"],
  },
  {
    word: "STORİ",
    forbidden: ["Instagram", "Yirmi dört", "Paylaşmak", "Kamera", "Hikaye"],
  },
  {
    word: "REEL",
    forbidden: ["Video", "Instagram", "Kaydırma", "Müzik", "Kısa"],
  },
  {
    word: "AIRPODS",
    forbidden: ["Kulaklık", "Apple", "Kablosuz", "Kutu", "Müzik"],
  },
  {
    word: "POWERBANK",
    forbidden: ["Şarj", "Pil", "Telefon", "Taşınabilir", "Kablo"],
  },
  {
    word: "SPOTIFY",
    forbidden: ["Müzik", "Çalma", "Yeşil", "Kulaklık", "Şarkı"],
  },
  {
    word: "NETFLIX",
    forbidden: ["Dizi", "Film", "Ekran", "Abonelik", "İzlemek"],
  },
  {
    word: "TOAST",
    forbidden: ["Ekmek", "Kızarmış", "Kahvaltı", "Peynir", "Avokado"],
  },
  {
    word: "SMOOTHIE",
    forbidden: ["Meyve", "Blender", "Pipet", "Soğuk", "Yoğurt"],
  },
  {
    word: "LIMONATA",
    forbidden: ["Limon", "Soğuk", "Şeker", "Yaz", "Bardak"],
  },
  {
    word: "COLD BREW",
    forbidden: ["Soğuk", "Kahve", "Demleme", "Buz", "Sert"],
  },
  {
    word: "FLAT WHITE",
    forbidden: ["Süt", "Avustralya", "Espresso", "Mikro", "Latte"],
  },
  {
    word: "MOCHA",
    forbidden: ["Çikolata", "Kahve", "Süt", "Tatlı", "Kakao"],
  },
  {
    word: "FİNCAN",
    forbidden: ["Bardak", "Kulplu", "Kahve", "Porselen", "Tabak"],
  },
  {
    word: "KÖPÜK",
    forbidden: ["Süt", "Latte", "Kalp", "Üst", "Barista"],
  },
  {
    word: "MASA",
    forbidden: ["Sandalye", "Oturmak", "Numara", "Rezervasyon", "Kafe"],
  },
  {
    word: "BAHŞİŞ",
    forbidden: ["Para", "Garson", "Hesap", "Kart", "Ekstra"],
  },
  {
    word: "PAKET",
    forbidden: ["Takeaway", "Kutu", "Eve", "Getir", "Poşet"],
  },
  {
    word: "QR MENÜ",
    forbidden: ["Kod", "Telefon", "Kamera", "Liste", "Okutmak"],
  },
  {
    word: "DECAF",
    forbidden: ["Kafeinsiz", "Kahve", "Uyku", "Gece", "Hafif"],
  },
  {
    word: "CROFFLE",
    forbidden: ["Kruvasan", "Waffle", "Tatlı", "Kızartma", "Dondurma"],
  },
  {
    word: "DUMPLING",
    forbidden: ["Hamur", "Çin", "Buhar", "Sos", "Lokma"],
  },
  {
    word: "TREND",
    forbidden: ["Viral", "TikTok", "Popüler", "Akım", "Keşfet"],
  },
  {
    word: "CHECK-IN",
    forbidden: ["Konum", "Paylaşmak", "Harita", "Buradayım", "Etiket"],
  },
  {
    word: "BLUETOOTH",
    forbidden: ["Bağlanmak", "Hoparlör", "Kablosuz", "Telefon", "Mavi"],
  },
  {
    word: "MACCHIATO",
    forbidden: ["Kahve", "Süt", "Leke", "Espresso", "İtalyan"],
  },
];

export function shuffleTabooOrder(length = TABOO_CARDS.length): number[] {
  const order = Array.from({ length }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = order[index];
    order[index] = order[swap] ?? current;
    order[swap] = current;
  }
  return order;
}
