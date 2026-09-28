import { useConnectionStatus, useEcho } from '@laravel/echo-react';
import { LoaderCircle, LockKeyhole, Send } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ChatMessage = {
    id: number;
    conversation_id: number;
    sender_id: number;
    sender_name: string;
    body: string;
    created_at: string;
};

export type ChatConversation = {
    id: number;
    type: 'customer_rider' | 'customer_restaurant';
    order: {
        id: number;
        order_number: string;
        restaurant_name: string;
    };
    counterpart: {
        name: string;
        avatar_url: string | null;
    };
    unread_count: number;
    is_closed: boolean;
    closed_at: string | null;
    show_url: string;
    send_url: string;
    mark_read_url: string;
};

type MessagePage = {
    data: ChatMessage[];
    next_page_url: string | null;
};

type Props = {
    conversation: ChatConversation;
    initialMessages: MessagePage;
    currentUserId: number;
    onMessage?: (message: ChatMessage) => void;
    onRead?: () => void;
};

const time = new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
});

const csrfToken = () =>
    document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.getAttribute('content') ?? '';

const initials = (name: string) =>
    name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

export default function ChatThread({
    conversation,
    initialMessages,
    currentUserId,
    onMessage,
    onRead,
}: Props) {
    const connectionStatus = useConnectionStatus();
    const [messages, setMessages] = useState(initialMessages.data);
    const [olderUrl, setOlderUrl] = useState(initialMessages.next_page_url);
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [closed, setClosed] = useState(conversation.is_closed);
    const scrollArea = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
        requestAnimationFrame(() => {
            scrollArea.current?.scrollTo({
                top: scrollArea.current.scrollHeight,
                behavior,
            });
        });
    }, []);

    const markRead = useCallback(async () => {
        try {
            await fetch(conversation.mark_read_url, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
            });
            onRead?.();
        } catch {
            // A failed read receipt must not block the conversation itself.
        }
    }, [conversation.mark_read_url, onRead]);

    const appendMessage = useCallback(
        (message: ChatMessage) => {
            setMessages((current) =>
                current.some((existing) => existing.id === message.id)
                    ? current
                    : [...current, message],
            );
            onMessage?.(message);
            scrollToBottom('smooth');

            if (message.sender_id !== currentUserId) {
                void markRead();
            }
        },
        [currentUserId, markRead, onMessage, scrollToBottom],
    );

    useEffect(() => {
        setMessages(initialMessages.data);
        setOlderUrl(initialMessages.next_page_url);
        setClosed(conversation.is_closed);
        setBody('');
        void markRead();
        scrollToBottom();
    }, [conversation.id, initialMessages, markRead, scrollToBottom]);

    useEffect(() => {
        if (conversation.is_closed || conversation.closed_at === null) return;

        const delay = new Date(conversation.closed_at).getTime() - Date.now();
        if (delay <= 0) {
            setClosed(true);
            return;
        }

        const timeout = window.setTimeout(
            () => setClosed(true),
            Math.min(delay, 2_147_000_000),
        );

        return () => window.clearTimeout(timeout);
    }, [conversation.closed_at, conversation.is_closed]);

    useEcho<ChatMessage>(
        `conversation.${conversation.id}`,
        '.message.sent',
        appendMessage,
        [conversation.id, appendMessage],
    );

    const send = async (event: FormEvent) => {
        event.preventDefault();
        const messageBody = body.trim();
        if (messageBody === '' || sending || closed) return;

        setSending(true);
        try {
            const response = await fetch(conversation.send_url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
                body: JSON.stringify({ body: messageBody }),
            });
            const payload = await response.json();

            if (!response.ok) {
                const validationMessage = payload.errors?.body?.[0];
                throw new Error(
                    validationMessage ??
                        payload.message ??
                        'The message could not be sent.',
                );
            }

            setBody('');
            appendMessage(payload.message as ChatMessage);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'The message could not be sent.',
            );
        } finally {
            setSending(false);
        }
    };

    const loadOlder = async () => {
        if (!olderUrl || loadingOlder) return;
        const element = scrollArea.current;
        const previousHeight = element?.scrollHeight ?? 0;
        const previousTop = element?.scrollTop ?? 0;

        setLoadingOlder(true);
        try {
            const response = await fetch(olderUrl, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json();
            if (!response.ok)
                throw new Error('Older messages could not be loaded.');

            const page = payload.messages as MessagePage;
            setMessages((current) => [
                ...page.data.filter(
                    (message) =>
                        !current.some((existing) => existing.id === message.id),
                ),
                ...current,
            ]);
            setOlderUrl(page.next_page_url);
            requestAnimationFrame(() => {
                if (element) {
                    element.scrollTop =
                        element.scrollHeight - previousHeight + previousTop;
                }
            });
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Older messages could not be loaded.',
            );
        } finally {
            setLoadingOlder(false);
        }
    };

    return (
        <section className="bg-card flex min-h-[34rem] flex-1 flex-col overflow-hidden rounded-xl border">
            <header className="flex items-center gap-3 border-b px-4 py-3">
                <Avatar>
                    {conversation.counterpart.avatar_url && (
                        <AvatarImage
                            src={conversation.counterpart.avatar_url}
                            alt={conversation.counterpart.name}
                        />
                    )}
                    <AvatarFallback>
                        {initials(conversation.counterpart.name)}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                        {conversation.counterpart.name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                        Order {conversation.order.order_number} ·{' '}
                        {conversation.type === 'customer_rider'
                            ? 'Rider chat'
                            : 'Restaurant chat'}
                    </p>
                </div>
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <span
                        className={cn(
                            'size-2 rounded-full',
                            connectionStatus === 'connected'
                                ? 'bg-emerald-500'
                                : 'bg-amber-500',
                        )}
                    />
                    {connectionStatus}
                </span>
            </header>

            <div
                ref={scrollArea}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
                aria-live="polite"
            >
                {olderUrl && (
                    <div className="text-center">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={loadOlder}
                            disabled={loadingOlder}
                        >
                            {loadingOlder && (
                                <LoaderCircle className="animate-spin" />
                            )}
                            Load older messages
                        </Button>
                    </div>
                )}

                {messages.length === 0 && (
                    <div className="text-muted-foreground flex min-h-64 items-center justify-center text-center text-sm">
                        No messages yet. Start the conversation about this
                        order.
                    </div>
                )}

                {messages.map((message) => {
                    const own = message.sender_id === currentUserId;

                    return (
                        <div
                            key={message.id}
                            className={cn(
                                'flex',
                                own ? 'justify-end' : 'justify-start',
                            )}
                        >
                            <div
                                className={cn(
                                    'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm',
                                    own
                                        ? 'bg-primary text-primary-foreground rounded-br-md'
                                        : 'bg-muted rounded-bl-md',
                                )}
                            >
                                {!own && (
                                    <p className="mb-1 text-xs font-medium opacity-70">
                                        {message.sender_name}
                                    </p>
                                )}
                                <p className="break-words whitespace-pre-wrap">
                                    {message.body}
                                </p>
                                <p
                                    className={cn(
                                        'mt-1 text-[10px]',
                                        own
                                            ? 'text-primary-foreground/70'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {time.format(new Date(message.created_at))}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {closed ? (
                <div className="text-muted-foreground bg-muted/40 flex items-center justify-center gap-2 border-t px-4 py-4 text-sm">
                    <LockKeyhole className="size-4" />
                    This order conversation is closed. Its history remains
                    available.
                </div>
            ) : (
                <form onSubmit={send} className="flex gap-2 border-t p-3">
                    <textarea
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                event.currentTarget.form?.requestSubmit();
                            }
                        }}
                        placeholder="Write a message…"
                        maxLength={1000}
                        rows={2}
                        className="border-input bg-background min-h-11 flex-1 resize-none rounded-md border px-3 py-2 text-sm"
                        aria-label="Message"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        className="self-end"
                        disabled={sending || body.trim() === ''}
                        aria-label="Send message"
                    >
                        {sending ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <Send />
                        )}
                    </Button>
                </form>
            )}
        </section>
    );
}
