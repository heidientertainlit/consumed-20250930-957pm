import { Trophy } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-dark-secondary border-t border-dark-accent py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                <Trophy className="text-white text-sm" size={16} />
              </div>
              <span className="text-xl font-bold gradient-text">entertainmint</span>
            </div>
            <p className="text-gray-400 text-sm">
              Make predictions on your favorite entertainment and win points in our prediction pools.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Categories</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-purple-primary transition-colors">Movies</a></li>
              <li><a href="#" className="hover:text-purple-primary transition-colors">TV Shows</a></li>
              <li><a href="#" className="hover:text-purple-primary transition-colors">Books</a></li>
              <li><a href="#" className="hover:text-purple-primary transition-colors">Pop Culture</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-purple-primary transition-colors">How It Works</a></li>
              <li><a href="#" className="hover:text-purple-primary transition-colors">FAQ</a></li>
              <li><a href="#" className="hover:text-purple-primary transition-colors">Contact Us</a></li>
              <li><a href="#" className="hover:text-purple-primary transition-colors">Rules</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="#" className="hover:text-purple-primary transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-purple-primary transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-purple-primary transition-colors">Responsible Gaming</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-dark-accent mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; 2024 entertainmint. All rights reserved. Play responsibly with points-based predictions.</p>
        </div>
      </div>
    </footer>
  );
}
