import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function ResponsibleGaming() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Responsible Gaming</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 mb-4">
            <strong>Last Updated:</strong> January 2026
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Our Commitment</h2>
          <p className="text-gray-600 mb-4">
            Consumed is committed to promoting responsible gaming practices. While our platform features entertainment-based games, predictions, and social competitions, we prioritize the well-being of our users.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">What We Offer</h2>
          <p className="text-gray-600 mb-4">
            Our games are designed for entertainment purposes only. We offer:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Trivia challenges about movies, TV, music, and more</li>
            <li>Prediction games for awards shows and entertainment events</li>
            <li>Social polls and voting on entertainment topics</li>
            <li>Friendly leaderboard competitions with friends</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">No Real Money Gambling</h2>
          <p className="text-gray-600 mb-4">
            Consumed does not involve real money gambling or wagering. Points and leaderboard positions are for entertainment and bragging rights only.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Healthy Gaming Tips</h2>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>Set time limits for app usage</li>
            <li>Take regular breaks</li>
            <li>Remember that games are meant to be fun, not stressful</li>
            <li>Engage with friends in a positive, supportive way</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Support Resources</h2>
          <p className="text-gray-600 mb-4">
            If you or someone you know is struggling with gaming habits, we encourage reaching out to support resources:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-4">
            <li>National Council on Problem Gambling: 1-800-522-4700</li>
            <li>SAMHSA National Helpline: 1-800-662-4357</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Contact Us</h2>
          <p className="text-gray-600 mb-4">
            Questions or concerns? Contact us at support@consumed.app
          </p>
        </div>
      </div>
    </div>
  );
}
