import { MarketingShell } from "@/components/marketing-shell";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - EcoLudus",
  description: "Privacy Policy for EcoLudus - how we protect your data"
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8 lg:px-10">
        <Link href="/landing" className="text-sm font-medium text-forest-700 hover:text-forest-900 mb-8 inline-block">
          ← Back to home
        </Link>
        
        <h1 className="font-serif text-4xl font-semibold text-forest-950 mb-2">Privacy Policy</h1>
        <p className="text-sm text-forest-900/60 mb-8">Last updated: June 2026</p>

        <div className="prose prose-sm max-w-none text-forest-900/80 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-forest-950 mb-3">1. Introduction</h2>
            <p>
              EcoLudus ("we", "our", or "us") operates the EcoLudus website and application. This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our service and the choices you have associated with that data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-950 mb-3">2. Information Collection and Use</h2>
            <p>We collect several different types of information for various purposes to provide and improve our service to you:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li><strong>Account Information:</strong> Email address, username, profile information you choose to share</li>
              <li><strong>Usage Data:</strong> Device information, browser type, pages visited, time spent, and interaction patterns</li>
              <li><strong>Sustainability Data:</strong> Quest completion records, carbon offset calculations, team interactions</li>
              <li><strong>Photo Verification Data:</strong> Images uploaded for environmental proof (processed locally, not stored)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-950 mb-3">3. Use of Data</h2>
            <p>EcoLudus uses the collected data for various purposes:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>To provide and maintain our service</li>
              <li>To verify environmental sustainability achievements</li>
              <li>To calculate verified carbon offset through third-party APIs (Climatiq)</li>
              <li>To coordinate real-world impact (tree planting through Ecologi)</li>
              <li>To send optional weekly impact emails</li>
              <li>To improve and analyze how users interact with our service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-950 mb-3">4. Third-Party Services</h2>
            <p>We use the following third-party services that may collect information:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li><strong>Climatiq:</strong> Carbon calculation API - see their privacy policy</li>
              <li><strong>Ecologi:</strong> Tree planting service - see their privacy policy</li>
              <li><strong>SendGrid:</strong> Email delivery (optional) - see their privacy policy</li>
              <li><strong>Firebase:</strong> Authentication and data storage</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-950 mb-3">5. Data Security</h2>
            <p>
              The security of your data is important to us but remember that no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your personal data, we cannot guarantee its absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-950 mb-3">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of weekly emails</li>
              <li>Request a copy of your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-forest-950 mb-3">7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:hello@ecoludus.com" className="text-forest-700 hover:underline font-medium">
                hello@ecoludus.com
              </a>
            </p>
          </section>
        </div>
      </section>
    </MarketingShell>
  );
}
