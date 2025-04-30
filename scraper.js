require('dotenv').config(); //simplifies loading environment variables from a .env file into the process.env object.
const cheerio = require("cheerio"); //for parsing and manipulating HTML and XML on the server-side. It's essentially jQuery for Node.js. 
const fs = require("fs"); //for interacting with the file system

const TurndownService = require('turndown'); //convert HTML content into Markdown format
const path = require('path'); //for joining paths, normalizing paths, extracting directories, and more.
const puppeteer = require('puppeteer'); //headless Chrome or Chromium browser to automate browser tasks such as, Web scraping: Extracting data from websites.

const { logger, } = require('./logger');

const ua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.3";

const articleArray = []; //to store the upaths of the updated articles

//===============================

async function getArticles(webUrl) {
  try {
    const browser = await puppeteer.launch({
      headless: true, //headless:true to hide the browser
      defaultViewport: null,
      //executablePath: '/usr/bin/google-chrome',
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    let page = await browser.newPage();
    await page.setJavaScriptEnabled(true);
    await page.setUserAgent(ua);
    let pageResponse = await page.goto(webUrl);
    //console.log("pageResponse.status()", pageResponse.ok());
    let content = await page.content();
    let $ = cheerio.load(content);
    let articles = $(process.env.selector);
    //console.log("articles.length", articles.length);

    let maxReloadTime = 5;
    //In case puppeteer fails to read correctly the first time, it will try again at most 5 times
    while ((!pageResponse.ok() || articles.length < process.env.numArticles) && maxReloadTime > 0) {
      //console.log("reload page");
      maxReloadTime = maxReloadTime - 1;

      page = await browser.newPage();
      await page.setJavaScriptEnabled(true);
      await page.setUserAgent(ua);
      pageResponse = await page.goto(webUrl);
      content = await page.content();
      $ = cheerio.load(content);
      articles = $(process.env.selector);
      //console.log("articles.length", articles.length);
    }

    await browser.close();

    //==============================


    /*
    articles.each(function () //loop all
    {
      //const articleUrl = webUrl + $(this).find("a").attr("href"); //for <li class="promoted-articles-item">
      const articleUrl = $(this).attr("href"); //for <a class="kt-article" href="...">
      //console.log(articleUrl);
      await getArticle(articleUrl);
    });
    */

    //limit the number of articles to process
    const maxLength = articles.length >= process.env.numArticles ? process.env.numArticles : articles.length;
    //console.log("maxLength ", maxLength);

    for (let i = 0; i < maxLength; i++) {
      //const articleUrl = webUrl + $(articles[i]).find("a").attr("href"); //for <li class="promoted-articles-item">
      const articleUrl = $(articles[i]).attr("href"); //for <a class="kt-article" href="...">      
      //console.log("articleUrl", articleUrl);
      //console.log($(articles[i]));
      await getArticle(articleUrl);

    }

    const numArticleSkipped = maxLength - articleArray.length;
    logger.info(`${maxLength} articles processed. ${articleArray.length} articles uploaded. ${numArticleSkipped} skipped.`);
    return articleArray;

  } catch (error) {
    console.error(error);
  }

}

async function getArticle(webUrl) {
  try {


    //for puppeteer
    const browser = await puppeteer.launch({
      headless: true, //headless:true to hide the browser
      defaultViewport: null,
      //executablePath: '/usr/bin/google-chrome',
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    let page = await browser.newPage();
    await page.setJavaScriptEnabled(true);
    await page.setUserAgent(ua);
    let pageResponse = await page.goto(webUrl);
    //console.log("pageResponse.status()", pageResponse.ok());
    let content = await page.content();
    let $ = cheerio.load(content);
    //let articles = $(process.env.selector);
    //console.log("articles.length", articles.length);

    let maxReloadTime = 5;
    //In case puppeteer fails to read correctly the first time, it will try again at most 5 times
    while (!pageResponse.ok()) {
      console.log("reload page");
      //maxReloadTime = maxReloadTime - 1;

      page = await browser.newPage();
      await page.setJavaScriptEnabled(true);
      await page.setUserAgent(ua);
      pageResponse = await page.goto(webUrl);
      content = await page.content();
      $ = cheerio.load(content);
      //articles = $(process.env.selector);
    }

    await browser.close();

    //==============================

    //for axios //axios() somehow does not work in this case, use fetch() instead
    //const response = await axios.get(webUrl);      
    //const $ = cheerio.load(response.data); 
    //const response = await axios.get(webUrl, { headers: options.headers });
    //const $ = cheerio.load(response.data);

    //for fetch   
    /* 
    let response = await fetch(webUrl);    
    let data = await response.text();
    let $ = cheerio.load(data);
    */

    //In case the website is not read correctly due to error: Enable Javascript and Cookies to continue
    //we read it again and again
    /*
    while (!response.ok) {
      console.log("read the url again");
      //response = await fetch(webUrl);
      //data = await response.text();
      //$ = cheerio.load(data);

      response = await axios.get(webUrl, { headers: options.headers });
      $ = cheerio.load(response.data);
    }
    */

    // Clean up HTML (optional, but recommended)
    $('script, style, nav, footer, iframe, .ads').remove();

    const turndownService = new TurndownService({
      headingStyle: 'atx', //ATX Headers are defined in Markdown by placing hash signs followed by a space before the heading text.
      codeBlockStyle: 'fenced' //create fenced code blocks by placing triple backticks ``` before and after the code block.
    });

    const markdown = turndownService.turndown($.html()); //convert to markdown

    const mdFolder = process.env.mdFolder; // Directory to save Markdown files
    const fileName = getLastStringFromURL(webUrl);
    const fileNameWithoutExtension = path.parse(fileName).name;
    const fileNameMd = `${fileNameWithoutExtension}.md`;
    const outputPath = `${mdFolder}/${fileNameMd}`;
    //console.log(outputPath)

    // Check that the file exists locally
    if (!fs.existsSync(outputPath)) {
      //console.log("File not found");
      //Creates a new file and writes the provided data to it. 
      fs.writeFileSync(outputPath, markdown, 'utf-8');
      articleArray.push(fileNameMd);
    }
    else {
      console.log("File found");
      const existingFile = fs.readFileSync(outputPath, 'utf-8'); //read existing file
      const areEqual = compareMdFilesContent(existingFile, markdown); //compare the content of existing file and the markdown
      if (areEqual) {
        console.log('The files are identical.');
        //do nothing
      } else {
        console.log('The files are different.');
        //Overwrites the content of the file.
        fs.writeFileSync(outputPath, markdown, 'utf-8');
        articleArray.push(fileNameMd);
      }
    }

  } catch (error) {
    console.error(error);
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
    console.error('An error occurred:', error);
    return false;
  }
}

//===============================

module.exports = {
  scraper: getArticles,
};