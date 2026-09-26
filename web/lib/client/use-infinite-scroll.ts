"use client";

import { useEffect, useRef } from "react";

type Pager = { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };

/** Returns a ref for a sentinel element; when it scrolls into view, the next page loads. */
export function useInfiniteScroll(q: Pager) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return sentinel;
}
