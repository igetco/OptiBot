//===Import the OpenAI library and configure it with your API key.

require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { logger, } = require('./logger');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

//===Use uploadAndPoll for batch operations.

async function uploadFilesToVectorStore(vectorStoreId, fileNames) {
  try {
 
    if (fileNames.length <= 0) {
      //logger.info('Skip all files.');
      logger.info('0 articles uploaded.');
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

    for await (const fileId of toBeDeletedList) {
      await openai.files.del(fileId);
      //console.log(`Deleted file with ID: ${fileId}`);
      
    }

    //Upload and attach updated files

    const files = fileNames.map((fileName) => fs.createReadStream(process.env.mdFolder + "/" + fileName));
    
    //upload and poll in batch
    /*
    const response = await openai.vectorStores.fileBatches.uploadAndPoll(vectorStoreId, { 
      files: files,
    });
    */

    let numArticleUploaded = 0;
    let numArticleUpdate = 0;
    
    //upload and poll one by one
    for await (const file of files) {
      const response = await openai.vectorStores.files.uploadAndPoll(vectorStoreId, file);

      if (response.status == 'completed') {
        numArticleUploaded++;

        const filename = path.basename(file.path);
        if(toBeDeletedList.includes(filename)) {
          numArticleUpdate++;
        }
      }
      
      //console.log("uploaded successfully", response); 
      /*Sample of response
      {
        id: 'file-KrwG2HxWE9twgj6js6x1Hz',
        object: 'vector_store.file',
        usage_bytes: 292860,
        created_at: 1746084032,
        vector_store_id: 'vs_680e6f716ea081919f7e6d354ce540aa',
        status: 'completed',
        last_error: null,
        chunking_strategy: {
          type: 'static',
          static: { max_chunk_size_tokens: 800, chunk_overlap_tokens: 400 }
        },
        attributes: {}
      }
      */
    }   
    const numArticleNew = numArticleUploaded - numArticleUpdate;

    logger.info(`${numArticleUploaded} articles uploaded successfully: ${numArticleNew} new articles, and ${numArticleUpdate} updated articles.`);
    logger.info('--------------------');
    
  } catch (error) {
    logger.error(error);    
  }

}

//===============================

module.exports = {
  uploadFilesToVectorStore: uploadFilesToVectorStore,
};