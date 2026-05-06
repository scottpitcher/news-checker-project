# news-checker-project

Clone the repository: git clone https://github.com/scottpitcher/news-checker-project
Navigate into the backend folder: cd news-checker-project/backend
Install dependencies: pip install -r requirements.txt
Create a .env file inside the /backend folder containing the following two lines:
OPENAI_API_KEY=your_openai_key_here
NEWS_API_KEY=your_newsapi_key_here
Start the Flask server: python app.py — keep this terminal window open, the server runs on localhost:5000
Open Google Chrome and navigate to chrome://extensions
Enable Developer Mode using the toggle in the top right corner
Click "Load unpacked" and select the /extension folder from the cloned repository
Pin the TweetCheck extension to your Chrome toolbar
Navigate to X/Twitter (x.com): a "Check" button will appear on tweets, click it to verify a claim
