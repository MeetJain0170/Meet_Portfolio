import Scanlines from "@/components/effects/Scanlines";
import NeuralExperience from "@/components/NeuralExperience";
import AccessibleFallback from "@/components/AccessibleFallback";

export default function Home() {
  return (
    <main id="app-root" className="fixed inset-0 overflow-hidden">
      <a className="skip-link" href="#text-portfolio">
        Skip visual experience — view text portfolio
      </a>
      <Scanlines />
      <NeuralExperience />
      <AccessibleFallback />
    </main>
  );
}
