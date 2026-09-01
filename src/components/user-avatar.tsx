import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { resolveAvatarSrc } from "@/lib/avatar-cache";

interface UserAvatarProps {
  src?: string;
  name?: string;
  className?: string;
}

export const getAvatarBgStyle = (seed: string = "") => {
  if (!seed) return { backgroundColor: "hsl(239, 84%, 67%)" };
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return { backgroundColor: `hsl(${hue}, 60%, 46%)` };
};

export const UserAvatar = ({
  src,
  name,
  className
}: UserAvatarProps) => {
  const style = getAvatarBgStyle(name || "");
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);
  const [resolved, setResolved] = useState<string | undefined>(undefined);

  useEffect(() => {
    const el = wrapRef.current;
    if (!src) {
      setInView(false);
      return;
    }
    if (src.startsWith("data:") || src.startsWith("blob:") || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    if (!el) {
      setInView(true);
      return;
    }
    let visible = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          visible = true;
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "80px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (!visible) setInView(false);
    };
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    if (!src || !inView) {
      if (!src) setResolved(undefined);
      return;
    }
    if (src.startsWith("data:") || src.startsWith("blob:")) {
      setResolved(src);
      return;
    }
    setResolved(undefined);
    resolveAvatarSrc(src)
      .then((value) => {
        if (!cancelled) setResolved(value || src);
      })
      .catch(() => {
        if (!cancelled) setResolved(src);
      });
    return () => {
      cancelled = true;
    };
  }, [src, inView]);

  return (
    <Avatar 
      ref={wrapRef}
      className={cn(
        "h-7 w-7 md:h-10 md:w-10 flex items-center justify-center select-none shrink-0",
        className
      )}
      style={style}
    >
      {resolved && <AvatarImage src={resolved} className="object-cover" />}
      <User className="h-1/2 w-1/2 text-white stroke-[2.5]" />
    </Avatar>
  );
};
