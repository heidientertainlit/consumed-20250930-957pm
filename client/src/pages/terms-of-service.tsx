import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 mb-4">
            <strong>Last Updated:</strong> January 2026
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-600 mb-4">
            By accessing or using Consumed, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
          <p className="text-gray-600 mb-4">
            Consumed is a social entertainment platform that allows users to track media consumption, play entertainment-related games, make predictions, and connect with other fans.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. User Accounts</h2>
          <p className="text-gray-600 mb-4">
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. User Content</h2>
          <p className="text-gray-600 mb-4">
            You retain ownership of content you submit to Consumed. By posting content, you grant us a license to use, display, and distribute that content on our platform.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Prohibited Conduct</h2>
          <p className="text-gray-600 mb-4">
            You agree not to engage in harassment, spam, impersonation, or any illegal activities while using our services.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">6. Intellectual Property</h2>
          <p className="text-gray-600 mb-4">
            Consumed and its original content, features, and functionality are owned by Consumed and are protected by copyright, trademark, and other intellectual property laws.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">7. Limitation of Liability</h2>
          <p className="text-gray-600 mb-4">
            Consumed shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">8. Changes to Terms</h2>
          <p className="text-gray-600 mb-4">
            We reserve the right to modify these terms at any time. We will notify users of significant changes via the platform or email.
          </p>
          
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">9. Contact</h2>
          <p className="text-gray-600 mb-4">
            For questions about these Terms, contact us at legal@consumed.app
          </p>
        </div>
      </div>
    </div>
  );
}
