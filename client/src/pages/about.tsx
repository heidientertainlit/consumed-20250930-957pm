import { Link } from "wouter";
import { ArrowLeft, Heart, Sparkles, Users, Gamepad2, Trophy, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navigation />
      
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <Link href="/">
          <Button variant="ghost" className="mb-6 text-purple-600 hover:text-purple-700">
            <ArrowLeft size={18} className="mr-2" />
            Back to Feed
          </Button>
        </Link>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-8 text-white">
            <h1 className="text-3xl font-bold mb-2">Why Consumed?</h1>
            <p className="text-purple-100 text-lg">The story behind bringing entertainment lovers together</p>
          </div>

          <div className="p-8 space-y-8">
            <section>
              <p className="text-gray-700 text-lg leading-relaxed">
                Entertainment is one of the easiest, most natural ways humans connect — the shows we binge, the books we love, the characters we root for, the teams we obsess over. Yet today, all those conversations and communities are scattered across a dozen platforms. Goodreads is for books. Letterboxd is for movies. TV lives somewhere else. Music somewhere else. Predictions somewhere else. Trivia somewhere else. And none of it feels interactive or connected.
              </p>
            </section>

            <section className="bg-purple-50 rounded-xl p-6 border border-purple-100">
              <p className="text-gray-800 font-medium text-lg mb-4">There was no single place where all entertainment — and all the social connection around it — actually lived together.</p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  No place to track everything you watch, read, listen to, and play.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  No place to compete with friends.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  No place to make predictions, play trivia, share takes, or discover what everyone else is obsessed with.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  No place to truly connect through the entertainment you already love.
                </li>
              </ul>
            </section>

            <section className="text-center py-4">
              <p className="text-2xl font-bold text-purple-600">Consumed exists to fix that.</p>
              <p className="text-gray-600 mt-2">To bring people together again through the thing we all share: what we consume.</p>
            </section>

            <hr className="border-gray-200" />

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Sparkles className="text-purple-500" size={24} />
                What is Consumed?
              </h2>
              <p className="text-gray-700 text-lg mb-6">
                Consumed is the home for all your entertainment — and all the fun around it.
              </p>
              
              <p className="text-gray-800 font-medium mb-4">A place where you can:</p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <BookOpen className="text-purple-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-gray-700">Track what you're watching, reading, listening to, and playing</span>
                </div>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <Heart className="text-purple-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-gray-700">Share opinions, rank things, and ask for recommendations</span>
                </div>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <Trophy className="text-purple-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-gray-700">Make predictions about shows, reality TV, sports, awards, and pop culture</span>
                </div>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <Gamepad2 className="text-purple-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-gray-700">Play trivia and compete with friends</span>
                </div>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <Sparkles className="text-purple-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-gray-700">Discover what's trending and what's actually worth watching</span>
                </div>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <Users className="text-purple-500 flex-shrink-0 mt-1" size={20} />
                  <span className="text-gray-700">Connect through shared tastes and fandoms</span>
                </div>
              </div>
            </section>

            <section className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-xl p-6 text-center">
              <p className="text-gray-800 text-lg leading-relaxed">
                It's social. It's interactive. It's competitive in a friendly way.<br />
                <span className="font-bold text-purple-700">It's all your entertainment — finally in one place.</span>
              </p>
              <p className="text-gray-700 mt-4">
                Consumed isn't another social network.<br />
                It's a <span className="font-semibold">connection network</span> built around the stories, characters, and media that already bring us together.
              </p>
            </section>

            <hr className="border-gray-200" />

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Heart className="text-purple-500" size={24} />
                Who Created It?
              </h2>
              
              <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
                <p>
                  Consumed was founded by Heidi, a lifelong entertainment lover who spent nearly 20 years in political marketing — a world built on persuasion, division, and noise. After years helping craft messages that split people into sides, she realized she wanted to build something that did the opposite.
                </p>
                
                <div className="bg-purple-50 rounded-xl p-6 my-6">
                  <p className="text-purple-800 font-medium">
                    Something joyful.<br />
                    Something connective.<br />
                    Something fueled by curiosity, not outrage.<br />
                    Something that brought people back together.
                  </p>
                </div>
                
                <p>
                  The idea hit during a late-night Goodreads scroll — her favorite escape from the negativity of social media. Goodreads was great, but it only covered books. Where was the platform for everything else we consume? The shows we binge, the podcasts we quote, the games we play, the music we love, the predictions we make, the debates we live for?
                </p>
                
                <p className="font-medium text-gray-800">
                  It didn't exist. So she taught herself to build it.
                </p>
                
                <p className="text-gray-600 italic">
                  No team. No funding. Just grit, determination, too many open tabs, and feedback from friends who believed in the vision.
                </p>
                
                <p>
                  Today, Consumed is growing into exactly what she wished existed: a space where entertainment creates connection, not division — and where people feel part of something again.
                </p>
              </div>
            </section>

            <section className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-8 text-center text-white">
              <p className="text-2xl font-bold mb-2">Play. Predict. Connect.</p>
              <p className="text-3xl font-bold">Get Consumed.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
