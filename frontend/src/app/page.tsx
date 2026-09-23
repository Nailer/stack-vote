import About from '@/components/About';
import PollBoard from '@/components/PollBoard';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#131416] text-white">
      <div className="max-w-4xl mx-auto px-4">
        <About />
        <PollBoard />
      </div>
    </main>
  );
}
