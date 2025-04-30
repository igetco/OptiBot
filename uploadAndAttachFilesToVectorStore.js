//===Import the OpenAI library and configure it with your API key.

require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const { logger, } = require('./logger');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

//===Use uploadAndPoll for batch operations.

async function uploadFilesToVectorStore(vectorStoreId, fileNames) {
  try {
 
    if (fileNames.length <= 0) {
      //logger.info('Skip all files.');
      logger.info('0 new articles. 0 updated articles.');
      logger.info('--------------------');
      return;
    }

    //Before uploading updated files to Vector Store, delete them first

    const toBeDeletedList = [];
    const list = await openai.files.list();
    for await (const file of list) {
      if (fileNames.includes(file.filename)) {
        toBeDeletedList.push(file.id);
      }
    }

    let  numArticleUpdate = 0;

    for await (const fileId of toBeDeletedList) {
      await openai.files.del(fileId);
      //console.log(`Deleted file with ID: ${fileId}`);
      numArticleUpdate++;
    }

    //Upload and attach updated files

    const files = fileNames.map((fileName) => fs.createReadStream(process.env.MD_FOLDER + "/" + fileName));

    const response = await openai.vectorStores.fileBatches.uploadAndPoll(vectorStoreId, { 
      files: files,
    });

    const numArticleNew = response.file_counts.completed - numArticleUpdate;

    logger.info(`${numArticleNew} new articles. ${numArticleUpdate} updated articles.`);
    logger.info('--------------------');
    return response;
    
  } catch (error) {
    logger.error(error);    
  }

}

//===============================

module.exports = {
  uploadFilesToVectorStore: uploadFilesToVectorStore,
};