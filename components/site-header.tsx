
import Link from "next/link"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { auth, signOut } from "@/auth"

export async function SiteHeader() {
    const session = await auth()

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center px-4 md:px-8">
                <div className="mr-4 flex">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <span className="font-bold sm:inline-block">
                            Paycheck Anatomy
                        </span>
                    </Link>
                    {session && (
                        <nav className="flex items-center space-x-6 text-sm font-medium">
                            <Link href="/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60">Dashboard</Link>
                            <Link href="/dashboard/expenses" className="transition-colors hover:text-foreground/80 text-foreground/60">Expenses</Link>
                            <Link href="/paychecks/new" className="transition-colors hover:text-foreground/80 text-foreground/60">Log Paycheck</Link>
                        </nav>
                    )}
                </div>

                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                    </div>
                    <div className="flex items-center gap-2">
                        {session ? (
                            <form action={async () => {
                                "use server"
                                await signOut()
                            }}>
                                <Button variant="ghost" size="sm">Sign Out</Button>
                            </form>
                        ) : (
                            <Link href="/api/auth/signin"><Button variant="ghost" size="sm">Sign In</Button></Link>
                        )}
                        <ModeToggle />
                    </div>
                </div>
            </div>
        </header>
    )
}
