import React from 'react';

const MessageBubble = ({ message, isUser, avatar }) => {
  // Function to detect if content contains a CSS video link
  const hasVideoLink = (content) => {
    return content.includes('CSS') && content.includes('video');
  };

  return (
    <div className={`message ${isUser ? 'user-message' : 'bot-message'}`}>
      {avatar}
      <div className="message-content">
        {message.content}
        
        {/* If the message mentions CSS video, render a video placeholder */}
        {!isUser && hasVideoLink(message.content) && (
          <div className="video-message">
            <img 
              src="https://via.placeholder.com/400x200/1a1a1a/0088cc?text=CSS+Tutorial+Video" 
              alt="CSS Tutorial" 
              style={{ width: '100%' }}
            />
            <div style={{ 
              position: 'absolute', 
              bottom: '10px', 
              right: '10px', 
              backgroundColor: 'rgba(0,0,0,0.7)', 
              padding: '2px 8px', 
              borderRadius: '4px',
              color: 'white'
            }}>
              1:23:13
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble; 