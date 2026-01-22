import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const multiQuestionChallenges = [
  {
    id: "trivia-movie-quotes-finish-the-line",
    title: "Movie Quotes: Finish the Line",
    type: "trivia",
    category: "Movies",
    status: "open",
    points_reward: 25,
    icon: "film",
    origin_type: "consumed",
    options: [
      { question: "I will be back - who said it?", options: ["Sylvester Stallone", "Arnold Schwarzenegger", "Bruce Willis", "Tom Cruise"], answer: "Arnold Schwarzenegger" },
      { question: "Here's looking at you, ___", options: ["darling", "sweetheart", "kid", "love"], answer: "kid" },
      { question: "May the ___ be with you", options: ["power", "force", "light", "spirit"], answer: "force" },
      { question: "You can't handle the ___!", options: ["pressure", "truth", "pain", "reality"], answer: "truth" },
      { question: "Life is like a box of ___", options: ["surprises", "chocolates", "mysteries", "gifts"], answer: "chocolates" },
      { question: "I see ___ people", options: ["dead", "strange", "ghost", "invisible"], answer: "dead" },
      { question: "To infinity and ___!", options: ["beyond", "forever", "eternity", "above"], answer: "beyond" },
      { question: "Why so ___?", options: ["sad", "angry", "serious", "quiet"], answer: "serious" },
      { question: "I'm the king of the ___!", options: ["world", "universe", "sea", "mountain"], answer: "world" },
      { question: "You talkin' to ___?", options: ["us", "them", "me", "him"], answer: "me" }
    ]
  },
  {
    id: "trivia-name-that-show",
    title: "Name That Show",
    type: "trivia",
    category: "TV",
    status: "open",
    points_reward: 25,
    icon: "tv",
    origin_type: "consumed",
    options: [
      { question: "A chemistry teacher turns to making meth", options: ["Ozark", "Breaking Bad", "The Wire", "Narcos"], answer: "Breaking Bad" },
      { question: "Friends living in a NYC apartment above a coffee shop", options: ["How I Met Your Mother", "Friends", "Seinfeld", "New Girl"], answer: "Friends" },
      { question: "A dysfunctional family runs a banana stand", options: ["Schitt's Creek", "Arrested Development", "Modern Family", "The Office"], answer: "Arrested Development" },
      { question: "Kids in 1980s Indiana encounter supernatural forces", options: ["Dark", "Stranger Things", "The OA", "Locke & Key"], answer: "Stranger Things" },
      { question: "Paper company employees in Scranton, PA", options: ["The Office", "Parks and Recreation", "Brooklyn Nine-Nine", "Superstore"], answer: "The Office" },
      { question: "A family of dragons fights for the Iron Throne", options: ["The Witcher", "Game of Thrones", "House of the Dragon", "Rings of Power"], answer: "Game of Thrones" },
      { question: "A high school teacher becomes a zombie and solves crimes", options: ["Santa Clarita Diet", "iZombie", "Dead Like Me", "Pushing Daisies"], answer: "iZombie" },
      { question: "Lawyers at a top NYC firm, one has a secret", options: ["The Good Wife", "Suits", "Boston Legal", "How to Get Away with Murder"], answer: "Suits" },
      { question: "Wealthy family loses everything and moves to a small town", options: ["Arrested Development", "Schitt's Creek", "Succession", "The Great"], answer: "Schitt's Creek" },
      { question: "FBI agents investigate paranormal cases", options: ["Fringe", "The X-Files", "Supernatural", "Warehouse 13"], answer: "The X-Files" }
    ]
  },
  {
    id: "trivia-celebrity-couples-then-or-now",
    title: "Celebrity Couples: Then or Now",
    type: "trivia",
    category: "TV",
    status: "open",
    points_reward: 25,
    icon: "heart",
    origin_type: "consumed",
    options: [
      { question: "Brad Pitt & Angelina Jolie", options: ["Together", "Split"], answer: "Split" },
      { question: "Blake Lively & Ryan Reynolds", options: ["Together", "Split"], answer: "Together" },
      { question: "Jennifer Lopez & Ben Affleck", options: ["Together", "Split"], answer: "Together" },
      { question: "Johnny Depp & Amber Heard", options: ["Together", "Split"], answer: "Split" },
      { question: "Beyoncé & Jay-Z", options: ["Together", "Split"], answer: "Together" },
      { question: "Chris Pratt & Anna Faris", options: ["Together", "Split"], answer: "Split" },
      { question: "Channing Tatum & Jenna Dewan", options: ["Together", "Split"], answer: "Split" },
      { question: "Mila Kunis & Ashton Kutcher", options: ["Together", "Split"], answer: "Together" },
      { question: "Miley Cyrus & Liam Hemsworth", options: ["Together", "Split"], answer: "Split" },
      { question: "John Legend & Chrissy Teigen", options: ["Together", "Split"], answer: "Together" }
    ]
  },
  {
    id: "trivia-ultimate-pop-culture-timeline",
    title: "Ultimate Pop Culture Timeline",
    type: "trivia",
    category: "TV",
    status: "open",
    points_reward: 25,
    icon: "clock",
    origin_type: "consumed",
    options: [
      { question: "iPhone released", options: ["2005", "2007", "2009", "2010"], answer: "2007" },
      { question: "Friends final episode aired", options: ["2002", "2004", "2006", "2008"], answer: "2004" },
      { question: "Twilight first movie released", options: ["2006", "2008", "2010", "2012"], answer: "2008" },
      { question: "The Avengers (first movie) released", options: ["2010", "2012", "2014", "2016"], answer: "2012" },
      { question: "Gangnam Style went viral", options: ["2010", "2011", "2012", "2013"], answer: "2012" },
      { question: "Netflix launched streaming", options: ["2005", "2007", "2009", "2011"], answer: "2007" },
      { question: "Game of Thrones premiered", options: ["2009", "2011", "2013", "2015"], answer: "2011" },
      { question: "Frozen released", options: ["2011", "2012", "2013", "2014"], answer: "2013" },
      { question: "TikTok launched globally", options: ["2016", "2017", "2018", "2019"], answer: "2018" },
      { question: "Spotify launched in the US", options: ["2009", "2010", "2011", "2012"], answer: "2011" }
    ]
  },
  {
    id: "trivia-mixed-bag-pop-culture-lightning-round",
    title: "Mixed Bag: Pop Culture Lightning Round",
    type: "trivia",
    category: "TV",
    status: "open",
    points_reward: 25,
    icon: "zap",
    origin_type: "consumed",
    options: [
      { question: "What color is Shrek?", options: ["Blue", "Green", "Orange", "Purple"], answer: "Green" },
      { question: "Which Hogwarts house is Harry Potter in?", options: ["Slytherin", "Ravenclaw", "Hufflepuff", "Gryffindor"], answer: "Gryffindor" },
      { question: "Who sings 'Shake It Off'?", options: ["Katy Perry", "Taylor Swift", "Ariana Grande", "Selena Gomez"], answer: "Taylor Swift" },
      { question: "What's the name of the coffee shop in Friends?", options: ["The Brew", "Central Perk", "Coffee Bean", "Mocha Joe's"], answer: "Central Perk" },
      { question: "What animal is Simba?", options: ["Tiger", "Bear", "Lion", "Panther"], answer: "Lion" },
      { question: "Who plays Iron Man?", options: ["Chris Evans", "Chris Hemsworth", "Robert Downey Jr.", "Mark Ruffalo"], answer: "Robert Downey Jr." },
      { question: "What game features a battle royale on an island?", options: ["Minecraft", "Fortnite", "Call of Duty", "Roblox"], answer: "Fortnite" },
      { question: "Which Disney princess has ice powers?", options: ["Moana", "Rapunzel", "Elsa", "Belle"], answer: "Elsa" },
      { question: "What streaming service made Squid Game?", options: ["Hulu", "Amazon Prime", "Netflix", "Disney+"], answer: "Netflix" },
      { question: "Which band sang 'Bohemian Rhapsody'?", options: ["The Beatles", "Queen", "Led Zeppelin", "Pink Floyd"], answer: "Queen" }
    ]
  },
  {
    id: "trivia-famous-podcasts-can-you-name-it",
    title: "Famous Podcasts: Can You Name It?",
    type: "trivia",
    category: "Podcasts",
    status: "open",
    points_reward: 25,
    icon: "mic",
    origin_type: "consumed",
    options: [
      { question: "True crime podcast that investigated Adnan Syed's case", options: ["My Favorite Murder", "Serial", "Crime Junkie", "Casefile"], answer: "Serial" },
      { question: "Joe Rogan's long-form interview show", options: ["Armchair Expert", "The Joe Rogan Experience", "WTF with Marc Maron", "Conan O'Brien Needs a Friend"], answer: "The Joe Rogan Experience" },
      { question: "NPR's storytelling show featuring Ira Glass", options: ["Radiolab", "This American Life", "Invisibilia", "Planet Money"], answer: "This American Life" },
      { question: "Comedy podcast where hosts talk about murder", options: ["My Favorite Murder", "Last Podcast on the Left", "Serial Killers", "Morbid"], answer: "My Favorite Murder" },
      { question: "Podcast about unexplained mysteries and the paranormal", options: ["Lore", "Unexplained", "The Black Tapes", "Mysterious Universe"], answer: "Lore" },
      { question: "Dax Shepard's celebrity interview podcast", options: ["SmartLess", "Armchair Expert", "WTF", "Literally!"], answer: "Armchair Expert" },
      { question: "NPR's daily news podcast", options: ["The Daily", "Up First", "Morning Edition", "All Things Considered"], answer: "Up First" },
      { question: "Podcast teaching personal finance basics", options: ["Freakonomics", "Planet Money", "So Money", "The Dave Ramsey Show"], answer: "Planet Money" },
      { question: "Will Ferrell, Jason Bateman, and Sean Hayes interview show", options: ["Armchair Expert", "Conan Needs a Friend", "SmartLess", "WTF"], answer: "SmartLess" },
      { question: "Science podcast exploring the unknown", options: ["Science Vs", "Radiolab", "Hidden Brain", "Stuff You Should Know"], answer: "Radiolab" }
    ]
  },
  {
    id: "trivia-books-that-became-movies",
    title: "Books That Became Movies",
    type: "trivia",
    category: "Books",
    status: "open",
    points_reward: 25,
    icon: "book",
    origin_type: "consumed",
    options: [
      { question: "Who wrote the Harry Potter series?", options: ["Stephenie Meyer", "Suzanne Collins", "J.K. Rowling", "Rick Riordan"], answer: "J.K. Rowling" },
      { question: "The Hunger Games was written by?", options: ["Veronica Roth", "Suzanne Collins", "James Dashner", "Lois Lowry"], answer: "Suzanne Collins" },
      { question: "Who wrote The Lord of the Rings?", options: ["C.S. Lewis", "George R.R. Martin", "J.R.R. Tolkien", "Terry Pratchett"], answer: "J.R.R. Tolkien" },
      { question: "Gone Girl was written by?", options: ["Gillian Flynn", "Paula Hawkins", "Lisa Jewell", "Ruth Ware"], answer: "Gillian Flynn" },
      { question: "The Fault in Our Stars author?", options: ["Rainbow Rowell", "John Green", "Colleen Hoover", "Nicholas Sparks"], answer: "John Green" },
      { question: "Who wrote The Da Vinci Code?", options: ["Dan Brown", "James Patterson", "Lee Child", "John Grisham"], answer: "Dan Brown" },
      { question: "Twilight series author?", options: ["Stephenie Meyer", "Cassandra Clare", "Richelle Mead", "P.C. Cast"], answer: "Stephenie Meyer" },
      { question: "The Notebook was written by?", options: ["Jojo Moyes", "Colleen Hoover", "Nicholas Sparks", "Nora Roberts"], answer: "Nicholas Sparks" },
      { question: "Who wrote Jurassic Park?", options: ["Stephen King", "Michael Crichton", "Dean Koontz", "Peter Benchley"], answer: "Michael Crichton" },
      { question: "The Martian author?", options: ["Andy Weir", "Ernest Cline", "Blake Crouch", "Hugh Howey"], answer: "Andy Weir" }
    ]
  },
  {
    id: "trivia-movie-release-dates-before-or-after",
    title: "Movie Release Dates: Before or After?",
    type: "trivia",
    category: "Movies",
    status: "open",
    points_reward: 25,
    icon: "calendar",
    origin_type: "consumed",
    options: [
      { question: "Was The Dark Knight released before or after 2010?", options: ["Before 2010", "After 2010"], answer: "Before 2010" },
      { question: "Was Inception released before or after 2008?", options: ["Before 2008", "After 2008"], answer: "After 2008" },
      { question: "Was Avatar released before or after 2010?", options: ["Before 2010", "After 2010"], answer: "Before 2010" },
      { question: "Was The Avengers released before or after 2011?", options: ["Before 2011", "After 2011"], answer: "After 2011" },
      { question: "Was Frozen released before or after 2012?", options: ["Before 2012", "After 2012"], answer: "After 2012" },
      { question: "Was Titanic released before or after 2000?", options: ["Before 2000", "After 2000"], answer: "Before 2000" },
      { question: "Was Black Panther released before or after 2017?", options: ["Before 2017", "After 2017"], answer: "After 2017" },
      { question: "Was The Social Network released before or after 2009?", options: ["Before 2009", "After 2009"], answer: "After 2009" },
      { question: "Was Mad Max: Fury Road released before or after 2014?", options: ["Before 2014", "After 2014"], answer: "After 2014" },
      { question: "Was Interstellar released before or after 2015?", options: ["Before 2015", "After 2015"], answer: "Before 2015" }
    ]
  },
  {
    id: "trivia-sports-quotes-who-said-it",
    title: "Sports Quotes: Who Said It?",
    type: "trivia",
    category: "Sports",
    status: "open",
    points_reward: 25,
    icon: "trophy",
    origin_type: "consumed",
    options: [
      { question: "'I'm the greatest!' - who said it?", options: ["Mike Tyson", "Muhammad Ali", "Floyd Mayweather", "Joe Frazier"], answer: "Muhammad Ali" },
      { question: "'You miss 100% of the shots you don't take'", options: ["Michael Jordan", "LeBron James", "Wayne Gretzky", "Kobe Bryant"], answer: "Wayne Gretzky" },
      { question: "'Hard work beats talent when talent doesn't work hard'", options: ["Tim Tebow", "Kevin Durant", "Tim Notke", "Kobe Bryant"], answer: "Tim Notke" },
      { question: "'It ain't over till it's over'", options: ["Babe Ruth", "Yogi Berra", "Lou Gehrig", "Joe DiMaggio"], answer: "Yogi Berra" },
      { question: "'Just Do It' is associated with which athlete?", options: ["LeBron James", "Tiger Woods", "Michael Jordan", "Serena Williams"], answer: "Michael Jordan" },
      { question: "'Float like a butterfly, sting like a bee'", options: ["Sugar Ray Leonard", "Muhammad Ali", "Oscar De La Hoya", "Manny Pacquiao"], answer: "Muhammad Ali" },
      { question: "'Mamba Mentality' was coined by?", options: ["LeBron James", "Kevin Durant", "Kobe Bryant", "Stephen Curry"], answer: "Kobe Bryant" },
      { question: "'The only way to prove you're a good sport is to lose'", options: ["Ernie Banks", "Phil Jackson", "John Wooden", "Vince Lombardi"], answer: "Ernie Banks" },
      { question: "'I've failed over and over, that's why I succeed'", options: ["Tom Brady", "Michael Jordan", "Magic Johnson", "Larry Bird"], answer: "Michael Jordan" },
      { question: "'Champions keep playing until they get it right'", options: ["Vince Lombardi", "Bear Bryant", "Billie Jean King", "Pat Summit"], answer: "Billie Jean King" }
    ]
  },
  {
    id: "trivia-sports-legends-moments",
    title: "Sports Legends & Moments",
    type: "trivia",
    category: "Sports",
    status: "open",
    points_reward: 25,
    icon: "star",
    origin_type: "consumed",
    options: [
      { question: "Who hit the 'Shot Heard Round the World' in 1951?", options: ["Babe Ruth", "Bobby Thomson", "Joe DiMaggio", "Willie Mays"], answer: "Bobby Thomson" },
      { question: "The 'Miracle on Ice' happened in which Olympics?", options: ["1976", "1980", "1984", "1988"], answer: "1980" },
      { question: "Who caught the 'Immaculate Reception'?", options: ["Lynn Swann", "Franco Harris", "John Stallworth", "Terry Bradshaw"], answer: "Franco Harris" },
      { question: "Michael Jordan's jersey number with the Bulls?", options: ["21", "23", "32", "45"], answer: "23" },
      { question: "Who made the 'Hand of God' goal?", options: ["Pele", "Diego Maradona", "Lionel Messi", "Zinedine Zidane"], answer: "Diego Maradona" },
      { question: "Tom Brady's first Super Bowl win was against?", options: ["Panthers", "Eagles", "Rams", "Seahawks"], answer: "Rams" },
      { question: "Who won 8 consecutive Tour de France titles?", options: ["Lance Armstrong", "Greg LeMond", "Miguel Indurain", "Chris Froome"], answer: "Lance Armstrong" },
      { question: "The 'Rumble in the Jungle' was in which country?", options: ["Philippines", "Zaire", "Mexico", "Nigeria"], answer: "Zaire" },
      { question: "Who scored in the 'Flu Game' in 1997 Finals?", options: ["Scottie Pippen", "Michael Jordan", "Dennis Rodman", "Toni Kukoc"], answer: "Michael Jordan" },
      { question: "Usain Bolt's 100m world record time?", options: ["9.58 seconds", "9.63 seconds", "9.69 seconds", "9.74 seconds"], answer: "9.58 seconds" }
    ]
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const results = [];

    for (const challenge of multiQuestionChallenges) {
      const { error } = await supabaseAdmin
        .from('prediction_pools')
        .upsert(challenge, { onConflict: 'id' });

      results.push({
        id: challenge.id,
        title: challenge.title,
        success: !error,
        error: error?.message
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({ 
      message: `Seeded ${successCount} challenges (${failCount} failed)`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
