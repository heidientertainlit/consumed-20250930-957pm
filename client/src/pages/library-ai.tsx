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

interface TrackingPreference {
  id: string;
  label: string;
  enabled: boolean;
  required?: boolean;
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
  
  // Tracking customization state
  const [trackingFields, setTrackingFields] = useState<TrackingPreference[]>([
    { id: 'rating', label: 'Rating', enabled: true },
    { id: 'notes', label: 'Notes/Review', enabled: true },
    { id: 'progress', label: 'Progress Tracking', enabled: true, required: true },
    { id: 'startDate', label: 'Start Date', enabled: false },
    { id: 'finishDate', label: 'Finish Date', enabled: false },
    { id: 'tags', label: 'Custom Tags', enabled: false },
  ]);
  
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
  
  // Toggle tracking field
  const toggleTrackingField = (id: string) => {
    setTrackingFields(fields => 
      fields.map(f => f.id === id && !f.required ? { ...f, enabled: !f.enabled } : f)
    );
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
          currentConfig: activeTab === 'library' ? librarySections : trackingFields
        }),
      });
      
      if (!response.ok) throw new Error('Failed to get AI response');
      
      const { message: aiMessage, config } = await response.json();
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiMessage }]);
      
      // Apply the generated config
      if (config) {
        if (activeTab === 'library' && config.sections) {
          setLibrarySections(config.sections);
        } else if (activeTab === 'tracking' && config.fields) {
          setTrackingFields(config.fields);
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
      : { tracking: trackingFields };
    
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
                  <TabsContent value="tracking" className="space-y-4 mt-4">
                    <div className="text-sm text-gray-700 mb-4">
                      Choose which fields appear when you track media
                    </div>
                    
                    <div className="space-y-2">
                      {trackingFields.map((field) => (
                        <div key={field.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={field.enabled}
                                onCheckedChange={() => toggleTrackingField(field.id)}
                                disabled={field.required}
                                data-testid={`toggle-field-${field.id}`}
                              />
                              <Label className={field.required ? 'font-medium text-purple-600' : 'font-medium text-black'}>
                                {field.label}
                                {field.required && <span className="text-xs text-gray-600 ml-2">(Required)</span>}
                              </Label>
                            </div>
                          </div>
                        </div>
                      ))}
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
                        : "e.g., I only want to track ratings, nothing else"
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
                          onClick={() => setUserInput("Simplify tracking - I only want to mark things as watched")}
                          className="text-xs text-purple-600 hover:underline block"
                        >
                          "Simplify tracking - I only want to mark as watched"
                        </button>
                        <button
                          onClick={() => setUserInput("Add a mood field to track how content made me feel")}
                          className="text-xs text-purple-600 hover:underline block"
                        >
                          "Add a mood field for tracking emotions"
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
