export interface MovieCollectionSummary {
  id: string;
  title: string;
  image: string;
}

export interface MovieCollectionFilm {
  title: string;
  type: "movie";
  external_id: string;
  external_source: "tmdb";
  image: string;
  year?: number;
}

export interface MovieCollectionDetails extends MovieCollectionSummary {
  movies: MovieCollectionFilm[];
}
