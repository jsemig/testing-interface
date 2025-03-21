# World's Shortest Hackathon at GTC 

This is a full-stack chat application that consists of:
- MongoDB database for storing conversations
- FastAPI backend for handling chat logic (Python 3.12)
- React frontend with Bootstrap styling for the user interface
- MongoDB Express web interface for database management
- NVIDIA Llama-3.3-Nemotron model for AI-powered chat responses
- Admin dashboard for conversation management
- Custom content filter for blocking joke-related queries

## Features

- Real-time chat interface with a bot
- AI-powered responses using NVIDIA's Llama-3.3-Nemotron model
- Conversation persistence in MongoDB
- Session management with UUID
- Modern UI with Bootstrap styling
- Admin dashboard to view and manage conversations
- Message rating system for bot responses (thumbs up/down with feedback)
- AI-powered improved responses based on user feedback
- Export quality conversations as JSONL for data analysis
- Dockerized environment for easy deployment
- Custom content filter for blocking joke-related queries

## Setup and Running

### Prerequisites
- Docker and Docker Compose installed on your system
- Git for cloning the repository

### Running the Application

1. Clone the repository
2. Navigate to the project directory
3. Run the following command to start all services:

```bash
docker-compose up --build
```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - MongoDB Express UI: http://localhost:8081

### API Endpoints

- `POST /api/conversations`: Start a new conversation
- `POST /api/messages`: Send a message to the bot
- `GET /api/conversations/{conversation_id}`: Get a conversation by ID
- `POST /api/messages/rate`: Rate a bot message (thumbs up/down with feedback)

## Content Safety with Custom Filter

The application uses a custom content filter to ensure appropriate conversation topics:

1. Filtering user inputs that request jokes or humor content
2. Using regex pattern matching to detect joke-related queries
3. Providing informative rejections that guide users back to appropriate medical topics
4. Instructing the AI model to avoid humor in all responses

The content filter implementation can be found in `backend/app/content_filter.py` and can be easily extended to block additional types of content by adding more patterns.

## Development

### Backend
The backend is built with FastAPI and uses MongoDB for data storage. To modify the backend:
1. Edit files in the `backend/app` directory
2. Rebuild the Docker container with `docker-compose up --build`

### Frontend
The frontend is built with React and uses Bootstrap for styling. To modify the frontend:
1. Edit files in the `frontend/src` directory
2. Rebuild the Docker container with `docker-compose up --build`

## Project Structure

```
├── docker-compose.yml    # Docker Compose configuration
├── backend/              # FastAPI backend
│   ├── app/              # Backend Python code
│   │   ├── main.py       # FastAPI application
│   │   └── ai_model.py   # NVIDIA AI model integration
│   ├── Dockerfile        # Backend Docker configuration
│   └── requirements.txt  # Python dependencies
└── frontend/             # React frontend
    ├── public/           # Static assets
    ├── src/              # React components and styles
    ├── Dockerfile        # Frontend Docker configuration
    ├── package.json      # JavaScript dependencies
    └── nginx.conf        # Nginx configuration
```

### Application Routes

- `/`: Main chat interface for users
- `/admin`: Admin dashboard for viewing and managing all conversations

## Admin Dashboard Features

- View all conversations
- See detailed message history for each conversation
- Rate bot responses with thumbs up/down
- Provide feedback for unhelpful responses
- Automatically generate improved responses for unhelpful messages
- Choose between the original and improved responses
- Exclude low-quality conversations from data exports
- Download filtered conversations in JSONL format for data analysis or backup

## AI-Powered Response Improvement

The application includes an intelligent feedback loop to enhance the quality of responses:

1. When a user rates a bot response as unhelpful, they provide feedback explaining why
2. The system uses this feedback to generate an improved response using the AI model
3. The admin is presented with both original and improved responses
4. If the improved response is better, it can replace the original in the conversation
5. If neither response is satisfactory, the entire conversation can be marked as negative
6. Negative conversations are automatically excluded from data exports
7. This creates a quality filter for training data, ensuring only good conversations are exported
