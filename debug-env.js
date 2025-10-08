import dotenv from 'dotenv';

// Load .env
const result = dotenv.config();

console.log('=== dotenv Debug ===\n');
console.log('Config result:', result.error ? 'ERROR' : 'SUCCESS');
if (result.error) {
  console.log('Error:', result.error);
}

console.log('\n=== Environment Variables ===');
console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
console.log('ANTHROPIC_API_KEY length:', process.env.ANTHROPIC_API_KEY?.length);
console.log('ANTHROPIC_API_KEY value:', process.env.ANTHROPIC_API_KEY);

console.log('\n=== .env File Location ===');
console.log('Current directory:', process.cwd());
console.log('.env path:', `${process.cwd()}\\.env`);
