import { notFound } from "next/navigation";

/** Temalı 404 önizlemesi — gerçek not-found boundary’yi tetikler. */
export default function BulunamadiPreview() {
  notFound();
}
