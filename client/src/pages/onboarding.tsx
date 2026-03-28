import { useLocation } from "wouter";
import { Dna, Users, Brain, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

const PATHS = [
  {
    icon: Dna,
    title: "Find Your Entertainment DNA",
    description: "Map your taste across books, shows, movies, music, and more.",
    route: "/entertainment-dna",
    gradient: "from-violet-600/20 to-purple-900/30",
    border: "border-violet-500/30",
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/15",
  },
  {
    icon: Users,
    title: "See What Everyone's Into",
    description: "Jump into the social feed and see what people are watching, reading, and listening to right now.",
    route: "/activity",
    gradient: "from-blue-600/20 to-indigo-900/30",
    border: "border-blue-500/30",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/15",
  },
  {
    icon: Brain,
    title: "Play Trivia",
    description: "Test your knowledge and start your streak.",
    route: "/play",
    gradient: "from-emerald-600/20 to-teal-900/30",
    border: "border-emerald-500/30",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/15",
  },
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();

  const go = (route: string) => {
    localStorage.setItem("consumed_onboarded", "true");
    setLocation(route);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #0d0618 0%, #130d2a 40%, #0a1628 100%)" }}
    >
      {/* App bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <img src="/consumed-logo-new.png" alt="Consumed" className="h-8 w-auto" />
        <button
          onClick={() => go("/activity")}
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-5 pt-8 pb-10 max-w-md mx-auto w-full">

        {/* Headline */}
        <div className="mb-10">
          <h1
            className="text-[1.75rem] font-bold text-white leading-tight mb-3"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Welcome to the social layer of entertainment.
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Start where you want — discover your Entertainment DNA, see what everyone's into, or jump straight into trivia.
          </p>
        </div>

        {/* Path cards */}
        <div className="space-y-3">
          {PATHS.map(({ icon: Icon, title, description, route, gradient, border, iconColor, iconBg }) => (
            <button
              key={route}
              onClick={() => go(route)}
              className={`w-full text-left rounded-2xl border bg-gradient-to-br ${gradient} ${border} p-4 flex items-start gap-4 hover:border-white/20 hover:bg-white/5 transition-all group active:scale-[0.98]`}
            >
              <div className={`flex-shrink-0 w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center mt-0.5`}>
                <Icon size={22} className={iconColor} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight mb-1">{title}</p>
                <p className="text-white/45 text-xs leading-relaxed">{description}</p>
              </div>
              <ChevronRight
                size={16}
                className="flex-shrink-0 text-white/20 group-hover:text-white/40 transition-colors mt-1"
              />
            </button>
          ))}
        </div>

        {/* Bottom hint */}
        <p className="text-center text-white/25 text-xs mt-8">
          You can always change your preferences later in your profile.
        </p>

      </div>
    </div>
  );
}
