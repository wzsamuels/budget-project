"use client";

import { Button } from "@/components/ui/button";
import { seedBudgetCategories } from "@/actions/expenses";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export function SeedCategoriesButton() {
    const [loading, setLoading] = useState(false);

    async function onClick() {
        setLoading(true);
        try {
            const result = await seedBudgetCategories();
            if (result.success) {
                toast.success("Categories initialized");
            } else {
                toast.error("Failed to seed categories");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg border-dashed space-y-4">
            <p className="text-muted-foreground text-sm">No expense categories found.</p>
            <Button onClick={onClick} disabled={loading} variant="outline">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Initialize Default Categories
            </Button>
        </div>
    );
}
