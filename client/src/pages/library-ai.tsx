import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Send, Sparkles, Eye, Settings, BookOpen, LayoutGrid, List, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// Mock customization state
interface LibrarySection {
  id: string;
  title: string;
  enabled: boolean;
  displayMode: 'grid' | 'list' | 'compact' | 'timeline';
  filters?: string[];
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
  
  // Library customization state
  const [librarySections, setLibrarySections] = useState<LibrarySection[]>([
    { id: 'currently', title: 'Currently Consuming', enabled: true, displayMode: 'grid' },
    { id: 'queue', title: 'Queue', enabled: true, displayMode: 'list' },
    { id: 'finished', title: 'Finished', enabled: true, displayMode: 'grid' },
    { id: 'favorites', title: 'Favorites', enabled: true, displayMode: 'grid' },
    { id: 'dnf', title: 'Did Not Finish', enabled: false, displayMode: 'list' },
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
  
  // AI Chat state
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { 
      role: 'assistant', 
      content: activeTab === 'library' 
        ? "Hi! I can help you customize your Library view. Tell me how you'd like to see your content organized!" 
        : "Hi! I can help you customize your tracking workflow. What would make logging media easier for you?"
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Handle drag and drop for library sections
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(librarySections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setLibrarySections(items);
  };
  
  // Toggle section enabled/disabled
  const toggleSection = (id: string) => {
    setLibrarySections(sections => 
      sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
  };
  
  // Update display mode for a section
  const updateDisplayMode = (id: string, mode: 'grid' | 'list' | 'compact' | 'timeline') => {
    setLibrarySections(sections => 
      sections.map(s => s.id === id ? { ...s, displayMode: mode } : s)
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
            ? librarySections 
            : { mediaTypes, trackingOptions, listDisplay }
        }),
      });
      
      if (!response.ok) throw new Error('Failed to get AI response');
      
      const { message: aiMessage, config } = await response.json();
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiMessage }]);
      
      // Apply the generated config
      if (config) {
        if (activeTab === 'library' && config.sections) {
          setLibrarySections(config.sections);
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
      ? { library: librarySections }
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
                  Drag to reorder, toggle sections, and customize display modes
                </CardDescription>
              </CardHeader>
              <CardContent className="bg-white">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                    <TabsTrigger value="library" data-testid="tab-library-layout" className="text-gray-700 data-[state=active]:bg-white data-[state=active]:text-black">
                      <BookOpen size={16} className="mr-2" />
                      Library Layout
                    </TabsTrigger>
                    <TabsTrigger value="tracking" data-testid="tab-tracking-prefs" className="text-gray-700 data-[state=active]:bg-white data-[state=active]:text-black">
                      <Settings size={16} className="mr-2" />
                      Tracking Preferences
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Library Layout Tab */}
                  <TabsContent value="library" className="space-y-4 mt-4">
                    <div className="text-sm text-gray-700 mb-4">
                      Configure which sections appear in your Library and how they're displayed
                    </div>
                    
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="sections">
                        {(provided) => (
                          <div 
                            {...provided.droppableProps} 
                            ref={provided.innerRef}
                            className="space-y-2"
                          >
                            {librarySections.map((section, index) => (
                              <Draggable key={section.id} draggableId={section.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`bg-white border rounded-lg p-4 ${
                                      snapshot.isDragging ? 'shadow-lg' : ''
                                    } ${!section.enabled ? 'opacity-50' : ''}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {/* Drag Handle */}
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                        <GripVertical className="text-gray-400" size={20} />
                                      </div>
                                      
                                      {/* Section Info */}
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <Switch
                                              checked={section.enabled}
                                              onCheckedChange={() => toggleSection(section.id)}
                                              data-testid={`toggle-${section.id}`}
                                            />
                                            <Label className="font-medium text-black">{section.title}</Label>
                                          </div>
                                          
                                          {section.enabled && (
                                            <Select
                                              value={section.displayMode}
                                              onValueChange={(value: any) => updateDisplayMode(section.id, value)}
                                            >
                                              <SelectTrigger className="w-40" data-testid={`display-mode-${section.id}`}>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="grid">
                                                  <div className="flex items-center gap-2">
                                                    <LayoutGrid size={14} />
                                                    Grid
                                                  </div>
                                                </SelectItem>
                                                <SelectItem value="list">
                                                  <div className="flex items-center gap-2">
                                                    <List size={14} />
                                                    List
                                                  </div>
                                                </SelectItem>
                                                <SelectItem value="compact">
                                                  <div className="flex items-center gap-2">
                                                    <List size={14} />
                                                    Compact
                                                  </div>
                                                </SelectItem>
                                                <SelectItem value="timeline">
                                                  <div className="flex items-center gap-2">
                                                    <Calendar size={14} />
                                                    Timeline
                                                  </div>
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
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
                        ? "e.g., Show only books I'm currently reading"
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
                          onClick={() => setUserInput("Show books I haven't touched in over a week")}
                          className="text-xs text-purple-600 hover:underline block"
                        >
                          "Show books I haven't touched in over a week"
                        </button>
                        <button
                          onClick={() => setUserInput("Create a binge-worthy section for TV shows")}
                          className="text-xs text-purple-600 hover:underline block"
                        >
                          "Create a binge-worthy section for TV shows"
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
