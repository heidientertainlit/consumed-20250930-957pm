import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <div className="flex items-center justify-center mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1>
          </div>

          <p className="mt-2 text-sm text-gray-600">
            This page doesn't exist or may have moved.
          </p>

          <Button
            onClick={() => setLocation("/")}
            className="mt-6 bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-back-home"
          >
            <Home size={16} className="mr-2" />
            Back to Feed
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
