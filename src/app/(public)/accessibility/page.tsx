/**
 * Accessibility Statement Page
 *
 * LOW-004: Public accessibility statement required by WCAG 2.1 AA best practices
 * Documents compliance status and contact for accessibility issues
 */

import { generatePageMetadata } from '@/lib/seo';

export const metadata = generatePageMetadata({
    title: 'Accessibility Statement',
    description:
        'lole Restaurant OS commitment to accessibility and WCAG 2.1 AA compliance. Learn about our accessibility features and how to report issues.',
    path: '/accessibility',
});

export default function AccessibilityPage(): React.JSX.Element {
    return (
        <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
                <header className="mb-12">
                    <h1 className="mb-4 text-3xl font-bold text-gray-900">
                        Accessibility Statement
                    </h1>
                    <p className="text-gray-600">Last updated: March 24, 2026</p>
                </header>

                <main className="prose prose-gray max-w-none">
                    <section className="mb-8">
                        <h2 className="mb-4 text-2xl font-semibold text-gray-900">
                            Our Commitment
                        </h2>
                        <p className="mb-4 text-gray-700">
                            lole Restaurant OS is committed to ensuring digital accessibility for
                            people with disabilities. We are continually improving the user
                            experience for everyone and applying the relevant accessibility
                            standards.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="mb-4 text-2xl font-semibold text-gray-900">
                            Conformance Status
                        </h2>
                        <p className="mb-4 text-gray-700">
                            We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1
                            Level AA. These guidelines explain how to make web content more
                            accessible for people with disabilities.
                        </p>
                        <div className="mb-4 border-l-4 border-blue-400 bg-blue-50 p-4">
                            <h3 className="mb-2 text-lg font-medium text-blue-900">
                                Current Compliance Status
                            </h3>
                            <ul className="list-inside list-disc space-y-1 text-blue-800">
                                <li>Keyboard navigation support</li>
                                <li>Screen reader compatibility (NVDA, JAWS, VoiceOver)</li>
                                <li>Color contrast ratios meeting AA standards</li>
                                <li>Text resizing up to 200% without loss of content</li>
                                <li>Alternative text for images</li>
                                <li>Form labels and error identification</li>
                                <li>Focus indicators for interactive elements</li>
                            </ul>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="mb-4 text-2xl font-semibold text-gray-900">
                            Technical Specifications
                        </h2>
                        <p className="mb-4 text-gray-700">
                            Accessibility of lole Restaurant OS relies on the following technologies
                            to work with the particular combination of web browser and any assistive
                            technologies or plugins installed on your computer:
                        </p>
                        <ul className="mb-4 list-inside list-disc space-y-1 text-gray-700">
                            <li>HTML5 (WAI-ARIA 1.1)</li>
                            <li>CSS3</li>
                            <li>JavaScript (ES2020+)</li>
                            <li>React 18 with accessibility patterns</li>
                        </ul>
                        <p className="text-gray-700">
                            These technologies are relied upon for conformance with the
                            accessibility standards used.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="mb-4 text-2xl font-semibold text-gray-900">
                            Accessibility Features
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                                <h3 className="mb-2 font-medium text-gray-900">
                                    Keyboard Navigation
                                </h3>
                                <p className="text-sm text-gray-600">
                                    All interactive elements are accessible via keyboard. Use Tab to
                                    navigate, Enter/Space to activate, and Escape to close modals.
                                </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                                <h3 className="mb-2 font-medium text-gray-900">
                                    Screen Reader Support
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Semantic HTML and ARIA landmarks provide context for screen
                                    readers. Tested with NVDA, JAWS, and VoiceOver.
                                </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                                <h3 className="mb-2 font-medium text-gray-900">
                                    Visual Adjustments
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Support for high contrast modes, reduced motion preferences, and
                                    text scaling up to 200%.
                                </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                                <h3 className="mb-2 font-medium text-gray-900">Color & Contrast</h3>
                                <p className="text-sm text-gray-600">
                                    Color contrast ratios meet WCAG 2.1 AA standards (4.5:1 for
                                    text, 3:1 for large text and UI components).
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="mb-4 text-2xl font-semibold text-gray-900">Known Issues</h2>
                        <p className="mb-4 text-gray-700">
                            We are actively working to address the following known accessibility
                            issues:
                        </p>
                        <ul className="list-inside list-disc space-y-2 text-gray-700">
                            <li>
                                <strong>Third-party integrations:</strong> Some payment provider
                                widgets may have limited accessibility. We work with providers to
                                improve this.
                            </li>
                            <li>
                                <strong>Legacy components:</strong> Some older UI components are
                                being updated to meet current accessibility standards.
                            </li>
                            <li>
                                <strong>Mobile gestures:</strong> Some complex gestures may not have
                                keyboard alternatives. We are implementing alternatives.
                            </li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="mb-4 text-2xl font-semibold text-gray-900">Feedback</h2>
                        <p className="mb-4 text-gray-700">
                            We welcome your feedback on the accessibility of lole Restaurant OS.
                            Please let us know if you encounter accessibility barriers:
                        </p>
                        <div className="mb-4 rounded-lg bg-gray-100 p-4">
                            <h3 className="mb-2 font-medium text-gray-900">Contact Us</h3>
                            <ul className="space-y-1 text-gray-700">
                                <li>
                                    <strong>Email:</strong>{' '}
                                    <a
                                        href="mailto:accessibility@lole.app"
                                        className="text-blue-600 hover:underline"
                                    >
                                        accessibility@lole.app
                                    </a>
                                </li>
                                <li>
                                    <strong>Phone:</strong>{' '}
                                    <a
                                        href="tel:+251911123456"
                                        className="text-blue-600 hover:underline"
                                    >
                                        +251 911 123 456
                                    </a>
                                </li>
                                <li>
                                    <strong>Address:</strong> Bole Road, Addis Ababa, Ethiopia
                                </li>
                            </ul>
                        </div>
                        <p className="text-gray-700">
                            We try to respond to accessibility feedback within 2 business days and
                            to propose a solution within 10 business days.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="mb-4 text-2xl font-semibold text-gray-900">
                            Assessment Approach
                        </h2>
                        <p className="mb-4 text-gray-700">
                            lole Restaurant OS assessed the accessibility of this website by:
                        </p>
                        <ul className="list-inside list-disc space-y-1 text-gray-700">
                            <li>Self-evaluation using WCAG 2.1 checklist</li>
                            <li>Automated testing with axe-core and Lighthouse</li>
                            <li>Manual testing with keyboard navigation</li>
                            <li>Screen reader testing (NVDA, VoiceOver)</li>
                            <li>External accessibility audit (2026)</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="mb-4 text-2xl font-semibold text-gray-900">
                            Formal Complaints
                        </h2>
                        <p className="text-gray-700">
                            In Ethiopia, you may submit complaints about web accessibility to the
                            Ethiopian Communications Authority. We are committed to working with
                            regulatory bodies to ensure equal access for all users.
                        </p>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-semibold text-gray-900">
                            This Statement
                        </h2>
                        <p className="text-gray-700">
                            This statement was prepared on March 24, 2026. It was last reviewed on
                            March 24, 2026. We review this statement annually or when significant
                            changes are made to the platform.
                        </p>
                    </section>
                </main>
            </div>
        </div>
    );
}
