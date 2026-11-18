import type { SVGProps } from "react";
import { ICONES } from "@/ui/icones";

export function cx(...partes: Array<string | false | null | undefined>) {
  return partes.filter(Boolean).join(" ");
}

export function Icon({
  name,
  size = 16,
  label,
  className,
  ...rest
}: {
  name: string;
  size?: number;
  label?: string;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "stroke" | "strokeWidth">) {
  const desenho = ICONES[name];
  if (!desenho) return null;
  const acesso = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };
  return (
    <svg
      {...rest}
      {...acesso}
      className={cx("cs-icon", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: desenho }}
    />
  );
}
