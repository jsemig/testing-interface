from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from datetime import datetime
from typing import List, Optional
try:
    from .ai_model import ai_model  # Try relative import first
except ImportError:
    from app.ai_model import ai_model  # Fall back to package import

app = FastAPI(title="Chat Bot API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
client = None

@app.on_event("startup")
async def startup_db_client():
    global client
    client = AsyncIOMotorClient("mongodb://root:example@mongodb:27017/")
    app.mongodb = client.chat_db

@app.on_event("shutdown")
async def shutdown_db_client():
    global client
    if client:
        client.close()

# Pydantic models
class Message(BaseModel):
    sender: str  # 'user' or 'bot'
    content: str
    timestamp: Optional[datetime] = None
    id: Optional[str] = None
    rating: Optional[str] = None  # 'up' or 'down'
    feedback: Optional[str] = None  # Feedback text for thumbs down
    is_improved: Optional[bool] = False  # Whether this is an improved response

class Conversation(BaseModel):
    id: str
    messages: List[Message]
    created_at: datetime
    is_negative: Optional[bool] = False  # Flag to mark negative conversations

class MessageRequest(BaseModel):
    conversation_id: str
    content: str

class RatingRequest(BaseModel):
    messageId: str
    rating: str  # 'up' or 'down'
    feedback: Optional[str] = None

class ImprovedResponseRequest(BaseModel):
    conversationId: str
    messageId: str
    feedback: str

class ImprovedResponseAcceptRequest(BaseModel):
    conversationId: str
    messageId: str
    accept: bool
    improvedResponse: str

# Routes
@app.get("/")
async def root():
    return {"message": "Chat Bot API is running"}

@app.post("/api/conversations", response_model=Conversation)
async def create_conversation():
    """
    Create a new conversation with initial bot message
    """
    conversation_id = str(uuid.uuid4())
    
    # Create initial welcome message
    welcome_message = Message(
        sender="bot",
        content="Hello and thank you for visiting World's Shortest Hackathon bot, what do you need help with?",
        timestamp=datetime.now(),
        id=str(uuid.uuid4())  # Assign a unique ID to the message
    )
    
    # Create conversation
    conversation = Conversation(
        id=conversation_id,
        messages=[welcome_message],
        created_at=datetime.now()
    )
    
    # Save to database
    await app.mongodb.conversations.insert_one(conversation.dict())
    
    return conversation

@app.post("/api/messages", response_model=Message)
async def send_message(message_request: MessageRequest):
    """
    Send a message to the chat bot and get a response
    """
    # Check if conversation exists
    conversation = await app.mongodb.conversations.find_one({"id": message_request.conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Create user message
    user_message = Message(
        sender="user",
        content=message_request.content,
        timestamp=datetime.now(),
        id=str(uuid.uuid4())  # Assign a unique ID to the message
    )
    
    # Add user message to database
    await app.mongodb.conversations.update_one(
        {"id": message_request.conversation_id},
        {"$push": {"messages": user_message.dict()}}
    )
    
    # Get all messages in the conversation for context
    updated_conversation = await app.mongodb.conversations.find_one({"id": message_request.conversation_id})
    
    # Generate bot response using NVIDIA AI model
    ai_response = await ai_model.generate_response(updated_conversation["messages"])
    
    # Create bot message with the AI-generated response
    bot_message = Message(
        sender="bot",
        content=ai_response,
        timestamp=datetime.now(),
        id=str(uuid.uuid4())  # Assign a unique ID to the message
    )
    
    # Add bot message to database
    await app.mongodb.conversations.update_one(
        {"id": message_request.conversation_id},
        {"$push": {"messages": bot_message.dict()}}
    )
    
    return bot_message

@app.post("/api/messages/rate")
async def rate_message(rating_request: RatingRequest):
    """
    Rate a message (thumbs up/down) and provide feedback for thumbs down
    """
    # Check if this is a temporary ID (client-side only)
    if rating_request.messageId.startswith('temp-'):
        # For temporary IDs, we just return success without updating the database
        # This is for backward compatibility with existing messages that don't have IDs
        return {"success": True, "message": "Rating submitted successfully (local only)"}
    
    # Find the conversation containing the message
    conversation = await app.mongodb.conversations.find_one(
        {"messages.id": rating_request.messageId}
    )
    
    if not conversation:
        # Handle the case where the message ID isn't found
        # This could happen with older messages created before the ID field was added
        return {"success": True, "message": "Message not found in database, but rating saved locally"}
    
    # Update the message with the rating information
    result = await app.mongodb.conversations.update_one(
        {"messages.id": rating_request.messageId},
        {"$set": {
            "messages.$.rating": rating_request.rating,
            "messages.$.feedback": rating_request.feedback
        }}
    )
    
    if result.modified_count == 0:
        # If no document was modified, it's likely because the message ID doesn't exist
        # We'll still return success for client-side rendering
        return {"success": True, "message": "No message was updated, but rating saved locally"}
    
    return {"success": True, "message": "Rating submitted successfully"}

@app.post("/api/messages/improve")
async def generate_improved_response(request: ImprovedResponseRequest):
    """
    Generate an improved bot response based on user feedback
    """
    # Find the conversation
    conversation = await app.mongodb.conversations.find_one({"id": request.conversationId})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Find the message that needs improvement
    target_message = None
    message_index = -1
    for i, message in enumerate(conversation["messages"]):
        if message.get("id") == request.messageId:
            target_message = message
            message_index = i
            break
    
    if not target_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Get context for the LLM by extracting previous messages
    context_messages = conversation["messages"][:message_index+1]
    
    # Generate improved response using the AI model
    # Pass the feedback to help the model understand what was wrong
    improved_response = await ai_model.generate_improved_response(
        context_messages, 
        target_message["content"], 
        request.feedback
    )
    
    return {
        "success": True, 
        "improvedResponse": improved_response,
        "originalResponse": target_message["content"]
    }

@app.post("/api/conversations/update-response")
async def update_conversation_response(request: ImprovedResponseAcceptRequest):
    """
    Update a conversation with an improved response or mark it as negative
    """
    # If user rejected the improved response, mark conversation as negative
    if not request.accept:
        result = await app.mongodb.conversations.update_one(
            {"id": request.conversationId},
            {"$set": {"is_negative": True}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to update conversation")
        return {"success": True, "message": "Conversation marked as negative"}
    
    # If user accepted the improved response, update the original message
    result = await app.mongodb.conversations.update_one(
        {"id": request.conversationId, "messages.id": request.messageId},
        {"$set": {
            "messages.$.content": request.improvedResponse,
            "messages.$.rating": "up",  # Change rating to positive
            "messages.$.is_improved": True
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update message")
    
    return {"success": True, "message": "Response updated successfully"}

@app.get("/api/conversations", response_model=List[Conversation])
async def get_all_conversations():
    """
    Get all conversations for the admin dashboard
    """
    conversations = await app.mongodb.conversations.find().to_list(length=100)
    return conversations

@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    """
    Get a conversation by ID
    """
    conversation = await app.mongodb.conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation 