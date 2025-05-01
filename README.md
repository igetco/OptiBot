# About
This is the OptiSigns – OptiBot Mini-Clone project. It tries to duplicate the OptiBot, the customer-support bot for OptiSigns.com. This bot will answer queries based on the contents of the files we upload to it.

## Set up

Clone the project. Then add `.env` to your project root folder, and update the following variables accordingly:

```
startUrl=https://support.optisigns.com
selector=.kt-article
mdFolder=output/md
numArticles=30
timezone=America/Chicago
APP_LOG=app.log

OPENAI_API_KEY=***
ASSISTANT_ID=***
vectorStoreId=***
```

## How to run

CD to your project root folder, and run the below command to install the packages
```
npm install
```

Run server
```
npm start
```

# Project Explanation

## Folder structure

    .
    ├── output                                  # folder containing the output md files
    ├── app.log                                 # log file
    ├── Dockerfile                              # used for dockerization, will be used in Digital Ocean
    ├── logger.js                               # used for logging    
    ├── main.js                                 # main entry
    ├── scraper.js                              # scrape and save md files to folder output
    ├── uploadAndAttachFilesToVectorStore.js    # upload and attach files to OpenAI
    ├── package-lock.json   
    ├── package.json   
    ├── .gitignore    
    └── README.md

## App flow

We use CRON to schedule the main.js to run once daily. main.js calls scraper.js and uploadAndAttachFilesToVectorStore.js. scraper.js scrapes and generates md files, then uploadAndAttachFilesToVectorStore.js will upload new/updated files to OpenAI Vector Store. We will check and skip any file that has no change.

## Chunking strategy

Here, we use Automatic Chunking. When uploading a file to the OpenAI Assistant, the system automatically breaks it down into chunks, and each chunk is then automatically transformed into a numerical vector representation, also known as an embedding. 

