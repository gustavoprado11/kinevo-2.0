import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { StudentMetrics } from "@/components/landing/student-metrics";
import { TrainerManagement } from "@/components/landing/trainer-management";
import { StudentExperience } from "@/components/landing/student-experience";
import { BentoFeatures } from "@/components/landing/bento-features";
import { Philosophy } from "@/components/landing/philosophy";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white selection:bg-violet-500/20 selection:text-violet-700">
      <Navbar />

      <main>
        <Hero />
        <StudentMetrics />
        <TrainerManagement />
        <StudentExperience />
        <BentoFeatures />
        <Philosophy />
      </main>

      <Footer />
    </div>
  );
}
