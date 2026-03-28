import { useLocation } from "wouter";
import { Dna, Users, Brain, ChevronRight } from "lucide-react";

const PATHS = [
  {
    icon: Dna,
    title: "Find Your Entertainment DNA",
    description: "Map your taste across books, shows, movies, music, and more.",
    route: "/entertainment-dna",
    gradient: "from-violet-50 to-purple-50",
    border: "border-violet-200",
    iconColor: "text-violet-500",
    iconBg: "bg-violet-100",
  },
  {
    icon: Users,
    title: "See What Everyone's Into",
    description: "Jump into the social feed and see what people are watching, reading, and listening to right now.",
    route: "/activity",
    gradient: "from-blue-50 to-indigo-50",
    border: "border-blue-200",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-100",
  },
  {
    icon: Brain,
    title: "Play Trivia",
    description: "Test your knowledge and start your streak.",
    route: "/play",
    gradient: "from-emerald-50 to-teal-50",
    border: "border-emerald-200",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-100",
  },
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();

  const go = (route: string) => {
    localStorage.setItem("consumed_onboarded", "true");
    setLocation(route);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Hero area — dark purple gradient */}
      <div
        className="px-5 pt-5 pb-10"
        style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #12121f 50%, #2d1f4e 100%)" }}
      >
        {/* App bar */}
        <div className="flex items-center justify-between mb-8">
          <img src="/consumed-logo-new.png" alt="Consumed" className="h-8 w-auto" />
          <button
            onClick={() => go("/activity")}
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Headline */}
        <h1
          className="text-[1.75rem] font-bold text-white leading-tight mb-3"
          style={{ fontFamily: "Poppins, sans-serif" }}
        >
          Welcome to the social layer of entertainment.
        </h1>
        <p className="text-white/55 text-sm leading-relaxed">
          Start where you want by discovering your Entertainment DNA, seeing what everyone's into, or jumping straight into games like trivia.
        </p>
      </div>

      {/* Cards area — white */}
      <div className="flex-1 bg-white px-5 pt-6 pb-10">
        <div className="max-w-md mx-auto space-y-3">

          {PATHS.map(({ icon: Icon, title, description, route, gradient, border, iconColor, iconBg }) => (
            <button
              key={route}
              onClick={() => go(route)}
              className={`w-full text-left rounded-2xl border bg-gradient-to-br ${gradient} ${border} p-4 flex items-start gap-4 hover:shadow-sm transition-all group active:scale-[0.98]`}
            >
              <div className={`flex-shrink-0 w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center mt-0.5`}>
                <Icon size={22} className={iconColor} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-semibold text-sm leading-tight mb-1">{title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{description}</p>
              </div>
              <ChevronRight
                size={16}
                className="flex-shrink-0 text-gray-300 group-hover:text-gray-400 transition-colors mt-1"
              />
            </button>
          ))}

          <button
            onClick={() => go("/activity")}
            className="w-full text-center text-purple-600 text-sm font-medium pt-4 hover:text-purple-700 transition-colors"
          >
            take me to the home page &rsaquo;&rsaquo;
          </button>
        </div>
      </div>

    </div>
  );
}
