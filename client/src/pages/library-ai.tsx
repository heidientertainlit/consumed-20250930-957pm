import { useState } from "react";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Sparkles, Eye, Settings, BookOpen, LayoutGrid, List } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// Mock customization state
interface ListOrganizationFeature {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  icon?: any;
}

interface ListLayoutPreferences {
  defaultLayout: 'grid' | 'list' | 'compact';
}

interface MediaTypePreference {
  id: string;
  label: string;
  enabled: boolean;
  icon: string;
}

interface TrackingOption {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface ListDisplayPreference {
  defaultView: 'grid' | 'list' | 'compact';
  showCovers: boolean;
  showProgress: boolean;
}

export default function LibraryAI() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  
  // Tab state
  const [activeTab, setActiveTab] = useState("library");
  
  // List organization features
  const [listLayout, setListLayout] = useState<ListLayoutPreferences>({
    defaultLayout: 'grid',
  });
  
  const [listFeatures, setListFeatures] = useState<ListOrganizationFeature[]>([
    { id: 'progress', label: 'Progress Tracker', description: 'Show progress bars and completion percentage', enabled: true },
    { id: 'notes', label: 'Notes & Reviews', description: 'Enable adding notes to list items', enabled: true },
    { id: 'collaborators', label: 'Invite Collaborators', description: 'Allow others to contribute to your lists', enabled: false },
    { id: 'privacy', label: 'Privacy Controls', description: 'Set lists as public or private', enabled: true },
    { id: 'covers', label: 'Cover Images', description: 'Display cover art for media items', enabled: true },
    { id: 'tags', label: 'Custom Tags', description: 'Organize items with custom tags', enabled: false },
  ]);
  
  // Media types tracking
  const [mediaTypes, setMediaTypes] = useState<MediaTypePreference[]>([
    { id: 'movies', label: 'Movies', enabled: true, icon: '🎬' },
    { id: 'tv', label: 'TV Shows', enabled: true, icon: '📺' },
    { id: 'books', label: 'Books', enabled: true, icon: '📚' },
    { id: 'music', label: 'Music', enabled: true, icon: '🎵' },
    { id: 'podcasts', label: 'Podcasts', enabled: false, icon: '🎙️' },
    { id: 'games', label: 'Games', enabled: false, icon: '🎮' },
  ]);
  
  // Tracking options
  const [trackingOptions, setTrackingOptions] = useState<TrackingOption[]>([
    { id: 'rating', label: 'Ratings', description: 'Rate items on a 5-star scale', enabled: true },
    { id: 'notes', label: 'Notes & Reviews', description: 'Write detailed reviews and thoughts', enabled: true },
    { id: 'tags', label: 'Custom Tags', description: 'Organize with your own tags (mood, genre, etc.)', enabled: false },
    { id: 'dates', label: 'Start/Finish Dates', description: 'Track when you started and finished', enabled: false },
    { id: 'privacy', label: 'Privacy Controls', description: 'Set items as public or private', enabled: true },
  ]);
  
  // List display preferences
  const [listDisplay, setListDisplay] = useState<ListDisplayPreference>({
    defaultView: 'grid',
    showCovers: true,
    showProgress: true,
  });
  
  // AI Chat state - initial message based on active tab
  const getInitialMessage = () => {
    return activeTab === 'library' 
      ? "Hi! I can help you configure how ALL your lists work. Want to change the layout, enable features, or adjust settings across the board?" 
      : "Hi! I can help you customize your tracking workflow. What would make logging media easier for you?";
  };
  
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { 
      role: 'assistant', 
      content: getInitialMessage()
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Toggle list feature
  const toggleListFeature = (id: string) => {
    setListFeatures(features => 
      features.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f)
    );
  };
  
