'use client';

import React, { useCallback, useState } from 'react';
import { BookOpen, Loader2, Search, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { logger } from '@/lib/logger';

interface SupportArticle {
    id: string;
    title: string;
    category: string;
}

interface SupportTicket {
    id: string;
    subject: string;
    description: string;
    priority: string;
    status: string;
    source: string;
    created_at: string;
    updated_at: string;
}

interface HelpSupportPageClientProps {
    initialArticles: SupportArticle[];
    initialTickets: SupportTicket[];
}

export function HelpSupportPageClient({
    initialArticles,
    initialTickets,
}: HelpSupportPageClientProps): React.ReactElement {
    const [query, setQuery] = useState('');
    const [articles, setArticles] = useState<SupportArticle[]>(initialArticles);
    const [articlesLoading, setArticlesLoading] = useState(false);
    const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [ticketSubmitting, setTicketSubmitting] = useState(false);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

    const loadArticles = useCallback(async (searchQuery: string) => {
        try {
            setArticlesLoading(true);
            const response = await fetch(
                `/api/support/articles?query=${encodeURIComponent(searchQuery)}`,
                { method: 'GET' }
            );
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to load articles.');
            }
            setArticles((payload?.data?.articles ?? []) as SupportArticle[]);
        } catch (error) {
            logger.error('Failed to load articles', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load articles.');
        } finally {
            setArticlesLoading(false);
        }
    }, []);

    const loadTickets = useCallback(async () => {
        try {
            setTicketsLoading(true);
            const response = await fetch('/api/v1/merchant/comms/support/tickets?limit=20', {
                method: 'GET',
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to load support tickets.');
            }
            setTickets((payload?.data?.tickets ?? []) as SupportTicket[]);
        } catch (error) {
            logger.error('Failed to load support tickets', error);
            toast.error(error instanceof Error ? error.message : 'Failed to load tickets.');
        } finally {
            setTicketsLoading(false);
        }
    }, []);

    const handleSearch = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        await loadArticles(query);
    };

    const handleTicketSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        const trimmedSubject = subject.trim();
        const trimmedDescription = description.trim();
        if (trimmedSubject.length < 3) {
            toast.error('Subject must be at least 3 characters.');
            return;
        }
        if (trimmedDescription.length < 5) {
            toast.error('Description must be at least 5 characters.');
            return;
        }

        try {
            setTicketSubmitting(true);
            const response = await fetch('/api/v1/merchant/comms/support/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: trimmedSubject,
                    description: trimmedDescription,
                    priority,
                    diagnostics_json: { source_page: 'merchant_help' },
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to create ticket.');
            }

            setSubject('');
            setDescription('');
            setPriority('medium');
            toast.success('Support ticket created.');
            await loadTickets();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create ticket.');
        } finally {
            setTicketSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen space-y-8 bg-white pb-20">
            <div>
                <h1 className="mb-2 text-4xl font-bold tracking-tight text-black">
                    Help & Support
                </h1>
                <p className="font-medium text-gray-500">
                    Knowledge base, ticketing, and support history.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-3xl bg-white p-6 shadow-lg shadow-gray-200/50">
                    <div className="mb-4 flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-orange-600" />
                        <h2 className="text-xl font-bold text-gray-900">Knowledge Base</h2>
                    </div>
                    <form onSubmit={handleSearch} className="mb-4 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                placeholder="Search articles..."
                                className="h-11 w-full rounded-xl border border-gray-200 pr-3 pl-9 text-sm outline-none focus:border-gray-400"
                            />
                        </div>
                        <button className="bg-brand-accent h-11 rounded-xl px-4 text-sm font-semibold text-black hover:brightness-105">
                            Search
                        </button>
                    </form>

                    {articlesLoading && (
                        <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading articles...
                        </div>
                    )}

                    {!articlesLoading && (
                        <div className="space-y-2">
                            {articles.length === 0 && (
                                <p className="text-sm text-gray-500">No articles found.</p>
                            )}
                            {articles.map(article => (
                                <div
                                    key={article.id}
                                    className="rounded-xl bg-gray-50 p-3 shadow-none transition-shadow hover:shadow-none"
                                >
                                    <p className="text-sm font-semibold text-gray-900">
                                        {article.title}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">{article.category}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-3xl bg-white p-6 shadow-lg shadow-gray-200/50">
                    <h2 className="mb-4 text-xl font-bold text-gray-900">Create Support Ticket</h2>
                    <form onSubmit={handleTicketSubmit} className="space-y-3">
                        <input
                            value={subject}
                            onChange={event => setSubject(event.target.value)}
                            placeholder="Subject"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                        />
                        <textarea
                            value={description}
                            onChange={event => setDescription(event.target.value)}
                            placeholder="Describe your issue..."
                            className="min-h-[120px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                        />
                        <select
                            value={priority}
                            onChange={event =>
                                setPriority(
                                    event.target.value as 'low' | 'medium' | 'high' | 'critical'
                                )
                            }
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                        <button
                            type="submit"
                            disabled={ticketSubmitting}
                            className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {ticketSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Submit Ticket
                        </button>
                    </form>
                </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-lg shadow-gray-200/50">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Ticket History Timeline</h2>
                {ticketsLoading && (
                    <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading ticket history...
                    </div>
                )}
                {!ticketsLoading && (
                    <div className="space-y-3">
                        {tickets.length === 0 && (
                            <p className="text-sm text-gray-500">No support tickets yet.</p>
                        )}
                        {tickets.map(ticket => (
                            <div
                                key={ticket.id}
                                className="rounded-xl bg-gray-50 p-4 shadow-none transition-shadow hover:shadow-none"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-gray-900">
                                        {ticket.subject}
                                    </p>
                                    <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                                        {ticket.status}
                                    </span>
                                </div>
                                <p className="mt-2 line-clamp-2 text-xs text-gray-600">
                                    {ticket.description}
                                </p>
                                <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
                                    <span>Priority: {ticket.priority}</span>
                                    <span>
                                        Created: {new Date(ticket.created_at).toLocaleString()}
                                    </span>
                                    <span>
                                        Updated: {new Date(ticket.updated_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
