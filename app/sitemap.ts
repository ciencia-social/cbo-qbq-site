import type { MetadataRoute } from "next";
import { entradasSitemap } from "@/site/sitemap";

export default function sitemap(): MetadataRoute.Sitemap {
  return entradasSitemap();
}
