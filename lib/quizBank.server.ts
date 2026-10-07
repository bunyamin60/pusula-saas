import "server-only";

import type { QuizCategoryId } from "@/lib/quizBank";

type RawQuizQuestion = {
  prompt: string;
  options: readonly string[];
  answer: number;
};

type RawQuizCategory = {
  id: QuizCategoryId;
  questions: readonly RawQuizQuestion[];
};

const QUIZ_CATEGORIES = [
      {
        id: "cafe",
        questions: [
          {
            prompt: "Espresso kelimesi hangi ülkede doğmuştur?",
            options: ["İtalya", "Brezilya", "Etiyopya", "Fransa"],
            answer: 0,
          },
          {
            prompt: "Kahvenin anavatanı kabul edilen ülke hangisidir?",
            options: ["Kolombiya", "Etiyopya", "Vietnam", "Endonezya"],
            answer: 1,
          },
          {
            prompt: "Latte’de süt köpüğü genelde ne kadar olur?",
            options: ["Çok az", "İnce bir tabaka", "Yarım fincan", "Sadece köpük"],
            answer: 1,
          },
          {
            prompt: "Americano nasıl yapılır?",
            options: [
              "Sadece sıcak su",
              "Espresso + sıcak su",
              "Süt + espresso",
              "Soğuk demleme",
            ],
            answer: 1,
          },
          {
            prompt: "Türk kahvesi nasıl pişirilir?",
            options: ["Filtre", "Cezvede", "French press", "Kapsül"],
            answer: 1,
          },
          {
            prompt: "Flat white’ın kökeni hangi bölgeye bağlanır?",
            options: ["İskandinavya", "Avustralya / Yeni Zelanda", "Japonya", "Meksika"],
            answer: 1,
          },
          {
            prompt: "Bir shot espresso yaklaşık kaç ml’dir?",
            options: ["10 ml", "30 ml", "90 ml", "200 ml"],
            answer: 1,
          },
          {
            prompt: "Cold brew neyle ilişkilidir?",
            options: [
              "Kaynatılmış kahve",
              "Soğuk uzun demleme",
              "Buharla süt",
              "Anında toz kahve",
            ],
            answer: 1,
          },
        ],
      },
      {
        id: "turkey",
        questions: [
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
            prompt: "Türkiye’nin başkenti neresidir?",
            options: ["İstanbul", "Ankara", "İzmir", "Bursa"],
            answer: 1,
          },
          {
            prompt: "Kapadokya hangi bölgemizdedir?",
            options: ["Karadeniz", "İç Anadolu", "Doğu Anadolu", "Marmara"],
            answer: 1,
          },
          {
            prompt: "Türk mutfağında “menemen” neye benzer?",
            options: ["Çorba", "Yumurtalı sebze sote", "Tatlı", "Pilav"],
            answer: 1,
          },
          {
            prompt: "Anıtkabir hangi şehirdedir?",
            options: ["İstanbul", "Ankara", "Samsun", "Trabzon"],
            answer: 1,
          },
          {
            prompt: "Türkiye’nin en uzun nehri hangisidir?",
            options: ["Kızılırmak", "Fırat", "Sakarya", "Yeşilırmak"],
            answer: 0,
          },
          {
            prompt: "“Lokum” dünyada daha çok hangi adla bilinir?",
            options: ["Baklava", "Turkish delight", "Halva", "Kadayıf"],
            answer: 1,
          },
          {
            prompt: "Efes Antik Kenti hangi ilimiz sınırlarındadır?",
            options: ["Antalya", "İzmir", "Muğla", "Aydın"],
            answer: 1,
          },
        ],
      },
      {
        id: "general",
        questions: [
          {
            prompt: "Oscar’da En İyi Film kazanan ilk renkli film hangisidir?",
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
            prompt: "Yüzüklerin Efendisi filmlerini kim yönetmiştir?",
            options: ["James Cameron", "Peter Jackson", "Ridley Scott", "George Lucas"],
            answer: 1,
          },
          {
            prompt: "Freddie Mercury hangi grubun solistiydi?",
            options: ["The Beatles", "Queen", "Nirvana", "Pink Floyd"],
            answer: 1,
          },
          {
            prompt: "DNA’nın çift sarmal modelini kimler önerdi?",
            options: [
              "Newton–Einstein",
              "Watson–Crick",
              "Curie–Pasteur",
              "Darwin–Mendel",
            ],
            answer: 1,
          },
          {
            prompt: "Pi sayısı yaklaşık kaçtır?",
            options: ["2,14", "3,14", "4,14", "1,41"],
            answer: 1,
          },
          {
            prompt: "Bir yılda yaklaşık kaç gün vardır?",
            options: ["360", "365", "370", "400"],
            answer: 1,
          },
        ],
      },
      {
        id: "sports",
        questions: [
          {
            prompt: "Futbolda bir takım sahada kaç oyuncuyla başlar?",
            options: ["9", "10", "11", "12"],
            answer: 2,
          },
          {
            prompt: "NBA’de bir çeyrek kaç dakikadır?",
            options: ["8", "10", "12", "15"],
            answer: 2,
          },
          {
            prompt: "Olimpiyat bayrağında kaç halka vardır?",
            options: ["3", "4", "5", "6"],
            answer: 2,
          },
          {
            prompt: "Teniste “love” ne anlama gelir?",
            options: ["15 puan", "Sıfır puan", "Set sonu", "Avantaj"],
            answer: 1,
          },
          {
            prompt: "Maraton mesafesi yaklaşık kaç km’dir?",
            options: ["21", "32", "42", "50"],
            answer: 2,
          },
          {
            prompt: "Voleybolda bir takım sahada kaç kişiyle oynar?",
            options: ["5", "6", "7", "8"],
            answer: 1,
          },
          {
            prompt: "Formula 1’de yarışa “pole position” ile başlamak ne demektir?",
            options: [
              "En son sıradan",
              "En önden",
              "Pit’ten",
              "Yedek araçla",
            ],
            answer: 1,
          },
          {
            prompt: "Türkiye’de Süper Lig şampiyonluk kupası hangi branşadır?",
            options: ["Basketbol", "Futbol", "Voleybol", "Hentbol"],
            answer: 1,
          },
        ],
      },
    ] as const satisfies readonly RawQuizCategory[];

export type ServerQuizQuestion = RawQuizQuestion & { id: string };

export function getServerQuizCategory(
  id: QuizCategoryId,
): { id: QuizCategoryId; questions: ServerQuizQuestion[] } | null {
  const category = QUIZ_CATEGORIES.find((entry) => entry.id === id);
  if (!category) return null;
  return {
    id: category.id,
    questions: category.questions.map((question, index) => ({
      ...question,
      id: `${category.id}-${index + 1}`,
    })),
  };
}
