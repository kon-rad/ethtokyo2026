import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog — AI City",
  description: "Essays on pop-up cities, the infomorph stack, extropianism, and building coordination primitives.",
};

const posts = [
  {
    href: "/blog/infomorph-extropianism",
    title: "Infomorphs and Extropianism",
    description:
      "Pop-up cities are the grouping layer of the infomorph stack: crypto-native coordination for a post-biological world.",
    date: "2026-09-27",
    tags: ["vision", "extropian", "infomorph"],
  },
];

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
        <p className="mt-2 text-muted">
          Essays on pop-up cities, the infomorph stack, extropianism, and building coordination
          primitives.
        </p>
      </div>

      <div className="space-y-6">
        {posts.map((post) => (
          <Link
            key={post.href}
            href={post.href}
            className="block rounded-2xl border border-line bg-surface p-6 transition hover:border-gray-300"
          >
            <div className="flex items-center gap-3 text-sm text-muted">
              <time>{post.date}</time>
              <span>·</span>
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">{post.title}</h2>
            <p className="mt-1 text-sm text-muted">{post.description}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
        <p className="font-medium">More posts coming</p>
        <p className="mt-1 text-sm text-muted">
          Follow <a href="https://x.com/konradgnat" className="underline">@konradgnat</a> for updates.
        </p>
      </div>
    </div>
  );
}