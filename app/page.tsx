
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";

export default async function LandingPage() {
  const session = await auth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center px-4">
      <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-6">
        Master Your Paycheck Anatomy
      </h1>
      <p className="text-xl text-muted-foreground mb-10 max-w-[600px]">
        Stop tracking just net income. Visualize taxes, benefits, and deductions to unlock true zero-based budgeting.
      </p>
      <div className="flex gap-4">
        {session ? (
          <Link href="/dashboard"><Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">Go to Dashboard</Button></Link>
        ) : (
          <Link href="/api/auth/signin"><Button size="lg">Get Started</Button></Link>
        )}
      </div>

      <div className="mt-20 w-full max-w-4xl h-64 bg-muted/30 rounded-xl flex items-center justify-center border border-dashed text-muted-foreground">
        Paycheck Visualization Demo
      </div>
    </div>
  );
}
