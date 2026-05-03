document.addEventListener('DOMContentLoaded', () => {
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const closeChatBtn = document.getElementById('close-chat');
    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const chatSubmit = document.getElementById('chat-submit');
    
    let isChatOpen = false;
    let messagesHistory = []; // to store context

    // Toggle Chat Window
    function toggleChat() {
        isChatOpen = !isChatOpen;
        if (isChatOpen) {
            chatWindow.classList.remove('hidden');
            setTimeout(() => {
                chatWindow.classList.remove('scale-95', 'opacity-0', 'translate-y-4');
                chatWindow.classList.add('scale-100', 'opacity-100', 'translate-y-0');
            }, 10); // slight delay to allow display:block to apply before animating
            chatInput.focus();
            
            // Change toggle button icon to X
            chatToggleBtn.innerHTML = '<i class="fa-solid fa-xmark text-xl"></i>';
        } else {
            chatWindow.classList.remove('scale-100', 'opacity-100', 'translate-y-0');
            chatWindow.classList.add('scale-95', 'opacity-0', 'translate-y-4');
            setTimeout(() => {
                chatWindow.classList.add('hidden');
            }, 300); // match transition duration
            
            // Change toggle button icon back to message
            chatToggleBtn.innerHTML = '<i class="fa-solid fa-message text-xl"></i>';
        }
    }

    chatToggleBtn.addEventListener('click', toggleChat);
    closeChatBtn.addEventListener('click', toggleChat);

    // Initial styling for hidden state for smooth open animation
    chatWindow.classList.add('scale-95', 'opacity-0', 'translate-y-4', 'transform', 'transition-all', 'duration-300', 'origin-bottom-right');

    function appendMessage(role, content) {
        const messageDiv = document.createElement('div');
        
        if (role === 'user') {
            messageDiv.className = 'flex items-start gap-2 max-w-[85%] ml-auto flex-row-reverse';
            messageDiv.innerHTML = `
                <div class="bg-brand-500 p-3 rounded-2xl rounded-tr-none shadow-sm text-sm text-white break-words">
                    ${escapeHTML(content)}
                </div>
            `;
        } else {
            messageDiv.className = 'flex items-start gap-2 max-w-[85%]';
            messageDiv.innerHTML = `
                <div class="w-6 h-6 rounded-full bg-brand-500 flex-shrink-0 flex items-center justify-center mt-1 shadow-sm">
                    <i class="fa-solid fa-robot text-[10px] text-white"></i>
                </div>
                <div class="bot-msg-content bg-white dark:bg-brand-800 border border-gray-100 dark:border-brand-700 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-gray-700 dark:text-gray-200 break-words">
                    <span class="typing-indicator flex gap-1 items-center h-5">
                        <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                        <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                        <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                    </span>
                </div>
            `;
        }
        
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv; // Return the created element
    }

    function updateBotMessage(messageElement, content) {
        const contentDiv = messageElement.querySelector('.bot-msg-content');
        if (contentDiv) {
            // Replace newlines with <br> and format bold markdown safely
            let formattedContent = escapeHTML(content)
                .replace(/\\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            contentDiv.innerHTML = formattedContent;
            scrollToBottom();
        }
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const content = chatInput.value.trim();
        if (!content) return;

        // Add user message to UI
        appendMessage('user', content);
        chatInput.value = '';
        chatSubmit.disabled = true;

        // Add to history
        messagesHistory.push({ role: 'user', content: content });

        // Add empty bot message with typing indicator to UI
        const botMessageElement = appendMessage('assistant', '');
        let fullBotResponse = '';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages: messagesHistory })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let isTypingIndicatorRemoved = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;
                        
                        try {
                            const data = JSON.parse(dataStr);
                            
                            if (data.error) {
                                fullBotResponse = "Sorry, I encountered an error: " + data.error;
                                updateBotMessage(botMessageElement, fullBotResponse);
                                break;
                            }
                            
                            const contentChunk = data.choices[0]?.delta?.content || '';
                            if (contentChunk) {
                                fullBotResponse += contentChunk;
                                updateBotMessage(botMessageElement, fullBotResponse);
                            }
                        } catch (err) {
                            console.error('Error parsing SSE data:', err, dataStr);
                        }
                    }
                }
            }

            // Save bot response to history
            messagesHistory.push({ role: 'assistant', content: fullBotResponse });

        } catch (error) {
            console.error('Chat error:', error);
            updateBotMessage(botMessageElement, "Sorry, I'm having trouble connecting to the server right now.");
        } finally {
            chatSubmit.disabled = false;
            chatInput.focus();
        }
    });
});
