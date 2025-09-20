import { useState } from "react";
import { X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  audience?: "top-fans" | "all";
}

export default function ShareUpdateDialog({ isOpen, onClose, audience = "all" }: ShareUpdateDialogProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["all"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [thoughts, setThoughts] = useState("");
  const [rating, setRating] = useState<string>("");
  const [starHover, setStarHover] = useState<number>(0);

  const mediaTypes = [
    { id: "all", label: "All Types" },
    { id: "movies", label: "Movies" },
    { id: "tv", label: "TV Shows" },
    { id: "books", label: "Books" },
    { id: "podcasts", label: "Podcasts" },
    { id: "music", label: "Music" },
    { id: "youtube", label: "YouTube" },
    { id: "sports", label: "Sports" }
  ];

  const handleTypeToggle = (typeId: string) => {
    if (typeId === "all") {
      setSelectedTypes(selectedTypes.includes("all") ? [] : ["all"]);
    } else {
      const newSelected = selectedTypes.filter(t => t !== "all");
      if (newSelected.includes(typeId)) {
        setSelectedTypes(newSelected.filter(t => t !== typeId));
      } else {
        setSelectedTypes([...newSelected, typeId]);
      }
    }
  };

  const handleRatingChange = (value: string) => {
    // Validate rating is between 0-5 and has max 1 decimal place
    const numValue = parseFloat(value);
    if (value === "" || (numValue >= 0 && numValue <= 5 && /^\d*\.?\d{0,1}$/.test(value))) {
      setRating(value);
    }
  };

  const handleStarClick = (starValue: number) => {
    setRating(starValue.toString());
  };

  const handlePost = () => {
    // Handle posting logic here
    console.log("Posting update:", { selectedTypes, searchQuery, thoughts, rating });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Share Update</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
            data-testid="close-share-dialog"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <p className="text-gray-600 mb-4">Share your entertainment experience with your friends.</p>

        {/* Media Types Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Media Types to Search</h3>
          <div className="grid grid-cols-2 gap-3">
            {mediaTypes.map((type) => (
              <label key={type.id} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type.id)}
                  onChange={() => handleTypeToggle(type.id)}
                  className="w-5 h-5 text-purple-600 border-2 border-gray-300 rounded focus:ring-purple-500"
                  data-testid={`checkbox-${type.id}`}
                />
                <span className="text-gray-700 font-medium">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Search for Media</h3>
          <input
            type="text"
            placeholder="Search for movies, TV shows, books, podcasts, music, sports, YouTube videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            data-testid="search-media-input"
          />
        </div>

        {/* Rating Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Rate this media (optional)</h3>
          <div className="flex items-center space-x-4">
            {/* Star Rating */}
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => setStarHover(star)}
                  onMouseLeave={() => setStarHover(0)}
                  className="transition-colors"
                  data-testid={`star-${star}`}
                >
                  <Star
                    size={24}
                    className={`${
                      star <= (starHover || parseFloat(rating) || 0)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>

            {/* Decimal Rating Input */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={rating}
                onChange={(e) => handleRatingChange(e.target.value)}
                placeholder="0"
                className="w-16 px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="rating-input"
              />
              <span className="text-gray-500 text-sm">(0–5)</span>
            </div>
          </div>
        </div>

        {/* Thoughts Textarea */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Thoughts (Review)</h3>
          <div className="relative">
            <textarea
              placeholder="Share your thoughts about this media..."
              value={thoughts}
              onChange={(e) => setThoughts(e.target.value)}
              maxLength={500}
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              data-testid="thoughts-textarea"
            />
            <div className="absolute bottom-3 right-3 text-sm text-gray-400">
              {thoughts.length}/500
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 bg-purple-700 text-white hover:bg-purple-800"
            data-testid="cancel-share"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePost}
            className={`flex-1 text-white ${
              audience === "top-fans" 
                ? "bg-purple-700 hover:bg-purple-800" 
                : "bg-blue-600 hover:bg-blue-700"
            }`}
            data-testid="post-share"
          >
            {audience === "top-fans" ? "Share to Top Fans" : "Share to All"}
          </Button>
        </div>
      </div>
    </div>
  );
}