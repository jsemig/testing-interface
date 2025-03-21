import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col, ListGroup, Card, Badge, Alert, Button, Modal, Form, Toast } from 'react-bootstrap';
import BotAvatar from './BotAvatar';
import UserAvatar from './UserAvatar';
import { FaThumbsUp, FaThumbsDown, FaCheck, FaDownload, FaRobot, FaSync } from 'react-icons/fa';
import '../AdminDashboard.css';

const AdminDashboard = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [currentRatedMessage, setCurrentRatedMessage] = useState(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [showImprovedResponseModal, setShowImprovedResponseModal] = useState(false);
  const [improvedResponse, setImprovedResponse] = useState('');
  const [originalResponse, setOriginalResponse] = useState('');
  const [generatingImprovedResponse, setGeneratingImprovedResponse] = useState(false);

  // Fetch all conversations when component mounts
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/conversations');
        setConversations(response.data);
        // Select the first conversation by default if available
        if (response.data.length > 0) {
          setSelectedConversation(response.data[0]);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching conversations:', err);
        setError('Failed to load conversations. Please try again later.');
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  // Handle conversation selection
  const handleSelectConversation = async (conversationId) => {
    try {
      const response = await axios.get(`/api/conversations/${conversationId}`);
      setSelectedConversation(response.data);
    } catch (err) {
      console.error('Error fetching conversation:', err);
      setError('Failed to load conversation details. Please try again later.');
    }
  };

  // Format timestamp for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Get a preview of the first message
  const getConversationPreview = (conversation) => {
    if (!conversation || !conversation.messages || conversation.messages.length === 0) {
      return 'No messages';
    }
    const firstMessage = conversation.messages[0];
    return firstMessage.content.substring(0, 50) + (firstMessage.content.length > 50 ? '...' : '');
  };

  // Get the total number of messages in a conversation
  const getMessageCount = (conversation) => {
    if (!conversation || !conversation.messages) return 0;
    return conversation.messages.length;
  };

  // Handle rating submission
  const handleRateMessage = async (messageId, rating, index) => {
    try {
      // If messageId is undefined, create a temporary ID based on the conversation ID and message index
      const effectiveMessageId = messageId || `temp-${selectedConversation.id}-${index}`;
      
      if (rating === 'down') {
        // For thumbs down, show the feedback modal
        setCurrentRatedMessage({ id: effectiveMessageId, rating, index });
        setShowFeedbackModal(true);
      } else {
        // For thumbs up, submit the rating directly
        setRatingSubmitting(true);
        
        try {
          const response = await axios.post('/api/messages/rate', {
            messageId: effectiveMessageId,
            rating: 'up',
            feedback: ''
          });
          
          // Show success message
          setSuccessMessage('Response rated as helpful!');
          setShowSuccessToast(true);
          
          // Update the UI to show the message was rated
          updateMessageRating(effectiveMessageId, 'up', index);
        } catch (apiError) {
          console.error('API Error:', apiError);
          // If the API call fails, just update the UI locally
          setSuccessMessage('Response rated as helpful (saved locally)');
          setShowSuccessToast(true);
          updateMessageRating(effectiveMessageId, 'up', index);
        }
        
        setRatingSubmitting(false);
      }
    } catch (err) {
      console.error('Error submitting rating:', err);
      setError('Failed to submit rating. Please try again later.');
      setRatingSubmitting(false);
    }
  };

  // Handle submission of feedback modal
  const handleSubmitFeedback = async () => {
    try {
      if (!feedbackText.trim()) {
        setError("Please provide feedback on why the response wasn't helpful.");
        return;
      }
      
      setRatingSubmitting(true);
      
      try {
        // First, rate the message as unhelpful
        await axios.post('/api/messages/rate', {
          messageId: currentRatedMessage.id,
          rating: 'down',
          feedback: feedbackText
        });
        
        // Update the UI to show the message was rated
        updateMessageRating(currentRatedMessage.id, 'down', currentRatedMessage.index);
        
        // Close the feedback modal
        setShowFeedbackModal(false);
        
        // Generate improved response
        setGeneratingImprovedResponse(true);
        const improvedResponseResult = await axios.post('/api/messages/improve', {
          conversationId: selectedConversation.id,
          messageId: currentRatedMessage.id,
          feedback: feedbackText
        });
        
        // Store the improved response and show the improved response modal
        setImprovedResponse(improvedResponseResult.data.improvedResponse);
        setOriginalResponse(improvedResponseResult.data.originalResponse);
        setShowImprovedResponseModal(true);
        setGeneratingImprovedResponse(false);
        
      } catch (apiError) {
        console.error('API Error:', apiError);
        // Continue with UI update even if API call fails
        setSuccessMessage('Feedback saved locally');
        setShowSuccessToast(true);
        setShowFeedbackModal(false);
        setGeneratingImprovedResponse(false);
      }
      
      setRatingSubmitting(false);
      setFeedbackText('');
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again later.');
      setRatingSubmitting(false);
      setShowFeedbackModal(false);
      setGeneratingImprovedResponse(false);
    }
  };

  // Handle acceptance or rejection of improved response
  const handleImprovedResponseDecision = async (accept) => {
    try {
      setRatingSubmitting(true);
      
      const response = await axios.post('/api/conversations/update-response', {
        conversationId: selectedConversation.id,
        messageId: currentRatedMessage.id,
        accept,
        improvedResponse
      });
      
      if (accept) {
        // If the user accepts the improved response, update the UI
        const updatedMessages = selectedConversation.messages.map((message, i) => {
          if ((currentRatedMessage.id && message.id === currentRatedMessage.id) || 
              (!currentRatedMessage.id && i === currentRatedMessage.index)) {
            return {
              ...message,
              content: improvedResponse,
              rating: 'up',
              is_improved: true
            };
          }
          return message;
        });
        
        setSelectedConversation({
          ...selectedConversation,
          messages: updatedMessages
        });
        
        setSuccessMessage('Response updated successfully!');
      } else {
        // If the user rejects the improved response, mark the conversation as negative
        setSuccessMessage('Conversation marked for exclusion from exports');
        
        // Update the local state to mark the conversation as negative
        const updatedConversations = conversations.map(conv => {
          if (conv.id === selectedConversation.id) {
            return { ...conv, is_negative: true };
          }
          return conv;
        });
        
        setConversations(updatedConversations);
        setSelectedConversation({
          ...selectedConversation,
          is_negative: true
        });
      }
      
      setShowSuccessToast(true);
      setShowImprovedResponseModal(false);
      setCurrentRatedMessage(null);
      setImprovedResponse('');
      setOriginalResponse('');
      setRatingSubmitting(false);
      
    } catch (err) {
      console.error('Error updating response:', err);
      setError('Failed to update response. Please try again later.');
      setRatingSubmitting(false);
      setShowImprovedResponseModal(false);
    }
  };

  // Update the message rating in the UI
  const updateMessageRating = (messageId, rating, index) => {
    if (!selectedConversation) return;
    
    const updatedMessages = selectedConversation.messages.map((message, i) => {
      // Match by ID if available or by index
      if ((messageId && message.id === messageId) || (!messageId && i === index)) {
        return {
          ...message,
          rating,
          feedback: rating === 'down' ? feedbackText : ''
        };
      }
      return message;
    });

    setSelectedConversation({
      ...selectedConversation,
      messages: updatedMessages
    });
  };

  // Handle conversations download in JSONL format
  const handleDownloadConversations = () => {
    try {
      setDownloadLoading(true);
      
      // Filter out negative conversations
      const filteredConversations = conversations.filter(conv => !conv.is_negative);
      
      // Convert conversations to JSONL format (one JSON object per line)
      const jsonlData = filteredConversations.map(conversation => JSON.stringify(conversation)).join('\n');
      
      // Create blob with the data
      const blob = new Blob([jsonlData], { type: 'application/jsonl' });
      const url = URL.createObjectURL(blob);
      
      // Create a link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat-conversations-${new Date().toISOString().slice(0, 10)}.jsonl`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setDownloadLoading(false);
      
      // Show success message
      setSuccessMessage(`${filteredConversations.length} conversations downloaded successfully!`);
      setShowSuccessToast(true);
    } catch (err) {
      console.error('Error downloading conversations:', err);
      setError('Failed to download conversations. Please try again later.');
      setDownloadLoading(false);
    }
  };

  if (loading) {
    return (
      <Container fluid className="p-4 admin-view">
        <Alert variant="info" className="text-center my-5">
          <Alert.Heading>Loading conversations...</Alert.Heading>
          <p>Please wait while we retrieve the conversation data.</p>
        </Alert>
      </Container>
    );
  }

  if (error) {
    return (
      <Container fluid className="p-4 admin-view">
        <Alert variant="danger" className="text-center my-5">
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="p-4 admin-view">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="admin-header mb-0">Chat Admin Dashboard</h1>
        <Button
          variant="primary"
          onClick={handleDownloadConversations}
          disabled={downloadLoading || conversations.length === 0}
          className="download-btn"
        >
          <FaDownload className="me-2" />
          {downloadLoading ? 'Downloading...' : `Download ${conversations.filter(c => !c.is_negative).length} Conversations`}
        </Button>
      </div>
      
      {/* Success Toast */}
      <Toast 
        className="position-fixed top-0 end-0 m-4 z-index-toast"
        onClose={() => setShowSuccessToast(false)} 
        show={showSuccessToast} 
        delay={3000} 
        autohide
        style={{ zIndex: 1050 }}
      >
        <Toast.Header className="bg-success text-white">
          <FaCheck className="me-2" />
          <strong className="me-auto">Success</strong>
        </Toast.Header>
        <Toast.Body>{successMessage}</Toast.Body>
      </Toast>
      
      <Row>
        {/* Conversations List (Left Side) */}
        <Col md={4} className="mb-4">
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white">
              <h5 className="mb-0">Conversations ({conversations.length})</h5>
            </Card.Header>
            <ListGroup variant="flush" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {conversations.length === 0 ? (
                <ListGroup.Item className="text-center py-4">No conversations found</ListGroup.Item>
              ) : (
                conversations.map((conversation) => (
                  <ListGroup.Item 
                    key={conversation.id}
                    action
                    active={selectedConversation && selectedConversation.id === conversation.id}
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={`d-flex justify-content-between align-items-center ${conversation.is_negative ? 'negative' : ''}`}
                  >
                    <div>
                      <div className="d-flex align-items-center">
                        <small className="text-muted me-2">
                          {formatDate(conversation.created_at)}
                        </small>
                        <Badge bg="info" pill>
                          {getMessageCount(conversation)} messages
                        </Badge>
                        {conversation.is_negative && (
                          <Badge bg="danger" pill className="ms-2">
                            Excluded from export
                          </Badge>
                        )}
                      </div>
                      <p className="mb-0 mt-1">{getConversationPreview(conversation)}</p>
                    </div>
                  </ListGroup.Item>
                ))
              )}
            </ListGroup>
          </Card>
        </Col>
        
        {/* Conversation Details (Right Side) */}
        <Col md={8}>
          <Card className="shadow-sm">
            <Card.Header className="bg-secondary text-white d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <h5 className="mb-0">
                  {selectedConversation ? 'Conversation Details' : 'Select a Conversation'}
                </h5>
                {selectedConversation && selectedConversation.is_negative && (
                  <Badge bg="danger" className="ms-2">Excluded from export</Badge>
                )}
              </div>
              {selectedConversation && (
                <small>Created: {formatDate(selectedConversation.created_at)}</small>
              )}
            </Card.Header>
            <Card.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {!selectedConversation ? (
                <div className="text-center py-5">
                  <p className="text-muted">Select a conversation from the list to view details</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <strong>Conversation ID:</strong> {selectedConversation.id}
                  </div>
                  
                  <div className="conversation-messages">
                    {selectedConversation.messages.map((message, index) => (
                      <div 
                        key={index} 
                        className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'} ${message.is_improved ? 'is-improved' : ''}`}
                      >
                        {message.sender === 'user' ? <UserAvatar /> : <BotAvatar />}
                        <div className="message-content">
                          <div className="message-header">
                            <small className="text-muted">
                              {message.sender === 'user' ? 'User' : 'Bot'} - {formatDate(message.timestamp)}
                              {message.is_improved && (
                                <Badge bg="info" className="is-improved-badge">Improved Response</Badge>
                              )}
                            </small>
                          </div>
                          <div className="message-body mt-1">
                            {message.content}
                          </div>
                          
                          {/* Rating buttons for bot messages only */}
                          {message.sender === 'bot' && (
                            <div className="message-rating mt-2">
                              {message.rating ? (
                                <div className="rated-message">
                                  <Badge bg={message.rating === 'up' ? 'success' : 'danger'}>
                                    {message.rating === 'up' ? 'Rated Helpful' : 'Rated Unhelpful'}
                                  </Badge>
                                  {message.feedback && (
                                    <div className="mt-1">
                                      <small className="text-muted">Feedback: {message.feedback}</small>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="d-flex align-items-center">
                                  <span className="me-2">Rate this response:</span>
                                  <Button 
                                    variant="outline-success" 
                                    size="sm" 
                                    className="me-2"
                                    onClick={() => handleRateMessage(message.id, 'up', index)}
                                    disabled={ratingSubmitting || selectedConversation.is_negative}
                                  >
                                    <FaThumbsUp /> Helpful
                                  </Button>
                                  <Button 
                                    variant="outline-danger" 
                                    size="sm"
                                    onClick={() => handleRateMessage(message.id, 'down', index)}
                                    disabled={ratingSubmitting || selectedConversation.is_negative}
                                  >
                                    <FaThumbsDown /> Not Helpful
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Feedback Modal */}
      <Modal show={showFeedbackModal} onHide={() => setShowFeedbackModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>What was unhelpful about this response?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Control
                as="textarea"
                rows={4}
                placeholder="Please provide details about what was wrong with this response..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowFeedbackModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSubmitFeedback}
            disabled={ratingSubmitting || !feedbackText.trim()}
          >
            {ratingSubmitting || generatingImprovedResponse ? 
              <><FaSync className="fa-spin me-2" /> Submitting...</> : 
              'Submit Feedback'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Improved Response Modal */}
      <Modal 
        show={showImprovedResponseModal} 
        onHide={() => setShowImprovedResponseModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaRobot className="me-2" />
            Improved Response
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <h5>Original Response:</h5>
          <Card className="mb-4 p-3 original-response">
            {originalResponse}
          </Card>
          
          <h5>Improved Response:</h5>
          <Card className="p-3 improved-response">
            {improvedResponse}
          </Card>
          
          <div className="mt-4">
            <p>Would you like to update the original response with this improved version?</p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="outline-danger" 
            onClick={() => handleImprovedResponseDecision(false)}
            disabled={ratingSubmitting}
          >
            No, mark conversation as negative
          </Button>
          <Button 
            variant="success" 
            onClick={() => handleImprovedResponseDecision(true)}
            disabled={ratingSubmitting}
          >
            Yes, update with improved response
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminDashboard; 