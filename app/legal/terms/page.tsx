import { MarketingShell } from "@/components/marketing-shell";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service - EcoLudus",
  description: "Terms of Service for EcoLudus"
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8 lg:px-10">
        <Link href="/landing" className="mb-8 inline-block text-sm font-medium transition hover:opacity-80" style={{ color: "var(--text-accent)" }}>
          ← Back to home
        </Link>

        <h1 className="mb-2 font-serif text-4xl font-semibold" style={{ color: "var(--text-primary)" }}>Terms of Service</h1>
        <p className="mb-8 text-sm" style={{ color: "var(--text-muted)" }}>Last updated: June 2026</p>

        <div className="prose prose-sm max-w-none space-y-6" style={{ color: "var(--text-secondary)" }}>
          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>1. Agreement to Terms</h2>
            <p>
              By accessing and using EcoLudus, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>2. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials (information or software) on EcoLudus for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose or for any public display</li>
              <li>Attempt to decompile or reverse engineer any software</li>
              <li>Remove any copyright or other proprietary notations from the materials</li>
              <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>3. Disclaimer</h2>
            <p>
              The materials on EcoLudus are provided on an 'as is' basis. EcoLudus makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>4. Limitations</h2>
            <p>
              In no event shall EcoLudus or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on EcoLudus.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>5. Accuracy of Materials</h2>
            <p>
              The materials appearing on EcoLudus could include technical, typographical, or photographic errors. EcoLudus does not warrant that any of the materials on EcoLudus are accurate, complete, or current. EcoLudus may make changes to the materials contained on EcoLudus at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>6. Links</h2>
            <p>
              EcoLudus has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by EcoLudus of the site. Use of any such linked website is at the user's own risk.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>7. Modifications</h2>
            <p>
              EcoLudus may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>8. User Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Submit false or misleading sustainability information</li>
              <li>Engage in harassment or abusive behavior toward other users</li>
              <li>Attempt to manipulate leaderboards or achievements</li>
              <li>Upload non-environmental or inappropriate photos for verification</li>
              <li>Violate any applicable local, state, national or international law or regulation</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>9. Carbon & Impact Statements</h2>
            <p>
              All carbon reduction calculations are provided by Climatiq API and represent estimates based on standard calculation methods. Actual environmental impact may vary. Real-world tree planting is facilitated through Ecologi partnership and is subject to their delivery timelines.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>10. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws of your jurisdiction, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>11. Contact</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at{" "}
              <a href="mailto:hello@ecoludus.com" className="font-medium underline transition hover:opacity-80" style={{ color: "var(--text-accent)" }}>
                hello@ecoludus.com
              </a>
            </p>
          </section>
        </div>
      </section>
    </MarketingShell>
  );
}
