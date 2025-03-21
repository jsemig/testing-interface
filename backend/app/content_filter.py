"""
Custom content filter to block joke-related content in the chatbot.
This is a lightweight alternative to NeMo-Guardrails.
"""

import re
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ContentFilter:
    def __init__(self):
        # Patterns for detecting joke-related content
        self.joke_patterns = [
            r'\bjoke[s]?\b',
            r'\bfunny\b',
            r'\bhumor\b',
            r'\bcomedy\b',
            r'\blaugh\b',
            r'\bpun[s]?\b',
            r'\bjest\b',
            r'\bcomical\b',
            r'\bhilarious\b',
            r'\bhumorous\b',
            r'\bcomedy\b',
            r'\bentertain me\b',
            r'\bmake me laugh\b',
            r'\bstand[-\s]?up\b',
            r'\bhumor me\b',
            r'\btell me something funny\b',
            r'\bcheer me up\b',
            r'\btell me a joke\b',
            r'\bknow any jokes\b',
            r'\bgot any jokes\b',
            r'\bshare a joke\b'
        ]
        self.joke_pattern = re.compile('|'.join(self.joke_patterns), re.IGNORECASE)
        
        # Standard responses for blocked content
        self.joke_responses = [
            "I'm sorry, I'm designed to provide information on medical topics. I'm not able to share jokes or humor content. Is there a medical topic I can help you with instead?",
            "As a medical information assistant, I focus on providing helpful information on health and medical topics, not entertainment content like jokes. How can I assist you with a medical question instead?",
            "I'm programmed to focus on medical information rather than humor or jokes. Is there a medical topic you'd like to learn about?",
            "I don't provide jokes or humor content. I'm here to help with medical information and questions. What medical topic would you like to explore?"
        ]
    
    def contains_joke_request(self, text):
        """
        Check if the text contains a request for jokes or humor.
        
        Args:
            text (str): The text to check
            
        Returns:
            bool: True if the text contains a joke request, False otherwise
        """
        if self.joke_pattern.search(text):
            logger.info(f"Blocked joke content request: {text}")
            return True
        return False
    
    def get_joke_response(self):
        """
        Get a random response for joke requests.
        
        Returns:
            str: A response message for joke requests
        """
        import random
        return random.choice(self.joke_responses)
    
    def filter_message(self, message):
        """
        Filter a message and return appropriate response if it contains blocked content.
        
        Args:
            message (str): The message to filter
            
        Returns:
            tuple: (is_blocked, response). If is_blocked is True, response contains the
                  appropriate message to return. If False, response is None.
        """
        if self.contains_joke_request(message):
            return True, self.get_joke_response()
        
        return False, None

# Create a singleton instance
content_filter = ContentFilter() 