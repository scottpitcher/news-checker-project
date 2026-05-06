# news-checker-project

# TweetCheck — Setup & Usage

## Prerequisites
- Python 3.8+
- Google Chrome
- OpenAI API key ([platform.openai.com](https://platform.openai.com))
- NewsAPI key ([newsapi.org](https://newsapi.org))

## Installation

**1. Clone the repository**
```
git clone https://github.com/scottpitcher/news-checker-project
cd news-checker-project
```

**2. Install backend dependencies**
```
cd backend
pip install -r requirements.txt
```

**3. Configure environment variables**

Create a `.env` file inside the `/backend` folder with the following:
```
OPENAI_API_KEY=your_openai_key_here
NEWS_API_KEY=your_newsapi_key_here
```

**4. Start the Flask server**
```
python app.py
```
Keep this terminal running. The server starts on `localhost:5000`.

## Loading the Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer Mode** using the toggle in the top right corner
3. Click **Load unpacked** and select the `/extension` folder from the cloned repository
4. Pin the TweetCheck extension to your Chrome toolbar

## Usage

Navigate to X/Twitter (x.com). A **Check** button will appear on tweets — click it to verify the claim against trusted news sources.
