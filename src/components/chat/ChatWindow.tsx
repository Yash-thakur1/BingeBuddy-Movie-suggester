'use client';

import { useRef, useEffect } from 'react';
import { useChatStore } from '@/store';
import { ChatMessage } from './ChatMessage';
import { ChatInput, QuickActions } from './ChatInput';
import { cn } from '@/lib/utils';

/**
 * Main chat window component
 * Displays conversation history and input
 */
export function ChatWindow() {
  const { messages, isOpen, closeChat, clearChat, isLoading } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={closeChat}
      />
      
      {/* Chat window */}
      <div className={cn(
        "fixed z-50 bg-dark-900/95 backdrop-blur-xl border border-dark-700/50",
        "shadow-2xl shadow-black/50",
        "flex flex-col",
        // Mobile: full screen
        "inset-4 rounded-2xl",
        // Desktop: bottom right corner
        "lg:inset-auto lg:right-6 lg:bottom-24 lg:w-[420px] lg:h-[600px] lg:max-h-[80vh]",
        // Animation
        "animate-in fade-in slide-in-from-bottom-4 duration-300"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 
                          flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white">BingeBuddy Assistant</h3>
              <p className="text-xs text-gray-400">Your personal movie guide</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Clear chat button */}
            <button
              onClick={clearChat}
              className="p-2 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-colors"
              title="Clear chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            
            {/* Close button */}
            <button
              onClick={closeChat}
              className="p-2 text-gray-400 hover:text-white hover:bg-dark-700/50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Messages area */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
        >
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <ChatMessage 
              message={{
                id: 'loading',
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                metadata: { isLoading: true }
              }}
            />
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Quick actions (only on welcome) */}
        <QuickActions />
        
        {/* Input area */}
        <ChatInput />
      </div>
    </>
  );
}

export default ChatWindow;
