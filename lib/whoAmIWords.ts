export type WhoAmICategoryId = "pop" | "legends" | "cafe" | "mix";

export type WhoAmIEntry = {
  name: string;
  category: Exclude<WhoAmICategoryId, "mix">;
};

export const WHOAMI_WORDS: WhoAmIEntry[] = [
  { name: "Bihter Ziyagil", category: "pop" },
  { name: "Polat Alemdar", category: "pop" },
  { name: "Harry Potter", category: "pop" },
  { name: "Wednesday", category: "pop" },
  { name: "Ramiz Dayı", category: "pop" },
  { name: "Barbie", category: "pop" },
  { name: "SüngerBob", category: "pop" },
  { name: "Barış Manço", category: "legends" },
  { name: "Tarkan", category: "legends" },
  { name: "Müslüm Gürses", category: "legends" },
  { name: "Sezen Aksu", category: "legends" },
  { name: "Mozart", category: "legends" },
  { name: "Mona Lisa", category: "legends" },
  { name: "Albert Einstein", category: "legends" },
  { name: "Nikola Tesla", category: "legends" },
  { name: "Fatih Sultan Mehmet", category: "legends" },
  { name: "Kleopatra", category: "legends" },
  { name: "Elon Musk", category: "legends" },
  { name: "Barista", category: "cafe" },
  { name: "Sürekli Ders Çalışan Öğrenci", category: "cafe" },
  { name: "Wi-Fi Şifresi Arayan Müşteri", category: "cafe" },
  { name: "Falcı Teyze", category: "cafe" },
  { name: "Sosyal Medya Fenomeni", category: "cafe" },
];

export const WHOAMI_CATEGORY_IDS: WhoAmICategoryId[] = [
  "pop",
  "legends",
  "cafe",
  "mix",
];

export function whoAmIDeck(category: WhoAmICategoryId): WhoAmIEntry[] {
  const source =
    category === "mix"
      ? WHOAMI_WORDS
      : WHOAMI_WORDS.filter((entry) => entry.category === category);
  const deck = [...source];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = deck[index];
    deck[index] = deck[swap] ?? current;
    deck[swap] = current;
  }
  return deck;
}
