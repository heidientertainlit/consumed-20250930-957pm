import { useState } from "react";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Search, Settings, Users, Globe, Lock, X, UserPlus, Trash2, MoreVertical, Star, Clock, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function ListDetail() {
  const [, setLocation] = useLocation();
  const [isPublic, setIsPublic] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showInviteCollaborator, setShowInviteCollaborator] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { toast } = useToast();

  // Mock list data - in real app would come from URL params/API
  const listData = {
    id: "currently-list",
    name: "Currently",
    description: "What you're watching, reading, or playing right now",
    items: [
      {
        id: 1,
        title: "The Seven Moons of Maali Almeida",
        creator: "Shehan Karunatilaka",
        type: "Book",
        artwork: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=80&h=80&fit=crop",
        progress: 68,
        addedDate: "2024-01-10",
        addedBy: "You"
      },
      {
        id: 2,
        title: "The Bear Season 3",
        creator: "Christopher Storer",
        type: "TV Show",
        artwork: "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=80&h=80&fit=crop",
        progress: 40,
        addedDate: "2024-01-08",
        addedBy: "You"
      },
      {
        id: 3,
        title: "Folklore",
        creator: "Taylor Swift",
        type: "Album",
        artwork: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop",
        progress: 90,
        addedDate: "2024-01-05",
        addedBy: "You"
      }
    ],
    collaborators: [
      {
        id: 1,
        name: "Sarah Chen",
        email: "sarah@example.com",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616c6c46c06?w=40&h=40&fit=crop&crop=face",
        role: "editor"
      },
      {
        id: 2,
        name: "Mike Rodriguez",
        email: "mike@example.com", 
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face",
        role: "viewer"
      }
    ],
    owner: "You",
    createdDate: "2024-01-01",
    totalItems: 3,
    likes: 24,
    isPublic: true
  };

  const addItemMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-media-to-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          listId: listData.id,
          title: title,
          mediaType: "mixed",
          creator: "",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add item: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item added!",
        description: "Successfully added item to list.",
      });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setNewItemTitle("");
      setShowAddItem(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to add item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddItem = () => {
    if (newItemTitle.trim()) {
      addItemMutation.mutate(newItemTitle.trim());
    }
  };

  const handleInviteCollaborator = () => {
    if (collaboratorEmail.trim()) {
      // In real app, would make API call to invite collaborator
      console.log("Inviting collaborator:", collaboratorEmail);
      setCollaboratorEmail("");
      setShowInviteCollaborator(false);
    }
  };

  const handleRemoveItem = (itemId: number) => {
    // In real app, would make API call to remove item
    console.log("Removing item:", itemId);
  };

  const togglePrivacyMutation = useMutation({
    mutationFn: async (isPublic: boolean) => {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/update-list-visibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          listId: listData.id,
          isPublic: isPublic,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update privacy: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Privacy updated!",
        description: `List is now ${!isPublic ? 'public' : 'private'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to update privacy",
        description: error.message,
        variant: "destructive",
      });
      setIsPublic(isPublic); // Revert the UI change
    },
  });

  const handleTogglePrivacy = () => {
    const newPublicState = !isPublic;
    setIsPublic(newPublicState);
    togglePrivacyMutation.mutate(newPublicState);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={() => {}} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/track")}
            className="mr-4"
            data-testid="button-back"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{listData.name}</h1>
            <p className="text-gray-600">{listData.description}</p>
          </div>
        </div>

        {/* List Stats & Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{listData.totalItems}</div>
                <div className="text-sm text-gray-600">Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{listData.likes}</div>
                <div className="text-sm text-gray-600">Likes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{listData.collaborators.length}</div>
                <div className="text-sm text-gray-600">Collaborators</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant={isPublic ? "default" : "secondary"} className="flex items-center gap-1">
                {isPublic ? <Globe size={12} /> : <Lock size={12} />}
                {isPublic ? "Public" : "Private"}
              </Badge>
              
              <Button
                onClick={() => setShowAddItem(true)}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-add-item"
              >
                <Plus size={16} className="mr-2" />
                Add Item
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowInviteCollaborator(true)}
                data-testid="button-invite-collaborator"
              >
                <UserPlus size={16} className="mr-2" />
                Invite
              </Button>
            </div>
          </div>
        </div>

        {/* List Items */}
        <div className="bg-white rounded-2xl shadow-sm mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Items</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Search size={16} />
                </Button>
                <Button variant="ghost" size="sm">
                  <Settings size={16} />
                </Button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {listData.items.map((item) => (
              <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <img
                    src={item.artwork}
                    alt={item.title}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                        <p className="text-sm text-gray-600">by {item.creator}</p>
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {item.type}
                        </Badge>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-gray-400 hover:text-red-600"
                        data-testid={`button-remove-${item.id}`}
                      >
                        <X size={16} />
                      </Button>
                    </div>

                    {item.progress > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{item.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>Added {item.addedDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>by {item.addedBy}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Collaborators Section */}
        <div className="bg-white rounded-2xl shadow-sm mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Collaborators</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTogglePrivacy}
                data-testid="button-toggle-privacy"
              >
                {isPublic ? <Lock size={16} className="mr-2" /> : <Globe size={16} className="mr-2" />}
                Make {isPublic ? "Private" : "Public"}
              </Button>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {/* Owner */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                    Y
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{listData.owner}</div>
                    <div className="text-sm text-gray-600">Owner</div>
                  </div>
                </div>
                <Badge>Owner</Badge>
              </div>

              {/* Collaborators */}
              {listData.collaborators.map((collaborator) => (
                <div key={collaborator.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={collaborator.avatar}
                      alt={collaborator.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{collaborator.name}</div>
                      <div className="text-sm text-gray-600">{collaborator.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {collaborator.role}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-600">
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Item to List</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAddItem(false)}>
                <X size={20} />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search for media to add
                </label>
                <input
                  type="text"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="Search movies, books, shows, music..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="input-add-item"
                />
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={handleAddItem}
                  disabled={!newItemTitle.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  data-testid="button-confirm-add-item"
                >
                  Add to List
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddItem(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Collaborator Modal */}
      {showInviteCollaborator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Invite Collaborator</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowInviteCollaborator(false)}>
                <X size={20} />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={collaboratorEmail}
                  onChange={(e) => setCollaboratorEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="input-collaborator-email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permission Level
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  <option value="viewer">Viewer - Can see list items</option>
                  <option value="editor">Editor - Can add/remove items</option>
                </select>
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={handleInviteCollaborator}
                  disabled={!collaboratorEmail.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  data-testid="button-send-invite"
                >
                  Send Invite
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowInviteCollaborator(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}