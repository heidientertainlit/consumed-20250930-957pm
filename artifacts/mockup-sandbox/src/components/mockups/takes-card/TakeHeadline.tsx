import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, ThumbsUp, ThumbsDown, Share2, AtSign, Send, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TakeHeadline() {
  const [activeTakeIndex, setActiveTakeIndex] = useState(0);

  const takes = [
    {
      id: 1,
      author: 'Trey',
      alignment: '83% aligned with you',
      rating: 4,
      text: 'Hooked after one episode.',
      tag: 'Take',
      tagColor: 'bg-orange-100 text-orange-700',
      tagIcon: <Zap className="w-3 h-3 mr-1" />,
      agree: 236,
      comment: 28,
    },
    {
      id: 2,
      author: 'Ashley',
      alignment: '65% aligned with you',
      rating: 3.5,
      text: "Lincoln isn't the real villain.",
      tag: 'Theory',
      tagColor: 'bg-purple-100 text-purple-700',
      tagIcon: <Star className="w-3 h-3 mr-1" />,
      agree: 142,
      comment: 45,
    },
    {
      id: 3,
      author: 'Kai',
      alignment: '92% aligned with you',
      rating: 5,
      text: 'The beard deserves an Emmy 😂',
      tag: 'Discussion',
      tagColor: 'bg-blue-100 text-blue-700',
      tagIcon: <MessageCircle className="w-3 h-3 mr-1" />,
      agree: 890,
      comment: 112,
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans selection:bg-violet-200">
      {/* Mobile Card Container */}
      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        
        {/* Header: Title + Poster Chip */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-gray-50">
          <div className="flex flex-col">
            <h3 className="font-semibold text-gray-900 text-lg leading-tight">Death by Lightning</h3>
            <p className="text-sm text-gray-500 font-medium">423 people talking</p>
          </div>
          <div className="w-12 h-16 rounded-md overflow-hidden bg-gray-200 shadow-sm shrink-0 border border-black/5">
            <img 
              src="/__mockup/images/death-by-lightning-poster.png" 
              alt="Death by Lightning Poster" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Carousel / Takes Area */}
        <div className="relative overflow-hidden w-full">
          <div 
            className="flex transition-transform duration-300 ease-in-out w-full"
            style={{ transform: `translateX(-${activeTakeIndex * 100}%)` }}
          >
            {takes.map((take, index) => (
              <div key={take.id} className="w-full shrink-0 flex-none px-5 py-6 flex flex-col">
                <div className="flex items-center mb-3">
                  <Badge variant="secondary" className={cn("rounded-full px-2.5 py-0.5 border-0 font-medium", take.tagColor)}>
                    {take.tagIcon}
                    {take.tag}
                  </Badge>
                </div>
                
                {/* Big Editorial Headline */}
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-[1.15] tracking-tight mb-5">
                  &ldquo;{take.text}&rdquo;
                </h2>
                
                {/* Author Info */}
                <div className="flex items-center gap-3 mt-auto">
                  <Avatar className="w-10 h-10 border border-gray-100">
                    <AvatarFallback className="bg-violet-100 text-violet-700 font-semibold">{take.author[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900 text-[15px]">{take.author}</span>
                      <span className="text-gray-300">&middot;</span>
                      <div className="flex items-center">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-medium text-gray-700 ml-1">{take.rating}</span>
                      </div>
                    </div>
                    <span className="text-[13px] text-gray-500 font-medium">{take.alignment}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Swipe Indicators */}
          <div className="absolute top-6 right-5 flex gap-1.5">
            {takes.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  activeTakeIndex === i ? "bg-violet-600" : "bg-gray-200"
                )}
                onClick={() => setActiveTakeIndex(i)}
              />
            ))}
          </div>
        </div>

        {/* Actions Row */}
        <div className="px-5 py-4 flex items-center justify-between border-t border-gray-50 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-full bg-white border-gray-200 text-gray-700 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-colors shadow-sm">
              <ThumbsUp className="w-4 h-4 mr-1.5" />
              <span className="font-semibold">{takes[activeTakeIndex].agree}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-full bg-white border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm">
              <ThumbsDown className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-full bg-white border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors shadow-sm ml-1">
              <MessageCircle className="w-4 h-4 mr-1.5" />
              <span className="font-semibold">{takes[activeTakeIndex].comment}</span>
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-gray-400 hover:text-gray-900 bg-white shadow-sm border border-gray-100">
              <AtSign className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-gray-400 hover:text-gray-900 bg-white shadow-sm border border-gray-100">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Add Your Take Input */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 shrink-0 border border-gray-100">
              <AvatarImage src="https://i.pravatar.cc/100?img=12" />
              <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">ME</AvatarFallback>
            </Avatar>
            <div className="relative flex-1">
              <Input 
                placeholder="Add your take..." 
                className="w-full bg-gray-50/80 border-gray-200 rounded-full pl-4 pr-10 h-10 text-[15px] focus-visible:ring-1 focus-visible:ring-violet-500 shadow-inner-sm placeholder:text-gray-400"
              />
              <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-full">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
