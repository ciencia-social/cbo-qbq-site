"use client";

import { usePathname } from "next/navigation";
import { NetworkBar } from "@/ui/componentes";

export function Barra() {
  const caminho = usePathname() ?? "";
  return <NetworkBar atual={caminho} />;
}
