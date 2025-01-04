import fs from 'fs'; 
import csv from 'csv-parser';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { json2csv } from 'json-2-csv';
import timestamp from 'time-stamp';
const execPromise = promisify(exec);

export const getJsonDataFromCsv = (filePath) => {
    return new Promise( (resolve) => {
        let jsonData = [];
        fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
            jsonData.push(data);
        })
        .on('end',function() {
            resolve(jsonData);
        });
    })
}
export const bulkInsertToSalesforce = (filePath, sObject, orgAlias) => {
    return new Promise((resolve, reject) => {
        console.log('Starting bulk insert to Salesforce...');
        console.log('Creating ingest job...');
        execPromise(`sf data import bulk -f ${filePath} -s ${sObject} -o ${orgAlias} --json`)
        .then(result => {
            let dataImportBulkResponse = JSON.parse(result.stdout);
            console.log('Job Process Id: ', dataImportBulkResponse.result.jobId);
            execPromise(`sf data import resume --job-id ${dataImportBulkResponse.result.jobId} --json`)
            .then(() => {
                console.log('Bulk insert to Salesforce completed.');
                console.log('Getting insert results...');
                execPromise(`sf data bulk results --job-id ${dataImportBulkResponse.result.jobId} --json -o ${orgAlias} --json`)
                .then((result) => {
                    console.log('Bulk insert results: ', JSON.parse(result.stdout));
                    resolve(JSON.parse(result.stdout));
                })
            })
            .catch(error => {
                console.log('ERROR Job processing: ', error);
                reject(JSON.parse(error.stdout));
            });
        })
        .catch(error => {
            console.log('ERROR Creating ingest job: ', error);
            reject(JSON.parse(error.stdout));
        });
    })
}

export const runAnonymousApexScript = (filePathOfApexScript, orgAlias) => {
    return new Promise((resolve, reject) => {
        console.log('Executing Anonymous Script...');
        execPromise(`sf apex run -f ${filePathOfApexScript} -o ${orgAlias} --json`)
        .then(result => {
            console.log('Execution Complete.');
            resolve(JSON.parse(result.stdout)); 
        })
        .catch(error => {
            console.log('ERROR Executing Script: ', error);
            reject(JSON.parse(error.stdout));
        });
    })
}

export const createCsvFileFromJson = (jsonData) => {
    return new Promise( (resolve, reject) => {
        console.log('Transforming data to csv format...');
        const csv = json2csv(jsonData);
        console.log('Creating CSV File...');
        let fileName = `${timestamp('YYYYMMDD-HHmmss')}.csv`;
        fs.writeFile(fileName, csv, (error) => {
            console.log('File Created: ', fileName);
            return (error) ? reject(error) : resolve(fileName);
        })
    })
}


export const insertJsonDataToSalesforce = (jsonData, sObject, orgAlias) => {
    return new Promise(async (resolve, reject) => {
        let csvFile = await createCsvFileFromJson(jsonData);
        bulkInsertToSalesforce(csvFile, sObject, orgAlias)
        .then((result) => {
            resolve(result);
        })
        .catch((error) => {
            reject(error);
        })
    })
}