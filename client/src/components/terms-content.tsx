import {
  APPLE_STANDARD_EULA_URL,
  BUSINESS_NAME,
  LEGAL_ENTITY_NAME,
  PRIVACY_POLICY_PATH,
  SUPPORT_EMAIL,
  TERMS_EFFECTIVE_DATE,
} from "@/lib/legal-terms";
import { cn } from "@/lib/utils";

interface TermsContentProps {
  className?: string;
}

/**
 * The complete Terms of Service document.
 *
 * This component intentionally has no auth or page-layout dependencies so it
 * can be rendered both on the public terms route and in an authentication
 * dialog.
 */
export function TermsContent({ className }: TermsContentProps) {
  return (
    <article className={cn("text-sm leading-relaxed text-gray-700", className)}>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {LEGAL_ENTITY_NAME} (dba {BUSINESS_NAME}) · Effective Date:{" "}
          {TERMS_EFFECTIVE_DATE}
        </p>
      </header>

      <p className="mb-6">
        These Terms of Service (“Terms”) are an agreement between you and{" "}
        {LEGAL_ENTITY_NAME}, doing business as {BUSINESS_NAME} (“Consumed,”
        “we,” “us,” or “our”). They govern your access to and use of the
        Consumed mobile application, website, and related features and services
        (collectively, the “Service”). By accessing or using the Service, you
        agree to these Terms. If you do not agree, do not access or use the
        Service.
      </p>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            1. Eligibility
          </h2>
          <p>
            You must be at least 18 years old to use the Service. By using the
            Service, you represent that you meet this requirement. If we learn
            that an account is being used by someone under 18, we may close the
            account and handle associated information as described in our{" "}
            <a
              href={PRIVACY_POLICY_PATH}
              className="text-purple-700 underline underline-offset-2 hover:text-purple-900"
            >
              Privacy Policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            2. Accounts and Account Security
          </h2>
          <p className="mb-3">
            Some features require an account. You agree to provide information
            that is accurate and current, keep your account credentials
            confidential, and accept responsibility for activity conducted
            through your account. Do not share your credentials, impersonate
            another person or entity, or use an account that you are not
            authorized to use. Tell us promptly if you believe your account or
            credentials have been compromised.
          </p>
          <p>
            You may delete your account through the available in-app account
            controls. Account deletion does not necessarily remove information
            that we may retain for legal, security, fraud-prevention, backup,
            or other legitimate operational purposes, as described in the{" "}
            <a
              href={PRIVACY_POLICY_PATH}
              className="text-purple-700 underline underline-offset-2 hover:text-purple-900"
            >
              Privacy Policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            3. The Service
          </h2>
          <p className="mb-3">
            Consumed is a social entertainment platform for tracking media
            consumption and participating in entertainment-related features,
            which may include ratings, lists, predictions, trivia, games,
            leaderboards, and connections with other fans. Features,
            information, and availability may change, and portions of the
            Service may be unavailable from time to time. We do not promise
            that the Service will be uninterrupted, error-free, or available in
            every location.
          </p>
          <p>
            The Service and information available through it are provided for
            entertainment and informational purposes. They are not legal,
            financial, medical, or other professional advice. You are
            responsible for your own decisions and use of the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            4. User Content
          </h2>
          <p className="mb-3">
            You retain ownership of content and information you submit to the
            Service (“User Content”), including media tracking activity,
            ratings, lists, predictions, trivia participation, profile
            information, posts, comments, and other material you provide.
          </p>
          <p className="mb-3">
            You grant Consumed a non-exclusive, worldwide, royalty-free license
            to host, store, reproduce, format, display, and distribute your
            User Content through the Service, and to make technically necessary
            changes to it, solely to operate, maintain, secure, improve, and
            provide the Service. This license permits our service providers to
            perform those functions for us. It does not transfer ownership of
            your User Content to Consumed.
          </p>
          <p>
            You are responsible for the User Content you submit and represent
            that you have the rights and permissions needed to submit it and
            grant the license above. Social features may make User Content
            visible to other users according to the feature and any available
            settings.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            5. Community Standards and Acceptable Use
          </h2>
          <p className="mb-3 font-medium text-gray-800">
            Consumed has no tolerance for objectionable content or abusive
            users. You may not use the Service to:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              harass, bully, stalk, threaten, target, intimidate, or otherwise
              abuse another person, or encourage harm;
            </li>
            <li>
              post or transmit hateful, discriminatory, sexually exploitative,
              sexually explicit, non-consensual intimate, or gratuitously
              violent content;
            </li>
            <li>
              post unlawful, defamatory, fraudulent, misleading, invasive,
              privacy-violating, or infringing content;
            </li>
            <li>
              impersonate a person or entity, misrepresent your affiliation, or
              use the Service to scam, spam, solicit, or defraud others;
            </li>
            <li>
              upload malware, interfere with the Service, or access accounts or
              systems without authorization;
            </li>
            <li>
              use bots or other automated means to access the Service, scrape
              data, or collect information about other users without
              authorization;
            </li>
            <li>
              manipulate games, predictions, ratings, leaderboards, or other
              features; or
            </li>
            <li>
              reverse engineer, decompile, disassemble, or attempt to discover
              the source code of the Service except where applicable law
              expressly permits it.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            6. Reporting, Blocking, and Moderation
          </h2>
          <p className="mb-3">
            Where available, you can report posts, comments, or users through
            the in-app reporting controls and can block users through the
            available blocking controls. You may also contact us at{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-purple-700 underline underline-offset-2 hover:text-purple-900"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            about a safety or policy concern. Blocking is a user control that
            can limit interactions and visibility in the Service; it is not a
            guarantee of complete separation across every feature or
            third-party service.
          </p>
          <p className="mb-3">
            We may review, restrict, remove, preserve, or decline to act on
            User Content and may use automated or manual measures to enforce
            these Terms. We may suspend or terminate accounts, with or without
            notice where permitted by law, when we believe they violate these
            Terms, harm others, or create risk for the Service or its users.
          </p>
          <p>
            We do not promise that every report will result in action or that
            any report will be reviewed or resolved within a particular
            timeframe. We do not undertake a duty to monitor all User Content,
            and we are not responsible for the conduct or content of users or
            third parties.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            7. Games and Entertainment Features
          </h2>
          <p>
            Games, predictions, ratings, rankings, leaderboards, and similar
            features are for entertainment only. They are non-wagering, carry
            no monetary value, and do not provide gambling, financial
            wagering, or real-money gaming services. Results, rankings, and
            recommendations are not guaranteed.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            8. Intellectual Property
          </h2>
          <p>
            The Service, including its software, design, branding, logos,
            original text, features, and other materials provided by Consumed,
            is owned by {LEGAL_ENTITY_NAME} or its licensors and is protected
            by intellectual-property and other applicable laws. Except for the
            limited right to use the Service under these Terms, no ownership or
            other license is granted to you. You may not copy, modify,
            distribute, sell, lease, or create derivative works from the
            Service or its materials without our prior written permission.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            9. Third-Party Services and Content
          </h2>
          <p>
            The Service may link to or work with third-party services, content,
            or data sources. Those third parties may have their own terms and
            privacy policies, which govern your use of their services. We do
            not control and are not responsible for third-party services,
            content, availability, or practices.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            10. Privacy and Communications
          </h2>
          <p>
            Our{" "}
            <a
              href={PRIVACY_POLICY_PATH}
              className="text-purple-700 underline underline-offset-2 hover:text-purple-900"
            >
              Privacy Policy
            </a>{" "}
            explains how we collect, use, retain, and disclose information in
            connection with the Service. These Terms do not constitute blanket
            consent to marketing communications. If marketing communications
            are offered, any required consent and your communication choices
            are handled separately and subject to applicable law.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            11. Apple Licensed Software
          </h2>
          <p>
            If you use the licensed iOS software, that software is also subject
            to Apple’s{" "}
            <a
              href={APPLE_STANDARD_EULA_URL}
              target="_blank"
              rel="noreferrer"
              className="text-purple-700 underline underline-offset-2 hover:text-purple-900"
            >
              Standard Licensed Application End User License Agreement
            </a>
            . Apple’s standard EULA applies to the licensed iOS software and is
            separate from these Service Terms. The linked document is Apple’s
            standard EULA; it is not a custom Consumed EULA or a replacement
            for these Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            12. Suspension and Termination
          </h2>
          <p className="mb-3">
            You may stop using the Service or delete your account at any time.
            We may suspend or terminate your access, remove User Content, or
            discontinue all or part of the Service at any time, including when
            necessary to enforce these Terms, protect users or the Service,
            comply with law, or address security or abuse concerns. We may do
            so with or without notice where permitted by law.
          </p>
          <p>
            When access ends, your right to use the Service ends. Provisions
            that by their nature should continue, including provisions about
            User Content, intellectual property, disclaimers, limitations of
            liability, governing law, and disputes, will continue to apply.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            13. Disclaimers and Limitation of Liability
          </h2>
          <p className="mb-3">
            TO THE FULLEST EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED
            “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, EXPRESS
            OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
            PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
            THAT THE SERVICE WILL BE SECURE, UNINTERRUPTED, ACCURATE, OR FREE
            OF HARMFUL CONTENT OR CODE.
          </p>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, {LEGAL_ENTITY_NAME} AND
            CONSUMED WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS,
            DATA, GOODWILL, OR REVENUE, ARISING FROM OR RELATING TO THE SERVICE
            OR THESE TERMS. OUR TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE
            SERVICE WILL NOT EXCEED THE GREATER OF $100 OR THE AMOUNTS, IF ANY,
            THAT YOU PAID DIRECTLY TO US FOR THE SERVICE DURING THE 12 MONTHS
            BEFORE THE EVENT GIVING RISE TO THE CLAIM.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            14. Changes to These Terms
          </h2>
          <p>
            We may revise these Terms from time to time. When we do, we will
            update the Effective Date above and post the revised Terms in the
            Service. Where appropriate, we may provide additional notice of
            material changes. Your continued use of the Service after revised
            Terms become effective means you accept them, to the extent
            permitted by law. If you do not agree to revised Terms, stop using
            the Service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            15. Governing Law and Consumer Rights
          </h2>
          <p>
            These Terms are governed by the laws of the State of Delaware,
            without regard to its conflict-of-law rules. This governing-law
            provision does not waive, limit, or require you to give up any
            nonwaivable consumer-protection rights or other mandatory rights
            that apply where you live.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            16. Contact
          </h2>
          <p>
            Questions about these Terms may be sent to{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-purple-700 underline underline-offset-2 hover:text-purple-900"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <p className="mt-2 text-gray-600">
            {LEGAL_ENTITY_NAME}, doing business as {BUSINESS_NAME}
          </p>
        </section>
      </div>
    </article>
  );
}
