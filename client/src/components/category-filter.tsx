import { Button } from "@/components/ui/button";

interface CategoryFilterProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  const categories = [
    { id: "all", name: "All Pools" },
    { id: "movies", name: "Movies" },
    { id: "tv", name: "TV Shows" },
    { id: "books", name: "Books" },
    { id: "pop-culture", name: "Pop Culture" },
    { id: "ending-soon", name: "Ending Soon" },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(category.id)}
            className={
              selectedCategory === category.id
                ? "gradient-primary text-white border-0"
                : "bg-dark-secondary border-dark-accent hover:border-purple-primary transition-colors"
            }
          >
            {category.name}
          </Button>
        ))}
      </div>
    </section>
  );
}
