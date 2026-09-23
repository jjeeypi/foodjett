import { Head, useForm } from '@inertiajs/react';
import { Save } from 'lucide-react';
import InputError from '@/components/input-error';
import SettingsNav from '@/components/admin/settings-nav';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Setting = {
    id: number;
    key: string;
    value: string;
    description: string | null;
};

const titleForKey = (key: string) =>
    key
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

const isNumericKey = (key: string) =>
    /(?:radius|minutes|rate|amount)/.test(key);

const groupFor = (key: string) =>
    key.includes('commission') || key.includes('fee')
        ? 'Commission & fees'
        : key.includes('rider') ||
            key.includes('admin_alert') ||
            key.includes('customer_notify') ||
            key.includes('auto_cancel')
          ? 'Rider search & escalation'
          : 'General';

export default function PlatformSettings({
    settings,
}: {
    settings: Setting[];
}) {
    const form = useForm<{ settings: Record<string, string> }>({
        settings: Object.fromEntries(
            settings.map((setting) => [setting.key, setting.value]),
        ),
    });
    const grouped = settings.reduce<Record<string, Setting[]>>(
        (groups, setting) => {
            const group = groupFor(setting.key);
            groups[group] = [...(groups[group] ?? []), setting];
            return groups;
        },
        {},
    );

    const submit = () => {
        form.patch('/admin/settings/platform', { preserveScroll: true });
    };

    return (
        <>
            <Head title="Platform settings" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <SettingsNav />
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Platform settings
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Control commission defaults and the rider-search
                        escalation timetable.
                    </p>
                </div>

                {Object.entries(grouped).map(([group, groupSettings]) => (
                    <Card key={group}>
                        <CardHeader>
                            <CardTitle>{group}</CardTitle>
                            <CardDescription>
                                {group === 'Commission & fees'
                                    ? 'Defaults applied when new commercial profiles are created.'
                                    : 'Timing and distance values used by the rider allocation workflow.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5 md:grid-cols-2">
                            {groupSettings.map((setting) => {
                                const error = (
                                    form.errors as Record<string, string>
                                )[`settings.${setting.key}`];
                                return (
                                    <div key={setting.id} className="space-y-2">
                                        <Label htmlFor={setting.key}>
                                            {titleForKey(setting.key)}
                                        </Label>
                                        <Input
                                            id={setting.key}
                                            name={`settings[${setting.key}]`}
                                            type={
                                                isNumericKey(setting.key)
                                                    ? 'number'
                                                    : 'text'
                                            }
                                            min={
                                                isNumericKey(setting.key)
                                                    ? '0'
                                                    : undefined
                                            }
                                            step={
                                                setting.key.includes('minutes')
                                                    ? '1'
                                                    : isNumericKey(setting.key)
                                                      ? '0.01'
                                                      : undefined
                                            }
                                            value={
                                                form.data.settings[
                                                    setting.key
                                                ] ?? ''
                                            }
                                            onChange={(event) =>
                                                form.setData('settings', {
                                                    ...form.data.settings,
                                                    [setting.key]:
                                                        event.target.value,
                                                })
                                            }
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            {setting.description ?? setting.key}
                                        </p>
                                        <InputError message={error} />
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                ))}

                <div className="flex justify-end">
                    <Button
                        onClick={submit}
                        disabled={form.processing || !form.isDirty}
                    >
                        <Save />{' '}
                        {form.processing ? 'Saving...' : 'Save settings'}
                    </Button>
                </div>
            </div>
        </>
    );
}

PlatformSettings.layout = { title: 'Platform settings' };
