import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import UserProfile from "./user-profile";

export default function ProfileByUsername() {
  const { username } = useParams<{ username: string }>();
  const [, setLocation] = useLocation();
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    supabase
      .from("users")
      .select("id")
      .eq("user_name", username)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          setLocation(`/user/${data.id}`, { replace: true });
        }
      });
  }, [username]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 font-medium">User not found</p>
          <p className="text-sm text-gray-400 mt-1">@{username}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
    </div>
  );
}
