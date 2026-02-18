import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search as SearchIcon, Sparkles, Loader2, Film, Music, BookOpen, Tv, X, TrendingUp, Heart, Target, User, Plus, Users, Download, RefreshCw, Share2, Dna, Mic, Gamepad2, Clock, BarChart3, Send, Lock, List, ChevronRight, Calendar, Play, Trophy, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import CreateListDialog from "@/components/create-list-dialog";
import { supabase } from "@/lib/supabase";
import html2canvas from "html2canvas";
import { CurrentlyConsumingCard } from "@/components/currently-consuming-card";
import { RecommendationsGlimpse } from "@/components/recommendations-glimpse";

export default function MyLibrary() {
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dna' | 'lists' | 'history' | 'compare'>('lists');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const comparisonCardRef = useRef<HTMLDivElement>(null);
  const [listSearch, setListSearch] = useState('');
  const [mediaHistorySearch, setMediaHistorySearch] = useState('');
  const [mediaHistoryType, setMediaHistoryType] = useState('all');
  const [mediaHistoryYear, setMediaHistoryYear] = useState('all');
  const [mediaHistoryRating, setMediaHistoryRating] = useState('all');
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [historyViewMode, setHistoryViewMode] = useState<'list' | 'grid'>('list');
  const [isGeneratingHistoryImage, setIsGeneratingHistoryImage] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const summaryCardRef = useRef<HTMLDivElement>(null);
  const { session, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['user-stats-dna', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return null;
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-stats?user_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.stats;
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 60000,
  });

  const { data: dnaProfile, isLoading: isLoadingDna, refetch: refetchDna } = useQuery({
    queryKey: ['dna-profile-summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('dna_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const { data: mediaHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['media-history-dna', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return [];
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          id,
          title,
          media_type,
          image_url,
          created_at,
          lists!inner(user_id, title)
        `)
        .eq('lists.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return [];
      return data || [];
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 60000,
  });

  const { data: userLists = [], isLoading: isLoadingLists } = useQuery({
    queryKey: ['user-lists-dna', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return [];
      const { data, error } = await supabase
        .from('lists')
        .select(`
          id,
          title,
          is_default,
          visibility,
          list_items(id)
        `)
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (error) return [];
      return (data || []).map((list: any) => ({
        ...list,
        items: list.list_items || [],
      }));
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 60000,
  });

  const { data: fullMediaHistory = [], isLoading: isLoadingFullHistory } = useQuery({
    queryKey: ['full-media-history-dna', user?.email],
    queryFn: async () => {
      if (!session?.access_token || !user?.email) {
        return [];
      }
      
      const { data: appUser, error: appUserError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (appUserError || !appUser) {
        return [];
      }
      
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          *,
          lists!inner(user_id, title)
        `)
        .eq('lists.user_id', appUser.id)
        .order('id', { ascending: false })
        .limit(100);
      if (error) {
        return [];
      }
      return (data || []).map((item: any) => ({
        ...item,
        listName: item.lists?.title || 'Unknown'
      }));
    },
    enabled: !!session?.access_token && !!user?.email,
    staleTime: 60000,
  });

  const [currentlyItems, setCurrentlyItems] = useState<any[]>([]);
  const [isLoadingCurrently, setIsLoadingCurrently] = useState(false);

  const fetchCurrentlyItems = async () => {
    if (!session?.access_token || !user?.id) return;
    setIsLoadingCurrently(true);
    try {
      const url = `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media?user_id=${user.id}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        const currentlyList = (data.lists || []).find((list: any) => list.title === 'Currently');
        setCurrentlyItems(currentlyList?.items?.slice(0, 10) || []);
      }
    } catch (error) {
      console.error('Error fetching currently items:', error);
    } finally {
      setIsLoadingCurrently(false);
    }
  };

  useEffect(() => {
    if (session?.access_token && user?.id) {
      fetchCurrentlyItems();
    }
  }, [session?.access_token, user?.id]);

  const updateProgressMutation = useMutation({
    mutationFn: async ({ itemId, progress, total, mode, progressDisplay }: { itemId: string; progress: number; total?: number; mode: string; progressDisplay: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const payload = {
        item_id: itemId,
        progress,
        progress_total: total,
        progress_mode: mode,
      };
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/update-item-progress',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData?.error || 'Failed to update progress');
      return { ...responseData, progressDisplay };
    },
    onSuccess: (data) => {
      toast({ title: `Progress updated to ${data.progressDisplay}` });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      fetchCurrentlyItems();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update progress", variant: "destructive" });
    },
  });

  const moveToListMutation = useMutation({
    mutationFn: async ({ itemId, targetList, listName }: { itemId: string; targetList: string; listName: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/move-item-to-list',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item_id: itemId,
            target_list: targetList,
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to move item');
      }
      return { ...await response.json(), listName };
    },
    onSuccess: (data) => {
      toast({ title: `Moved to ${data.listName}` });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      fetchCurrentlyItems();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to move item", variant: "destructive" });
    },
  });

  const filteredMediaHistory = fullMediaHistory.filter((item: any) => {
    const matchesSearch = !mediaHistorySearch || item.title?.toLowerCase().includes(mediaHistorySearch.toLowerCase());
    const matchesType = mediaHistoryType === 'all' || item.media_type?.toLowerCase() === mediaHistoryType.toLowerCase();
    const itemYear = item.created_at ? new Date(item.created_at).getFullYear().toString() : null;
    const matchesYear = mediaHistoryYear === 'all' || itemYear === mediaHistoryYear;
    const matchesRating = mediaHistoryRating === 'all' || item.rating?.toString() === mediaHistoryRating;
    return matchesSearch && matchesType && matchesYear && matchesRating;
  });

  const getHistoryTitle = () => {
    const parts: string[] = [];
    if (mediaHistoryType !== 'all') parts.push(mediaHistoryType.charAt(0).toUpperCase() + mediaHistoryType.slice(1) + 's');
    if (mediaHistoryYear !== 'all') parts.push(mediaHistoryYear);
    if (mediaHistoryRating !== 'all') parts.push(`${mediaHistoryRating}★+`);
    return parts.length > 0 ? parts.join(' · ') : 'My History';
  };

  const handleDownloadHistoryImage = useCallback(async () => {
    if (!filteredMediaHistory.length || isGeneratingHistoryImage) return;
    setIsGeneratingHistoryImage(true);

    try {
      const items = filteredMediaHistory;
      const cols = 4;
      const canvasWidth = 1080;
      const padding = 60;
      const gap = 12;
      const cellWidth = Math.floor((canvasWidth - padding * 2 - gap * (cols - 1)) / cols);
      const cellHeight = Math.floor(cellWidth * 1.5);
      const rows = Math.ceil(items.length / cols);
      const titleHeight = 100;
      const footerHeight = 80;
      const canvasHeight = padding + titleHeight + rows * cellHeight + (rows - 1) * gap + footerHeight + padding;

      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth * scale;
      canvas.height = canvasHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);

      const grad = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
      grad.addColorStop(0, '#1a1025');
      grad.addColorStop(0.5, '#2d1b4e');
      grad.addColorStop(1, '#1a1025');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const historyTitle = getHistoryTitle();
      ctx.fillStyle = 'white';
      ctx.font = '800 48px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(historyTitle, canvasWidth / 2, padding + 48);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '400 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${items.length} items`, canvasWidth / 2, padding + 78);

      const loadImage = (url: string): Promise<HTMLImageElement | null> => {
        return new Promise((resolve) => {
          const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = proxyUrl;
        });
      };

      const images = await Promise.all(
        items.map((item: any) => {
          const imgUrl = item.image_url || item.poster_url;
          return imgUrl ? loadImage(imgUrl) : Promise.resolve(null);
        })
      );

      const gridTop = padding + titleHeight;
      items.forEach((item: any, idx: number) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = padding + col * (cellWidth + gap);
        const y = gridTop + row * (cellHeight + gap);

        ctx.save();
        ctx.beginPath();
        const r = 12;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + cellWidth - r, y);
        ctx.quadraticCurveTo(x + cellWidth, y, x + cellWidth, y + r);
        ctx.lineTo(x + cellWidth, y + cellHeight - r);
        ctx.quadraticCurveTo(x + cellWidth, y + cellHeight, x + cellWidth - r, y + cellHeight);
        ctx.lineTo(x + r, y + cellHeight);
        ctx.quadraticCurveTo(x, y + cellHeight, x, y + cellHeight - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.clip();

        ctx.fillStyle = '#2a2a3e';
        ctx.fillRect(x, y, cellWidth, cellHeight);

        const img = images[idx];
        if (img) {
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const cellAspect = cellWidth / cellHeight;
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
          if (imgAspect > cellAspect) {
            sw = img.naturalHeight * cellAspect;
            sx = (img.naturalWidth - sw) / 2;
          } else {
            sh = img.naturalWidth / cellAspect;
            sy = (img.naturalHeight - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, x, y, cellWidth, cellHeight);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.font = '400 14px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.title || '', x + cellWidth / 2, y + cellHeight / 2, cellWidth - 16);
        }
        ctx.restore();
      });

      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '700 40px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('@consumedapp', canvasWidth / 2, canvasHeight - padding + 10);

      const fileName = historyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );

      if (!blob) {
        throw new Error('Failed to generate image');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fileName}-consumedapp.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: "Image Downloaded", description: "Share it on social media!" });
    } catch (error) {
      console.error('Error generating history image:', error);
      toast({ title: "Download Failed", description: "Could not generate image", variant: "destructive" });
    } finally {
      setIsGeneratingHistoryImage(false);
    }
  }, [filteredMediaHistory, isGeneratingHistoryImage, toast, mediaHistoryType, mediaHistoryYear, mediaHistoryRating]);

  const handleShareList = async (listId: string, listTitle: string) => {
    const url = `${window.location.origin}/list/${listTitle.toLowerCase().replace(/\s+/g, '-')}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: listTitle, url });
      } catch {
        await navigator.clipboard.writeText(url);
        toast({ title: "Copied!", description: "List link copied to clipboard" });
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copied!", description: "List link copied to clipboard" });
    }
  };

  const getDisplayTitle = (title: string) => {
    if (title === 'All') return 'All';
    return title;
  };

  const handleDownloadSummary = async () => {
    if (!summaryCardRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(summaryCardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
      });
      const link = document.createElement('a');
      link.download = 'my-entertainment-dna.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: "Saved!", description: "Your DNA summary is ready to share" });
    } catch (error) {
      toast({ title: "Error", description: "Could not save image", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareSummary = async () => {
    if (navigator.share && dnaProfile) {
      try {
        await navigator.share({
          title: 'My Entertainment DNA',
          text: `I'm a "${dnaProfile.label}" - ${dnaProfile.tagline}. Check out my entertainment DNA on Consumed!`,
          url: window.location.origin,
        });
      } catch (error) {
        navigator.clipboard.writeText(`I'm a "${dnaProfile?.label}" - ${dnaProfile?.tagline}. Check out my entertainment DNA on Consumed!`);
        toast({ title: "Copied!", description: "Share text copied to clipboard" });
      }
    } else {
      navigator.clipboard.writeText(`I'm a "${dnaProfile?.label}" - ${dnaProfile?.tagline}. Check out my entertainment DNA on Consumed!`);
      toast({ title: "Copied!", description: "Share text copied to clipboard" });
    }
  };

  const handleRegenerateDna = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/generate-dna-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user?.id }),
      });
      if (response.ok) {
        await refetchDna();
        toast({ title: "Regenerated!", description: "Your DNA profile has been updated" });
      } else {
        throw new Error('Failed to regenerate');
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not regenerate DNA", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'movie': return <Film size={14} className="text-pink-400" />;
      case 'tv': return <Tv size={14} className="text-blue-400" />;
      case 'music': return <Music size={14} className="text-green-400" />;
      case 'book': return <BookOpen size={14} className="text-orange-400" />;
      case 'podcast': return <Mic size={14} className="text-purple-400" />;
      case 'game': return <Gamepad2 size={14} className="text-red-400" />;
      default: return <Film size={14} className="text-gray-400" />;
    }
  };

  const itemCount = userStats ? 
    (userStats.moviesWatched || 0) + (userStats.tvShowsWatched || 0) + (userStats.booksRead || 0) + (userStats.gamesPlayed || 0) : 0;
  const hasSurvey = !!dnaProfile;
  const dnaLevel = hasSurvey && itemCount >= 30 ? 2 : hasSurvey || itemCount >= 10 ? 1 : 0;
  const canCompare = hasSurvey && dnaLevel >= 2;

  const { data: friends = [], isLoading: isLoadingFriends } = useQuery({
    queryKey: ['compare-friends', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return [];
      
      const { data: friendships, error: fErr } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');
      
      if (fErr || !friendships?.length) return [];
      
      const friendIds = [...new Set(friendships.map((f: any) => 
        f.user_id === user.id ? f.friend_id : f.user_id
      ).filter((id: string) => id !== user.id))];
      
      if (!friendIds.length) return [];
      
      const { data: usersData } = await supabase
        .from('users')
        .select('id, user_name, avatar')
        .in('id', friendIds);
      
      const { data: dnaData } = await supabase
        .from('dna_profiles')
        .select('user_id')
        .in('user_id', friendIds);
      
      const hasSurveyMap: Record<string, boolean> = {};
      dnaData?.forEach((d: any) => { hasSurveyMap[d.user_id] = true; });
      
      const { data: listsData } = await supabase
        .from('lists')
        .select('id, user_id')
        .in('user_id', friendIds);
      
      const statsMap: Record<string, number> = {};
      if (listsData?.length) {
        const listIds = listsData.map(l => l.id);
        const listToUserMap: Record<string, string> = {};
        listsData.forEach(l => { listToUserMap[l.id] = l.user_id; });
        
        const { data: itemsData } = await supabase
          .from('list_items')
          .select('list_id')
          .in('list_id', listIds);
        
        itemsData?.forEach((item: any) => {
          const userId = listToUserMap[item.list_id];
          if (userId) statsMap[userId] = (statsMap[userId] || 0) + 1;
        });
      }
      
      return (usersData || []).map((u: any) => {
        const count = statsMap[u.id] || 0;
        const friendHasSurvey = hasSurveyMap[u.id] || false;
        return {
          id: u.id,
          user_name: u.user_name || 'Unknown',
          avatar_url: u.avatar,
          itemCount: count,
          hasSurvey: friendHasSurvey,
          isEligible: count >= 30 && friendHasSurvey,
        };
      });
    },
    enabled: !!session?.access_token && !!user?.id && dnaLevel >= 2,
    staleTime: 60000,
  });

  const eligibleFriends = friends.filter((f: any) => f.isEligible);
  const almostEligibleFriends = friends.filter((f: any) => !f.isEligible && f.itemCount > 0);
  const selectedFriend = friends.find((f: any) => f.id === selectedFriendId);

  const handleSelectFriend = async (friendId: string) => {
    if (!session?.access_token || !canCompare) return;
    
    if (selectedFriendId === friendId) {
      setSelectedFriendId(null);
      setComparisonResult(null);
      setCompareError(null);
      return;
    }
    
    setSelectedFriendId(friendId);
    setIsComparing(true);
    setCompareError(null);
    setComparisonResult(null);
    
    try {
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/compare-dna-friend',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ friend_id: friendId }),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setComparisonResult(data);
      } else {
        const errorData = await response.json();
        setCompareError(errorData.error || 'Failed to compare DNA');
      }
    } catch (err) {
      setCompareError('Failed to compare DNA');
    } finally {
      setIsComparing(false);
    }
  };

  const handleDownloadComparison = async () => {
    if (!comparisonCardRef.current) return;
    try {
      const canvas = await html2canvas(comparisonCardRef.current, { scale: 3, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `dna-match-${selectedFriend?.user_name || 'friend'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: "Saved!", description: "Your DNA match card is ready to share" });
    } catch (error) {
      toast({ title: "Error", description: "Could not save image", variant: "destructive" });
    }
  };

  const handleShareComparison = async () => {
    if (!comparisonCardRef.current || !comparisonResult) return;
    try {
      const canvas = await html2canvas(comparisonCardRef.current, { scale: 3, backgroundColor: '#ffffff' });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'dna-match.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Entertainment DNA Match',
            text: `I have a ${comparisonResult.match_score}% entertainment DNA match with ${selectedFriend?.user_name}! 🧬`,
            files: [file],
          });
        } else {
          handleDownloadComparison();
        }
      });
    } catch (error) {
      navigator.clipboard.writeText(`I have a ${comparisonResult.match_score}% entertainment DNA match with ${selectedFriend?.user_name}!`);
      toast({ title: "Copied!", description: "Share text copied to clipboard" });
    }
  };

  const handleNudgeFriend = async (friend: any) => {
    const itemsNeeded = Math.max(0, 30 - friend.itemCount);
    const appUrl = window.location.origin;
    const message = friend.hasSurvey 
      ? `Hey ${friend.user_name}! 🧬 I want to compare our Entertainment DNA on Consumed, but you need to log ${itemsNeeded} more items first. Let's see how compatible our taste is! ${appUrl}`
      : `Hey ${friend.user_name}! 🧬 I want to compare our Entertainment DNA on Consumed! Complete the DNA survey and log 30 items so we can see how compatible our taste is! ${appUrl}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Compare our Entertainment DNA!', text: message });
      } catch {
        await navigator.clipboard.writeText(message);
        toast({ title: "Copied!", description: "Share message copied to clipboard" });
      }
    } else {
      await navigator.clipboard.writeText(message);
      toast({ title: "Copied!", description: "Share message copied to clipboard" });
    }
  };

  const getMatchColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-purple-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <Navigation />
      <div className="pt-16">
        <div className="bg-white px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">My Library</h1>
          <p className="text-sm text-gray-500">Your lists, progress, and media history</p>
        </div>

        <div className="bg-white pt-4 pb-2 -mt-px">
          <div className="max-w-3xl lg:mx-auto px-4">
            <div className="mb-2">
              <h2 className="text-sm font-medium text-gray-900">In Progress</h2>
            </div>
            {currentlyItems.length > 0 ? (
              <div 
                className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 lg:justify-center"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {currentlyItems.map((item: any) => (
                  <CurrentlyConsumingCard 
                    key={item.id} 
                    item={item}
                    onUpdateProgress={(progress, total, mode, progressDisplay) => {
                      updateProgressMutation.mutate({
                        itemId: item.id,
                        progress,
                        total,
                        mode,
                        progressDisplay
                      });
                    }}
                    onMoveToList={(targetList, listName) => {
                      moveToListMutation.mutate({
                        itemId: item.id,
                        targetList,
                        listName
                      });
                    }}
                    isUpdating={updateProgressMutation.isPending || moveToListMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <div className="pb-1">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                  <Clock className="mx-auto mb-1 text-gray-400" size={18} />
                  <p className="text-gray-600 text-xs">No items in your Currently list yet</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">Search and add to "Currently" to track progress</p>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 mx-4 mt-2 mb-2"></div>
        </div>

        <div className="bg-white max-w-7xl mx-auto px-4 pt-0 pb-6 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button
              onClick={() => setActiveTab('lists')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'lists'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <List size={14} />
              Lists
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <Clock size={14} />
              History
            </button>
            <button
              onClick={() => setActiveTab('dna')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'dna'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <Dna size={14} />
              My DNA
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'compare'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <Users size={14} />
              Compare
            </button>
          </div>

          {activeTab === 'dna' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-500 via-blue-500 to-teal-400 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Dna className="text-white" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-white">Complete Your DNA</h3>
                    <p className="text-white/80 text-xs">Answer more questions to unlock personalized insights</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setLocation('/entertainment-dna')}
                      size="sm"
                      className="bg-white text-purple-600 hover:bg-white/90 text-xs font-semibold"
                    >
                      Take DNA Quiz
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Your Stats</h2>
                {isLoadingStats ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-purple-600" size={24} />
                  </div>
                ) : userStats ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-purple-600">{userStats.moviesWatched || 0}</p>
                        <p className="text-xs text-gray-500">Movies</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-600">{userStats.tvShowsWatched || 0}</p>
                        <p className="text-xs text-gray-500">TV Shows</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">{userStats.booksRead || 0}</p>
                        <p className="text-xs text-gray-500">Books</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-pink-600">{userStats.musicHours || 0}h</p>
                        <p className="text-xs text-gray-500">Music</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-orange-600">{userStats.podcastHours || 0}h</p>
                        <p className="text-xs text-gray-500">Podcasts</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{userStats.gamesPlayed || 0}</p>
                        <p className="text-xs text-gray-500">Games</p>
                      </div>
                    </div>
                    <div className="border-t pt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-base font-bold text-gray-900">{userStats.totalHours || 0}h</p>
                        <p className="text-xs text-gray-500">Total Hours</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{userStats.averageRating || '-'}</p>
                        <p className="text-xs text-gray-500">Avg Rating</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{userStats.dayStreak || 0}</p>
                        <p className="text-xs text-gray-500">Day Streak</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <BarChart3 className="mx-auto mb-2 text-gray-300" size={32} />
                    <p className="text-sm">Start tracking to see your stats</p>
                  </div>
                )}
              </div>

              {isLoadingDna ? (
                <div className="bg-white rounded-xl p-4 flex justify-center border border-gray-100">
                  <Loader2 className="animate-spin text-purple-600" size={24} />
                </div>
              ) : dnaProfile ? (
                <>
                  <div 
                    ref={summaryCardRef}
                    className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
                  >
                    <div className="p-4">
                      <div className="text-center mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Dna className="text-white" size={20} />
                        </div>
                        <h2 className="text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {dnaProfile.label}
                        </h2>
                        <p className="text-gray-600 text-xs mt-0.5">{dnaProfile.tagline}</p>
                      </div>
                      
                      {dnaProfile.profile_text && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 mb-3">
                          <p className="text-gray-700 text-xs leading-relaxed">{dnaProfile.profile_text}</p>
                        </div>
                      )}

                      {dnaProfile.favorite_genres && dnaProfile.favorite_genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mb-3">
                          {dnaProfile.favorite_genres.slice(0, 5).map((genre: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-center pt-2 border-t border-gray-100">
                        <p className="text-purple-600 text-xs font-medium">@consumedapp</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={handleDownloadSummary}
                      disabled={isDownloading}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <Download size={14} />
                      {isDownloading ? 'Saving...' : 'Download'}
                    </Button>
                    <Button
                      onClick={handleShareSummary}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <Share2 size={14} />
                      Share
                    </Button>
                  </div>
                </>
              ) : null}

              <RecommendationsGlimpse />
            </div>
          )}

          {activeTab === 'compare' && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Compare DNA</h2>
              
              {!canCompare ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Lock size={20} className="text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">Comparison Locked</h3>
                  <p className="text-gray-500 text-xs mb-3">
                    {!hasSurvey 
                      ? "Complete the DNA survey to unlock comparisons" 
                      : `Log ${Math.max(0, 30 - itemCount)} more items to unlock`
                    }
                  </p>
                  {!hasSurvey && (
                    <Button
                      onClick={() => setLocation('/entertainment-dna')}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                    >
                      Take DNA Survey
                    </Button>
                  )}
                </div>
              ) : isLoadingFriends ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin text-purple-600" size={24} />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-6">
                  <Users size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-600 mb-1">No friends yet</p>
                  <p className="text-xs text-gray-500 mb-3">Add friends to compare your entertainment DNA</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation('/me?tab=friends')}
                    className="border-purple-200 hover:border-purple-300 text-xs"
                  >
                    <Users size={14} className="mr-1.5" />
                    Find Friends
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {eligibleFriends.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Select a friend to compare:</p>
                      <div className="flex flex-wrap gap-2">
                        {eligibleFriends.map((friend: any) => (
                          <button
                            key={friend.id}
                            onClick={() => handleSelectFriend(friend.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all ${
                              selectedFriendId === friend.id
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <div className="w-5 h-5 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 text-xs font-medium overflow-hidden">
                              {friend.avatar_url ? (
                                <img src={friend.avatar_url} alt={friend.user_name} className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                friend.user_name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span>{friend.user_name}</span>
                            {selectedFriendId === friend.id && <X size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedFriendId && (
                    <div className="pt-3 border-t border-gray-100">
                      {isComparing && (
                        <div className="flex flex-col items-center py-6">
                          <Loader2 className="animate-spin text-purple-600 mb-2" size={28} />
                          <p className="text-xs text-gray-600">Comparing with {selectedFriend?.user_name}...</p>
                        </div>
                      )}

                      {compareError && (
                        <div className="text-center py-4">
                          <p className="text-xs text-red-600 mb-2">{compareError}</p>
                          <Button variant="outline" size="sm" onClick={() => handleSelectFriend(selectedFriendId)} className="text-xs">
                            Try Again
                          </Button>
                        </div>
                      )}

                      {!isComparing && !compareError && comparisonResult && (
                        <div className="space-y-3">
                          <div 
                            ref={comparisonCardRef}
                            className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4"
                          >
                            <div className="text-center mb-4">
                              <div className={`text-4xl font-bold ${getMatchColor(comparisonResult.match_score)}`}>
                                {comparisonResult.match_score}%
                              </div>
                              <p className="text-gray-600 text-xs mt-1">Entertainment DNA Match</p>
                            </div>

                            <div className="flex items-center justify-center gap-4 mb-4">
                              <div className="text-center">
                                <div className="w-10 h-10 rounded-full bg-purple-200 mx-auto mb-1 flex items-center justify-center text-purple-700 font-semibold text-sm overflow-hidden ring-2 ring-purple-300">
                                  {user?.user_metadata?.avatar_url ? (
                                    <img src={user.user_metadata.avatar_url} alt="You" className="w-10 h-10 rounded-full object-cover" />
                                  ) : (
                                    user?.email?.charAt(0).toUpperCase() || 'Y'
                                  )}
                                </div>
                                <p className="text-xs text-gray-600">You</p>
                              </div>
                              <div className="text-purple-400 text-sm">×</div>
                              <div className="text-center">
                                <div className="w-10 h-10 rounded-full bg-indigo-200 mx-auto mb-1 flex items-center justify-center text-indigo-700 font-semibold text-sm overflow-hidden ring-2 ring-indigo-300">
                                  {selectedFriend?.avatar_url ? (
                                    <img src={selectedFriend.avatar_url} alt={selectedFriend.user_name} className="w-10 h-10 rounded-full object-cover" />
                                  ) : (
                                    selectedFriend?.user_name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <p className="text-xs text-gray-600">{selectedFriend?.user_name}</p>
                              </div>
                            </div>

                            {comparisonResult.insights?.compatibilityLine && (
                              <p className="text-xs text-purple-700 text-center italic mb-3">
                                "{comparisonResult.insights.compatibilityLine}"
                              </p>
                            )}

                            {comparisonResult.shared_titles?.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                                  <Heart size={10} className="text-red-400" /> You both love
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {comparisonResult.shared_titles.slice(0, 4).map((item: any, idx: number) => (
                                    <span key={idx} className="text-xs text-gray-700 bg-white/70 px-2 py-0.5 rounded-full">
                                      {item.title}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {comparisonResult.shared_genres?.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1.5">Shared genres</p>
                                <div className="flex flex-wrap gap-1">
                                  {comparisonResult.shared_genres.slice(0, 5).map((genre: string, idx: number) => (
                                    <span key={idx} className="text-xs text-purple-600 bg-purple-100/60 px-2 py-0.5 rounded-full">
                                      {genre}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {comparisonResult.insights?.consumeTogether && (
                              <div className="pt-2 border-t border-purple-100">
                                <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                                  <Sparkles size={10} className="text-amber-500" /> Watch together
                                </p>
                                <div className="space-y-1">
                                  {comparisonResult.insights.consumeTogether.movies?.slice(0, 2).map((item: string, idx: number) => (
                                    <p key={idx} className="text-xs text-gray-700 flex items-center gap-1">
                                      <Film size={10} className="text-gray-400" /> {item}
                                    </p>
                                  ))}
                                  {comparisonResult.insights.consumeTogether.tv?.slice(0, 2).map((item: string, idx: number) => (
                                    <p key={idx} className="text-xs text-gray-700 flex items-center gap-1">
                                      <Tv size={10} className="text-gray-400" /> {item}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="pt-2 mt-2 border-t border-purple-100 text-center">
                              <p className="text-xs text-gray-400">consumed.app</p>
                            </div>
                          </div>

                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDownloadComparison}
                              className="border-purple-200 text-purple-600 text-xs"
                            >
                              <Download size={12} className="mr-1" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleShareComparison}
                              className="border-purple-200 text-purple-600 text-xs"
                            >
                              <Share2 size={12} className="mr-1" />
                              Share
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {eligibleFriends.length === 0 && almostEligibleFriends.length > 0 && (
                    <div className="text-center py-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">
                        None of your friends are ready for comparison yet.
                      </p>
                    </div>
                  )}

                  {almostEligibleFriends.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 border border-amber-200">
                      <p className="text-xs font-medium text-amber-800 mb-2">Almost ready to compare:</p>
                      <div className="space-y-2">
                        {almostEligibleFriends.slice(0, 3).map((friend: any) => {
                          const itemsNeeded = Math.max(0, 30 - friend.itemCount);
                          return (
                            <div key={friend.id} className="flex items-center justify-between bg-white/80 rounded-lg p-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-xs font-medium overflow-hidden">
                                  {friend.avatar_url ? (
                                    <img src={friend.avatar_url} alt={friend.user_name} className="w-7 h-7 rounded-full object-cover" />
                                  ) : (
                                    friend.user_name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-800">{friend.user_name}</p>
                                  <p className="text-xs text-amber-600">
                                    {!friend.hasSurvey ? 'Needs survey' : `${itemsNeeded} more items`}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleNudgeFriend(friend)}
                                className="border-amber-300 hover:bg-amber-100 text-amber-700 text-xs h-7 px-2"
                              >
                                <Send size={10} className="mr-1" />
                                Nudge
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'lists' && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 -mt-1">

              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search lists..."
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400"
                  />
                </div>
                <button
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-[34px] px-3 rounded-lg flex items-center gap-1 font-medium flex-shrink-0"
                  onClick={() => setIsCreateListOpen(true)}
                >
                  <Plus size={12} />
                  New
                </button>
              </div>

              {isLoadingLists ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="bg-gray-50 rounded-lg p-3 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/4"></div>
                    </div>
                  ))}
                </div>
              ) : userLists.length === 0 ? (
                <div className="text-center py-6">
                  <List className="mx-auto mb-2 text-gray-300" size={28} />
                  <p className="text-sm text-gray-600">No lists yet</p>
                  <p className="text-xs text-gray-500">Create your first list to start tracking</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userLists
                    .filter((list: any) => list.title.toLowerCase().includes(listSearch.toLowerCase()))
                    .map((list: any) => (
                    <div
                      key={list.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors cursor-pointer"
                      onClick={() => {
                        const listSlug = list.title.toLowerCase().replace(/\s+/g, '-');
                        setLocation(`/list/${listSlug}`);
                      }}
                    >
                      <div className="px-3 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 flex-1">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                            {list.is_default ? (
                              list.title === 'Want to Watch' ? <Play className="text-purple-600" size={14} /> :
                              list.title === 'Currently' ? <Clock className="text-blue-600" size={14} /> :
                              list.title === 'Completed' ? <Trophy className="text-green-600" size={14} /> :
                              <List className="text-gray-600" size={14} />
                            ) : (
                              <List className="text-purple-600" size={14} />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-medium text-gray-900 text-sm">{getDisplayTitle(list.title)}</h4>
                              {!list.is_default && list.visibility === 'private' && (
                                <Lock size={10} className="text-gray-400" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{list.items?.length || 0} items</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Share2 
                            className="text-gray-400 hover:text-purple-600" 
                            size={14}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareList(list.id, list.title);
                            }}
                          />
                          <ChevronRight className="text-gray-400" size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-1 mb-3">
                    <div className="flex items-center bg-gray-100 rounded p-0.5">
                      <button
                        onClick={() => setHistoryViewMode('list')}
                        className={`p-1.5 rounded transition-colors ${historyViewMode === 'list' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}
                      >
                        <List size={14} />
                      </button>
                      <button
                        onClick={() => setHistoryViewMode('grid')}
                        className={`p-1.5 rounded transition-colors ${historyViewMode === 'grid' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}
                      >
                        <LayoutGrid size={14} />
                      </button>
                    </div>
                    <button
                      onClick={handleDownloadHistoryImage}
                      disabled={isGeneratingHistoryImage || !filteredMediaHistory.length}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors disabled:opacity-40"
                      aria-label="Download as image"
                    >
                      <Download size={16} className={isGeneratingHistoryImage ? 'animate-pulse' : ''} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <div className="relative">
                      <button
                        onClick={() => setOpenFilter(openFilter === 'type' ? null : 'type')}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                          mediaHistoryType !== 'all'
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        <Film size={10} />
                        {mediaHistoryType === 'all' ? 'Type' : mediaHistoryType}
                        <ChevronRight size={10} className={`transition-transform ${openFilter === 'type' ? 'rotate-90' : ''}`} />
                      </button>
                      {openFilter === 'type' && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[100px]">
                          {[
                            { value: 'all', label: 'All Types' },
                            { value: 'movie', label: 'Movies' },
                            { value: 'tv', label: 'TV' },
                            { value: 'book', label: 'Books' },
                            { value: 'music', label: 'Music' },
                          ].map(({ value, label }) => (
                            <button
                              key={value}
                              onClick={() => { setMediaHistoryType(value); setOpenFilter(null); }}
                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                                mediaHistoryType === value ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setOpenFilter(openFilter === 'year' ? null : 'year')}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                          mediaHistoryYear !== 'all'
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        <Calendar size={10} />
                        {mediaHistoryYear === 'all' ? 'Year' : mediaHistoryYear}
                        <ChevronRight size={10} className={`transition-transform ${openFilter === 'year' ? 'rotate-90' : ''}`} />
                      </button>
                      {openFilter === 'year' && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[80px] max-h-40 overflow-y-auto">
                          <button
                            onClick={() => { setMediaHistoryYear('all'); setOpenFilter(null); }}
                            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                              mediaHistoryYear === 'all' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                            }`}
                          >
                            All Years
                          </button>
                          {Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString()).map((year) => (
                            <button
                              key={year}
                              onClick={() => { setMediaHistoryYear(year); setOpenFilter(null); }}
                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                                mediaHistoryYear === year ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                              }`}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setOpenFilter(openFilter === 'rating' ? null : 'rating')}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                          mediaHistoryRating !== 'all'
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        ⭐
                        {mediaHistoryRating === 'all' ? 'Rating' : `${mediaHistoryRating}★`}
                        <ChevronRight size={10} className={`transition-transform ${openFilter === 'rating' ? 'rotate-90' : ''}`} />
                      </button>
                      {openFilter === 'rating' && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[80px]">
                          <button
                            onClick={() => { setMediaHistoryRating('all'); setOpenFilter(null); }}
                            className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                              mediaHistoryRating === 'all' ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                            }`}
                          >
                            All
                          </button>
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <button
                              key={rating}
                              onClick={() => { setMediaHistoryRating(rating.toString()); setOpenFilter(null); }}
                              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-100 ${
                                mediaHistoryRating === rating.toString() ? 'text-purple-600 font-medium bg-purple-50' : 'text-gray-900'
                              }`}
                            >
                              {'⭐'.repeat(rating)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative mb-3">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Filter media history..."
                      value={mediaHistorySearch}
                      onChange={(e) => setMediaHistorySearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  {isLoadingFullHistory ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="bg-gray-50 rounded-lg p-3 animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                          <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                        </div>
                      ))}
                    </div>
                  ) : filteredMediaHistory.length === 0 ? (
                    <div className="text-center py-6">
                      <Clock className="mx-auto mb-2 text-gray-300" size={28} />
                      <p className="text-sm text-gray-600">No media history yet</p>
                      <p className="text-xs text-gray-500">Start tracking to see your history</p>
                    </div>
                  ) : historyViewMode === 'list' ? (
                    <div className="space-y-2">
                      {filteredMediaHistory.map((item: any, index: number) => (
                        <div
                          key={`${item.id}-${index}`}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 hover:border-purple-300 transition-colors cursor-pointer"
                          onClick={() => {
                            if (item.external_id && item.external_source) {
                              setLocation(`/media/${item.media_type}/${item.external_source}/${item.external_id}`);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getMediaIcon(item.media_type)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 text-sm truncate">{item.title}</h4>
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                {getMediaIcon(item.media_type)}
                                <span className="capitalize">{item.media_type}</span>
                                <span>•</span>
                                <span>{item.listName}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {filteredMediaHistory.map((item: any, index: number) => (
                        <div
                          key={`${item.id}-${index}`}
                          className="bg-white rounded-lg border border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all overflow-hidden cursor-pointer"
                          onClick={() => {
                            if (item.external_id && item.external_source) {
                              setLocation(`/media/${item.media_type}/${item.external_source}/${item.external_id}`);
                            }
                          }}
                        >
                          <div className="aspect-[2/3] relative">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center p-1">
                                <span className="text-[10px] text-gray-400 text-center leading-tight">{item.title}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          )}
        </div>
      </div>

      <CreateListDialog open={isCreateListOpen} onOpenChange={setIsCreateListOpen} />
    </div>
  );
}