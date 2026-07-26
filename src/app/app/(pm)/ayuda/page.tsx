import { HelpCenter } from "@/components/help/help-center";

export const metadata = {
  title: "Ayuda — Nexus",
};

export default function AyudaPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <HelpCenter />
    </div>
  );
}
