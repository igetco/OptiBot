require('dotenv').config(); //simplifies loading environment variables from a .env file into the process.env object.
const cheerio = require("cheerio"); //for parsing and manipulating HTML and XML on the server-side. It's essentially jQuery for Node.js. 
const fs = require("fs"); //for interacting with the file system

const TurndownService = require('turndown'); //convert HTML content into Markdown format
const path = require('path'); //for joining paths, normalizing paths, extracting directories, and more.
const puppeteer = require('puppeteer'); //headless Chrome or Chromium browser to automate browser tasks such as, Web scraping: Extracting data from websites.

const { logger, } = require('./logger');

//User-Agent string serves as an identifier sent within HTTP headers to communicate details about the client making a request.
const ua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.3";

let articlePaths = []; //to store the paths of the updated articles

//===============================

async function getArticles(webUrl) {
  try {
    //launch browser
    const browser = await puppeteer.launch({
      headless: true, //headless:true to hide the browser
      defaultViewport: null,
      executablePath: '/usr/bin/google-chrome',
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    let page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);
    await page.setJavaScriptEnabled(true);
    await page.setUserAgent(ua);
    let pageResponse = await page.goto(webUrl);
    let content = await page.content();
    let $ = cheerio.load(content);
    let articles = $(process.env.selector);

    let maxReloadTime = 20;
    //In case puppeteer fails to read correctly the first time, it will try again at most 5 times
    while ((!pageResponse.ok() || articles.length == 0) && maxReloadTime > 0) {
      console.log("retry");
      maxReloadTime = maxReloadTime - 1;
      //await page.reload();
      pageResponse = await page.goto(webUrl);
      content = await page.content();
      $ = cheerio.load(content);
      articles = $(process.env.selector);
    }

    //==============================

    //limit the number of articles to process
    const maxLength = articles.length >= process.env.numArticles ? process.env.numArticles : articles.length;
    articlePaths = []; //reset to empty
    let numArticleRead = 0;
    for (let i = 0; i < maxLength; i++) {
      //const articleUrl = webUrl + $(articles[i]).find("a").attr("href"); //for <li class="promoted-articles-item">
      const articleUrl = $(articles[i]).attr("href"); //for <a class="kt-article" href="..."> 
      numArticleRead++;   
      //console.log(articleUrl);      
      await getArticle(articleUrl, page, browser);
    }

    await browser.close(); //close browser

    const numArticleSkipped = numArticleRead - articlePaths.length; 
    logger.info('--------------------');
    logger.info(`${numArticleRead} articles read. ${numArticleSkipped} articles skipped.`);
    
    return articlePaths;

  } catch (error) {
    logger.error(error);
  }

}

async function getArticle(webUrl, page, browser) {
  try {
    await page.goto(webUrl);
    let content = await page.content();
    let $ = cheerio.load(content);

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