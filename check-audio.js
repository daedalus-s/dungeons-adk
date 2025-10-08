// check-audio.js - Inspect audio file
import fs from 'fs';

const audioPath = './uploads/aragorn-goblin.wav';

if (fs.existsSync(audioPath)) {
  const buffer = fs.readFileSync(audioPath);
  
  console.log('Audio File Analysis:\n');
  console.log('File size:', (buffer.length / 1024).toFixed(2), 'KB');
  
  // Read WAV header
  if (buffer.toString('ascii', 0, 4) === 'RIFF') {
    console.log('Format: WAV âœ…');
    
    const sampleRate = buffer.readUInt32LE(24);
    const numChannels = buffer.readUInt16LE(22);
    const bitsPerSample = buffer.readUInt16LE(34);
    const audioFormat = buffer.readUInt16LE(20);
    
    console.log('Sample Rate:', sampleRate, 'Hz');
    console.log('Channels:', numChannels, numChannels === 1 ? '(Mono âœ…)' : '(Stereo - needs to be mono)');
    console.log('Bits per Sample:', bitsPerSample);
    console.log('Format Code:', audioFormat, audioFormat === 1 ? '(PCM âœ…)' : '(Not PCM - may need conversion)');
    
    console.log('\nðŸ“‹ For Google Speech-to-Text, we need:');
    console.log('   âœ… Sample Rate: 16000 Hz (or 8000, 32000, 44100, 48000)');
    console.log('   âœ… Channels: 1 (mono)');
    console.log('   âœ… Format: PCM (Linear16)');
    
    console.log('\nðŸ”§ Your file settings:');
    if (sampleRate !== 16000) {
      console.log('   âš ï¸  Sample rate needs conversion');
    }
    if (numChannels !== 1) {
      console.log('   âš ï¸  Needs to be converted to mono');
    }
    if (audioFormat !== 1) {
      console.log('   âš ï¸  Format may need conversion');
    }
    
  } else {
    console.log('Format: Not a WAV file');
    console.log('First 4 bytes:', buffer.toString('ascii', 0, 4));
  }
} else {
  console.log('âŒ File not found:', audioPath);
}
