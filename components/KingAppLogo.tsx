import Image from "next/image";

type KingAppLogoProps = {
  className?: string;
  priority?: boolean;
  size?: number;
};

export function KingAppLogo({
  className = "",
  priority = false,
  size = 56
}: KingAppLogoProps) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-black ${className}`}
      style={{ height: size, width: size }}
    >
      <Image
        alt="KingApp logo"
        className="object-contain"
        fill
        priority={priority}
        sizes={`${size}px`}
        src="/icons/kingapp-logo.jpg"
      />
    </div>
  );
}
