# About
This is a simple project for OptiSigns – OptiBot Mini-Clone.

## Set up

1. Add `.env` to your project root folder, and update the following variables accordingly:

```
startUrl=https://support.optisigns.com
selector=.kt-article
mdFolder=output/md
numArticles=30
timezone=America/Chicago

OPENAI_API_KEY=***
ASSISTANT_ID=***
vectorStoreId=***
```

## How to run

Install packages
```
npm install
```

Run server
```
node start
```

# Project Explanation

## Folder structure

    .
    ├── output                                  # folder containing the output md files
    ├── Dockerfile                              # used for dockerization, will be used in Digital Ocean
    ├── main.js                                 # main entry
    ├── scraper.js                              # scrape and save md files to folder output
    ├── uploadAndAttachFilesToVectorStore.js    # upload and attach files to OpenAI
    ├── package-lock.json   
    ├── package.json   
    ├── .gitignore    
    └── README.md

    