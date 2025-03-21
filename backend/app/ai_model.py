import openai
import asyncio
import json
from typing import List, Dict, Any
import os
from dotenv import load_dotenv
import logging
from asyncio import sleep

# Import custom content filter
try:
    from .content_filter import content_filter
except ImportError:
    from app.content_filter import content_filter

# Import NeMo Guardrails
try:
    from .guardrails import guardrails
except ImportError:
    from app.guardrails import guardrails

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIModel:
    def __init__(self):
        # Initialize OpenAI client
        self.api_key = os.getenv("OPENAI_API_KEY", "your-api-key")
        self.model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        
        # For older OpenAI version compatibility
        try:
            self.client = openai.OpenAI(api_key=self.api_key)
            self.is_new_client = True
        except (AttributeError, TypeError):
            # Fallback for older OpenAI package
            openai.api_key = self.api_key
            self.is_new_client = False
            logger.info("Using legacy OpenAI client")
        
        # Check if guardrails are available
        self.use_guardrails = guardrails is not None
        if self.use_guardrails:
            logger.info("NeMo Guardrails initialized and will be used for responses")
        else:
            logger.warning("NeMo Guardrails not available, fallback to basic filtering")
        
        logger.info(f"AI Model initialized with model: {self.model}")

    async def generate_response(self, messages):
        """Generate a response using the NVIDIA AI model via OpenAI API"""
        try:
            # Extract just the content from messages for context
            message_texts = []
            last_message_content = ""
            
            for msg in messages:
                if isinstance(msg, Dict):
                    sender = msg.get("sender", "unknown")
                    content = msg.get("content", "")
                else:
                    sender = getattr(msg, "sender", "unknown")
                    content = getattr(msg, "content", "")
                
                message_texts.append(f"{sender.capitalize()}: {content}")
                
                # Keep track of the last user message for content filtering
                if sender == "user":
                    last_message_content = content
            
            context = "\n".join(message_texts)
            
            # Apply content filter to user input
            if last_message_content:
                is_blocked, filter_response = content_filter.filter_message(last_message_content)
                if is_blocked:
                    logger.info("Content filter blocked a request for joke content")
                    return filter_response
            
            # Process with NeMo Guardrails if available
            if self.use_guardrails and last_message_content:
                try:
                    # Format messages for guardrails
                    guardrail_messages = []
                    for msg in messages:
                        if isinstance(msg, Dict):
                            sender = msg.get("sender", "unknown")
                            content = msg.get("content", "")
                        else:
                            sender = getattr(msg, "sender", "unknown")
                            content = getattr(msg, "content", "")
                        
                        if sender == "user":
                            guardrail_messages.append({"role": "user", "content": content})
                        else:
                            guardrail_messages.append({"role": "assistant", "content": content})
                    
                    # Get response through guardrails
                    guardrail_response = guardrails.generate_response(
                        messages=guardrail_messages,
                    )
                    
                    if guardrail_response:
                        logger.info("Response generated through NeMo Guardrails")
                        return guardrail_response["content"]
                    
                except Exception as e:
                    logger.error(f"Error using NeMo Guardrails: {str(e)}")
                    logger.info("Falling back to direct API call")
            
            # Create the prompt for the model
            prompt = f"""You are a helpful assistant specialized in medical topics.
            
Previous conversation:
{context}

Please provide a helpful, accurate, and friendly response to the last message. 
Respond directly without referring to yourself as an AI or mentioning that you're here to help.
Remember to avoid humor, jokes, or any non-medical content. Even if the user explicitly asks for a joke, you must refuse."""
            
            # Call OpenAI API
            if self.is_new_client:
                # New client version
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "system", "content": "You are a helpful assistant specializing in medical topics. Do not include jokes or humor in your responses. Never provide jokes even if explicitly asked."}, 
                              {"role": "user", "content": prompt}],
                    max_tokens=500
                )
                return response.choices[0].message.content.strip()
            else:
                # Old client version
                response = openai.ChatCompletion.create(
                    model=self.model,
                    messages=[{"role": "system", "content": "You are a helpful assistant specializing in medical topics. Do not include jokes or humor in your responses. Never provide jokes even if explicitly asked."}, 
                              {"role": "user", "content": prompt}],
                    max_tokens=500
                )
                return response['choices'][0]['message']['content'].strip()
                
        except Exception as e:
            logger.error(f"Error generating AI response: {str(e)}")
            return "I'm sorry, I'm having trouble processing your request. Please try again later."

    async def generate_improved_response(self, messages, original_response, feedback):
        """Generate an improved response based on user feedback"""
        try:
            # Extract just the content from messages for context
            message_texts = []
            for msg in messages:
                if isinstance(msg, Dict):
                    sender = msg.get("sender", "unknown")
                    content = msg.get("content", "")
                else:
                    sender = getattr(msg, "sender", "unknown")
                    content = getattr(msg, "content", "")
                
                message_texts.append(f"{sender.capitalize()}: {content}")
            
            context = "\n".join(message_texts)
            
            # Create the prompt for the model
            prompt = f"""You are a helpful assistant specialized in medical topics.

Previous conversation:
{context}

The following response was marked as not helpful by the user:
"{original_response}"

User feedback about why it wasn't helpful:
"{feedback}"

Please generate an improved response that addresses the user's concerns and feedback.
The improved response should be more accurate, helpful, and address the specific issues mentioned in the feedback.
Respond directly without referring to yourself as an AI or mentioning that you're here to help.
Remember to avoid humor, jokes, or any non-medical content. Even if the user explicitly asks for a joke, you must refuse."""
            
            # Call OpenAI API
            if self.is_new_client:
                # New client version
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant specializing in medical topics. Do not include jokes or humor in your responses. Never provide jokes even if explicitly asked."}, 
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=700
                )
                return response.choices[0].message.content.strip()
            else:
                # Old client version
                response = openai.ChatCompletion.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant specializing in medical topics. Do not include jokes or humor in your responses. Never provide jokes even if explicitly asked."}, 
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=700
                )
                return response['choices'][0]['message']['content'].strip()
                
        except Exception as e:
            logger.error(f"Error generating improved AI response: {str(e)}")
            return "I'm sorry, I'm having trouble processing your feedback request. Please try again later."

# Create a singleton instance
ai_model = AIModel() 