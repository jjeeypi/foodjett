import { Head, Link, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import { LockKeyhole, MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ChatThread, {
    type ChatConversation,
    type ChatMessage,
} from '@/components/chat/chat-thread';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ConversationListItem = ChatConversation & {
    last_message: {
        body: string;
        sender_name: string;
        created_at: string;
    } | null;
};

type MessagePage = {
    data: ChatMessage[];
    next_page_url: string | null;
};

type UnreadUpdate = {
    user_id: number;
    conversation_id: number;
    unread_count: number;
    conversation_unread_count: number;
    message: ChatMessage | null;
};

const dateTime = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});

const initials = (name: string) =>
    name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

export default function MessagesIndex({
    conversations,
    selectedConversation,
    messages,
}: {
    conversations: ConversationListItem[];
    selectedConversation: ChatConversation | null;
    messages: MessagePage | null;
}) {
    const { auth } = usePage().props;
    const [items, setItems] = useState(conversations);

    useEffect(() => setItems(conversations), [conversations]);

    const updatePreview = useCallback(
        (message: ChatMessage, unreadCount?: number) => {
            setItems((current) => {
                const target = current.find(
                    (conversation) =>
                        conversation.id === message.conversation_id,
                );
                if (!target) return current;

                const updated: ConversationListItem = {
                    ...target,
                    unread_count:
                        unreadCount ??
                        (selectedConversation?.id === target.id
                            ? 0
                            : target.unread_count),
                    last_message: {
                        body: message.body,
                        sender_name: message.sender_name,
                        created_at: message.created_at,
                    },
                };

                return [
                    updated,
                    ...current.filter(
                        (conversation) => conversation.id !== target.id,
                    ),
                ];
            });
        },
        [selectedConversation?.id],
    );

    useEcho<UnreadUpdate>(
        `user.${auth.user.id}.notifications`,
        '.messages.unread.updated',
        (update) => {
            setItems((current) =>
                current.map((conversation) =>
                    conversation.id === update.conversation_id
                        ? {
                              ...conversation,
                              unread_count:
                                  selectedConversation?.id === conversation.id
                                      ? 0
                                      : update.conversation_unread_count,
                          }
                        : conversation,
                ),
            );

            if (update.message) {
                updatePreview(
                    update.message,
                    selectedConversation?.id === update.conversation_id
                        ? 0
                        : update.conversation_unread_count,
                );
            }
        },
        [auth.user.id, selectedConversation?.id, updatePreview],
    );

    const markSelectedRead = useCallback(() => {
        if (!selectedConversation) return;
        setItems((current) =>
            current.map((conversation) =>
                conversation.id === selectedConversation.id
                    ? { ...conversation, unread_count: 0 }
                    : conversation,
            ),
        );
    }, [selectedConversation]);

    return (
        <>
            <Head title="Messages" />
            <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                        Messages
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Order-specific conversations with your restaurant and
                        rider.
                    </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
                    <aside className="bg-card overflow-hidden rounded-xl border">
                        <div className="border-b px-4 py-3">
                            <h2 className="font-medium">Conversations</h2>
                        </div>
                        <div className="max-h-[42rem] divide-y overflow-y-auto">
                            {items.length === 0 && (
                                <div className="text-muted-foreground flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
                                    <MessageCircle className="size-8" />
                                    <p>
                                        Conversations appear after a restaurant
                                        accepts your order or a rider is
                                        assigned.
                                    </p>
                                </div>
                            )}
                            {items.map((conversation) => (
                                <Link
                                    key={conversation.id}
                                    href={conversation.show_url}
                                    preserveScroll
                                    className={cn(
                                        'hover:bg-muted/60 flex gap-3 p-4 transition-colors',
                                        selectedConversation?.id ===
                                            conversation.id && 'bg-primary/5',
                                    )}
                                >
                                    <Avatar className="size-10 shrink-0">
                                        {conversation.counterpart
                                            .avatar_url && (
                                            <AvatarImage
                                                src={
                                                    conversation.counterpart
                                                        .avatar_url
                                                }
                                                alt={
                                                    conversation.counterpart
                                                        .name
                                                }
                                            />
                                        )}
                                        <AvatarFallback>
                                            {initials(
                                                conversation.counterpart.name,
                                            )}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="truncate text-sm font-medium">
                                                {conversation.counterpart.name}
                                            </p>
                                            {conversation.unread_count > 0 && (
                                                <Badge className="min-w-5 justify-center px-1.5">
                                                    {conversation.unread_count >
                                                    99
                                                        ? '99+'
                                                        : conversation.unread_count}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                            Order{' '}
                                            {conversation.order.order_number} ·{' '}
                                            {conversation.order.restaurant_name}
                                        </p>
                                        <p className="text-muted-foreground mt-2 truncate text-xs">
                                            {conversation.last_message
                                                ? conversation.last_message.body
                                                : 'No messages yet'}
                                        </p>
                                        <div className="mt-2 flex items-center justify-between gap-2">
                                            <span className="text-muted-foreground text-[11px]">
                                                {conversation.last_message
                                                    ? dateTime.format(
                                                          new Date(
                                                              conversation
                                                                  .last_message
                                                                  .created_at,
                                                          ),
                                                      )
                                                    : ''}
                                            </span>
                                            <span
                                                className={cn(
                                                    'inline-flex items-center gap-1 text-[11px] font-medium',
                                                    conversation.is_closed
                                                        ? 'text-muted-foreground'
                                                        : 'text-emerald-600 dark:text-emerald-400',
                                                )}
                                            >
                                                {conversation.is_closed && (
                                                    <LockKeyhole className="size-3" />
                                                )}
                                                {conversation.is_closed
                                                    ? 'Closed'
                                                    : 'Active'}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </aside>

                    {selectedConversation && messages ? (
                        <ChatThread
                            key={selectedConversation.id}
                            conversation={selectedConversation}
                            initialMessages={messages}
                            currentUserId={auth.user.id}
                            onMessage={updatePreview}
                            onRead={markSelectedRead}
                        />
                    ) : (
                        <div className="text-muted-foreground bg-card flex min-h-[34rem] items-center justify-center rounded-xl border p-8 text-center text-sm">
                            Select a conversation to read or send messages.
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
