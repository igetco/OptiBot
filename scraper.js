require('dotenv').config(); //simplifies loading environment variables from a .env file into the process.env object.
const cheerio = require("cheerio"); //for parsing and manipulating HTML and XML on the server-side. It's essentially jQuery for Node.js. 
const fs = require("fs"); //for interacting with the file system

const TurndownService = require('turndown'); //convert HTML content into Markdown format
const path = require('path'); //for joining paths, normalizing paths, extracting directories, and more.
const puppeteer = require('puppeteer'); //provides an API to programmatically control Chrome or Chromium browser to automate browser tasks such as, Web scraping: Extracting data from websites.

const { logger, } = require('./logger');

//User-Agent string serves as an identifier sent within HTTP headers to communicate details about the client making a request.
const ua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.3";

const userAgentList = [
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.3',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36',
];

const headersList = [
  {
    'Accept-Language': 'en-US,en;q=0.9',
    'Upgrade-Insecure-Requests': '1',
  },
  {
    'Accept-Language': 'fr-FR,fr;q=0.9',
    'Upgrade-Insecure-Requests': '1',
  },
  {
    'Accept-Language': 'es-ES,es;q=0.9',
    'Upgrade-Insecure-Requests': '1',
  },
];

let articlePaths = []; //to store the paths of the updated articles

//===============================

async function getArticles(webUrl) {
  try {
    //launch browser
    const browser = await puppeteer.launch({
      headless: true, //headless:true to hide the browser
      defaultViewport: null,
      //executablePath: '/usr/bin/google-chrome', //not needed, just for reference
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);
    await page.setJavaScriptEnabled(true);
    //Rotate User-Agents
    const randomUserAgent = userAgentList[Math.floor(Math.random() * userAgentList.length)];
    await page.setUserAgent(randomUserAgent); 
    //Rotating Browser Headers
    const randomHeaders = headersList[Math.floor(Math.random() * headersList.length)];
    await page.setExtraHTTPHeaders(randomHeaders);

    //The 'networkidle2' option ensures that Puppeteer waits until there are no more than two network connections for at least 500 ms.
    //This is particularly useful for pages that load additional content dynamically.  
    //Without 'networkidle2' option, we cannot get all the dynamic contents.  
    //pages with dynamically loaded content may require multiple attempts and retries at intervals to retrieve all elements.
    let pageResponse = await page.goto(webUrl, { waitUntil: 'networkidle2' });
    let content = await page.content();
    let $ = cheerio.load(content);
    let articles = $(process.env.selector); //length for now is 800 articles

    //In case puppeteer fails to read correctly the first time, it will try again at most 5 times
    let maxReloadTime = 5;    
    while ((!pageResponse.ok() || articles.length < process.env.numArticles) && maxReloadTime > 0) {
      console.log("retry");
      maxReloadTime = maxReloadTime - 1;
      pageResponse = await page.goto(webUrl, { waitUntil: 'networkidle2' });
      content = await page.content();
      $ = cheerio.load(content);
      articles = $(process.env.selector);
    }
    
    //==============================

    //length for now is 800 articles; for testing, here we limit the number of articles to process to 30, specified in .env
    const maxLength = articles.length >= process.env.numArticles ? process.env.numArticles : articles.length;
    articlePaths = []; //reset to empty
    for (let i = 0; i < maxLength; i++) {
      //const articleUrl = webUrl + $(articles[i]).find("a").attr("href"); //for <li class="promoted-articles-item">
      const articleUrl = $(articles[i]).attr("href"); //for <a class="kt-article" href="...">  
      console.log((i+1), articleUrl);      
      await getArticle(articleUrl, page);
    }

    await browser.close(); //close browser

    const numArticleRead = maxLength;
    const numArticleSkipped = numArticleRead - articlePaths.length; 
    logger.info('--------------------');
    logger.info(`${numArticleRead} articles read: ${numArticleSkipped} articles skipped.`);
    
    return articlePaths;

  } catch (error) {
    logger.error(error);
  }

}

async function getArticle(webUrl, page) {
  try {
    let pageResponse = await page.goto(webUrl, { waitUntil: 'networkidle2' });
    let content = await page.content();
    let $ = cheerio.load(content);

    //In case puppeteer fails to read correctly the first time, it will try again at most 5 times
    let maxReloadTime = 5;    
    while ((!pageResponse.ok()) && maxReloadTime > 0) {
      console.log("retry");
      maxReloadTime = maxReloadTime - 1;
      pageResponse = await page.goto(webUrl, { waitUntil: 'networkidle2' });
      content = await page.content();
      $ = cheerio.load(content);
      articles = $(process.env.selector);
    }

    //==============================

    // Clean up HTML (optional, but recommended)
    $('script, style, nav, footer, iframe, .ads').remove();

    const turndownService = new TurndownService({
      headingStyle: 'atx', //ATX Headers are defined in Markdown by placing hash signs followed by a space before the heading text.
      codeBlockStyle: 'fenced' //create fenced code blocks by placing triple backticks ``` before and after the code block.
    });

    const markdown = turndownService.turndown($.html()); //convert to markdown

    const MD_FOLDER = process.env.mdFolder; // Directory to save Markdown files
    const fileName = getLastStringFromURL(webUrl);
    const fileNameWithoutExtension = path.parse(fileName).name;
    const fileNameMd = `${fileNameWithoutExtension}.md`;
    const outputPath = `${MD_FOLDER}/${fileNameMd}`;

    // Check that the file exists locally
    if (!fs.existsSync(outputPath)) {
      //Creates a new file and writes the provided data to it. 
      fs.writeFileSync(outputPath, markdown, 'utf-8');
      articlePaths.push(fileNameMd);
    }
    else {
      const existingFile = fs.readFileSync(outputPath, 'utf-8'); //read existing file
      const areEqual = compareMdFilesContent(existingFile, markdown); //compare the content of existing file and the markdown
      if (areEqual) {
        //console.log('The files are identical.');
        //do nothing
      } else {
        //console.log('The files are different.');
        //Overwrites the content of the file.
        fs.writeFileSync(outputPath, markdown, 'utf-8');
        articlePaths.push(fileNameMd);
      }
    }

  } catch (error) {
    logger.error(error);
  }

}

//===============================
//Helper functions

function getLastStringFromURL(url) {
  const urlObject = new URL(url);
  const pathSegments = urlObject.pathname.split('/');
  const lastSegment = pathSegments.pop();
  return lastSegment;
}

function compareMdFilesContent(file1Content, file2Content) {
  try {
    return file1Content === file2Content;
  } catch (error) {
    logger.error(error);
    return false;
  }
}

//===============================

module.exports = {
  scraper: getArticles,
};