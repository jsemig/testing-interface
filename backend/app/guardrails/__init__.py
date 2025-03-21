from nemoguardrails import LLMRails, RailsConfig
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_guardrails():
    """
    Initialize and return the NeMo-Guardrails configuration.
    """
    try:
        # Get the directory of the current file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Path to the guardrails config directory
        config_dir = os.path.join(current_dir, "config")
        
        # Load the rails configuration from the config directory
        config = RailsConfig.from_path(config_dir)
        
        # Initialize the rails with the configuration
        rails = LLMRails(config)
        
        logger.info("NeMo Guardrails successfully initialized")
        return rails
    except Exception as e:
        logger.error(f"Failed to initialize NeMo Guardrails: {str(e)}")
        # Return None in case of error, so the application can handle this gracefully
        return None

# Create a singleton instance
guardrails = get_guardrails() 