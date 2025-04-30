const cron = require('node-cron'); //simplifies scheduling background tasks in your applications. It excels at automating repetitive jobs such as sending emails, processing images, backing up databases, and more.

const { scraper, } = require('./scraper');
const { uploadFilesToVectorStore, } = require('./uploadAndAttachFilesToVectorStore');
const { logger, } = require('./logger');

//======================================

async function main() {

    try 
    {
        logger.info('Main started');
        const articleArray = await scraper(process.env.startUrl);
        console.log("articleArray", articleArray)
        if (articleArray) {
            uploadFilesToVectorStore(process.env.vectorStoreId, articleArray);
        }
    } 
    catch (error) 
    {
        console.log("main catch", error);
    }

}

main(); //run once at startup, then run the schedule below:

//For example, cron.schedule('0 0-23 * * *', () => { }, { timezone: 'America/Chicago' });
//minute(0-59) hour(0-23) dayOfMonth(1-31) month(1-12) dayOfWeek(1-7)

//cron.schedule('*/5 * * * *', // Schedule task to run every 5 minutes
cron.schedule('0 2 * * *', // Schedule task to run every day at specific time (e.g., 2:00 AM)
    main, { 
    scheduled: true,
    timezone: process.env.timezone
});

logger.info('Scraper scheduled to run daily.');
  