  // Toggle media type
  const toggleMediaType = (id: string) => {
    setMediaTypes(types => 
      types.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t)
    );
  };
  
  // Toggle tracking option
  const toggleTrackingOption = (id: string) => {
    setTrackingOptions(options => 
      options.map(o => o.id === id ? { ...o, enabled: !o.enabled } : o)
    );
  };
  
  // Update list display preference
  const updateListDisplay = (key: keyof ListDisplayPreference, value: any) => {
    setListDisplay(prev => ({ ...prev, [key]: value }));
  };
  
  // Send message to AI
  const sendMessage = async () => {
    if (!userInput.trim()) return;
    
    const newMessage = { role: 'user' as const, content: userInput };
    setMessages(prev => [...prev, newMessage]);
    setUserInput('');
    setIsGenerating(true);
    
    try {
      // Call AI backend
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/builder-chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userInput,
          context: activeTab,
          currentConfig: activeTab === 'library' 
            ? { listLayout, listFeatures }
            : { mediaTypes, trackingOptions, listDisplay }
        }),
      });
      
      if (!response.ok) throw new Error('Failed to get AI response');
      
      const { message: aiMessage, config } = await response.json();
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiMessage }]);
      
      // Apply the generated config
      if (config) {
        if (activeTab === 'library') {
          if (config.listLayout) setListLayout(config.listLayout);
          if (config.listFeatures) setListFeatures(config.listFeatures);
        } else if (activeTab === 'tracking') {
          if (config.mediaTypes) setMediaTypes(config.mediaTypes);
          if (config.trackingOptions) setTrackingOptions(config.trackingOptions);
          if (config.listDisplay) setListDisplay(config.listDisplay);
        }
        
        toast({
          title: "Customization applied!",
          description: "Your settings have been updated based on your request.",
        });
      }
    } catch (error) {
      console.error('AI chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I'm having trouble right now. Please try again!" 
      }]);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Preview current config
  const previewConfig = () => {
    const config = activeTab === 'library' 
      ? { library: { listLayout, listFeatures } }
      : { tracking: { mediaTypes, trackingOptions, listDisplay } };
    
    toast({
      title: "Current Configuration",
      description: (
        <pre className="text-xs overflow-auto max-h-40">
          {JSON.stringify(config, null, 2)}
        </pre>
      ),
    });
  };
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={() => {}} />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="text-purple-600" size={32} />
            <h1 className="text-3xl font-semibold text-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
              AI Builder
            </h1>
          </div>
          <p className="text-gray-600">
            Customize how you track and view your entertainment
          </p>
        </div>
        
        {/* Main Layout: Builder (left) + AI Chat (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Visual Builder (2/3 width) */}
          <div className="lg:col-span-2">
            <Card className="bg-white border border-gray-200">
              <CardHeader className="bg-white">
                <CardTitle className="flex items-center gap-2 text-black">
                  <Settings size={20} className="text-gray-700" />
                  Customization Builder
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Configure system-wide settings for lists and tracking preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="bg-white">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                    <TabsTrigger value="library" data-testid="tab-list-organization" className="text-gray-700 data-[state=active]:bg-white data-[state=active]:text-black">
                      <BookOpen size={16} className="mr-2" />
                      List Organization
                    </TabsTrigger>
                    <TabsTrigger value="tracking" data-testid="tab-tracking-prefs" className="text-gray-700 data-[state=active]:bg-white data-[state=active]:text-black">
                      <Settings size={16} className="mr-2" />
                      Tracking Preferences
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* List Organization Tab */}
                  <TabsContent value="library" className="space-y-6 mt-4">
                    <div className="text-sm text-gray-700 mb-4">
                      Configure how ALL your lists work - these settings apply system-wide
                    </div>
                    
                    {/* Default Layout Section */}
                    <div>
                      <h3 className="font-semibold text-black mb-2">Default Layout</h3>
                      <div className="text-sm text-gray-700 mb-3">
                        Choose how your lists are displayed by default
                      </div>
                      <Select
                        value={listLayout.defaultLayout}
                        onValueChange={(value: any) => setListLayout({ defaultLayout: value })}
                      >
                        <SelectTrigger className="w-full bg-white text-black border-gray-300" data-testid="select-default-layout">
                          <SelectValue className="text-black" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-300">
                          <SelectItem value="grid" className="text-black">
                            <div className="flex items-center gap-2 text-black">
                              <LayoutGrid size={14} />
                              Grid - Visual cards with covers
                            </div>
                          </SelectItem>
                          <SelectItem value="list" className="text-black">
                            <div className="flex items-center gap-2 text-black">
                              <List size={14} />
                              List - Detailed rows with metadata
                            </div>
                          </SelectItem>
                          <SelectItem value="compact" className="text-black">
                            <div className="flex items-center gap-2 text-black">
                              <List size={14} />
                              Compact - Dense text-only view
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* List Features Section */}
                    <div>
                      <h3 className="font-semibold text-black mb-2">List Features</h3>
                      <div className="text-sm text-gray-700 mb-3">
                        Enable or disable features across all your lists
                      </div>
                      <div className="space-y-2">
                        {listFeatures.map((feature) => (
                          <div key={feature.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <Switch
                                checked={feature.enabled}
                                onCheckedChange={() => toggleListFeature(feature.id)}
                                className="mt-0.5"
                                data-testid={`toggle-feature-${feature.id}`}
                              />
                              <div className="flex-1">
                                <Label className="font-medium text-black cursor-pointer">
                                  {feature.label}
                                </Label>
                                <p className="text-sm text-gray-600 mt-1">
                                  {feature.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Tracking Preferences Tab */}
                  <TabsContent value="tracking" className="space-y-6 mt-4">
                    {/* Media Types Section */}
                    <div>
                      <h3 className="font-semibold text-black mb-2">Media Types</h3>
                      <div className="text-sm text-gray-700 mb-3">
                        Choose which types of content you want to track
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {mediaTypes.map((type) => (
                          <div key={type.id} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={type.enabled}
                                onCheckedChange={() => toggleMediaType(type.id)}
                                data-testid={`toggle-media-${type.id}`}
                              />
                              <Label className="font-medium text-black flex items-center gap-2">
                                <span>{type.icon}</span>
                                {type.label}
                              </Label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Tracking Options Section */}
                    <div>
                      <h3 className="font-semibold text-black mb-2">Tracking Options</h3>
                      <div className="text-sm text-gray-700 mb-3">
                        Customize what information you capture when logging media
                      </div>
                      <div className="space-y-2">
                        {trackingOptions.map((option) => (
                          <div key={option.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <Switch
                                checked={option.enabled}
                                onCheckedChange={() => toggleTrackingOption(option.id)}
                                data-testid={`toggle-option-${option.id}`}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <Label className="font-medium text-black block mb-1">
                                  {option.label}
                                </Label>
                                <p className="text-xs text-gray-600">{option.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* List Display Preferences Section */}
                    <div>
                      <h3 className="font-semibold text-black mb-2">List Display</h3>
                      <div className="text-sm text-gray-700 mb-3">
                        Control how your lists are displayed
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-black mb-2 block">Default View</Label>
                          <Select
                            value={listDisplay.defaultView}
                            onValueChange={(value: any) => updateListDisplay('defaultView', value)}
                          >
                            <SelectTrigger className="w-full" data-testid="select-default-view">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="grid">
                                <div className="flex items-center gap-2">
                                  <LayoutGrid size={14} />
                                  Grid (visual covers)
                                </div>
                              </SelectItem>
                              <SelectItem value="list">
                                <div className="flex items-center gap-2">
                                  <List size={14} />
                                  List (compact rows)
                                </div>
                              </SelectItem>
                              <SelectItem value="compact">
                                <div className="flex items-center gap-2">
                                  <List size={14} />
                                  Compact (text only)
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-black">Show Cover Images</Label>
                          <Switch
                            checked={listDisplay.showCovers}
                            onCheckedChange={(checked) => updateListDisplay('showCovers', checked)}
                            data-testid="toggle-show-covers"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-black">Show Progress Bars</Label>
                          <Switch
                            checked={listDisplay.showProgress}
                            onCheckedChange={(checked) => updateListDisplay('showProgress', checked)}
                            data-testid="toggle-show-progress"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                
                {/* Action Buttons */}
                <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200">
                  <Button onClick={previewConfig} variant="outline" className="text-black border-gray-300" data-testid="button-preview-config">
                    <Eye size={16} className="mr-2" />
                    Preview Config
                  </Button>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white" data-testid="button-apply-config">
                    Apply Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Right: AI Chat (1/3 width) */}
          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col bg-white border border-gray-200">
              <CardHeader className="bg-white">
                <CardTitle className="flex items-center gap-2 text-black">
                  <Sparkles className="text-purple-600" size={20} />
                  AI Assistant
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Tell me what you want, I'll configure it for you
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col bg-white">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-96">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-purple-100 ml-8'
                          : 'bg-gray-100 mr-8'
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        {msg.role === 'user' ? 'You' : 'AI'}
                      </div>
                      <div className="text-sm text-black">{msg.content}</div>
                    </div>
                  ))}
                  {isGenerating && (
                    <div className="bg-gray-100 mr-8 p-3 rounded-lg">
                      <div className="text-xs font-medium text-gray-700 mb-1">AI</div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="animate-pulse">Thinking...</div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder={
                      activeTab === 'library'
                        ? "e.g., Turn off cover images on all lists"
                        : "e.g., I only want to track movies and TV shows"
                    }
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    disabled={isGenerating}
                    data-testid="input-ai-chat"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isGenerating || !userInput.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    data-testid="button-send-message"
                  >
                    <Send size={16} />
                  </Button>
                </div>
                
                {/* Example Prompts */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-2">Try asking:</div>
                  <div className="space-y-1">
                    {activeTab === 'library' ? (
                      <>
                        <button
                          onClick={() => setUserInput("Turn off progress trackers on all my lists")}
                          className="text-xs text-purple-600 hover:underline block"
                        >
                          "Turn off progress trackers on all my lists"
                        </button>
                        <button
                          onClick={() => setUserInput("Switch to compact view for all lists")}
                          className="text-xs text-purple-600 hover:underline block"
                        >
                          "Switch to compact view for all lists"
                        </button>
                        <button
                          onClick={() => setUserInput("Enable collaboration features")}
                          className="text-xs text-purple-600 hover:underline block"
                        >
                          "Enable collaboration features"
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setUserInput("I only want to track movies and books, nothing else")}
                          className="text-xs text-purple-600 hover:underline block"
                        >
                          "I only want to track movies and books, nothing else"
                        </button>
                        <button
                          onClick={() => setUserInput("Turn off notes and tags, I just want ratings")}
                          className="text-xs text-purple-600 hover:underline block"
                        >
                          "Turn off notes and tags, I just want ratings"
                        </button>
                        <button
                          onClick={() => setUserInput("Show my lists as compact text, no covers")}
                          className="text-xs text-purple-600 hover:underline block"
                        >
                          "Show my lists as compact text, no covers"
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
