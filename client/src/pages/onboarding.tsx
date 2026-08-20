import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Check, ChevronRight, Sparkles, Dna, Search, Tv, Heart, Zap, Clapperboard, Wand2, Smile, Trophy, Skull, HelpCircle, Crown, Rocket, Video, Palette, Drama, HeartHandshake, Home, BookOpen, Leaf } from "lucide-react";
import { markOnboardingComplete } from "@/components/route-guards";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const DEBATE_POOL_ID = "9d861d7f-2afc-40a8-b132-a78626739347";

const debate = {
  left: {
    name: "Barbie",
    poster: "https://image.tmdb.org/t/p/w300/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
  },
  right: {
    name: "Oppenheimer",
    poster: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
  },
};

// All titles below were verified via the media-search edge function (real ids + posters).
const lovedRows: { label: string; items: { title: string; externalId: string; source: string; poster: string }[] }[] = [
  {
    label: "Movies",
    items: [
      { title: "Harry Potter", externalId: "671", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg" },
      { title: "Wicked", externalId: "402431", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/xDGbZ0JJ3mYaGKy4Nzd9Kph6M9L.jpg" },
      { title: "The Eras Tour", externalId: "1160164", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/jf3YO8hOqGHCupsREf5qymYq1n.jpg" },
      { title: "Dune: Part Two", externalId: "693134", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg" },
      { title: "Inside Out 2", externalId: "1022789", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg" },
      { title: "Top Gun: Maverick", externalId: "361743", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/n0YuM4f5lvGAP6MAW2kBIzugXnc.jpg" },
      { title: "Everything Everywhere All at Once", externalId: "545611", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/u68AjlvlutfEIcpmbYpKcdi09ut.jpg" },
      { title: "Deadpool & Wolverine", externalId: "533535", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg" },
      { title: "Moana 2", externalId: "1241982", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/aLVkiINlIeCkcZIzb7XHzPYgO6L.jpg" },
      { title: "A Minecraft Movie", externalId: "950387", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/yFHHfHcUgGAxziP1C3lLt0q2T4s.jpg" },
      { title: "The Super Mario Bros. Movie", externalId: "502356", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg" },
      { title: "Spider-Man: Across the Spider-Verse", externalId: "569094", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg" },
      { title: "Twisters", externalId: "718821", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/pjnD08FlMAIXsfOLKQbvmO0f0MD.jpg" },
      { title: "The Notebook", externalId: "11036", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/rNzQyW4f8B8cQeg7Dgj3n6eT5k9.jpg" },
      { title: "Interstellar", externalId: "157336", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg" },
    ],
  },
  {
    label: "TV Shows",
    items: [
      { title: "Stranger Things", externalId: "66732", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg" },
      { title: "The Bear", externalId: "136315", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg" },
      { title: "The Last of Us", externalId: "100088", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg" },
      { title: "The Office", externalId: "2316", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg" },
      { title: "Ted Lasso", externalId: "97546", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/5fhZdwP1DVJ0FyVH6vrFdHwpXIn.jpg" },
      { title: "The White Lotus", externalId: "111803", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/gbSaK9v1CbcYH1ISgbM7XObD2dW.jpg" },
      { title: "Severance", externalId: "95396", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg" },
      { title: "Friends", externalId: "1668", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/2koX1xLkpTQM4IZebYvKysFW1Nh.jpg" },
      { title: "Yellowstone", externalId: "73586", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/vOYfRZ0NpUK5hG2CB2dJFnYJlGe.jpg" },
      { title: "Bridgerton", externalId: "91239", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/uXTg565ahu9RwonCX1V2Hex1NU6.jpg" },
      { title: "Wednesday", externalId: "119051", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/36xXlhEpQqVVPuiZhfoQuaY4OlA.jpg" },
      { title: "Game of Thrones", externalId: "1399", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg" },
      { title: "Love Island USA", externalId: "90521", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/kU2y21cls8WargMaX7KI47URMjD.jpg" },
      { title: "Abbott Elementary", externalId: "125935", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/nBe1e3JJEZ6veGrVXNF0fRoLu56.jpg" },
      { title: "Grey's Anatomy", externalId: "1416", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/hjJkrLXhWvGHpLeLBDFznpBTY1S.jpg" },
      { title: "Squid Game", externalId: "93405", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/1QdXdRYfktUSONkl1oD5gc6Be0s.jpg" },
      { title: "Only Murders in the Building", externalId: "107113", source: "tmdb", poster: "https://image.tmdb.org/t/p/w300/1yjFVQZuW8aofZ5Cgol8iImsVFp.jpg" },
    ],
  },
  {
    label: "Books",
    items: [
      { title: "Atomic Habits", externalId: "fFCjDQAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=fFCjDQAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "The Hobbit", externalId: "F2xu1nZOzKoC", source: "googlebooks", poster: "https://books.google.com/books/content?id=F2xu1nZOzKoC&printsec=frontcover&img=1&zoom=2" },
      { title: "Fourth Wing", externalId: "E-OLEAAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=E-OLEAAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "It Ends with Us", externalId: "KmbkCgAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=KmbkCgAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "The Silent Patient", externalId: "tLdiDwAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=tLdiDwAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "A Court of Thorns and Roses", externalId: "E-kdBQAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=E-kdBQAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "The Midnight Library", externalId: "63fYDwAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=63fYDwAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "Onyx Storm", externalId: "Vuv4EAAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=Vuv4EAAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "Lessons in Chemistry", externalId: "PDJBEQAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=PDJBEQAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "Where the Crawdads Sing", externalId: "neUlEAAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=neUlEAAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "Verity", externalId: "TJZWEAAAQBAJ", source: "googlebooks", poster: "https://books.google.com/books/content?id=TJZWEAAAQBAJ&printsec=frontcover&img=1&zoom=2" },
      { title: "The Great Gatsby", externalId: "iXn5U2IzVH0C", source: "googlebooks", poster: "https://books.google.com/books/content?id=iXn5U2IzVH0C&printsec=frontcover&img=1&zoom=2" },
    ],
  },
  {
    label: "Podcasts",
    items: [
      { title: "Serial", externalId: "917918570", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/9a/fb/87/9afb8760-0e05-2b3e-24a2-7e14cce74570/mza_14816055607064169808.jpg/600x600bb.jpg" },
      { title: "Crime Junkie", externalId: "1322200189", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/8c/35/04/8c350430-2fbf-98d0-0a25-00b76550ffeb/mza_13445204151221888086.jpg/600x600bb.jpg" },
      { title: "SmartLess", externalId: "1521578868", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/b1/93/5f/b1935f9f-35be-9144-e813-626bd8dabfb4/mza_4132654708551836825.jpg/600x600bb.jpg" },
      { title: "The Daily", externalId: "1200361736", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ab/64/66/ab6466a9-9a7d-e20e-7a3d-bc5be37d29ce/mza_15084852813176276273.jpg/600x600bb.jpg" },
      { title: "Call Her Daddy", externalId: "1418960261", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/05/10/91/05109145-8c22-5464-1f20-aaedeab769f8/mza_10276081716633787086.jpg/600x600bb.jpg" },
      { title: "New Heights with Jason & Travis Kelce", externalId: "1643745036", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/3a/7b/24/3a7b2444-814b-2ad4-1398-6406514a78a3/mza_6923137187248425375.jpeg/600x600bb.jpg" },
      { title: "The Joe Rogan Experience", externalId: "360084272", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/e6/61/f7/e661f71b-bc22-59df-2292-27cbfd3e8e73/mza_550587729782303948.jpg/600x600bb.jpg" },
      { title: "Dateline NBC", externalId: "1464919521", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/8c/00/7a/8c007a42-e550-0214-d4cb-b59cd7edf194/mza_5305664083935674472.jpeg/600x600bb.jpg" },
      { title: "Armchair Expert", externalId: "1471469906", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/23/b8/2d/23b82dda-a6ce-559a-e23f-749f5ba9a098/mza_11571802223823955980.jpg/600x600bb.jpg" },
      { title: "Stuff You Should Know", externalId: "1861380952", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/2d/24/30/2d2430e7-349b-b22c-d954-1da4dfe10363/mza_18317406832201939159.png/600x600bb.jpg" },
      { title: "Morbid", externalId: "1379959217", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/78/e9/0e/78e90ee0-567d-1ad8-17a0-17d7c988c4bd/mza_8425901783365617933.jpg/600x600bb.jpg" },
    ],
  },
  {
    label: "Music",
    items: [
      { title: "HIT ME HARD AND SOFT", externalId: "1739659134", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg" },
      { title: "Short n' Sweet", externalId: "1752214909", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a1/1c/ca/a11ccab6-7d4c-e041-d028-998bcebeb709/24UMGIM61704.rgb.jpg/600x600bb.jpg" },
      { title: "The Tortured Poets Department", externalId: "1736268219", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/6b/7d/61/6b7d61e4-e6f1-83bc-d645-463aa06b33c4/24UMGIM29563.rgb.jpg/600x600bb.jpg" },
      { title: "GUTS", externalId: "1694767605", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/9e/0d/17/9e0d17e0-c068-fbd9-fd85-610cc87c86aa/23UMGIM71511.rgb.jpg/600x600bb.jpg" },
      { title: "SOS", externalId: "1658650487", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/62/93/13/6293132e-20ff-67ab-3d1f-96bb6797a6ba/196589564955.jpg/600x600bb.jpg" },
      { title: "Midnights", externalId: "1649434996", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/67/b5/01/67b501d5-362e-797e-7dbd-942b9e273084/22UM1IM24801.rgb.jpg/600x600bb.jpg" },
      { title: "1989 (Taylor's Version)", externalId: "1708308989", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/11/a6/80/11a680e6-2e48-08fa-5e87-3f18e838d31f/23UM1IM11868.rgb.jpg/600x600bb.jpg" },
      { title: "COWBOY CARTER", externalId: "1738370746", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c6/9c/17/c69c17df-1835-77e7-58c1-ca04d44a0611/196871853736.jpg/600x600bb.jpg" },
      { title: "One Thing At A Time", externalId: "1818424391", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/82/eb/b3/82ebb3c6-2bd4-31fd-0eb9-57667f3590e1/00602455239419_Cover.jpg/600x600bb.jpg" },
      { title: "Harry's House", externalId: "1615584999", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2a/19/fb/2a19fb85-2f70-9e44-f2a9-82abe679b88e/886449990061.jpg/600x600bb.jpg" },
      { title: "Un Verano Sin Ti", externalId: "1622046238", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/3e/04/eb/3e04ebf6-370f-f59d-ec84-2c2643db92f1/196626945068.jpg/600x600bb.jpg" },
      { title: "eternal sunshine", externalId: "1800579959", source: "itunes", poster: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/14/2a/2d/142a2d3e-fb3a-e818-8c7b-6eeb92990084/25UMGIM42095.rgb.jpg/600x600bb.jpg" },
    ],
  },
];

const allLovedItems = lovedRows.flatMap((r) => r.items);

// Real rooms from the pools table — tapping a pill follows the room (room_follows)
const roomOptions = [
  { id: "eb529882-4a66-496d-97f2-bf9981692968", name: "True Crime", Icon: Search },
  { id: "c73774e0-c54c-44ed-8b14-ae0e3b076ddc", name: "Reality", Icon: Tv },
  { id: "a776d7dd-8206-4381-b847-17ff6f1e0d67", name: "Heartwarming", Icon: Heart },
  { id: "9e424f35-cd99-43ff-b695-d0ae89747b5a", name: "Action & Thriller", Icon: Zap },
  { id: "47182919-da7a-41bb-9688-50ec11561e53", name: "Rom-Com", Icon: Clapperboard },
  { id: "58841101-ce10-46d7-9241-f7d52a11f630", name: "Fantasy", Icon: Wand2 },
  { id: "b32722af-0a76-4df3-9fa2-a94a7e3046fb", name: "Comedy", Icon: Smile },
  { id: "3e0a4b3d-e211-44c7-9633-4a6a5a9206de", name: "Sports", Icon: Trophy },
  { id: "6ce32c55-b1ab-42ce-8e5c-6cf530e3e58b", name: "Horror", Icon: Skull },
  { id: "0ab28a57-065e-4d7a-8bd2-09af8c3be7d9", name: "Mystery", Icon: HelpCircle },
  { id: "cdd6dffe-70d2-45af-80b1-55e1f30ae6a5", name: "Period Drama", Icon: Crown },
  { id: "58db44eb-d82d-4173-85d9-c4c4e288d77b", name: "Sci-Fi", Icon: Rocket },
  { id: "41c7f7bb-faeb-4780-956e-f77f7f4adf64", name: "Documentaries", Icon: Video },
  { id: "d7db8196-b5df-4354-944f-44c0b9857780", name: "Animation", Icon: Palette },
  { id: "f7f22b7c-2e3b-470e-ac60-d4ee9601b16b", name: "Drama", Icon: Drama },
  { id: "51432489-35b9-468a-a0fb-7648a7d588e3", name: "Romance", Icon: HeartHandshake },
  { id: "dd89be31-9f46-47b9-848d-7519be038176", name: "Lifestyle", Icon: Home },
  { id: "4792cc12-15c9-4ea3-bf50-19abfbab49de", name: "Nonfiction", Icon: BookOpen },
  { id: "e227edc9-bcb1-4828-8360-374a9792a636", name: "Self Help", Icon: Leaf },
];


// Genre tags for each curated title — used to show "forming" genres on the reveal screen.
const TITLE_GENRES: Record<string, string[]> = {
  "Harry Potter": ["Fantasy"],
  "Wicked": ["Fantasy", "Musicals"],
  "The Eras Tour": ["Pop", "Pop Culture"],
  "Dune: Part Two": ["Sci-Fi"],
  "Inside Out 2": ["Animation", "Feel-Good"],
  "Top Gun: Maverick": ["Action"],
  "Everything Everywhere All at Once": ["Sci-Fi", "Comedy"],
  "Deadpool & Wolverine": ["Action", "Comedy"],
  "Moana 2": ["Animation", "Feel-Good"],
  "A Minecraft Movie": ["Adventure", "Comedy"],
  "The Super Mario Bros. Movie": ["Animation", "Adventure"],
  "Spider-Man: Across the Spider-Verse": ["Animation", "Action"],
  "Twisters": ["Action", "Thrillers"],
  "The Notebook": ["Romance"],
  "Interstellar": ["Sci-Fi", "Drama"],
  "Stranger Things": ["Sci-Fi", "Horror"],
  "The Bear": ["Drama", "Comedy"],
  "The Last of Us": ["Drama", "Thrillers"],
  "The Office": ["Comedy"],
  "Ted Lasso": ["Comedy", "Feel-Good"],
  "The White Lotus": ["Drama", "Comedy"],
  "Severance": ["Sci-Fi", "Thrillers"],
  "Friends": ["Comedy"],
  "Yellowstone": ["Drama"],
  "Bridgerton": ["Romance", "Drama"],
  "Wednesday": ["Fantasy", "Comedy"],
  "Game of Thrones": ["Fantasy", "Drama"],
  "Love Island USA": ["Reality"],
  "Abbott Elementary": ["Comedy"],
  "Grey's Anatomy": ["Drama", "Romance"],
  "Squid Game": ["Thrillers", "Drama"],
  "Only Murders in the Building": ["Mystery", "Comedy"],
  "Atomic Habits": ["Self-Improvement"],
  "The Hobbit": ["Fantasy"],
  "Fourth Wing": ["Fantasy", "Romance"],
  "It Ends with Us": ["Romance", "Drama"],
  "The Silent Patient": ["Thrillers", "Mystery"],
  "A Court of Thorns and Roses": ["Fantasy", "Romance"],
  "The Midnight Library": ["Feel-Good", "Drama"],
  "Onyx Storm": ["Fantasy", "Romance"],
  "Lessons in Chemistry": ["Drama", "Feel-Good"],
  "Where the Crawdads Sing": ["Mystery", "Drama"],
  "Verity": ["Thrillers", "Romance"],
  "The Great Gatsby": ["Classics", "Drama"],
  "Serial": ["True Crime"],
  "Crime Junkie": ["True Crime"],
  "SmartLess": ["Comedy"],
  "The Daily": ["News"],
  "Call Her Daddy": ["Pop Culture", "Comedy"],
  "New Heights with Jason & Travis Kelce": ["Sports", "Comedy"],
  "The Joe Rogan Experience": ["Pop Culture"],
  "Dateline NBC": ["True Crime"],
  "Armchair Expert": ["Comedy", "Pop Culture"],
  "Stuff You Should Know": ["Pop Culture"],
  "Morbid": ["True Crime"],
  "HIT ME HARD AND SOFT": ["Pop"],
  "Short n' Sweet": ["Pop"],
  "The Tortured Poets Department": ["Pop"],
  "GUTS": ["Pop"],
  "SOS": ["R&B"],
  "Midnights": ["Pop"],
  "1989 (Taylor's Version)": ["Pop"],
  "COWBOY CARTER": ["Country", "Pop"],
  "One Thing At A Time": ["Country"],
  "Harry's House": ["Pop"],
  "Un Verano Sin Ti": ["Latin"],
  "eternal sunshine": ["Pop", "R&B"],
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

type Step = "debate" | "loved" | "reveal";

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>("debate");
  const [vote, setVote] = useState<string | null | undefined>(undefined);
  const [rooms, setRooms] = useState<string[]>([]);
  const [loved, setLoved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showTenPrompt, setShowTenPrompt] = useState(false);
  const [tenPromptShown, setTenPromptShown] = useState(false);
  const pendingSaves = useRef<Promise<void> | null>(null);

  const finish = async (route: string) => {
    markOnboardingComplete(user?.id);
    // Ensure background onboarding writes (ratings, list adds) land before the
    // next page fetches them — e.g. the DNA survey prefill is one-shot.
    if (pendingSaves.current) {
      await Promise.race([
        pendingSaves.current,
        new Promise((r) => setTimeout(r, 6000)),
      ]).catch(() => {});
    }
    setLocation(route);
  };

  const toggleRoom = (id: string) =>
    setRooms((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const submitDebateStep = () => {
    setStep("loved");
    if (!user?.id) return;
    if (vote && vote !== "both") {
      // Same write path as every other poll — dedup handled by unique constraint,
      // feed automatically hides answered polls.
      supabase
        .from("user_predictions")
        .insert({ user_id: user.id, pool_id: DEBATE_POOL_ID, prediction: vote, points_earned: 10 })
        .then(({ error }) => {
          if (error && error.code !== "23505") console.error("[onboarding vote]", error);
        });
    }
    if (rooms.length > 0) {
      // Real follows — same rows as tapping Follow inside a room.
      supabase
        .from("room_follows")
        .insert(rooms.map((room_id) => ({ user_id: user.id, room_id })))
        .then(({ error }) => {
          if (error && error.code !== "23505") console.error("[onboarding room follow]", error);
        });
    }
  };

  const addLoved = (title: string) => {
    if (loved.includes(title)) {
      setLoved((titles) => titles.filter((selectedTitle) => selectedTitle !== title));
      return;
    }
    const newCount = loved.length + 1;
    setLoved((l) => [...l, title]);
    // Cards stay in place with an "Added" badge — no layout shift.
    if (newCount === 10 && !tenPromptShown) {
      setTenPromptShown(true);
      setTimeout(() => setShowTenPrompt(true), 900);
    }
  };

  const submitLoved = async () => {
    if (saving) return;
    setSaving(true);
    // Show the reveal immediately — persistence runs in the background,
    // tracked in pendingSaves so finish() can wait for it.
    setStep("reveal");
    pendingSaves.current = (async () => {
    try {
      if (user?.id && loved.length > 0) {
        const picks = allLovedItems.filter((i) => loved.includes(i.title));
        const typeByLabel: Record<string, string> = {
          Movies: "movie", "TV Shows": "tv", Books: "book", Podcasts: "podcast", Music: "music",
        };
        const typeByTitle: Record<string, string> = {};
        for (const row of lovedRows)
          for (const it of row.items) typeByTitle[it.title] = typeByLabel[row.label] || "movie";
        await Promise.all(
          picks.map(async (p) => {
            const { error } = await supabase.from("media_ratings").upsert(
              {
                user_id: user.id,
                media_title: p.title,
                media_type: typeByTitle[p.title] || "movie",
                media_external_id: p.externalId,
                media_external_source: p.source,
                rating: 5,
              },
              { onConflict: "user_id,media_external_id,media_external_source" },
            );
            if (error) console.error("[onboarding rating]", error);
          }),
        );
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        // Also track the picks (list_items) so they count toward "tracked" and DNA levels.
        if (token) {
          try {
            const listsRes = await fetch(`${SUPABASE_URL}/functions/v1/get-user-lists-with-media`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });
            const listsData = await listsRes.json();
            const finished = (listsData?.lists || []).find((l: any) => l.title?.toLowerCase().includes("finished"));
            if (finished?.id) {
              await Promise.all(
                picks.map((p) =>
                  fetch(`${SUPABASE_URL}/functions/v1/add-media-to-list`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      list_id: finished.id,
                      media_title: p.title,
                      media_type: typeByTitle[p.title] || "movie",
                      media_external_id: p.externalId,
                      media_external_source: p.source,
                      media_image_url: p.poster,
                      rating: 5,
                      skip_social_post: true,
                    }),
                  })
                    .then((r) => { if (!r.ok) console.error("[onboarding track]", p.title, r.status); })
                    .catch((e) => console.error("[onboarding track]", p.title, e)),
                ),
              );
            } else {
              console.error("[onboarding track] no Finished list found");
            }
          } catch (e) {
            console.error("[onboarding track]", e);
          }
        }
        // Fire-and-forget DNA signal rebuild (same as feed reactions / seen-it game)
        if (token) {
          fetch(`${SUPABASE_URL}/functions/v1/extract-dna-signals`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id }),
          }).catch(() => {});
        }
      }
    } finally {
      setSaving(false);
    }
    })();
  };

  const ProgressBar = ({ current }: { current: number }) => (
    <div className="pt-6 flex flex-col items-center">
      <div className="flex items-center gap-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: 56,
              background: i <= current ? "#a855f7" : "rgba(255,255,255,0.14)",
              boxShadow: i <= current ? "0 0 8px rgba(168,85,247,0.7)" : "none",
            }}
          />
        ))}
      </div>
      <p className="text-[11px] tracking-[0.2em] text-white/45 font-semibold mt-3">
        {current + 1} OF 2
      </p>
    </div>
  );

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen w-full flex items-stretch justify-center bg-gradient-to-br from-black via-slate-900 to-purple-900">
      <div className="w-full max-w-[430px] flex flex-col text-white relative bg-gradient-to-b from-slate-900/60 via-purple-950/40 to-purple-900/50">
        <button
          onClick={() => finish("/activity")}
          className="absolute top-5 right-5 z-10 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Skip
        </button>
        {children}
      </div>
    </div>
  );

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-slate-900 to-purple-900">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (step === "debate")
    return (
      <div className="min-h-screen w-full flex items-stretch justify-center bg-white">
        <div className="w-full max-w-[430px] flex flex-col relative bg-white">
          {/* Gradient hero header */}
          <div className="relative text-white px-6 pb-8 bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-900">
            <button
              onClick={() => finish("/activity")}
              className="absolute top-5 right-5 z-10 text-sm text-white/60 hover:text-white transition-colors"
            >
              Skip
            </button>
            <ProgressBar current={0} />
            <h1
              className="text-center text-[26px] leading-[1.2] font-black mt-6"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              Help us determine your entertainment DNA
            </h1>
            <p className="text-center text-[14px] italic text-white/70 mt-3">
              Answer these two quick questions
            </p>
          </div>

          {/* White body */}
          <div className="flex-1 flex flex-col px-6 pt-8 pb-10">
            <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600">STEP ONE</p>
            <h2
              className="text-[26px] leading-[1.15] font-black text-gray-900 mt-1.5"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              Settle the debate.
            </h2>

            <div className="flex items-center justify-center gap-4 mt-5 relative">
              {[debate.left, debate.right].map((side) => {
                const chosen = vote === side.name;
                return (
                  <button
                    key={side.name}
                    onClick={() => setVote(side.name)}
                    className="w-[44%] rounded-2xl overflow-hidden relative active:scale-95 transition-all"
                    style={{
                      aspectRatio: "2/3",
                      boxShadow: chosen
                        ? "0 10px 30px rgba(124,58,237,0.4)"
                        : "0 10px 30px rgba(0,0,0,0.18)",
                      outline: chosen ? "3px solid #7c3aed" : "none",
                    }}
                  >
                    <img src={side.poster} alt={side.name} className="w-full h-full object-cover" />
                    <div
                      className="absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center"
                      style={{
                        borderColor: chosen ? "#7c3aed" : "rgba(255,255,255,0.85)",
                        background: chosen ? "#7c3aed" : "rgba(0,0,0,0.25)",
                      }}
                    >
                      {chosen && <Check size={15} className="text-white" />}
                    </div>
                  </button>
                );
              })}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-purple-700 text-white border-4 border-white flex items-center justify-center text-sm font-black shadow-lg">
                VS
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <button
                onClick={() => setVote("both")}
                className={`w-full rounded-xl border px-4 py-3 text-[13px] font-semibold transition-colors ${
                  vote === "both"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                But how could I choose? I love them both!
              </button>
              <button
                onClick={() => setVote(null)}
                className={`w-full rounded-xl border px-4 py-3 text-[13px] font-medium transition-colors ${
                  vote === null
                    ? "border-gray-300 bg-gray-50 text-gray-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                Neither / Haven't seen
              </button>
            </div>

            <div className="mt-10">
              <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600">STEP TWO</p>
              <h2
                className="text-[26px] leading-[1.15] font-black text-gray-900 mt-1.5"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                What are you into?
              </h2>
              <p className="text-[13px] text-gray-400 mt-2">
                Follow the conversations for your favorite topics — pick as many as you like.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-5">
                {roomOptions.map((room) => {
                  const on = rooms.includes(room.id);
                  const Icon = room.Icon;
                  return (
                    <button
                      key={room.id}
                      onClick={() => toggleRoom(room.id)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold border transition-all active:scale-95"
                      style={{
                        borderColor: on ? "#7c3aed" : "rgb(229,231,235)",
                        background: on
                          ? "linear-gradient(135deg,#6d28d9,#9333ea 45%,#d946ef)"
                          : "white",
                        color: on ? "white" : "rgb(55,65,81)",
                        boxShadow: on ? "0 4px 14px rgba(124,58,237,0.3)" : "none",
                      }}
                    >
                      <Icon size={15} className={on ? "text-white" : "text-purple-600"} />
                      {room.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1" />
            <button
              onClick={submitDebateStep}
              disabled={vote === undefined}
              className="w-full py-3.5 rounded-full font-bold text-[15px] text-white mt-10 transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );

  if (step === "loved")
    return (
      <Shell>
        <ProgressBar current={1} />
        <div className="flex-1 flex flex-col px-5 pt-6 pb-8">
          <h1 className="text-center text-[22px] leading-[1.25] font-black" style={{ fontFamily: "Poppins, sans-serif" }}>
            Pick titles you’ve loved.
          </h1>
          <p className="text-center text-[13px] text-white/60 mt-2">
            Choose at least 3. The more you pick, the better we’ll understand your taste.
          </p>

          <div className="flex flex-col items-center mt-5">
            <div className="flex items-center gap-2">
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < Math.min(loved.length, 10);
                return (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full transition-all"
                    style={{
                      background: filled ? "#a855f7" : "rgba(255,255,255,0.15)",
                      boxShadow: filled ? "0 0 8px rgba(168,85,247,0.7)" : "none",
                    }}
                  />
                );
              })}
            </div>
            <p className="text-sm font-bold text-white/80 mt-2.5">
              {Math.min(loved.length, 10)} / 10 selected
              {loved.length >= 3 && <span className="text-purple-300"> ✓</span>}
            </p>
            <p className="text-[12px] text-white/55 mt-1">
              {loved.length < 3
                ? "Every pick shapes your Entertainment DNA."
                : "Keep going to make your Entertainment DNA even better."}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {lovedRows.map((row) => {
              const visible = row.items;
              return (
                <div key={row.label}>
                  <p className="text-[12px] font-bold tracking-wide text-white/70 uppercase mb-2">
                    {row.label}
                  </p>
                  <div className="relative -mx-5">
                    <div
                      className="flex gap-2.5 overflow-x-auto pb-1 px-5"
                      style={{ scrollbarWidth: "none" }}
                    >
                    {visible.map((item) => {
                      const added = loved.includes(item.title);
                      return (
                        <button
                          key={item.title}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addLoved(item.title)}
                          className="relative rounded-xl overflow-hidden border transition-all active:scale-95 flex-shrink-0"
                          style={{
                            width: 104,
                            aspectRatio: "2/3",
                            borderColor: added ? "#a855f7" : "rgba(255,255,255,0.1)",
                            boxShadow: added ? "0 0 16px rgba(168,85,247,0.45)" : "none",
                            opacity: added ? 0.85 : 1,
                          }}
                        >
                          <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                          {added && (
                            <div className="absolute inset-0 pointer-events-none transition-opacity" style={{ background: "rgba(20,10,40,0.45)" }}>
                              <span
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-lg"
                                style={{ background: "#a855f7" }}
                              >
                                <Check size={14} strokeWidth={3} />
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                    </div>
                    {/* Swipe hint: right-edge fade + chevron */}
                    <div
                      className="pointer-events-none absolute inset-y-0 right-0 w-12 flex items-center justify-end pr-1"
                      style={{ background: "linear-gradient(to left, rgba(10,6,24,0.9), rgba(10,6,24,0))" }}
                    >
                      <ChevronRight size={18} className="text-white/60" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={submitLoved}
            disabled={loved.length < 3 || saving}
            className="w-full py-3.5 rounded-full font-bold text-[15px] mt-4 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
          >
            {saving ? "Saving..." : "Continue"}
          </button>
          <button
            onClick={() => {
              setLoved([]);
              setStep("reveal");
            }}
            className="mx-auto text-sm text-white/45 font-medium mt-4"
          >
            None of these — I'll do it later
          </button>
          <p className="text-center text-[12px] text-white/40 mt-2">
            Pick at least 3. You can always add more later.
          </p>
        </div>

        {showTenPrompt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowTenPrompt(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl p-6 text-center bg-white"
              style={{ boxShadow: "0 0 40px rgba(168,85,247,0.35)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.35)" }}
              >
                <Dna size={32} className="text-purple-500" />
              </div>
              <h3 className="text-xl font-black mt-4 text-gray-900" style={{ fontFamily: "Poppins, sans-serif" }}>
                That's 10!
              </h3>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                You've started to unlock your Entertainment DNA.
              </p>
              <button
                onClick={() => {
                  setShowTenPrompt(false);
                  submitLoved();
                }}
                className="w-full py-3 rounded-full font-bold text-[15px] text-white mt-5 active:scale-95 transition-transform"
                style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
              >
                See my DNA now
              </button>
            </div>
          </div>
        )}

      </Shell>
    );

  return (
    <div className="min-h-screen w-full flex items-stretch justify-center bg-white">
      <div className="w-full max-w-[430px] flex flex-col relative bg-white">
        {/* Purple gradient hero */}
        <div
          className="relative px-6 pt-16 pb-10 flex flex-col items-center text-white"
          style={{ background: "linear-gradient(135deg, #0f0a2e 0%, #2e1065 55%, #4c1d95 100%)" }}
        >
          <button
            onClick={() => finish("/activity")}
            className="absolute top-5 right-5 z-10 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Skip
          </button>
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center"
            style={{
              background: "rgba(168,85,247,0.12)",
              border: "1px solid rgba(168,85,247,0.4)",
              boxShadow: "0 0 50px rgba(168,85,247,0.3)",
            }}
          >
            <Dna size={44} className="text-purple-300" />
          </div>
          <div
            className="mt-6 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[0.15em] uppercase"
            style={{ background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.5)", color: "#d8b4fe" }}
          >
            Level 1 DNA unlocked
          </div>
          <h2 className="text-2xl font-black mt-4 text-center" style={{ fontFamily: "Poppins, sans-serif" }}>
            Your Entertainment DNA has started forming.
          </h2>
        </div>

        {/* White body */}
        <div className="flex-1 flex flex-col px-6 py-8">
          <div className="w-full">
            <div className="flex items-center justify-between text-[12px] font-semibold text-gray-500">
              <span>Level 1</span>
              <span>Full DNA profile</span>
            </div>
            <div className="mt-2 h-2.5 rounded-full overflow-hidden bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(20 + loved.length * 2.5, 55)}%`,
                  background: "linear-gradient(90deg, #7c3aed, #d946ef)",
                }}
              />
            </div>
            <p
              className="text-[17px] font-semibold text-gray-800 mt-5 text-center leading-snug"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              Take the DNA quiz or add {Math.max(0, 30 - loved.length)} more titles to unlock your full archetype.
            </p>
          </div>

          <div className="pt-8">
            <button
              onClick={() => finish("/entertainment-dna")}
              className="w-full py-4 rounded-full font-medium text-[17px] text-white active:scale-95 transition-transform"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
            >
              Take the DNA quiz
            </button>
            <button
              onClick={() => finish("/activity")}
              className="w-full py-3.5 rounded-full font-medium text-[16px] mt-3 text-purple-700 active:scale-95 transition-transform"
              style={{ border: "1px solid rgba(124,58,237,0.45)", background: "white" }}
            >
              Skip to feed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
