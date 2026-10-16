// Frozen checkpoint manifest, not an endorsement of any proposed connection.
export const SOURCES = [
  { key:"animals-film",title:"Animals",type:"movie",creator:"Ben Affleck",year:2026,why:"New release, ambiguous title, and the original bad-match example." },
  { key:"white-lotus",title:"The White Lotus",type:"tv",creator:"Mike White",year:2021,why:"Social satire: wealthy-people subject overlap versus actual appeal." },
  { key:"succession",title:"Succession",type:"tv",creator:"Jesse Armstrong",year:2018,why:"Dark family comedy versus superficially similar rich-family stories." },
  { key:"frances-ha",title:"Frances Ha",type:"movie",creator:"Noah Baumbach",year:2013,why:"Intimate character experience, unlike the Animals thriller." },
  { key:"never-let-me-go",title:"Never Let Me Go",type:"book",creator:"Kazuo Ishiguro",why:"Quiet speculative fiction and a direct screen adaptation." },
  { key:"station-eleven",title:"Station Eleven",type:"book",creator:"Emily St. John Mandel",why:"Hope, art and survival versus bleak apocalypse; adaptation." },
  { key:"big-little-lies",title:"Big Little Lies",type:"book",creator:"Liane Moriarty",why:"Family secrets, satire, suspense and a verified adaptation." },
  { key:"the-road",title:"The Road",type:"book",creator:"Cormac McCarthy",why:"Same apocalypse subject as Station Eleven, different experience." },
  { key:"carrie-lowell",title:"Carrie & Lowell",type:"music",creator:"Sufjan Stevens",why:"Intimate grief across formats; deliberately thin music metadata." },
  { key:"animals-album",title:"Animals",type:"music",creator:"Pink Floyd",why:"Exact-title collision with the film; music evidence limits." },
  { key:"heavyweight",title:"Heavyweight",type:"podcast",creator:"Gimlet / Pushkin",why:"Reflective nonfiction and emotional repair, not generic true crime." },
  { key:"s-town",title:"S-Town",type:"podcast",creator:"Serial",why:"Narrative nonfiction, mystery and character; show-format evidence." },
] as const;
export const CANDIDATE_SEEDS = [
  {title:"The Good Place",type:"tv",creator:"Michael Schur"},
  {title:"Big Little Lies",type:"tv",creator:"David E. Kelley"},
  {title:"Station Eleven",type:"tv",creator:"Patrick Somerville"},
  {title:"Never Let Me Go",type:"movie",creator:"Mark Romanek"},
  {title:"The Road",type:"movie",creator:"John Hillcoat"},
  {title:"Gone Girl",type:"movie",creator:"David Fincher"},
  {title:"Prisoners",type:"movie",creator:"Denis Villeneuve"},
  {title:"The Farewell",type:"movie",creator:"Lulu Wang"},
  {title:"Fleabag",type:"tv",creator:"Phoebe Waller-Bridge"},
  {title:"Severance",type:"tv",creator:"Dan Erickson"},
  {title:"The Leftovers",type:"tv",creator:"Damon Lindelof"},
  {title:"Klara and the Sun",type:"book",creator:"Kazuo Ishiguro"},
  {title:"The Remains of the Day",type:"book",creator:"Kazuo Ishiguro"},
  {title:"Little Fires Everywhere",type:"book",creator:"Celeste Ng"},
  {title:"The Glass Hotel",type:"book",creator:"Emily St. John Mandel"},
  {title:"The Goldfinch",type:"book",creator:"Donna Tartt"},
  {title:"The Art of Racing in the Rain",type:"book",creator:"Garth Stein"},
  {title:"Serial",type:"podcast",creator:"Serial"},
  {title:"This American Life",type:"podcast",creator:"This American Life"},
  {title:"Punisher",type:"music",creator:"Phoebe Bridgers"},
  {title:"In Rainbows",type:"music",creator:"Radiohead"},
  {title:"Wish You Were Here",type:"music",creator:"Pink Floyd"},
] as const;
export const CHECKPOINT = "small-lab-1";
export const MAX_ITEMS = 48;
export const SPEND_CAP = 0.75; // Also enforced transactionally in the database.
