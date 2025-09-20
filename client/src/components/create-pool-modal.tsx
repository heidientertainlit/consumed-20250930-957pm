import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Film, Tv, Book, Star, Trophy } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CreatePoolModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreatePoolModal({ isOpen, onClose }: CreatePoolModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    predictionType: "yes-no",
    endDate: "",
    endTime: "",
    options: ["Yes", "No"]
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createPoolMutation = useMutation({
    mutationFn: async (data: any) => {
      const endDateTime = new Date(`${data.endDate}T${data.endTime}`);
      return apiRequest("POST", "/api/pools", {
        title: data.title,
        description: data.description,
        category: data.category,
        predictionType: data.predictionType,
        options: data.options,
        endDate: endDateTime.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pools/featured"] });
      toast({
        title: "Pool Created",
        description: "Your prediction pool has been created successfully!",
      });
      onClose();
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create pool. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      predictionType: "yes-no",
      endDate: "",
      endTime: "",
      options: ["Yes", "No"]
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.title || !formData.description || !formData.endDate || !formData.endTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createPoolMutation.mutate(formData);
  };

  const categories = [
    { id: "movies", name: "Movies", icon: Film, color: "text-purple-primary" },
    { id: "tv", name: "TV Shows", icon: Tv, color: "text-pink-primary" },
    { id: "books", name: "Books", icon: Book, color: "text-cyan-accent" },
    { id: "sports", name: "Sports", icon: Trophy, color: "text-orange-accent" },
    { id: "pop-culture", name: "Pop Culture", icon: Star, color: "text-gold-accent" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-secondary border-dark-accent max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create New Pool</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Category</Label>
            <RadioGroup 
              value={formData.category} 
              onValueChange={(value) => setFormData({ ...formData, category: value })}
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
              {categories.map((category) => (
                <div key={category.id}>
                  <RadioGroupItem value={category.id} id={category.id} className="sr-only" />
                  <Label 
                    htmlFor={category.id}
                    className={`cursor-pointer border border-dark-accent rounded-lg p-4 text-center hover:border-purple-primary transition-colors block ${
                      formData.category === category.id ? 'border-purple-primary bg-purple-primary/10' : ''
                    }`}
                  >
                    <category.icon className={`${category.color} text-2xl mb-2 mx-auto`} />
                    <div className="text-sm font-medium">{category.name}</div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Pool Title */}
          <div>
            <Label htmlFor="poolTitle" className="text-sm font-medium mb-2 block">Pool Title</Label>
            <Input
              id="poolTitle"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-dark-primary border-dark-accent focus:border-purple-primary"
              placeholder="e.g., Will Marvel's next movie break $1B?"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="poolDescription" className="text-sm font-medium mb-2 block">Description</Label>
            <Textarea
              id="poolDescription"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-dark-primary border-dark-accent focus:border-purple-primary"
              placeholder="Provide context and details about your prediction..."
              rows={3}
            />
          </div>

          {/* Prediction Type */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Prediction Type</Label>
            <RadioGroup 
              value={formData.predictionType} 
              onValueChange={(value) => setFormData({ ...formData, predictionType: value })}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="yes-no" id="yes-no" />
                <Label htmlFor="yes-no">Yes/No Question</Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="multiple-choice" id="multiple-choice" />
                <Label htmlFor="multiple-choice">Multiple Choice</Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="number-range" id="number-range" />
                <Label htmlFor="number-range">Number Range (e.g., box office numbers)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* End Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="endDate" className="text-sm font-medium mb-2 block">End Date</Label>
              <Input
                type="date"
                id="endDate"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="bg-dark-primary border-dark-accent focus:border-purple-primary"
              />
            </div>
            <div>
              <Label htmlFor="endTime" className="text-sm font-medium mb-2 block">End Time</Label>
              <Input
                type="time"
                id="endTime"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="bg-dark-primary border-dark-accent focus:border-purple-primary"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4">
            <Button 
              type="button" 
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-dark-accent border-dark-accent hover:border-gray-600"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createPoolMutation.isPending}
              className="flex-1 gradient-primary hover:opacity-90"
            >
              {createPoolMutation.isPending ? "Creating..." : "Create Pool"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
