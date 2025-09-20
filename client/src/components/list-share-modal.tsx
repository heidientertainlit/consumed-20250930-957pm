import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Copy, Check, Share2, Link, Facebook, Twitter, MessageCircle } from "lucide-react";

interface ListShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  listName: string;
  listItems: number;
  listType?: "default" | "custom";
}

export default function ListShareModal({ isOpen, onClose, listName, listItems, listType = "default" }: ListShareModalProps) {
  const [copied, setCopied] = useState(false);
  
  const shareUrl = `${window.location.origin}/list/${listName.toLowerCase().replace(/\s+/g, '-')}`;
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link');
    }
  };

  const handleSocialShare = (platform: string) => {
    const text = `Check out my "${listName}" list with ${listItems} items on entertainlit!`;
    let url = '';
    
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + shareUrl)}`;
        break;
    }
    
    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Share List</h3>
            <p className="text-sm text-gray-600">"{listName}" • {listItems} items</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>
        
        {/* Copy Link */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Share Link
          </label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 truncate">
              {shareUrl}
            </div>
            <Button
              onClick={handleCopyLink}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-copy-link"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
          {copied && (
            <p className="text-xs text-green-600 mt-1">Link copied to clipboard!</p>
          )}
        </div>

        {/* Social Sharing */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Share to Social Media
          </label>
          <div className="grid grid-cols-3 gap-3">
            <Button
              onClick={() => handleSocialShare('twitter')}
              variant="outline"
              className="flex flex-col items-center p-4 h-auto"
              data-testid="button-share-twitter"
            >
              <Twitter size={20} className="text-blue-500 mb-1" />
              <span className="text-xs">Twitter</span>
            </Button>
            
            <Button
              onClick={() => handleSocialShare('facebook')}
              variant="outline"
              className="flex flex-col items-center p-4 h-auto"
              data-testid="button-share-facebook"
            >
              <Facebook size={20} className="text-blue-600 mb-1" />
              <span className="text-xs">Facebook</span>
            </Button>
            
            <Button
              onClick={() => handleSocialShare('whatsapp')}
              variant="outline"
              className="flex flex-col items-center p-4 h-auto"
              data-testid="button-share-whatsapp"
            >
              <MessageCircle size={20} className="text-green-500 mb-1" />
              <span className="text-xs">WhatsApp</span>
            </Button>
          </div>
        </div>

        {/* List Privacy Notice */}
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            <strong>Note:</strong> {listType === "custom" ? "This list will be made public when shared." : "This is a default list that shows your personal consumption data."}
          </p>
        </div>
      </div>
    </div>
  );
}