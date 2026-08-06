import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy — ScoreTrack'
  }, [])

  return (
    <article className="rounded-xl bg-white p-5 shadow-sm">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Privacy Policy</h1>
      <p className="mb-4 text-sm text-gray-500">Last updated: July 4, 2026</p>

      <div className="space-y-4 text-sm leading-relaxed text-gray-700">
        <p>
          ScoreTrack (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) provides live cricket scoring for local
          clubs and tournaments through our website and mobile apps at{' '}
          <a className="text-blue-600 underline" href="https://scoretrackonline.com">
            scoretrackonline.com
          </a>
          .
        </p>

        <section>
          <h2 className="mb-1 font-semibold text-gray-900">Information we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Account information:</strong> name, display name, email address, mobile phone
              number, and profile photo (when you sign in with Google or register).
            </li>
            <li>
              <strong>Cricket data you create:</strong> teams, squads, matches, scores, player
              statistics, tournaments, and shared live/overlay links.
            </li>
            <li>
              <strong>Usage data:</strong> basic technical logs from our hosting and authentication
              providers (e.g. device/browser type, IP address, crash diagnostics).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-gray-900">How we use information</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Provide sign-in, scoring, statistics, notifications, and sharing features.</li>
            <li>Display public match pages, player stats, and tournament listings you choose to make public.</li>
            <li>Maintain security, prevent abuse, and improve the service.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-gray-900">Third-party services</h2>
          <p>
            We use Google Firebase (Authentication, Cloud Firestore, Hosting) to run the app. Google
            processes account and app data on our behalf under their terms and privacy policy. Google
            Sign-In is optional; you may also register with email and password.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-gray-900">Data sharing</h2>
          <p>
            We do not sell your personal information. Match and player statistics you mark as public
            may be visible to anyone with the link. We may disclose information if required by law or
            to protect users and the service.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-gray-900">Data retention &amp; deletion</h2>
          <p>
            We retain account and scoring data while your account is active. You may update profile
            details in the app, or delete your account from{' '}
            <Link className="text-blue-600 underline" to="/app/delete-account">
              Delete account
            </Link>{' '}
            in the app menu. You can also email{' '}
            <a className="text-blue-600 underline" href="mailto:paravathmuhsin2@gmail.com">
              paravathmuhsin2@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-gray-900">Children</h2>
          <p>
            ScoreTrack is not directed at children under 13. We do not knowingly collect personal
            information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-gray-900">Contact</h2>
          <p>
            Questions about this policy:{' '}
            <a className="text-blue-600 underline" href="mailto:paravathmuhsin2@gmail.com">
              paravathmuhsin2@gmail.com
            </a>
          </p>
        </section>
      </div>
    </article>
  )
}
