import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { Loader2, Users, ListChecks, ChevronRight } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TOOLS = [
  {
    path: "/admin/personas",
    icon: Users,
    title: "Generate Persona Posts",
    description: "Create, review, and schedule AI-generated posts for bot personas. Control tone, media type, and timing.",
    color: "from-purple-900/40 to-purple-800/20 border-purple-700/40",
    iconColor: "text-purple-400",
    iconBg: "bg-purple-900/50",
  },
  {
    path: "/admin/trivia-polls",
    icon: ListChecks,
    title: "Generate Trivia & Polls",
    description: "Use AI to generate platform-owned trivia questions and polls. Content posts as Consumed, not as a user.",
    color: "from-blue-900/40 to-blue-800/20 border-blue-700/40",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-900/50",
  },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: currentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-profile-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("users")
        .select("id, user_name, is_admin")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!profileLoading && currentProfile && !currentProfile.is_admin) {
      setLocation("/");
    }
  }, [currentProfile, profileLoading]);

  if (profileLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (!currentProfile?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Access restricted</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Admin</h1>
          <p className="text-gray-400 text-sm">Consumed content management tools</p>
        </div>

        <div className="space-y-4">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.path}
                onClick={() => setLocation(tool.path)}
                className={`w-full text-left bg-gradient-to-br ${tool.color} border rounded-2xl p-6 flex items-center gap-5 hover:opacity-90 transition-all group`}
              >
                <div className={`${tool.iconBg} rounded-xl p-3 flex-shrink-0`}>
                  <Icon size={24} className={tool.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-white mb-1">{tool.title}</p>
                  <p className="text-sm text-gray-400 leading-snug">{tool.description}</p>
                </div>
                <ChevronRight size={18} className="text-gray-500 group-hover:text-gray-300 flex-shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
