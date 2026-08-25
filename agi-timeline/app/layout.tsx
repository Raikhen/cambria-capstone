import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGI Timeline",
  description:
    "A curated, citation-grounded timeline of the events that matter on the road to advanced AI.",
};

const NAV_LINKS = [
  { href: "/classic", label: "Classic" },
  { href: "/canvas", label: "Canvas" },
  { href: "/digest", label: "Digest" },
  { href: "/methodology", label: "Methodology" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold">
              AGI Timeline
            </Link>
            <ul className="flex gap-4 text-sm">
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
