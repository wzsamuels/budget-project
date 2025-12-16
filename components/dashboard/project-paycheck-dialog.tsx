"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { projectPaycheck } from "@/actions/paycheck";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { Label } from "@/components/ui/label";

interface ProjectPaycheckDialogProps {
    paycheckId: string;
    employerName: string;
    payDate: string;
}

export function ProjectPaycheckDialog({
    paycheckId,
    employerName,
    payDate,
}: ProjectPaycheckDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [frequency, setFrequency] = useState<"WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY">("BIWEEKLY");

    async function handleProject() {
        setLoading(true);
        try {
            const result = await projectPaycheck(paycheckId, frequency);
            if (result.success) {
                toast.success(`Successfully projected ${result.count} future paychecks.`);
                setOpen(false);
            } else {
                toast.error("Failed to project paychecks.");
            }
        } catch (error) {
            toast.error("An error occurred.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Calendar className="h-4 w-4" />
                    Project
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Project Future Paychecks</DialogTitle>
                    <DialogDescription>
                        Generate expected paychecks for the rest of the year based on this paycheck from {employerName} ({new Date(payDate).toLocaleDateString()}).
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="frequency" className="text-right">
                            Frequency
                        </Label>
                        <Select
                            value={frequency}
                            onValueChange={(val: any) => setFrequency(val)}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="WEEKLY">Weekly</SelectItem>
                                <SelectItem value="BIWEEKLY">Bi-Weekly</SelectItem>
                                <SelectItem value="SEMIMONTHLY">Semi-Monthly (15th & End)</SelectItem>
                                <SelectItem value="MONTHLY">Monthly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleProject} disabled={loading}>
                        {loading ? "Projecting..." : "Generate projections"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
