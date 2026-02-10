import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { StudentExperience } from "@/components/landing/student-experience";
import { TrainerManagement } from "@/components/landing/trainer-management";
import { Philosophy } from "@/components/landing/philosophy";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 selection:bg-violet-500/30 selection:text-violet-200">
      <Navbar />

      <main>
        <Hero />
        <StudentExperience />
        <TrainerManagement />
        <Philosophy />
      </main>

      <Footer />
    </div>
  );
}
