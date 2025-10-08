import mongoose from 'mongoose';
import { createClient } from 'redis';
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

async function testAllServices() {
  console.log('Testing all services...\n');

  // Test MongoDB
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('âœ… MongoDB: Connected');
    await mongoose.connection.close();
  } catch (error) {
    console.log('âŒ MongoDB: Failed -', error.message);
  }

  // Test Redis
  try {
    const redis = createClient({
      url: `redis://${config.redisHost}:${config.redisPort}`
    });
    await redis.connect();
    await redis.set('test', 'hello');
    const value = await redis.get('test');
    console.log('âœ… Redis: Connected');
    await redis.quit();
  } catch (error) {
    console.log('âŒ Redis: Failed -', error.message);
  }

  // Test Anthropic
  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey
    });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say hello!' }]
    });
    console.log('âœ… Anthropic: Connected');
    console.log('   Response:', message.content[0].text);
  } catch (error) {
    console.log('âŒ Anthropic: Failed -', error.message);
  }

  console.log('\nðŸŽ‰ All services ready!');
}

testAllServices();
