import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Check, ChevronRight, CircleUser, Dna, Eye, Feather, Gamepad2, Heart, HeartHandshake, HelpCircle, Home, Leaf, Loader2, Mic, Music, Palette, Plane, Rocket, Search, Sparkles, Trophy, Tv, Users, Video, Wand2, Youtube, Zap, Clapperboard, Smile, Skull, Crown, Drama, BookOpen } from "lucide-react";
import {
  dismissOnboardingPrompt,
  loadOnboardingProgress,
  markOnboardingComplete,
  resolveOnboardingResumeStep,
  saveOnboardingProgress,
  type OnboardingResumeStep,
} from "@/components/route-guards";
import { useFirstSessionHooks } from "@/components/first-session-hooks";
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
const lovedRows: {
  label: string;
  items: {
    title: string;
    externalId: string;
    source: string;
    poster: string;
    mediaSubtype?: string;
    creator?: string;
  }[];
}[] = [
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
  {
    label: "Gaming",
    items: [
      { title: "Stardew Valley", externalId: "654", source: "rawg", poster: "https://media.rawg.io/media/games/713/713269608dc8f2f40f5a670a14b2de94.jpg" },
      { title: "Baldur's Gate III", externalId: "324997", source: "rawg", poster: "https://media.rawg.io/media/games/699/69907ecf13f172e9e144069769c3be73.jpg" },
      { title: "Animal Crossing: New Horizons", externalId: "421698", source: "rawg", poster: "https://media.rawg.io/media/games/42f/42fe1abd4d7c11ca92d93a0fb0f8662b.jpg" },
      { title: "The Legend of Zelda: Breath of the Wild", externalId: "22511", source: "rawg", poster: "https://media.rawg.io/media/games/cc1/cc196a5ad763955d6532cdba236f730c.jpg" },
      { title: "Fortnite Battle Royale", externalId: "47137", source: "rawg", poster: "https://media.rawg.io/media/games/dcb/dcbb67f371a9a28ea38ffd73ee0f53f3.jpg" },
      { title: "The Sims 4", externalId: "42187", source: "rawg", poster: "https://media.rawg.io/media/games/e44/e445335e611b4ccf03af71fffcbd30a4.jpg" },
    ],
  },
  {
    label: "YouTube",
    items: [
      { title: "MrBeast", externalId: "UCX6OQ3DkcsbYNE6H8uQQuVA", source: "youtube", poster: "https://yt3.ggpht.com/nxYrc_1_2f77DoBadyxMTmv7ZpRZapHR5jbuYe7PlPd5cIRJxtNNEYyOC0ZsxaDyJJzXrnJiuDE=s800-c-k-c0x00ffffff-no-rj", mediaSubtype: "channel", creator: "MrBeast" },
      { title: "Hot Ones", externalId: "UCPD_bxCRGpmmeQcbe2kpPaA", source: "youtube", poster: "https://yt3.ggpht.com/HFfZisaVh7x0A_ZxfEObPrpAyDPqsuIJD0P4zE23jNL65Pdn58ixh7GsDaJcGw5797VChzybXQ=s800-c-k-c0x00ffffff-no-rj", mediaSubtype: "channel", creator: "First We Feast" },
      { title: "Dude Perfect", externalId: "UCRijo3ddMTht_IHyNSNXpNQ", source: "youtube", poster: "https://yt3.ggpht.com/nZRsCgyfOVFhBzY-YFV8AhdMcYAybNZ8uttjcsrUGOnGRSVF5yKqRh6XHIs_o03TcbixvlOZ=s800-c-k-c0x00ffffff-no-rj", mediaSubtype: "channel", creator: "Dude Perfect" },
      { title: "Mark Rober", externalId: "UCY1kMZp36IQSyNx_9h4mpCg", source: "youtube", poster: "https://yt3.ggpht.com/ytc/AIdro_ksXY2REjZ6gYKSgnWT5jC_zT9mX900vyFtVinR8KbHww=s800-c-k-c0x00ffffff-no-rj", mediaSubtype: "channel", creator: "Mark Rober" },
      { title: "Marques Brownlee", externalId: "UCBJycsmduvYEL83R_U4JriQ", source: "youtube", poster: "https://yt3.ggpht.com/qu4TmIaYUlS41-dJ9gZ7DUR3nilvmB5_11i6OKSdvNnBNiyOusZP1bMN6ICnuxtjFBb6ioKgRQ=s800-c-k-c0x00ffffff-no-rj", mediaSubtype: "channel", creator: "Marques Brownlee" },
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
  { id: "3e0a4b3d-e211-44c7-9633-4a6a5a9206de", name: "Sports Talk & Docs", Icon: Trophy },
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

const mediaTypeOptions = [
  { id: "Movies", name: "Movies", Icon: Clapperboard },
  { id: "TV Shows", name: "TV Shows", Icon: Tv },
  { id: "Books", name: "Books", Icon: BookOpen },
  { id: "Podcasts", name: "Podcasts", Icon: Mic },
  { id: "Music", name: "Music", Icon: Music },
  { id: "Gaming", name: "Gaming", Icon: Gamepad2 },
  { id: "YouTube", name: "YouTube", Icon: Youtube },
];

const FORMAT_FROM_MEDIA_TYPE: Record<string, string> = {
  movie: "Movies",
  tv: "TV Shows",
  book: "Books",
  podcast: "Podcasts",
  music: "Music",
  game: "Gaming",
  youtube: "YouTube",
};

const TITLE_CONTEXT_LABEL = "Titles already shaping my DNA:";
const stripTitleContext = (answer: string) =>
  answer.replace(new RegExp(`(?:\\n\\n)?${TITLE_CONTEXT_LABEL}[\\s\\S]*$`), "").trim();
const addTitleContext = (answer: string, titles: string[]) => {
  const note = stripTitleContext(answer);
  if (titles.length === 0) return note;
  return [note, `${TITLE_CONTEXT_LABEL} ${titles.join(", ")}`].filter(Boolean).join("\n\n");
};

const ROOM_GENRES: Record<string, string | undefined> = {
  "eb529882-4a66-496d-97f2-bf9981692968": "True Crime",
  "c73774e0-c54c-44ed-8b14-ae0e3b076ddc": "Reality",
  "a776d7dd-8206-4381-b847-17ff6f1e0d67": "Romance",
  "9e424f35-cd99-43ff-b695-d0ae89747b5a": "Action",
  "47182919-da7a-41bb-9688-50ec11561e53": "Rom-com/chick-lit",
  "58841101-ce10-46d7-9241-f7d52a11f630": "Fantasy",
  "b32722af-0a76-4df3-9fa2-a94a7e3046fb": "Comedy",
  "3e0a4b3d-e211-44c7-9633-4a6a5a9206de": undefined,
  "6ce32c55-b1ab-42ce-8e5c-6cf530e3e58b": "Horror",
  "0ab28a57-065e-4d7a-8bd2-09af8c3be7d9": "Mystery/Thriller",
  "cdd6dffe-70d2-45af-80b1-55e1f30ae6a5": "Historical",
  "58db44eb-d82d-4173-85d9-c4c4e288d77b": "Science Fiction",
  "41c7f7bb-faeb-4780-956e-f77f7f4adf64": "Documentaries",
  "d7db8196-b5df-4354-944f-44c0b9857780": "Animation",
  "f7f22b7c-2e3b-470e-ac60-d4ee9601b16b": "Drama",
  "51432489-35b9-468a-a0fb-7648a7d588e3": "Romance",
  "dd89be31-9f46-47b9-848d-7519be038176": "Lifestyle (Home Reno, Food, Travel)",
  "4792cc12-15c9-4ea3-bf50-19abfbab49de": "Nonfiction",
  "e227edc9-bcb1-4828-8360-374a9792a636": "Self Help",
};

const DRIVER_ICONS: { match: string; Icon: typeof Tv }[] = [
  { match: "feel something", Icon: Heart },
  { match: "escape", Icon: Plane },
  { match: "connect over", Icon: Users },
  { match: "visuals", Icon: Eye },
  { match: "unwind", Icon: Leaf },
  { match: "figure things out", Icon: Search },
  { match: "curious about people", Icon: CircleUser },
  { match: "fun or action", Icon: Zap },
  { match: "depends on the day", Icon: Sparkles },
];

const driverIcon = (option: string) =>
  DRIVER_ICONS.find((driver) => option.toLowerCase().includes(driver.match))?.Icon;

interface SurveyQuestion {
  id: string;
  display_order: number;
  options?: string[];
}


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

type TitleSuggestion = {
  title: string;
  format: string;
  genres: string[];
};

// Real titles used as prompts when a user's selected format + topic does not
// have enough matches in the smaller curated title rows above.
const DNA_TITLE_SUGGESTIONS: TitleSuggestion[] = [
  { title: "Making a Murderer", format: "TV Shows", genres: ["True Crime", "Documentaries"] },
  { title: "The Jinx", format: "TV Shows", genres: ["True Crime", "Documentaries"] },
  { title: "The Tinder Swindler", format: "Movies", genres: ["True Crime", "Documentaries"] },
  { title: "American Murder: The Family Next Door", format: "Movies", genres: ["True Crime", "Documentaries"] },
  { title: "Abducted in Plain Sight", format: "Movies", genres: ["True Crime", "Documentaries"] },
  { title: "Free Solo", format: "Movies", genres: ["Documentaries", "Sports"] },
  { title: "Icarus", format: "Movies", genres: ["Documentaries", "Sports"] },
  { title: "The Last Dance", format: "TV Shows", genres: ["Documentaries", "Sports"] },
  { title: "Mad Max: Fury Road", format: "Movies", genres: ["Action", "Thriller"] },
  { title: "John Wick", format: "Movies", genres: ["Action", "Thriller"] },
  { title: "The Dark Knight", format: "Movies", genres: ["Action", "Drama"] },
  { title: "The Bourne Identity", format: "Movies", genres: ["Action", "Thriller"] },
  { title: "Reacher", format: "TV Shows", genres: ["Action", "Thriller"] },
  { title: "The Boys", format: "TV Shows", genres: ["Action", "Drama"] },
  { title: "The Hunger Games", format: "Books", genres: ["Action", "Drama"] },
  { title: "Elden Ring", format: "Gaming", genres: ["Action", "Fantasy"] },
  { title: "Red Dead Redemption 2", format: "Gaming", genres: ["Action", "Drama"] },
  { title: "Pride and Prejudice", format: "Books", genres: ["Romance", "Drama"] },
  { title: "Normal People", format: "TV Shows", genres: ["Romance", "Drama"] },
  { title: "Little Women", format: "Movies", genres: ["Drama", "Romance"] },
  { title: "Blade Runner 2049", format: "Movies", genres: ["Sci-Fi", "Drama"] },
  { title: "The Expanse", format: "TV Shows", genres: ["Sci-Fi", "Drama"] },
  { title: "The Lord of the Rings: The Fellowship of the Ring", format: "Movies", genres: ["Fantasy", "Action"] },
  { title: "The Girl with the Dragon Tattoo", format: "Books", genres: ["Mystery", "Thriller"] },
  { title: "Bridesmaids", format: "Movies", genres: ["Comedy"] },
  { title: "Schitt's Creek", format: "TV Shows", genres: ["Comedy"] },
  { title: "Hereditary", format: "Movies", genres: ["Horror"] },
  { title: "The Conjuring", format: "Movies", genres: ["Horror"] },
  { title: "In Cold Blood", format: "Books", genres: ["True Crime", "Nonfiction"] },
  { title: "Sapiens", format: "Books", genres: ["Nonfiction"] },
];

const TITLE_SUGGESTION_ALIASES: Record<string, string[]> = {
  "Romance": ["romance", "rom com", "chick lit"],
  "Sci-Fi": ["sci fi", "science fiction"],
  "Documentaries": ["documentaries", "documentary", "docs", "nonfiction"],
  "Sports": ["sports", "sports talk"],
  "True Crime": ["true crime"],
  "Thriller": ["thriller", "thrillers", "mystery"],
  "Mystery": ["mystery"],
};

const normalizeSuggestionText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const suggestionGenreTerms = (genre: string) => [
  normalizeSuggestionText(genre),
  ...(TITLE_SUGGESTION_ALIASES[genre] || []).map(normalizeSuggestionText),
];

const suggestionGenresOverlap = (first: string, second: string) =>
  suggestionGenreTerms(first).some((firstTerm) =>
    suggestionGenreTerms(second).some((secondTerm) =>
      firstTerm === secondTerm || firstTerm.includes(secondTerm) || secondTerm.includes(firstTerm),
    ),
  );

const titleSuggestionCatalog: TitleSuggestion[] = [
  ...DNA_TITLE_SUGGESTIONS,
  ...lovedRows.flatMap((row) =>
    row.items.map((item) => ({
      title: item.title,
      format: row.label,
      genres: TITLE_GENRES[item.title] || [],
    })),
  ),
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

type Step = "debate" | "interests" | "loved" | "love" | "drivers" | "generating" | "reveal";

const DNA_HEADER_MESSAGES: Record<number, string> = {
  2: "Great! Your DNA is taking shape.",
  3: "Getting closer to your DNA.",
  4: "Your DNA is coming into focus.",
  5: "Your DNA is almost ready.",
};

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user, session, loading: authLoading } = useAuth();
  const { markDNA } = useFirstSessionHooks();
  const resumeDNA = useRef(new URLSearchParams(window.location.search).get("resume") === "dna").current;
  const resumeRequested = useRef(new URLSearchParams(window.location.search).has("resume")).current;
  const [step, setStep] = useState<Step>("debate");
  const [vote, setVote] = useState<string | null | undefined>(undefined);
  const [rooms, setRooms] = useState<string[]>([]);
  const [mediaTypes, setMediaTypes] = useState<string[]>([]);
  const [loved, setLoved] = useState<string[]>([]);
  const [existingTitles, setExistingTitles] = useState<string[]>([]);
  const [loveNote, setLoveNote] = useState("");
  const [drivers, setDrivers] = useState<string[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionLoadError, setQuestionLoadError] = useState<string | null>(null);
  const [questionReloadKey, setQuestionReloadKey] = useState(0);
  const [resumePrefillLoading, setResumePrefillLoading] = useState(true);
  const [progressLoadError, setProgressLoadError] = useState<string | null>(null);
  const [progressReloadKey, setProgressReloadKey] = useState(0);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(74);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedProfile, setGeneratedProfile] = useState<{
    label?: string;
    tagline?: string;
    flavor_notes?: string[];
    profile_text?: string;
  } | null>(null);
  const [showTenPrompt, setShowTenPrompt] = useState(false);
  const [tenPromptShown, setTenPromptShown] = useState(false);
  const pendingSaves = useRef<Promise<void> | null>(null);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const waitForPendingSaves = async () => {
    // Ensure background onboarding writes (ratings, list adds) land before the
    // next page fetches them — e.g. the DNA completion prefill is one-shot.
    if (pendingSaves.current) {
      await Promise.race([
        pendingSaves.current,
        new Promise((r) => setTimeout(r, 6000)),
      ]).catch(() => {});
    }
  };

  const completeAndNavigate = async (route: string) => {
    markOnboardingComplete(user?.id);
    await waitForPendingSaves();
    setLocation(route);
  };

  const leaveForNow = async (route = "/activity") => {
    if (!progressLoadError && !questionLoadError) {
      const resumableStep: OnboardingResumeStep =
        step === "generating" || step === "reveal" ? "drivers" : step;
      saveOnboardingProgress(user?.id, resumableStep, { preserveCompletion: hasExistingProfile });
    }
    dismissOnboardingPrompt(user?.id);
    await waitForPendingSaves();
    setLocation(route);
  };

  const goToStep = (nextStep: OnboardingResumeStep) => {
    saveOnboardingProgress(user?.id, nextStep, { preserveCompletion: hasExistingProfile });
    setStep(nextStep);
  };

  useEffect(() => {
    if (!session?.access_token) return;
    let cancelled = false;

    const loadQuestions = async () => {
      setQuestionsLoading(true);
      setQuestionLoadError(null);
      const { data, error } = await supabase
        .from("edna_questions")
        .select("id, display_order, options")
        .in("display_order", [2, 3, 4, 5])
        .order("display_order", { ascending: true });
      if (!cancelled) {
        const loadedQuestions = (data || []) as SurveyQuestion[];
        const hasRequiredQuestions = [2, 3, 4, 5].every((order) =>
          loadedQuestions.some((question) => question.display_order === order),
        );
        if (error || !hasRequiredQuestions) {
          console.error("[onboarding DNA questions]", error);
          setQuestionLoadError(
            error
              ? "We couldn't load your DNA questions. Please try again."
              : "Your DNA questions aren't available right now. Please try again.",
          );
          setSurveyQuestions([]);
          setResumePrefillLoading(false);
        } else {
          setSurveyQuestions(loadedQuestions);
        }
        setQuestionsLoading(false);
      }
    };

    loadQuestions();
    return () => { cancelled = true; };
  }, [questionReloadKey, session?.access_token]);

  useEffect(() => {
    if (!user?.id || surveyQuestions.length === 0) return;
    let cancelled = false;

    const prefillCompletion = async () => {
      setProgressLoadError(null);
      const [responsesResult, ratingsResult, trackedResult, followsResult, profileResult] = await Promise.all([
        supabase.from("edna_responses").select("question_id, answer_text").eq("user_id", user.id),
        supabase.from("media_ratings").select("media_title, media_type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("list_items").select("title, media_type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("room_follows").select("room_id").eq("user_id", user.id),
        supabase.from("dna_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;

      if (profileResult.error) throw profileResult.error;
      if (profileResult.data && !resumeDNA) {
        markOnboardingComplete(user.id);
        setLocation("/profile");
        return;
      }
      setHasExistingProfile(Boolean(profileResult.data));

      if (responsesResult.error) throw responsesResult.error;
      if (ratingsResult.error) console.error("[onboarding DNA titles]", ratingsResult.error);
      if (trackedResult.error) console.error("[onboarding tracked titles]", trackedResult.error);
      if (followsResult.error) console.error("[onboarding room follows]", followsResult.error);
      const ratings = (ratingsResult.data || []) as { media_title: string; media_type: string }[];
      const tracked = (trackedResult.data || []) as { title: string; media_type: string }[];
      const activityTitles = Array.from(new Set([
        ...ratings.map((row) => row.media_title),
        ...tracked.map((row) => row.title),
      ].filter(Boolean))).slice(0, 12);
      const ratedFormats = Array.from(new Set(
        [...ratings, ...tracked.map((row) => ({ media_title: row.title, media_type: row.media_type }))]
          .map((row) => FORMAT_FROM_MEDIA_TYPE[(row.media_type || "").toLowerCase()])
          .filter((format): format is string => Boolean(format)),
      ));
      setExistingTitles(activityTitles);
      setLoved(activityTitles.filter((title) => allLovedItems.some((item) => item.title === title)));

      const answersByQuestion = new Map(
        (responsesResult.data || []).map((row: { question_id: string; answer_text: string }) => [row.question_id, row.answer_text || ""]),
      );
      const questionFor = (order: number) => surveyQuestions.find((question) => question.display_order === order);
      const typesQuestion = questionFor(2);
      const genresQuestion = questionFor(3);
      const loveQuestion = questionFor(4);
      const driversQuestion = questionFor(5);

      let selectedFormats = ratedFormats;
      if (typesQuestion) {
        const answer = answersByQuestion.get(typesQuestion.id) || "";
        const storedFormats = mediaTypeOptions
          .map((option) => option.id)
          .filter((option) => answer.includes(option));
        if (storedFormats.length > 0) selectedFormats = storedFormats;
      }
      setMediaTypes(selectedFormats);
      if (loveQuestion) setLoveNote(stripTitleContext(answersByQuestion.get(loveQuestion.id) || ""));
      if (driversQuestion) {
        const answer = answersByQuestion.get(driversQuestion.id) || "";
        setDrivers((driversQuestion.options || []).filter((option) => answer.includes(option)));
      }
      const followedRooms = (followsResult.data || [])
        .map((row: { room_id: string }) => row.room_id)
        .filter((roomId) => roomId in ROOM_GENRES);
      setRooms(followedRooms);
      const hasFormats = selectedFormats.length > 0;
      const storedGenres = genresQuestion ? answersByQuestion.get(genresQuestion.id)?.trim() : "";
      const hasGenres = Boolean(storedGenres) || followedRooms.some((roomId) => Boolean(ROOM_GENRES[roomId]));
      const hasLoveResponse = Boolean(loveQuestion && answersByQuestion.has(loveQuestion.id));
      const hasDriverResponse = Boolean(driversQuestion && answersByQuestion.has(driversQuestion.id));
      const draft = loadOnboardingProgress(user.id);
      const createdAt = new Date(user.created_at).getTime();
      const isNewAccount = Date.now() - createdAt < 10 * 60 * 1000;

      const nextStep = resolveOnboardingResumeStep({
        hasExistingProfile: Boolean(profileResult.data),
        resumeDNA,
        resumeRequested,
        isNewAccount,
        draftStep: draft?.step,
        hasFormats,
        hasGenres,
        hasLoveResponse,
        hasDriverResponse,
      });
      saveOnboardingProgress(user.id, nextStep, { preserveCompletion: Boolean(profileResult.data) });
      setStep(nextStep);
    };

    prefillCompletion()
      .catch((error) => {
        console.error("[onboarding DNA prefill]", error);
        if (!cancelled) {
          setProgressLoadError("We couldn't load your saved setup progress. Nothing has been changed.");
        }
      })
      .finally(() => {
        if (!cancelled) setResumePrefillLoading(false);
      });
    return () => { cancelled = true; };
  }, [progressReloadKey, resumeDNA, resumeRequested, setLocation, surveyQuestions, user?.created_at, user?.id]);

  useEffect(() => {
    if (!isGenerating) return;
    setGenerationProgress(74);
    const interval = window.setInterval(() => {
      setGenerationProgress((progress) => Math.min(progress + 3, 96));
    }, 900);
    return () => window.clearInterval(interval);
  }, [isGenerating]);

  const toggleRoom = (id: string) =>
    setRooms((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const toggleMediaType = (id: string) =>
    setMediaTypes((types) => (types.includes(id) ? types.filter((type) => type !== id) : [...types, id]));
  const toggleDriver = (driver: string) =>
    setDrivers((current) => (current.includes(driver) ? current.filter((item) => item !== driver) : [...current, driver]));
  const titleRows = mediaTypes.length > 0
    ? [...lovedRows].sort((left, right) => {
        const leftRank = mediaTypes.indexOf(left.label);
        const rightRank = mediaTypes.indexOf(right.label);
        if (leftRank === -1 && rightRank === -1) return 0;
        if (leftRank === -1) return 1;
        if (rightRank === -1) return -1;
        return leftRank - rightRank;
      })
    : lovedRows;
  const hasMappableRoom = rooms.some((roomId) => Boolean(ROOM_GENRES[roomId]));
  const questionByOrder = (order: number) =>
    surveyQuestions.find((question) => question.display_order === order);

  const persistResponses = async (rows: Array<{ question_id: string; answer_text: string }>) => {
    if (!user?.id) throw new Error("You need to be signed in to save onboarding.");
    const { error } = await supabase
      .from("edna_responses")
      .upsert(rows.map((row) => ({ ...row, user_id: user.id })), { onConflict: "user_id,question_id" });
    if (error) throw error;
  };

  const submitDebateStep = () => {
    goToStep("interests");
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
  };

  const submitInterestsStep = async () => {
    if (saving || !user?.id) return;
    const formatsQuestion = questionByOrder(2);
    const genresQuestion = questionByOrder(3);
    if (!formatsQuestion || !genresQuestion) {
      setSaveError("We couldn't load your setup questions. Please try again.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const roomGenres = Array.from(new Set(
        rooms.map((roomId) => ROOM_GENRES[roomId]).filter((genre): genre is string => Boolean(genre)),
      ));
      const [followResult] = await Promise.all([
        supabase
          .from("room_follows")
          .upsert(rooms.map((room_id) => ({ user_id: user.id, room_id })), {
            onConflict: "user_id,room_id",
            ignoreDuplicates: true,
          }),
        persistResponses([
          { question_id: formatsQuestion.id, answer_text: mediaTypes.join(", ") },
          { question_id: genresQuestion.id, answer_text: roomGenres.join(", ") },
        ]),
      ]);
      if (followResult.error && followResult.error.code !== "23505") throw followResult.error;
      goToStep(resumeDNA && hasExistingProfile ? "love" : "loved");
    } catch (error) {
      console.error("[onboarding interests]", error);
      setSaveError("We couldn't save those choices. Please try again.");
    } finally {
      setSaving(false);
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
    setExistingTitles(loved);
    // Continue immediately — persistence runs in the background,
    // tracked in pendingSaves so navigation can wait for it.
    goToStep("love");
    pendingSaves.current = (async () => {
    try {
      if (user?.id && loved.length > 0) {
        const picks = allLovedItems.filter((i) => loved.includes(i.title));
        const typeByLabel: Record<string, string> = {
          Movies: "movie", "TV Shows": "tv", Books: "book", Podcasts: "podcast", Music: "music",
          Gaming: "game", YouTube: "youtube",
        };
        const typeByTitle: Record<string, string> = {};
        for (const row of lovedRows)
          for (const it of row.items) {
            typeByTitle[it.title] = typeByLabel[row.label] || "movie";
          }
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
                      media_subtype: p.mediaSubtype,
                      media_creator: p.creator,
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

            // As elsewhere in the app, adding a YouTube channel also follows
            // that creator so their future activity can shape DNA and recommendations.
            const youtubeChannels = picks.filter(
              (p) => p.source === "youtube" && p.mediaSubtype === "channel" && /^UC[\w-]{22}$/.test(p.externalId),
            );
            await Promise.all(
              youtubeChannels.map((channel) =>
                fetch(`${SUPABASE_URL}/functions/v1/follow-creator`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "follow",
                    creatorName: channel.creator || channel.title,
                    creatorRole: "YouTuber",
                    creatorImage: channel.poster,
                    externalId: channel.externalId,
                    externalSource: "youtube",
                  }),
                }).catch(() => null),
              ),
            );
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

  const submitLoveStep = async () => {
    if (saving) return;
    const loveQuestion = questionByOrder(4);
    if (!loveQuestion) {
      setSaveError("We couldn't load this DNA question. Please try again.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const titlesForDNA = existingTitles.length > 0 ? existingTitles : loved;
      await persistResponses([{
        question_id: loveQuestion.id,
        answer_text: addTitleContext(loveNote, titlesForDNA),
      }]);
      goToStep("drivers");
    } catch (error) {
      console.error("[onboarding love]", error);
      setSaveError("We couldn't save that answer. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const generateDNA = async () => {
    if (isGenerating || !user?.id || !session?.access_token || drivers.length === 0) return;
    if (mediaTypes.length === 0 || !hasMappableRoom) {
      setStep("interests");
      return;
    }
    setGenerationError(null);
    setIsGenerating(true);
    saveOnboardingProgress(user.id, "drivers", { preserveCompletion: hasExistingProfile });
    setStep("generating");

    try {
      if (pendingSaves.current) await pendingSaves.current;

      const formatsQuestion = questionByOrder(2);
      const genresQuestion = questionByOrder(3);
      const loveQuestion = questionByOrder(4);
      const driversQuestion = questionByOrder(5);
      if (!formatsQuestion || !genresQuestion || !loveQuestion || !driversQuestion) {
        throw new Error("DNA questions could not be loaded. Please try again.");
      }

      const roomGenres = Array.from(new Set(
        rooms.map((roomId) => ROOM_GENRES[roomId]).filter((genre): genre is string => Boolean(genre)),
      ));
      const titlesForDNA = existingTitles.length > 0 ? existingTitles : loved;
      const responseRows = [
        { user_id: user.id, question_id: formatsQuestion.id, answer_text: mediaTypes.join(", ") },
        { user_id: user.id, question_id: genresQuestion.id, answer_text: roomGenres.join(", ") },
        { user_id: user.id, question_id: loveQuestion.id, answer_text: addTitleContext(loveNote, titlesForDNA) },
        { user_id: user.id, question_id: driversQuestion.id, answer_text: drivers.join(", ") },
      ];

      const { error: responseError } = await supabase
        .from("edna_responses")
        .upsert(responseRows, { onConflict: "user_id,question_id" });
      if (responseError) throw responseError;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-dna-profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: user.id }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || "We couldn't generate your DNA profile. Please try again.");
      }

      const profile = await response.json();
      setGeneratedProfile(profile);
      setGenerationProgress(100);
      markDNA();
      markOnboardingComplete(user.id);
      fetch(`${SUPABASE_URL}/functions/v1/generate-media-recommendations`, {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
      setStep("reveal");
    } catch (error) {
      console.error("[onboarding DNA generation]", error);
      setGenerationError(error instanceof Error ? error.message : "We couldn't generate your DNA profile. Please try again.");
      setStep("drivers");
    } finally {
      setIsGenerating(false);
    }
  };

  const ONBOARDING_PROGRESS: Array<{ lead: string; detail?: string }> = [
    { lead: "Step 1 of 5" },
    { lead: "Step 2 of 5" },
    {
      lead: "Step 3 of 5 — Pick at least 3 favorites",
    },
  ];

  const ProgressBar = ({ current, tone = "dark" }: { current: number; tone?: "dark" | "light" }) => {
    const progress = ONBOARDING_PROGRESS[current];
    const light = tone === "light";
    const progressLabel = [progress.lead, progress.detail].filter(Boolean).join(" ");
    return (
      <div className="flex flex-col items-center">
        <p className={light ? "text-center text-[13px] text-gray-500" : "text-center text-[13px] text-white/55"}>
          <span className={current === 2 ? (light ? "font-bold text-gray-700" : "font-bold text-white/80") : undefined}>
            {progress.lead}
          </span>
          {progress.detail && <> {progress.detail}</>}
        </p>
        <div className="flex items-center gap-2 mt-3" aria-label={`Onboarding ${progressLabel}`}>
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className="h-2 w-2 rounded-full transition-all"
              style={{
                background: index <= current ? "#c026d3" : light ? "#e5e7eb" : "rgba(255,255,255,0.2)",
                boxShadow: index <= current ? "0 0 8px rgba(232,121,249,0.65)" : "none",
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const OnboardingHero = ({
    currentStep,
    onBack,
  }: {
    currentStep: 1 | 2 | 3;
    onBack?: () => void;
  }) => (
    <div
      className="px-5 pt-5 pb-6 text-white"
      style={{ background: "linear-gradient(135deg, #0f0a2e 0%, #2e1065 55%, #4c1d95 100%)" }}
    >
      <div className="flex items-center justify-between mb-4">
        {onBack ? (
          <button onClick={onBack} className="text-sm text-white/60 hover:text-white transition-colors">
            Back
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <button onClick={() => leaveForNow()} className="text-xs text-white/70 hover:text-white">
          Skip for now
        </button>
      </div>
      {currentStep === 1 ? (
        <div className="flex flex-col items-center text-center">
          <Dna className="text-purple-200 mb-3" size={28} />
          <h1 className="text-[26px] leading-[1.15] font-bold" style={{ fontFamily: "Poppins, sans-serif" }}>
            Discover Your
            <br />
            Entertainment DNA
          </h1>
          <p className="max-w-[310px] mt-3 text-[13px] leading-relaxed text-white/70">
            What you consume tells a story about you.
            <br />
            Ready to see yours?
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <Dna className="text-purple-200 mb-3" size={28} />
          <h1 className="max-w-[340px] text-[26px] leading-[1.15] font-bold" style={{ fontFamily: "Poppins, sans-serif" }}>
            {DNA_HEADER_MESSAGES[currentStep]}
          </h1>
        </div>
      )}
      <div className="mt-5">
        <ProgressBar current={currentStep - 1} />
      </div>
    </div>
  );

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-slate-900 to-purple-900">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (resumePrefillLoading)
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f0a2e 0%, #2e1065 55%, #4c1d95 100%)" }}>
        <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
      </div>
    );

  if (progressLoadError)
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="max-w-[430px] w-full rounded-3xl bg-white p-7 text-center shadow-2xl">
          <Dna className="mx-auto text-purple-600" size={38} />
          <h1 className="mt-4 text-xl font-bold text-gray-900">We couldn't restore your setup yet</h1>
          <p className="mt-2 text-sm text-gray-600">{progressLoadError}</p>
          <button
            onClick={() => {
              setResumePrefillLoading(true);
              setProgressReloadKey((key) => key + 1);
            }}
            className="mt-6 w-full rounded-full py-3.5 font-bold text-white"
            style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
          >
            Try again
          </button>
          <button onClick={() => leaveForNow()} className="mt-4 text-sm font-medium text-purple-700">
            Back to activity
          </button>
        </div>
      </div>
    );

  if (questionLoadError)
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="max-w-[430px] w-full rounded-3xl bg-white p-7 text-center shadow-2xl">
          <Dna className="mx-auto text-purple-600" size={38} />
          <h1 className="mt-4 text-xl font-bold text-gray-900">Your DNA flow needs a quick retry</h1>
          <p className="mt-2 text-sm text-gray-600">{questionLoadError}</p>
          <button
            onClick={() => {
              setResumePrefillLoading(true);
              setQuestionReloadKey((key) => key + 1);
            }}
            className="mt-6 w-full rounded-full py-3.5 font-bold text-white"
            style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
          >
            Try again
          </button>
          <button onClick={() => leaveForNow()} className="mt-4 text-sm font-medium text-purple-700">
            Skip for now
          </button>
        </div>
      </div>
    );

  if (step === "debate")
    return (
      <div className="min-h-screen w-full flex items-stretch justify-center bg-white">
        <div className="w-full max-w-[430px] flex flex-col relative bg-white">
          <OnboardingHero currentStep={1} />

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

            <div className="min-h-6" />
            <button
              onClick={submitDebateStep}
              disabled={vote === undefined}
              className="w-full py-3.5 rounded-full font-bold text-[15px] text-white mt-6 transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );

  if (step === "interests")
    return (
      <div className="min-h-screen w-full flex items-stretch justify-center bg-white">
        <div className="w-full max-w-[430px] flex flex-col relative bg-white">
          <OnboardingHero currentStep={2} onBack={() => goToStep("debate")} />

          <div className="flex-1 flex flex-col px-6 pt-8 pb-10">
            <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600">STEP TWO</p>
            <h2 className="text-[26px] leading-[1.15] font-black text-gray-900 mt-1.5" style={{ fontFamily: "Poppins, sans-serif" }}>
              What’s in your rotation?
            </h2>
            <p className="text-[13px] text-gray-400 mt-2">
              Pick all the ways you like to unwind, obsess, and keep up.
            </p>
            <div className="flex flex-wrap gap-2.5 mt-5">
              {mediaTypeOptions.map((type) => {
                const on = mediaTypes.includes(type.id);
                const Icon = type.Icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => toggleMediaType(type.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold border transition-all active:scale-95"
                    style={{
                      borderColor: on ? "#7c3aed" : "rgb(229,231,235)",
                      background: on ? "linear-gradient(135deg,#6d28d9,#9333ea 45%,#d946ef)" : "white",
                      color: on ? "white" : "rgb(55,65,81)",
                      boxShadow: on ? "0 4px 14px rgba(124,58,237,0.3)" : "none",
                    }}
                  >
                    <Icon size={15} className={on ? "text-white" : "text-purple-600"} />
                    {type.name}
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600">STEP THREE</p>
              <h3 className="text-[26px] leading-[1.15] font-black text-gray-900 mt-1.5" style={{ fontFamily: "Poppins, sans-serif" }}>
                And what pulls you in?
              </h3>
              <p className="text-[13px] text-gray-400 mt-2">
                Follow the conversations for your favorite topics — pick as many as you like.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 mt-4">
              {roomOptions.map((room) => {
                const on = rooms.includes(room.id);
                return (
                  <button
                    key={room.id}
                    onClick={() => toggleRoom(room.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all active:scale-95"
                    style={{
                      border: on ? "1px solid #ddd6fe" : "1px solid transparent",
                      background: on ? "#f5f3ff" : "#f8fafc",
                      color: on ? "#6d28d9" : "#4b5563",
                    }}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                    {room.name}
                  </button>
                );
              })}
            </div>
            {rooms.length > 0 && !hasMappableRoom && (
              <p className="mt-3 text-[12px] font-medium text-purple-600">
                Add one more topic to help shape your Entertainment DNA. Sports can stay selected.
              </p>
            )}
            {saveError && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                {saveError}
              </p>
            )}

            <div className="flex-1" />
            <button
              onClick={submitInterestsStep}
              disabled={mediaTypes.length === 0 || !hasMappableRoom || saving}
              className="w-full py-3.5 rounded-full font-bold text-[15px] text-white mt-10 transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
            >
              {saving ? "Saving..." : "Continue"}
            </button>
          </div>
        </div>
      </div>
    );

  if (step === "loved")
    return (
      <div className="min-h-screen w-full flex items-stretch justify-center bg-gray-100">
        <div className="w-full max-w-[430px] flex flex-col relative bg-white">
          <OnboardingHero currentStep={3} onBack={() => goToStep("interests")} />

          <div className="flex-1 flex flex-col px-5 pt-3 pb-8 bg-white">
            <div
              className={`mx-auto mt-1 flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all ${
                loved.length >= 3
                  ? "border-purple-200 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              {loved.length >= 3 && <Check size={15} strokeWidth={3} />}
              <span>
                {loved.length >= 3
                  ? `${loved.length} ${loved.length === 1 ? "title" : "titles"} picked`
                  : `${loved.length} of 3 titles picked`}
              </span>
            </div>

            <div className="mt-2 space-y-4">
            {titleRows.map((row) => {
              const visible = row.items;
              return (
                <div key={row.label}>
                  <p className="text-[12px] font-bold tracking-wide text-gray-500 uppercase mb-2">
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
                            borderColor: added ? "#a855f7" : "#e5e7eb",
                            boxShadow: added ? "0 0 16px rgba(168,85,247,0.45)" : "none",
                            opacity: added ? 0.85 : 1,
                          }}
                        >
                          <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                          {(row.label === "Gaming" || row.label === "YouTube") && (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2 pt-7 pb-2 text-left">
                              <span className="block text-[10px] leading-tight font-semibold text-white line-clamp-2">
                                {item.title}
                              </span>
                            </div>
                          )}
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
                       style={{ background: "linear-gradient(to left, rgba(255,255,255,0.98), rgba(255,255,255,0))" }}
                    >
                      <ChevronRight size={18} className="text-purple-500" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={submitLoved}
            disabled={loved.length < 3 || saving}
            className="w-full py-3.5 rounded-full font-bold text-[15px] text-white mt-4 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
          >
            {saving ? "Saving..." : "Continue"}
          </button>
          <button
            onClick={() => {
              setLoved([]);
              goToStep("love");
            }}
            className="mx-auto text-sm text-gray-500 font-medium mt-4"
          >
            None of these — I'll do it later
          </button>
          <p className="text-center text-[12px] text-gray-400 mt-2">
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

        </div>
      </div>
    );

  const titlesShapingDNA = existingTitles.length > 0 ? existingTitles : loved;
  const selectedTopicText = rooms
    .flatMap((roomId) => {
      const room = roomOptions.find((option) => option.id === roomId);
      return [room?.name, ROOM_GENRES[roomId]];
    })
    .filter((topic): topic is string => Boolean(topic))
    .join(" ");
  const normalizedSelectedTopics = normalizeSuggestionText(selectedTopicText);
  const alreadyShapingTitles = new Set(titlesShapingDNA.map((title) => normalizeSuggestionText(title)));
  const shapingGenres = Array.from(new Set(
    titlesShapingDNA.flatMap((title) => {
      const catalogMatch = titleSuggestionCatalog.find((suggestion) => suggestion.title === title);
      return TITLE_GENRES[title] || catalogMatch?.genres || [];
    }),
  ));
  const mediaTitleSuggestions = (() => {
    if (mediaTypes.length === 0) return [];

    const candidates = titleSuggestionCatalog
      .filter((suggestion) => mediaTypes.includes(suggestion.format))
      .filter((suggestion) => !alreadyShapingTitles.has(normalizeSuggestionText(suggestion.title)));
    const scoredCandidates = candidates.map((suggestion, index) => {
      const topicScore = suggestion.genres.some((genre) =>
        suggestionGenreTerms(genre).some((term) => normalizedSelectedTopics.includes(term)),
      ) ? 3 : 0;
      const dnaSimilarityScore = suggestion.genres.reduce(
        (score, genre) => score + (shapingGenres.some((shapingGenre) => suggestionGenresOverlap(genre, shapingGenre)) ? 4 : 0),
        0,
      );
      return { suggestion, score: topicScore + dnaSimilarityScore, index };
    });
    const relevantCandidates = scoredCandidates.filter(({ score }) => score > 0);

    // Prefer titles matching the selected topics, but keep useful format-based
    // suggestions visible when the curated genre set has no exact match.
    return (relevantCandidates.length > 0 ? relevantCandidates : scoredCandidates)
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, 6)
      .map(({ suggestion }) => suggestion);
  })();
  const driversQuestion = questionByOrder(5);

  const dnaHeader = (currentStep: number, stepLabel: string, onBack?: () => void) => (
    <div
      className="px-5 pt-5 pb-6 text-white"
      style={{ background: "linear-gradient(135deg, #0f0a2e 0%, #2e1065 55%, #4c1d95 100%)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-sm text-white/60 hover:text-white transition-colors">
          Back
        </button>
        <button onClick={() => leaveForNow()} className="text-xs text-white/70 hover:text-white">
          Skip for now
        </button>
      </div>
      <div className="flex flex-col items-center text-center">
        <Dna className="text-purple-200 mb-3" size={28} />
        <h1 className="max-w-[340px] text-[26px] leading-[1.15] font-bold" style={{ fontFamily: "Poppins, sans-serif" }}>
          {DNA_HEADER_MESSAGES[currentStep]}
        </h1>
      </div>
      <p className="text-white/50 text-xs mt-3 text-center">{stepLabel}</p>
      <div className="flex items-center justify-center gap-2 mt-3" aria-label={stepLabel}>
        {[1, 2, 3, 4, 5].map((stepNumber) => (
          <span
            key={stepNumber}
            className="h-2 w-2 rounded-full transition-all"
            style={{
              background: stepNumber <= currentStep ? "#e879f9" : "rgba(255,255,255,0.2)",
              boxShadow: stepNumber <= currentStep ? "0 0 8px rgba(232,121,249,0.65)" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );

  if ((step === "love" || step === "drivers") && (questionsLoading || resumePrefillLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f0a2e 0%, #2e1065 55%, #4c1d95 100%)" }}>
        <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
      </div>
    );
  }

  if (step === "love")
    return (
      <div className="min-h-screen w-full flex items-stretch justify-center bg-gray-100">
        <div className="w-full max-w-[430px] flex flex-col relative bg-white">
          {dnaHeader(4, "Step 4 of 5", () => {
            if (resumeDNA && hasExistingProfile) leaveForNow();
            else goToStep("loved");
          })}
          <div className="flex-1 px-6 pt-6 pb-4 bg-white">
            <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600 mb-1.5">TELL US ANYTHING</p>
            <h2 className="text-[26px] leading-[1.15] font-black text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
              What do you love?
            </h2>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-purple-50 px-4 py-3.5">
              <Dna size={18} className="shrink-0 text-purple-600" />
              <p className="text-[14px] text-gray-800">This makes your DNA even more accurate and personalized.</p>
            </div>
            <div className="relative mt-4">
              <textarea
                value={loveNote}
                onChange={(event) => setLoveNote(event.target.value)}
                placeholder="Share anything you love..."
                className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:border-purple-400 focus:outline-none min-h-[160px] resize-none text-gray-900 placeholder:text-gray-400 text-[15px]"
                data-testid="dna-love-input"
              />
              <Feather size={16} className="absolute bottom-4 right-4 text-gray-400 pointer-events-none" />
            </div>
            <p className="ml-2 mt-2 text-[12px] leading-relaxed text-gray-400">
              <span className="font-semibold text-gray-500">Need ideas?</span> Your comfort show. A movie you&apos;ll defend forever. A book you couldn&apos;t put down. An album on repeat. Your team. Your current obsession.
            </p>
            {mediaTitleSuggestions.length > 0 && (
              <div className="mt-4">
                <p className="ml-2 text-[12px] font-semibold text-gray-500 mb-2">Suggestions based on your picks</p>
                <div className="flex flex-wrap gap-2">
                  {mediaTitleSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.format}-${suggestion.title}`}
                      type="button"
                      onClick={() => {
                        setLoveNote((current) => {
                          if (current.toLowerCase().includes(suggestion.title.toLowerCase())) return current;
                          const trimmed = current.trimEnd();
                          return trimmed
                            ? `${trimmed}${/[.!?]$/.test(trimmed) ? " " : ", "}${suggestion.title}`
                            : suggestion.title;
                        });
                      }}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100 active:scale-95"
                      data-testid="dna-title-suggestion"
                    >
                      + {suggestion.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {saveError && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                {saveError}
              </p>
            )}
          </div>
          <div className="px-6 pb-10 bg-white">
            <button
              onClick={submitLoveStep}
              disabled={saving}
              className="w-full text-white font-semibold rounded-full py-3.5 text-base shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
            >
              {saving ? "Saving..." : "Continue"}
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              onClick={submitLoveStep}
              disabled={saving}
              className="w-full mt-4 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-50"
            >
              Skip to next page
            </button>
          </div>
        </div>
      </div>
    );

  if (step === "drivers")
    return (
      <div className="min-h-screen w-full flex items-stretch justify-center bg-gray-100">
        <div className="w-full max-w-[430px] flex flex-col relative bg-white">
          {dnaHeader(5, "Step 5 of 5 — Almost ready", () => goToStep("love"))}
          <div className="flex-1 px-5 pt-6 pb-4 bg-white">
            <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600 mb-1.5">LAST QUESTION — ALMOST DONE</p>
            <h2 className="text-[22px] leading-[1.15] font-black text-gray-900 mb-1" style={{ fontFamily: "Poppins, sans-serif" }}>
              When you press play, what are you hoping for?
            </h2>
            <p className="text-[13px] text-gray-400 mt-1 mb-4">Select as many as you want.</p>
            {generationError && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {generationError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {(driversQuestion?.options || []).map((option, index) => {
                const on = drivers.includes(option);
                const Icon = driverIcon(option);
                const isLastOdd = index === (driversQuestion?.options?.length || 0) - 1 && (driversQuestion?.options?.length || 0) % 2 === 1;
                return (
                  <button
                    key={option}
                    onClick={() => toggleDriver(option)}
                    className={`relative flex items-center gap-3 px-3.5 py-3.5 rounded-2xl border text-left transition-all active:scale-95 ${isLastOdd ? "col-span-2" : ""}`}
                    style={{
                      borderColor: on ? "#7c3aed" : "rgb(229,231,235)",
                      background: on ? "#f6f3fd" : "white",
                    }}
                  >
                    {Icon && <Icon size={20} className="text-purple-600 shrink-0" />}
                    <span className="text-[13px] font-medium text-gray-900 leading-snug">{option}</span>
                    {on && (
                      <span className="absolute right-3 top-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#6d28d9" }}>
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-5 pb-10 bg-white">
            <button
              onClick={generateDNA}
              disabled={drivers.length === 0 || isGenerating}
              className="w-full text-white font-semibold rounded-full py-4 text-base shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
            >
              Discover Your DNA
            </button>
          </div>
        </div>
      </div>
    );

  if (step === "generating")
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="max-w-[430px] w-full bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Dna className="text-white animate-spin" size={40} style={{ animationDuration: "3s" }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Discovering Your Entertainment DNA</h1>
          <p className="text-gray-700 mb-6 text-lg font-medium animate-pulse">Crafting your DNA profile...</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">This usually takes 30–60 seconds</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
      <div className="max-w-[430px] w-full bg-white rounded-3xl p-7 shadow-2xl text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-5">
          <Dna className="text-white" size={40} />
        </div>
        <p className="text-[11px] tracking-[0.18em] font-bold text-purple-600 uppercase">Your Entertainment DNA</p>
        <h1 className="text-3xl font-black text-gray-900 mt-2" style={{ fontFamily: "Poppins, sans-serif" }}>
          {generatedProfile?.label || "Your DNA is ready"}
        </h1>
        {generatedProfile?.tagline && <p className="text-gray-600 mt-3 text-base">{generatedProfile.tagline}</p>}
        {generatedProfile?.flavor_notes && generatedProfile.flavor_notes.length > 0 && (
          <div className="mt-6 rounded-2xl bg-purple-50 p-4 text-left">
            <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-purple-600" />
              Your Flavor Notes
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {generatedProfile.flavor_notes.slice(0, 3).map((note) => <li key={note}>• {note}</li>)}
            </ul>
          </div>
        )}
        {generatedProfile?.profile_text && (
          <p className="mt-5 text-sm leading-relaxed text-gray-700">{generatedProfile.profile_text}</p>
        )}
        <button
          onClick={() => completeAndNavigate("/profile")}
          className="w-full mt-7 py-3.5 rounded-full font-bold text-[15px] text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
        >
          See my DNA profile
        </button>
        <button onClick={() => completeAndNavigate("/activity")} className="mt-4 text-sm font-medium text-purple-700">
          Go to feed
        </button>
      </div>
    </div>
  );
}
