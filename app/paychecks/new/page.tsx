
import { PaycheckForm } from "./paycheck-form";

export default function NewPaycheckPage() {
    return (
        <div className="container mx-auto py-10 px-4 md:px-8 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Add New Paycheck</h1>
                <p className="text-muted-foreground mt-2">
                    Enter your gross pay and deductions to calculate your true net income.
                </p>
            </div>
            <PaycheckForm />
        </div>
    );
}
