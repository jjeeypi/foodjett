type Props = {
    current: number;
    total: number;
    label: string;
};

export default function StepIndicator({ current, total, label }: Props) {
    const progress = Math.round((current / total) * 100);

    return (
        <div className="space-y-2" aria-label={`Step ${current} of ${total}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">
                    Step {current} of {total}
                </span>
                <span className="text-muted-foreground">{label}</span>
            </div>
            <div
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={total}
                aria-valuenow={current}
                className="bg-muted h-2 overflow-hidden rounded-full"
            >
                <div
                    className="bg-primary h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
