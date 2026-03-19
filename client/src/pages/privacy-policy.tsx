import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/navigation";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/profile" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">EntertainLit Inc. (dba Consumed) · Effective Date: February 23, 2026</p>

        <p className="text-gray-700 mb-6 leading-relaxed">
          This Privacy Policy describes how EntertainLit Inc. doing business as Consumed ("Consumed," "we," "us," or "our") collects, uses, and protects your information when you use the Consumed mobile application and related services.
        </p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
          <h3 className="text-base font-medium text-gray-800 mb-2">A. Information You Provide</h3>
          <p className="text-gray-700 mb-3 leading-relaxed">When you create an account or use Consumed, we may collect:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
            <li>Email address</li>
            <li>Username</li>
            <li>Profile information</li>
            <li>Media tracking activity (movies, television, books, music, podcasts, games, sports, and other entertainment)</li>
            <li>Ratings, lists, predictions, trivia participation, and leaderboard activity</li>
            <li>User-generated content</li>
            <li>Support communications</li>
          </ul>
          <h3 className="text-base font-medium text-gray-800 mb-2">B. Automatically Collected Information</h3>
          <p className="text-gray-700 mb-3 leading-relaxed">When you use the app, we may automatically collect:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
            <li>Device type and operating system</li>
            <li>App usage and interaction data (features used, screens viewed)</li>
            <li>Push notification tokens</li>
            <li>Anonymous analytics identifiers (not linked to advertising identifiers)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
          <p className="text-gray-700 mb-3 leading-relaxed">We use collected information to:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
            <li>Provide authentication and account access</li>
            <li>Store and display your media history and activity</li>
            <li>Power leaderboards, games, predictions, and interactive features</li>
            <li>Generate insights, summaries, or classifications using artificial intelligence services</li>
            <li>Improve product performance and user experience</li>
            <li>Send optional push notifications</li>
            <li>Monitor security and prevent abuse</li>
            <li>Provide customer support</li>
          </ul>
          <p className="text-gray-700 font-medium">We do not sell your personal information.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Media Tracking Data</h2>
          <p className="text-gray-700 mb-3 leading-relaxed">
            Consumed allows users to log and track their entertainment consumption across media types. This information may be used to:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
            <li>Generate personal insights, summaries, and AI-powered features</li>
            <li>Display leaderboard rankings</li>
            <li>Improve feature development</li>
            <li>Enable social and interactive experiences</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">You control what you choose to track within the app.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Third-Party Service Providers & Content Sources</h2>
          <p className="text-gray-700 mb-3 leading-relaxed">
            We use third-party providers and content sources to operate and improve our services. These may include:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
            <li>Cloud infrastructure and database providers</li>
            <li>Push notification services</li>
            <li>Analytics and product usage tracking services</li>
            <li>Artificial intelligence processing services</li>
            <li>External media data providers</li>
          </ul>
          <p className="text-gray-700 mb-3 leading-relaxed">Media data and metadata may be provided by third-party APIs, including:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
            <li>The Movie Database (TMDB) for movie and television information</li>
            <li>Spotify for music and podcast-related metadata</li>
            <li>Google Books for book-related metadata</li>
          </ul>
          <p className="text-gray-700 mb-3 leading-relaxed">
            These providers may process limited data necessary to deliver functionality. Their use of information is governed by their respective privacy policies and terms.
          </p>
          <p className="text-gray-700 mb-3 leading-relaxed">
            We do not use third-party SDKs for advertising or cross-app tracking purposes.
          </p>
          <p className="text-gray-700 leading-relaxed">
            PostHog does not use Apple's Advertising Identifier (IDFA) and does not engage in cross-app or cross-site tracking. Its data collection is not considered "tracking" under Apple's App Tracking Transparency framework.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Retention</h2>
          <p className="text-gray-700 leading-relaxed">
            We retain your information while your account is active. You may request deletion of your account at any time through the app settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Account Deletion</h2>
          <p className="text-gray-700 mb-3 leading-relaxed">If you delete your account:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
            <li>Your personal data will be removed from our active systems</li>
            <li>Aggregated or anonymized data that cannot be linked back to you may be retained</li>
            <li>Certain information may be retained if required for legal, fraud prevention, or security purposes</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Your Rights and Choices</h2>
          <p className="text-gray-700 mb-3 leading-relaxed">Depending on your location, you may have the right to:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt out of optional push notifications at any time through your device settings</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            To exercise these rights, contact us at:{" "}
            <a href="mailto:support@consumedapp.com" className="text-purple-600 underline">
              support@consumedapp.com
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Children's Privacy</h2>
          <p className="text-gray-700 mb-3 leading-relaxed">
            Consumed is not directed to children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such information, we will promptly delete it.
          </p>
          <p className="text-gray-700 leading-relaxed">
            If you believe we may have collected such information, contact us at{" "}
            <a href="mailto:support@consumedapp.com" className="text-purple-600 underline">
              support@consumedapp.com
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Security</h2>
          <p className="text-gray-700 leading-relaxed">
            We implement reasonable technical and organizational safeguards to protect your information from unauthorized access, disclosure, or loss. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
          <p className="text-gray-700 leading-relaxed">
            We may update this Privacy Policy periodically. When we do, we will update the Effective Date above. For significant changes, we may notify you through the app or via email. Continued use of the app after updates constitutes acceptance of the revised policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Contact Us</h2>
          <p className="text-gray-700 mb-2 leading-relaxed">If you have questions about this Privacy Policy or our data practices:</p>
          <p className="text-gray-700 font-medium">EntertainLit, LLC (dba Consumed)</p>
          <a href="mailto:support@consumedapp.com" className="text-purple-600 underline">
            support@consumedapp.com
          </a>
        </section>
      </div>

      <Navigation />
    </div>
  );
}
