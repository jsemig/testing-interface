import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MessageBubble from './MessageBubble';
import BotAvatar from './BotAvatar';
import UserAvatar from './UserAvatar';

const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Start a new conversation when the component mounts
  useEffect(() => {
    const startConversation = async () => {
      try {
        setIsLoading(true);
        const response = await axios.post('/api/conversations');
        setConversationId(response.data.id);
        setMessages(response.data.messages);
        setIsLoading(false);
      } catch (error) {
        console.error('Error starting conversation:', error);
        setIsLoading(false);
      }
    };
    
    startConversation();
  }, []);
  
  // Scroll to the bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!input.trim() || !conversationId) return;
    
    // Add user message to state immediately
    const userMessage = {
      content: input,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Send message to API
      const response = await axios.post('/api/messages', {
        conversation_id: conversationId,
        content: input
      });
      
      // Add bot response to state
      setMessages(prevMessages => [...prevMessages, response.data]);
      setIsLoading(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
    }
  };
  
  return (
    <div className="chat-container">
      <div className="chat-header">
        <button className="back-button">&lt;</button>
        <h3>Live chat</h3>
        <button className="close-button">×</button>
      </div>
      
      <div className="chat-messages">
        {messages.map((message, index) => (
          <MessageBubble 
            key={index} 
            message={message} 
            isUser={message.sender === 'user'} 
            avatar={message.sender === 'user' ? <UserAvatar /> : <BotAvatar />} 
          />
        ))}
        
        {isLoading && (
          <div className="message bot-message">
            <BotAvatar />
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input">
        <form onSubmit={handleSendMessage}>
          <input
            type="text"
            placeholder="Type your message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </form>
      </div>
    </div>
  );
};

export default ChatBox; 