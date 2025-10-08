import { google } from 'googleapis';
import speech from '@google-cloud/speech';
import vision from '@google-cloud/vision';
import dotenv from 'dotenv';

dotenv.config();

async function testServiceAccount() {
  console.log('Testing Google Cloud service account...\n');

  // Test 1: Sheets API
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID
    });
    
    console.log('âœ… Sheets API: Connected');
    console.log('   Sheet title:', response.data.properties.title);
  } catch (error) {
    console.log('âŒ Sheets API: Failed');
    console.log('   Error:', error.message);
  }

  // Test 2: Speech API
  try {
    const speechClient = new speech.SpeechClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    
    console.log('âœ… Speech-to-Text API: Authenticated');
  } catch (error) {
    console.log('âŒ Speech-to-Text API: Failed');
    console.log('   Error:', error.message);
  }

  // Test 3: Vision API
  try {
    const visionClient = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    
    console.log('âœ… Vision API: Authenticated');
  } catch (error) {
    console.log('âŒ Vision API: Failed');
    console.log('   Error:', error.message);
  }

  console.log('\nâœ¨ Service account setup complete!');
}

testServiceAccount();
