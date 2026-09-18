import type { Metadata } from "next";
import { PreviewPopout } from "@/components/PreviewPopout";

export const metadata: Metadata = {
  title: "Aperçu live — IDE Claude",
  description: "Aperçu plein écran d’IDE Claude, synchronisé avec l’éditeur HTML / CSS.",
};

export default function PreviewPage() {
  return <PreviewPopout />;
}
